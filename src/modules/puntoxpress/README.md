# Módulo PuntoXpress

## Descripción

Módulo de integración para **PuntoXpress** (sistema de cobro externo). Permite a integradores (agentes de cobro externos) autenticarse, buscar facturas pendientes de clientes y aplicar o anular pagos a través de una API REST y un endpoint legacy compatible con la API PHP anterior.

**Ruta base:** `/puntoxpress`

## Arquitectura

Este módulo está **completamente separado** del módulo `auth` de usuarios internos:
- JWT Secret separado (`JWT_SECRET_PUNTOXPRESS`, fallback a `JWT_SECRET`)
- Estrategia Passport separada (`jwt-puntoxpress`)
- Modelo Prisma dedicado (`puntoxpress_integrador`, tabla SQL: `punto_express_integrador`)
- Controlador legacy para compatibilidad con la API PHP anterior (`api_newtel_punto_express`)

## Estructura del Módulo

```
puntoxpress/
├── puntoxpress.module.ts            # Módulo principal
├── puntoxpress.service.ts           # Lógica de negocio (búsquedas, pagos, anulaciones)
├── puntoxpress-auth.service.ts      # Autenticación de integradores
├── puntoxpress.controller.ts        # Controlador REST principal
├── puntoxpress-legacy.controller.ts # Controlador legacy (compatibilidad API PHP)
├── README.md                        # Esta documentación
│
├── strategies/
│   └── jwt-puntoxpress.strategy.ts  # Estrategia JWT para integradores
│
├── guards/
│   └── puntoxpress-auth.guard.ts    # Guard de autenticación
│
├── decorators/
│   ├── puntoxpress-auth.decorator.ts # @PuntoXpressAuth()
│   └── get-integrador.decorator.ts   # @GetIntegrador()
│
├── dto/
│   ├── auth-puntoxpress.dto.ts       # Login
│   ├── aplicar-pago.dto.ts           # Aplicar pago
│   ├── anular-pago.dto.ts            # Anular pago
│   ├── busqueda-nombre.dto.ts        # Búsqueda por nombre
│   ├── legacy-request.dto.ts         # Request legacy multipropósito
│   └── index.ts                      # Barrel export
│
└── interfaces/
    ├── jwt-puntoxpress-payload.interface.ts  # Payload JWT
    ├── factura-puntoxpress.interface.ts       # Respuesta normalizada de factura
    └── index.ts                              # Barrel export
```

## Modelo de Datos (Prisma)

### Tabla `punto_express_integrador`

Almacena credenciales y configuración de cada integrador externo.

```prisma
model puntoxpress_integrador {
  id_integrador   Int       @id @default(autoincrement())
  nombre          String
  usuario         String    @unique
  password_hash   String
  activo          Boolean   @default(true)
  fecha_creacion  DateTime  @default(now())

  @@map("punto_express_integrador")  // mantiene nombre de tabla SQL existente
}
```

### Entidades relacionadas (existentes)

- `facturaDirecta` — Facturas del sistema
- `cuenta_por_cobrar` (CXC) — Cuentas por cobrar vinculadas a facturas
- `abono_cxc` — Pagos/abonos aplicados a CXC
- `caja_movimiento` — Movimientos de caja
- `cliente` — Clientes del ISP

## Endpoints

### REST API (controlador principal)

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| POST | `/auth` | No | Login de integrador |
| GET | `/facturas/correlativo/:correlativo` | Sí | Buscar facturas por número de factura |
| GET | `/facturas/cliente/:idCliente` | Sí | Buscar facturas por código de cliente |
| GET | `/facturas/dui/:dui` | Sí | Buscar facturas por DUI del cliente |
| GET | `/facturas/nombre?nombre=X` | Sí | Buscar facturas por nombre (min 3 chars, max 50 resultados) |
| POST | `/pagos` | Sí | Aplicar pago a una factura |
| DELETE | `/pagos/:idPago/anular` | Sí | Anular un pago previamente aplicado |

### Legacy API (compatibilidad)

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| POST | `/legacy` | Varía | Endpoint único que enruta por campo `metodo` |

## Uso de Decoradores

### @PuntoXpressAuth()

Protege un endpoint requiriendo autenticación de integrador.

