# Módulo de Cobranza y Recuperación de Mora

> **Estado:** Funcional — MVP desplegado en dev y probado end-to-end.
> **Backend:** NestJS · **Frontend:** Angular (standalone components)
> **Última actualización:** 2026-04-08

Este módulo agrega al ERP AFIS un flujo de **gestión humana de cobranza**: segmenta facturas vencidas por antigüedad, las asigna a gestores de cobro mediante Round Robin y registra el seguimiento tipo CRM (llamadas, WhatsApp, visitas, promesas de pago).

---

## 1. Contexto y alcance

**Problema original:** El sistema ya calculaba mora (recargos) vía `MoraService`, pero no existía un flujo para:
- Segmentar facturas vencidas por antigüedad.
- Asignar morosos a gestores específicos.
- Registrar las acciones de seguimiento del gestor.
- Medir la recuperación por ciclo.

**Alcance cubierto en este MVP:**
- ✅ Segmentación por buckets: 1-30, 31-60, 61-90, 91+ días.
- ✅ Distribución Round Robin entre N gestores seleccionados.
- ✅ Vista "Mis Gestiones" filtrada por gestor logueado.
- ✅ Timeline de notas con 5 tipos de contacto.
- ✅ Dashboard de recuperación con KPIs y gráficos.
- ✅ Reasignación y cierre de asignaciones (PAGADA / INCOBRABLE).
- ✅ Permisos granulares con auditoría.

**Decisiones clave tomadas con el usuario:**
| Pregunta | Decisión |
|---|---|
| ¿Cómo identificar al "Gestor de Cobro"? | Cualquier usuario activo por ahora; validación por permiso/rol será agregada después. |
| ¿A qué nivel se asignan los morosos? | Por `facturaDirecta` individual (granular). |
| Fuente de facturas vencidas | Tabla `facturaDirecta` filtrada por `estado_pago` ∈ {PENDIENTE, VENCIDA, PARCIAL} y `fecha_vencimiento < hoy`. |

---

## 2. Base de datos

### 2.1 Nuevos modelos Prisma

Archivo: `afis-bk/prisma/schema.prisma` (final del archivo).

#### `cobranza_asignacion`
Vincula una `facturaDirecta` vencida con un usuario gestor en el contexto de un ciclo.

```prisma
model cobranza_asignacion {
  id_asignacion        Int      @id @default(autoincrement())
  id_factura_directa   Int
  id_ciclo             Int
  id_gestor            Int
  id_usuario_asignador Int
  estado               estado_asignacion_cobranza @default(ACTIVA)
  bucket_inicial       bucket_mora
  fecha_asignacion     DateTime @default(now())
  fecha_cierre         DateTime?
  motivo_cierre        String?  @db.Text
  // índices por gestor+estado, ciclo, estado, factura
}
```

#### `cobranza_nota`
Timeline de seguimiento (cascade delete con la asignación).

```prisma
model cobranza_nota {
  id_nota        Int      @id @default(autoincrement())
  id_asignacion  Int
  tipo           tipo_nota_cobranza
  descripcion    String   @db.Text
  fecha_promesa  DateTime?     // solo PROMESA_PAGO
  monto_promesa  Decimal?      // solo PROMESA_PAGO
  id_usuario     Int
  fecha_creacion DateTime @default(now())
}
```

#### Enums
```prisma
enum estado_asignacion_cobranza { ACTIVA REASIGNADA CERRADA_PAGADA CERRADA_INCOBRABLE }
enum bucket_mora                 { DIAS_1_30 DIAS_31_60 DIAS_61_90 DIAS_91_MAS }
enum tipo_nota_cobranza          { CONTACTO_WHATSAPP LLAMADA_REALIZADA VISITA_TECNICA PROMESA_PAGO OTRO }
```

#### Relaciones inversas agregadas
- `usuarios.cobranza_asignaciones_gestor`, `cobranza_asignaciones_creadas`, `cobranza_notas`
- `atcCicloFacturacion.cobranzaAsignaciones`
- `facturaDirecta.cobranzaAsignaciones`

### 2.2 Migración

```bash
cd afis-bk
npx prisma migrate dev --name add_cobranza_module
npx prisma generate
```

Migración generada: `20260407205038_add_cobranza_module`.

### 2.3 ⚠️ Nota de integridad
El modelo `cobranza_asignacion` **NO** tiene `@@unique` en `[id_factura_directa, estado]`. La lógica de "una sola asignación ACTIVA por factura" se garantiza a nivel de servicio (verificar en `distribuir` y `reasignar`). Si quieres reforzarlo a nivel de BD hay que usar un índice parcial (PostgreSQL: `CREATE UNIQUE INDEX ... WHERE estado = 'ACTIVA'`).

---

## 3. Backend (NestJS)

### 3.1 Estructura de archivos

```
afis-bk/src/modules/facturacion/cobranza/
├── README.md                     (este archivo)
├── cobranza.controller.ts        11 endpoints
├── cobranza.service.ts           Lógica de negocio
├── helpers/
│   └── bucket-mora.helper.ts     calcularBucket, calcularDiasAtraso, rangoFechasBucket
└── dto/
    ├── index.ts                  Barrel export
    ├── facturas-vencidas-query.dto.ts
    ├── distribuir-asignaciones.dto.ts
    ├── crear-nota.dto.ts
    ├── mis-asignaciones-query.dto.ts
    ├── reasignar.dto.ts
    └── cerrar-asignacion.dto.ts
```

Registrado en `afis-bk/src/modules/facturacion/facturacion.module.ts`:
- `CobranzaController` en `controllers`
- `CobranzaService` en `providers`

### 3.2 Helper de buckets

`helpers/bucket-mora.helper.ts`:

| Función | Descripción |
|---|---|
| `calcularBucket(fecha, hoy?)` | Devuelve el `bucket_mora` a partir de `fecha_vencimiento`. |
| `calcularDiasAtraso(fecha, hoy?)` | Días vencidos (0 si aún no vence). |
| `rangoFechasBucket(bucket, hoy?)` | Devuelve `{gte, lte}` para filtros Prisma eficientes (evita filtrar en memoria). |
| `ALL_BUCKETS` | Constante con los 4 buckets en orden. |

**Zona horaria:** usa `getInicioDiaElSalvador()` y `diasEntreFechasElSalvador()` de `src/common/helpers/dates.helper.ts` — consistente con `MoraService`.

### 3.3 Endpoints

Prefijo: `/facturacion/cobranza`. Todos protegidos con `@Auth()` + `@RequirePermissions()`.

| # | Método | Ruta | Permiso | Descripción |
|---|---|---|---|---|
| 1 | GET  | `/ciclos/:id/resumen-mora` | `facturacion.cobranza:ver` | Resumen por bucket: cantidad_facturas, monto_total, cantidad_clientes, cantidad_asignadas, cantidad_sin_asignar + totales. |
| 2 | GET  | `/ciclos/:id/facturas-vencidas` | `facturacion.cobranza:ver` | Lista paginada. Query: `bucket`, `asignado=true\|false`, `id_gestor`, `search`, `page`, `limit`. Devuelve factura + cliente + contrato + asignación activa + `dias_atraso` + `bucket_actual`. |
| 3 | GET  | `/ciclos/:id/dashboard` | `facturacion.cobranza:ver` | KPIs: mora_total, mora_recuperada, %, facturas_por_bucket, top_gestores. |
| 4 | GET  | `/gestores` | `facturacion.cobranza:ver` | Usuarios activos candidatos + conteo de asignaciones activas. |
| 5 | POST | `/ciclos/:id/distribuir` | `facturacion.cobranza:asignar` | Distribuye Round Robin. Body: `{id_gestores[], buckets?[], solo_sin_asignar=true, estrategia='ROUND_ROBIN'}`. |
| 6 | POST | `/asignaciones/:id/reasignar` | `facturacion.cobranza:asignar` | Cierra la actual como `REASIGNADA`, crea una nueva `ACTIVA`. |
| 7 | POST | `/asignaciones/:id/cerrar` | `facturacion.cobranza:asignar` | Estado: `CERRADA_PAGADA` o `CERRADA_INCOBRABLE`. |
| 8 | GET  | `/mis-asignaciones` | `facturacion.cobranza:ver_propias` | Asignaciones `ACTIVA` del usuario logueado. Query: `id_ciclo`, `bucket`, `search`. |
| 9 | GET  | `/asignaciones/:id` | `facturacion.cobranza:ver` | Detalle completo con cliente, contrato, gestor, asignador y timeline de notas. |
| 10 | GET  | `/asignaciones/:id/notas` | `facturacion.cobranza:ver` | Timeline de notas ordenado desc. |
| 11 | POST | `/asignaciones/:id/notas` | `facturacion.cobranza:gestionar` | Crear nota. Body: `{tipo, descripcion, fecha_promesa?, monto_promesa?}`. `PROMESA_PAGO` exige las dos últimas. |