```typescript
@Get('facturas/dui/:dui')
@PuntoXpressAuth()
async buscarPorDui(@Param('dui') dui: string) {
  return this.service.buscarPorDui(dui);
}
```

Aplica automáticamente:
- `AuthGuard('jwt-puntoxpress')`
- Documentación Swagger de Bearer Auth
- Documentación de respuesta 401

### @GetIntegrador()

Obtiene datos del integrador autenticado del request.

```typescript
// Obtener todo el integrador
@GetIntegrador() integrador

// Obtener solo una propiedad
@GetIntegrador('id_integrador') id: number
@GetIntegrador('nombre') nombre: string
```

## Variables de Entorno

```env
# Secret separado para JWT de integradores (fallback: JWT_SECRET)
JWT_SECRET_PUNTOXPRESS=un_secreto_diferente

# ID del usuario del sistema para registrar transacciones (default: '1')
PORTAL_SYSTEM_USER_ID=1

# Habilitar activación automática de clientes suspendidos al saldar deuda (default: 'false')
PUNTOXPRESS_AUTO_ACTIVACION=false
```

## Flujo de Autenticación

1. Integrador envía `POST /puntoxpress/auth` con `usuario` y `contrasena`
2. Se valida que el integrador existe y está activo
3. Se verifica contraseña con bcrypt
4. Se genera JWT con payload `{ id_integrador, nombre, type: 'puntoxpress' }` (1h expiración)
5. Se retorna `{ estado: 'OK', token, duracion: 3600 }`
6. Integrador incluye token en header `Authorization: Bearer <token>` en llamadas subsecuentes
7. En cada request, la estrategia JWT valida token, tipo, y que el integrador siga activo

## Flujo de Pago

1. Integrador envía `POST /puntoxpress/pagos` con `{ id_cxc, monto, colector, referencia? }`
2. Se valida que la CXC exista y esté en estado `PENDIENTE`, `PAGADA_PARCIAL` o `VENCIDA`
3. Se verifica que el monto no exceda el `saldo_pendiente`
4. **Dentro de transacción:**
   - Se valida regla de **factura más antigua primero** (la CXC debe ser la más antigua pendiente del cliente)
   - Se re-obtiene la CXC para evitar datos obsoletos (concurrencia)
   - Se crea registro `abono_cxc` con `metodo_pago: 'EFECTIVO'` y observaciones `[PuntoXpress: {colector}]`
   - Se crea movimiento de caja (`caja_movimiento`)
   - Se actualiza estado de CXC (`PAGADA_TOTAL` o `PAGADA_PARCIAL`)
   - Se actualiza `estado_pago` de la factura (`PAGADO` o `PARCIAL`)
   - Si `PUNTOXPRESS_AUTO_ACTIVACION=true`, verifica activación automática del cliente
5. Se registra log de auditoría `PUNTOXPRESS_PAGO`
6. Se retorna `{ estado: 'OK', mensaje: 'Pago aplicado con éxito', id_pago }`

## Flujo de Anulación

1. Integrador envía `DELETE /puntoxpress/pagos/:idPago/anular` con `{ motivo }`
2. Se valida que el pago exista, esté activo, y sea un pago PuntoXpress (`[PuntoXpress:` o `[Punto Express:` en observaciones, para compatibilidad con pagos anteriores)
3. Se verifica que la CXC asociada no esté anulada
4. **Dentro de transacción:**
   - Se marca el abono como inactivo
   - Se recalcula CXC: `saldo_pendiente += monto`, `total_abonado -= monto`
   - Se actualiza estado de CXC (`PENDIENTE` o `PAGADA_PARCIAL`)
   - Se actualiza `estado_pago` de la factura
5. Se registra log de auditoría `PUNTOXPRESS_ANULAR_PAGO`
6. Se retorna `{ estado: 'OK', mensaje: 'Pago anulado con éxito' }`

## Búsquedas

Los 4 tipos de búsqueda retornan un arreglo normalizado `FacturaPuntoXpress[]`:

```typescript
interface FacturaPuntoXpress {
  id_factura: number;
  numero_factura: string;
  fecha_vencimiento: string;
  periodo_facturado: string;
  monto: number;
  saldo_pendiente: number;
  cliente: string;
  codigo_cliente: number;
  vencida: boolean;
  estado_factura: string;
}
```