### 3.4 Lógica de distribución Round Robin

`CobranzaService.distribuir()`:
1. Valida que todos los `id_gestores` existan y estén activos.
2. Construye filtro Prisma con `whereFacturasVencidasCiclo()` + opcional `solo_sin_asignar`.
3. Carga facturas ordenadas por `fecha_vencimiento ASC` (prioriza más antiguas).
4. Si se especificaron `buckets`, filtra en memoria con `calcularBucket()`.
5. Asigna con `id_gestores[idx % id_gestores.length]`.
6. Transacción Prisma: si `solo_sin_asignar=false`, marca las previas como `REASIGNADA` y crea las nuevas.
7. Registra `logAction('COBRANZA_DISTRIBUIR')` para auditoría.
8. Devuelve `{id_ciclo, total_asignadas, por_gestor[]}`.

### 3.5 Validación de permisos sobre notas

`crearNota()` exige que `id_gestor === id_usuario` (el gestor solo puede registrar sobre sus propias asignaciones). **Excepción:** administradores (`id_rol === 1`) hacen bypass. Se verifica contra la BD en lugar de confiar en un claim.

### 3.6 Permisos agregados al seed

Archivo: `afis-bk/prisma/seeds/permisos/permisos.data.ts` (bloque después de `facturacion.cobros`):

| Código | Nombre | Auditoría |
|---|---|---|
| `facturacion.cobranza:ver` | Ver Gestión de Cobranza | — |
| `facturacion.cobranza:ver_propias` | Ver Mis Gestiones | — |
| `facturacion.cobranza:asignar` | Asignar/Reasignar Morosos | ✅ |
| `facturacion.cobranza:gestionar` | Registrar Notas de Seguimiento | — |

Ejecutar tras cambios: `npm run seed:permisos` (281 permisos totales).

---

## 4. Frontend (Angular)

### 4.1 Estructura de archivos

```
afis/src/app/components/facturacion/cobranza/
├── asignacion-mora/               Admin: distribuir morosos
│   ├── asignacion-mora.component.ts
│   ├── asignacion-mora.component.html
│   └── asignacion-mora.component.scss
├── mis-gestiones/                 Gestor: listado de asignaciones propias
│   ├── mis-gestiones.component.ts
│   ├── mis-gestiones.component.html
│   └── mis-gestiones.component.scss
├── seguimiento-detalle/           CRM: timeline + nueva nota + cerrar
│   ├── seguimiento-detalle.component.ts
│   ├── seguimiento-detalle.component.html
│   └── seguimiento-detalle.component.scss
└── dashboard-recuperacion/        KPIs + gráficos ApexCharts
    ├── dashboard-recuperacion.component.ts
    ├── dashboard-recuperacion.component.html
    └── dashboard-recuperacion.component.scss
```

Servicio compartido: `afis/src/app/shared/services/cobranza.service.ts`
- Métodos espejo de los 11 endpoints
- Interfaces `BucketMora`, `TipoNotaCobranza`, `ResumenBucket`, etc.
- Constantes `BUCKET_META` y `TIPO_NOTA_META` (etiqueta, color, icono por valor)

### 4.2 Rutas registradas

Archivo: `afis/src/app/components/facturacion/facturacion.routes.ts`

| Ruta | Componente | Permiso |
|---|---|---|
| `/facturacion/cobranza/ciclos/:id/asignacion` | AsignacionMoraComponent | `facturacion.cobranza:ver` |
| `/facturacion/cobranza/ciclos/:id/dashboard` | DashboardRecuperacionComponent | `facturacion.cobranza:ver` |
| `/facturacion/cobranza/mis-gestiones` | MisGestionesComponent | `facturacion.cobranza:ver_propias` |
| `/facturacion/cobranza/asignaciones/:id` | SeguimientoDetalleComponent | `facturacion.cobranza:ver` |

### 4.3 Puntos de entrada en la UI

1. **Tabla de ciclos** (`ciclos.component.html`): se agregaron 2 botones por fila protegidos con `*hasPermission`:
   - 🟡 "Asignar Mora" → `asignacion-mora`
   - 🟢 "Mis Gestiones" → `mis-gestiones?id_ciclo=:id`

2. **Sidebar** (`shared/services/navservice.ts`): nuevo enlace "Mis Gestiones de Cobro" bajo "Ciclos de Facturación".

3. **Dentro de `asignacion-mora`:** botón "Dashboard de Recuperación".

### 4.4 Características UX destacadas

- **Cards de buckets** con color escalado (verde → rojo) y badge especial `PRIORIDAD CORTE` en `DIAS_91_MAS`.
- **Selección visual de gestores** con checkboxes en tabla clickeable.
- **Preview pre-distribución** con SweetAlert mostrando el conteo estimado por gestor.
- **Timeline** reutilizando estilos ya existentes en el proyecto — color e icono por `tipo_nota_cobranza`, box especial para promesas de pago con monto + fecha.
- **Formulario condicional:** al seleccionar `PROMESA_PAGO` aparecen dinámicamente `fecha_promesa` y `monto_promesa` con validadores condicionales.
- **Botones de contacto directo:** `tel:` y `https://wa.me/503...` en la vista de seguimiento.
- **Gráficos ApexCharts** en el dashboard: donut (recuperado vs pendiente) + barras horizontales por bucket.

### 4.5 Patrones reutilizados

| Patrón | Fuente |
|---|---|
| Tabla paginada + filtros con debounce | `ciclos.component.ts` |
| Modal FormBuilder + SweetAlert2 loading | `ciclos.component.ts` |
| `*hasPermission` directiva | `shared/directives/has-permission.directive.ts` |
| Timeline SCSS | `orden-detail.component` + `_custom.scss` |
| ApexCharts setup | `dashboards/sales/sales.component.ts` |
| `AuthService.currentUserValue` | patrón estándar del proyecto |

---

## 5. Pruebas end-to-end realizadas

Backend (con `reynaldo.ruiz@ixcnet.com` contra `http://localhost:4001`):

| Endpoint | Resultado |
|---|---|
| `GET /ciclos/1/resumen-mora` | 3864 facturas vencidas, $94,230.22 · 4 buckets poblados |
| `POST /ciclos/1/distribuir` con 3 gestores, bucket `DIAS_1_30` | 133 facturas → 45/44/44 (Round Robin equitativo) ✅ |
| `GET /facturas-vencidas?asignado=true&id_gestor=20` | Filtro devuelve 45 ✅ |
| `POST /asignaciones/1/notas` con `CONTACTO_WHATSAPP` | 201 ✅ |
| `POST .../notas` con `PROMESA_PAGO` sin campos | 400 validación condicional ✅ |
| `POST .../notas` con `PROMESA_PAGO` completa | 201 ✅ |
| `POST /asignaciones/:id/reasignar` | Cierra previa como REASIGNADA + nueva ACTIVA ✅ |
| `POST /asignaciones/:id/cerrar` | `CERRADA_PAGADA` / `CERRADA_INCOBRABLE` ✅ |
| `GET /ciclos/1/dashboard` | KPIs + top_gestores calculados ✅ |
| Swagger `/api-json` | 11 rutas cobranza registradas ✅ |