| Tipo | Parámetro | Notas |
|------|-----------|-------|
| Por correlativo | `correlativo` (string) | Busca por número de factura |
| Por código cliente | `idCliente` (number) | Ordena por fecha ascendente |
| Por DUI | `dui` (string) | Busca todos los clientes con ese DUI |
| Por nombre | `nombre` (string, min 3 chars) | Case-insensitive, límite 50 resultados |

Solo se retornan facturas con CXC en estado `PENDIENTE`, `PAGADA_PARCIAL` o `VENCIDA`.

## Compatibilidad Legacy

El endpoint `POST /puntoxpress/legacy` replica el comportamiento de la API PHP anterior (`api_newtel_punto_express`). Acepta un body JSON con campo `metodo` que determina la operación:

| Método | Campos requeridos |
|--------|-------------------|
| `Autenticacion` | `usuario`, `contrasena` |
| `BusquedaCorrelativo` | `token`, `correlativo` |
| `BusquedaCodigoCliente` | `token`, `codigo_cliente` |
| `BusquedaDUI` | `token`, `dui` |
| `BusquedaNombre` | `token`, `nombre` |
| `AplicarPago` | `token`, `id_cxc`, `monto`, `colector` |
| `AnularPago` | `token`, `id_pago`, `motivo` |

**Códigos de respuesta legacy:**

| Código | Significado |
|--------|-------------|
| `0` | Éxito |
| `1` | Error de autorización |
| `2` | Error de validación |
| `3` | Método no reconocido |
| `99` | Error interno |

La validación de token en el controlador legacy se realiza manualmente (no usa guards de Passport) para mantener compatibilidad con el formato de request/response original.

## Activación Automática

Cuando `PUNTOXPRESS_AUTO_ACTIVACION=true`:
- Después de aplicar un pago, si el cliente está en estado `SUSPENDIDO`
- Y ya no tiene CXC pendientes (todas pagadas)
- El sistema cambia automáticamente el estado del cliente a `ACTIVO`
- Se registra un log de la activación

## Reglas de Negocio

1. **Factura más antigua primero**: Un pago solo puede aplicarse a la CXC más antigua pendiente del cliente. Si se intenta pagar una factura más reciente teniendo una anterior pendiente, se rechaza.
2. **Solo efectivo**: Todos los pagos se registran con `metodo_pago: 'EFECTIVO'`.
3. **Observaciones con colector**: El campo observaciones del abono incluye `[PuntoXpress: {nombre_colector}]` para identificar pagos de este canal.
4. **Solo pagos PuntoXpress anulables**: La anulación verifica que el pago tenga la marca `[PuntoXpress:` o `[Punto Express:` en observaciones (compatibilidad con pagos anteriores al rename).
5. **Precisión decimal**: Montos con máximo 2 decimales, mínimo `0.01`.
6. **Concurrencia**: Se re-obtiene la CXC dentro de la transacción para evitar race conditions.

## Logs de Auditoría

| Acción | Descripción |
|--------|-------------|
| `PUNTOXPRESS_PAGO` | Pago aplicado exitosamente |
| `PUNTOXPRESS_ANULAR_PAGO` | Pago anulado con motivo |

Los logs incluyen el `id_integrador` para trazabilidad del agente de cobro.

## Dependencias

- `PrismaModule` — Acceso a base de datos
- `ConfigModule` — Variables de entorno
- `@nestjs/passport` — Autenticación
- `@nestjs/jwt` — Generación y validación de tokens
- `passport-jwt` — Estrategia JWT
- `bcrypt` — Hash de contraseñas

## Notas de Desarrollo

- El módulo reutiliza `PORTAL_SYSTEM_USER_ID` (mismo que el portal de clientes) como usuario del sistema para registrar transacciones
- La estrategia JWT usa el nombre `'jwt-puntoxpress'` para no colisionar con las estrategias `jwt` (usuarios internos) y `jwt-cliente` (portal de clientes)
- El token JWT expira en 1 hora (configurado en el módulo)
- El controlador legacy envuelve excepciones HTTP en respuestas con código numérico para compatibilidad
- La validación de factura más antigua se realiza dentro de la transacción para prevenir condiciones de carrera