Frontend: `ng build --configuration development` → bundle limpio sin warnings.

---

## 6. Limitaciones conocidas / Deuda técnica

### 6.1 Modelo de datos
- ❗ **No hay constraint de unicidad** para "una asignación ACTIVA por factura" — solo se valida a nivel de servicio. Puede romperse bajo condiciones de carrera si se hacen dos distribuciones concurrentes.
- Los totales del dashboard (`mora_recuperada`) se basan en el snapshot vigente de `facturaDirecta.total + monto_mora` al momento de la consulta, no en el monto histórico al momento de la asignación.
- No se persiste la fecha-hora de "última nota" como campo calculado — se resuelve con `take: 1, orderBy: fecha_creacion desc` en cada query (bien para volúmenes actuales, potencial problema de N+1 a escala).

### 6.2 Lógica de negocio
- Cualquier usuario activo aparece en `getGestores()`. No hay filtro por rol "Gestor de Cobro" ni por permiso `facturacion.cobranza:gestionar` (por decisión temporal del usuario).
- La distribución Round Robin es "greedy simple": no considera carga actual del gestor, historial de efectividad, ubicación geográfica ni zona de rutas.
- No hay notificación al gestor cuando se le asigna un nuevo moroso.
- No hay cierre automático de asignaciones cuando la factura se paga (debería gatillarse desde `cxc`/`abonos`).
- El dashboard trata `mora_pendiente === mora_total` (no resta lo recuperado al vivo porque ese ya no aparece como vencido).

### 6.3 UI/UX
- No hay exportación a Excel/PDF de las asignaciones.
- No hay vista de "histórico" de asignaciones cerradas del ciclo (solo las activas).
- La tabla de gestores en `asignacion-mora` no es paginada (asume ~30 usuarios).
- No hay filtro "promesas de pago vencidas" en `mis-gestiones` (un gestor debería poder ver sus promesas incumplidas rápido).
- El formulario de nueva nota no permite adjuntar archivos/fotos (evidencia de visita).
- No hay confirmación visual cuando la asignación pasa de un bucket a otro (ej. de 30 a 31 días).

### 6.4 Permisos
- Falta `facturacion.cobranza:gestionar_todas` para supervisores que necesiten registrar notas sobre cualquier asignación (actualmente solo admin con `id_rol=1` puede).

---

## 7. Mejoras propuestas (roadmap sugerido)

### Prioridad alta
1. **Filtrar gestores por permiso/rol** — Cambiar `getGestores()` para devolver solo usuarios con permiso `facturacion.cobranza:gestionar` o rol "Gestor de Cobro".
2. **Cierre automático de asignaciones** — Hook en `cxc`/`abonos` para detectar cuando una `facturaDirecta` pasa a `PAGADO` y cerrar la asignación activa como `CERRADA_PAGADA`.
3. **Constraint de unicidad parcial** en BD: `CREATE UNIQUE INDEX cobranza_asig_factura_activa ON cobranza_asignacion(id_factura_directa) WHERE estado = 'ACTIVA';`
4. **Notificaciones push/email** al gestor cuando recibe una nueva distribución.
5. **Vista de promesas de pago** en `mis-gestiones` con alerta de promesas vencidas (tipo `PROMESA_PAGO` con `fecha_promesa < hoy` y asignación aún activa).

### Prioridad media
6. **Distribución ponderada** por carga actual del gestor (no solo equitativa por cantidad sino equilibrando carga existente).
7. **Histórico de asignaciones cerradas** — Vista/tab que liste las `REASIGNADA`, `CERRADA_PAGADA`, `CERRADA_INCOBRABLE` del ciclo con filtro por gestor.
8. **Exportación** Excel/PDF de las asignaciones por ciclo y por gestor (reutilizar `AbonosReportService` como referencia).
9. **Evidencias/archivos adjuntos** en las notas de seguimiento — integrar con `MinioService` para upload de fotos de visita o comprobantes.
10. **Métricas de efectividad por gestor** — tiempo promedio de recuperación, % conversión de promesas cumplidas, monto recuperado/día.

### Prioridad baja
11. **Asignación por cliente** en lugar de por factura (opción configurable): todas las facturas vencidas del mismo cliente caen al mismo gestor.
12. **Integración con WhatsApp oficial** — registrar automáticamente una nota `CONTACTO_WHATSAPP` cuando el gestor envía un mensaje desde el módulo `whatsapp-chat`.
13. **Recordatorios automáticos de promesas** — 1 día antes de `fecha_promesa` enviar notificación al gestor.
14. **Dashboard ejecutivo multi-ciclo** — comparar la efectividad entre ciclos.
15. **Guía/onboarding** en la UI para nuevos gestores (tooltips explicando buckets y flujo).

---

## 8. Cómo continuar el desarrollo

### 8.1 Agregar un nuevo endpoint

1. Crear DTO en `cobranza/dto/` con `class-validator` + Swagger.
2. Exportar en `dto/index.ts`.
3. Agregar método público en `CobranzaService`.
4. Agregar handler en `CobranzaController` con `@RequirePermissions()` + decoradores Swagger.
5. Agregar método espejo en `afis/src/app/shared/services/cobranza.service.ts`.

### 8.2 Agregar un nuevo campo a la asignación

1. Editar `schema.prisma` y ejecutar `npx prisma migrate dev --name ...`.
2. Ajustar el `select`/`include` en `CobranzaService` donde aplique.
3. Actualizar los mapeos de salida (`enriched` en `getFacturasVencidas` y `getMisAsignaciones`).
4. Actualizar el template del componente y las interfaces del servicio frontend.

### 8.3 Agregar un nuevo tipo de nota

1. Agregar valor al enum `tipo_nota_cobranza` en `schema.prisma` → migrar.
2. Actualizar `CrearNotaDto` (array en `@IsEnum`) y tipo TS `TipoNotaCobranza` en el servicio frontend.
3. Agregar entrada en `TIPO_NOTA_META` (color + icono + label).
4. Si necesita campos condicionales, replicar el patrón de `PROMESA_PAGO` en DTO (`@ValidateIf`) y en el form reactivo del frontend.

### 8.4 Referencias útiles

- **Plan original:** `~/.claude/plans/snug-napping-map.md`
- **Helper de fechas TZ El Salvador:** `src/common/helpers/dates.helper.ts`
- **Patrón de auditoría:** `prisma.logAction(accion, id_usuario, detalle)`
- **Directiva de permisos frontend:** `shared/directives/has-permission.directive.ts`
- **Servicio de gestión de mora existente (recargos):** `services/mora.service.ts`
- **Swagger UI:** `http://localhost:4001/api`

---

## 9. Contactos y credenciales de prueba

- **Usuario admin:** `reynaldo.ruiz@ixcnet.com` / `Abcd1234!@`
- **Backend dev:** `http://localhost:4001`
- **Frontend dev:** `http://localhost:4200`
- **Swagger:** `http://localhost:4001/api`
- **Prisma Studio:** `npx prisma studio` (desde `afis-bk/`)

### Ciclo de prueba con datos reales
- Ciclo 1 tiene ~3864 facturas vencidas distribuidas en los 4 buckets, ideal para probar distribuciones y dashboards sin preparar fixtures.

---

**Fin del documento.**
Si vas a ejecutar cambios relevantes, actualiza la sección "Estado" al inicio y agrega una entrada en "Limitaciones conocidas" o "Mejoras propuestas" según aplique.
