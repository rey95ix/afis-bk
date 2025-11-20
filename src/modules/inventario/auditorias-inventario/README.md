# Módulo de Auditorías de Inventario

## Descripción General

El módulo de **Auditorías de Inventario** permite realizar conteos físicos de inventario, compararlos con las cantidades del sistema, identificar discrepancias, generar ajustes con workflow de autorización y aplicarlos al inventario. Incluye evidencias fotográficas, snapshots históricos y métricas de precisión.

## Características Principales

✅ **Tipos de Auditoría**:
- Auditorías Completas: Conteo total de bodega/estante
- Auditorías Sorpresa: Conteos no programados

✅ **Workflow Completo**:
1. Planificar auditoría → Iniciar conteo → Registrar conteos físicos → Escanear series → Finalizar → Revisar discrepancias → Generar ajustes → Autorizar → Aplicar al inventario

✅ **Evidencias Fotográficas**:
- Integración con MinIO para almacenamiento
- Tipos: ESTANTE, PRODUCTO, GENERAL, DISCREPANCIA

✅ **Ajustes con Autorización**:
- TODOS los ajustes requieren autorización de supervisor
- Trazabilidad completa: solicitud → autorización → aplicación
- Generación automática de movimientos de inventario

✅ **Snapshots Históricos**:
- Fotografía del estado del inventario post-auditoría
- Útil para análisis histórico y reportes contables

✅ **Métricas y Dashboard**:
- Accuracy de inventario (% conformidad)
- Valor de discrepancias por período
- Productos con discrepancias recurrentes

✅ **Escaneo Individual de Series**:
- Validación uno a uno de equipos serializados
- Detección de ubicaciones incorrectas

---

## Estructura de Archivos

```
auditorias-inventario/
├── dto/
│   ├── create-auditoria.dto.ts          # Crear/planificar auditoría
│   ├── update-auditoria.dto.ts          # Actualizar auditoría
│   ├── filter-auditoria.dto.ts          # Filtros para listar auditorías
│   ├── iniciar-conteo.dto.ts            # Iniciar conteo físico
│   ├── registrar-conteo.dto.ts          # Registrar conteos de productos
│   ├── escanear-serie.dto.ts            # Escanear serie individual
│   ├── finalizar-auditoria.dto.ts       # Finalizar auditoría
│   ├── upload-evidencia.dto.ts          # Subir evidencia fotográfica
│   ├── create-ajuste.dto.ts             # Generar ajustes
│   ├── autorizar-ajuste.dto.ts          # Autorizar/rechazar ajuste
│   ├── filter-ajuste.dto.ts             # Filtros para listar ajustes
│   ├── query-metricas.dto.ts            # Consultar métricas
│   └── index.ts                         # Barrel export
├── auditorias-inventario.service.ts     # Lógica de negocio ✅
├── auditorias-inventario.controller.ts  # Endpoints REST ✅
├── auditorias-inventario.module.ts      # Módulo NestJS ✅
└── CLAUDE.md                            # Este archivo
```

**Estado del Módulo**: ✅ **Backend 100% Implementado**
- Service: 18 métodos públicos
- Controller: 17 endpoints REST
- Module: Registrado en InventarioModule
- DTOs: Todos implementados con validaciones

---

## ⚠️ IMPORTANTE: Formato de Respuestas API

**Todas las respuestas de los endpoints** son automáticamente envueltas por el `TransformInterceptor` global.

### Estructura Real de Respuesta

Cuando un endpoint retorna un objeto como:
```typescript
// Respuesta del Service/Controller
{
  auditorias: [...],
  meta: { total: 100, page: 1, limit: 10, totalPages: 10 }
}
```

**El cliente (frontend) recibirá:**
```typescript
{
  data: {
    auditorias: [...],
    meta: { total: 100, page: 1, limit: 10, totalPages: 10 }
  },
  status: true,
  msg: "Success"
}
```

### Regla de Oro

**❌ NUNCA envolver manualmente en `data`** en los services/controllers.

**✅ El interceptor lo hace automáticamente** para TODAS las respuestas exitosas.

### Ejemplos

**Ejemplo 1: Listado paginado**
```typescript
// Service retorna
return {
  auditorias,  // Array de auditorías
  meta: { total, page, limit, totalPages }
};

// Cliente recibe
{
  data: {
    auditorias: [...],
    meta: {...}
  },
  status: true,
  msg: "Success"
}
```

**Ejemplo 2: Objeto único**
```typescript
// Service retorna
return auditoria;  // Objeto Auditoria

// Cliente recibe
{
  data: auditoria,  // El objeto directo
  status: true,
  msg: "Success"
}
```

**Ejemplo 3: Respuesta compleja (finalizar-y-aplicar)**
```typescript
// Service retorna
return {
  auditoria: {...},
  ajustes_aplicados: [...],
  movimientos_generados: [...],
  resumen: {...}
};

// Cliente recibe
{
  data: {
    auditoria: {...},
    ajustes_aplicados: [...],
    movimientos_generados: [...],
    resumen: {...}
  },
  status: true,
  msg: "Success"
}
```

**Ubicación del interceptor:**
- `src/common/intersectors/transformar.interceptor.ts`
- Registrado globalmente en `main.ts`
- Ver `src/common/CLAUDE.md` para más detalles

---

## Modelos de Base de Datos

### Enums

#### `tipo_auditoria`
```prisma
enum tipo_auditoria {
  COMPLETA   // Conteo total de bodega/estante
  SORPRESA   // Conteo no programado
}
```

#### `estado_auditoria`
```prisma
enum estado_auditoria {
  PLANIFICADA          // Auditoría creada, pendiente de iniciar
  EN_PROGRESO          // Conteo en curso
  PENDIENTE_REVISION   // Finalizada, pendiente de revisar discrepancias
  COMPLETADA           // Completada y revisada
  CANCELADA            // Cancelada
}
```

#### `tipo_discrepancia`
```prisma
enum tipo_discrepancia {
  FALTANTE   // Cantidad física < sistema
  SOBRANTE   // Cantidad física > sistema
  CONFORME   // Cantidad física = sistema
}
```

#### `causa_discrepancia`
```prisma
enum causa_discrepancia {
  ROBO
  MERMA
  ERROR_REGISTRO
  ERROR_CONTEO
  DANO
  OTRO
  PENDIENTE_INVESTIGACION
}
```

#### `estado_ajuste`
```prisma
enum estado_ajuste {
  PENDIENTE_AUTORIZACION  // Esperando aprobación
  AUTORIZADO              // Aprobado, pendiente de aplicar
  RECHAZADO               // Rechazado por supervisor
  APLICADO                // Aplicado al inventario
  CANCELADO               // Cancelado
}
```

#### `tipo_snapshot`
```prisma
enum tipo_snapshot {
  AUDITORIA    // Generado automáticamente post-auditoría
  MENSUAL      // Snapshot mensual programado
  TRIMESTRAL   // Snapshot trimestral
  ANUAL        // Snapshot anual
  MANUAL       // Generado manualmente
}
```

---

### Tablas Principales

#### `auditorias_inventario`
Cabecera de auditoría.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id_auditoria` | Int | PK, autoincrement |
| `codigo` | String | Código único: AUD-YYYYMM-#### |
| `tipo` | tipo_auditoria | COMPLETA o SORPRESA |
| `estado` | estado_auditoria | Estado actual |
| `id_bodega` | Int | FK → bodegas |
| `id_estante` | Int? | FK → estantes (opcional) |
| `incluir_todas_categorias` | Boolean | Si audita todas las categorías |
| `categorias_a_auditar` | String? | JSON array de IDs de categorías |
| `id_usuario_planifica` | Int | FK → usuarios (quien creó) |
| `id_usuario_ejecuta` | Int? | FK → usuarios (quien ejecuta) |
| `fecha_planificada` | DateTime? | Fecha planificada |
| `fecha_inicio` | DateTime? | Fecha real de inicio |
| `fecha_fin` | DateTime? | Fecha real de fin |
| `total_items_auditados` | Int | Total de productos contados |
| `total_items_conformes` | Int | Items sin discrepancia |
| `total_items_con_discrepancia` | Int | Items con discrepancia |
| `valor_total_discrepancias` | Decimal | Valor monetario total |
| `porcentaje_accuracy` | Decimal | % de precisión (conformes/total) |
| `observaciones` | String? | Notas generales |

**Relaciones:**
- `bodega` → bodegas
- `estante` → estantes
- `usuario_planifica` → usuarios
- `usuario_ejecuta` → usuarios
- `detalle` → auditorias_detalle[]
- `evidencias` → auditorias_evidencias[]
- `ajustes` → ajustes_inventario[]
- `snapshot` → snapshots_inventario?

---

#### `auditorias_detalle`
Detalle de auditoría por producto.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id_auditoria_detalle` | Int | PK |
| `id_auditoria` | Int | FK → auditorias_inventario |
| `id_catalogo` | Int | FK → catalogo |
| `cantidad_sistema` | Int | **Stock según sistema** |
| `cantidad_reservada_sistema` | Int | Stock reservado según sistema |
| `costo_promedio_sistema` | Decimal | Costo promedio al momento del conteo |
| `cantidad_fisica` | Int? | **Cantidad contada físicamente** |
| `fue_contado` | Boolean | Si ya se contó este producto |
| `discrepancia` | Int? | física - sistema |
| `discrepancia_valor` | Decimal? | discrepancia * costo_promedio |
| `porcentaje_discrepancia` | Decimal? | % de desviación |
| `tipo_discrepancia` | tipo_discrepancia? | FALTANTE/SOBRANTE/CONFORME |
| `causa_probable` | causa_discrepancia? | Causa identificada |
| `requiere_investigacion` | Boolean | Si discrepancia > 10% |
| `observaciones_conteo` | String? | Notas del contador |
| `id_usuario_conteo` | Int? | FK → usuarios |
| `fecha_conteo` | DateTime? | Fecha/hora del conteo |

**Relaciones:**
- `auditoria` → auditorias_inventario
- `catalogo` → catalogo
- `usuario_conteo` → usuarios
- `series` → auditorias_series[]

**Índice único:** `[id_auditoria, id_catalogo]`

---

#### `auditorias_series`
Series individuales escaneadas durante auditoría.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id_auditoria_serie` | Int | PK |
| `id_auditoria_detalle` | Int | FK → auditorias_detalle |
| `numero_serie` | String | Número de serie escaneado |
| `encontrado_fisicamente` | Boolean | Si se encontró físicamente |
| `existe_en_sistema` | Boolean | Si existe en BD |
| `estado_en_sistema` | estado_inventario? | Estado según BD |
| `ubicacion_esperada_bodega` | Int? | Bodega donde debería estar |
| `ubicacion_real_bodega` | Int? | Bodega donde se encontró |
| `observaciones` | String? | Notas |
| `fecha_escaneo` | DateTime | Fecha/hora del escaneo |

---

#### `auditorias_evidencias`
Evidencias fotográficas.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id_evidencia` | Int | PK |
| `id_auditoria` | Int | FK → auditorias_inventario |
| `tipo` | String | ESTANTE/PRODUCTO/GENERAL/DISCREPANCIA |
| `titulo` | String? | Título de la evidencia |
| `descripcion` | String? | Descripción |
| `nombre_archivo` | String | Nombre original del archivo |
| `ruta_archivo` | String | Ruta en MinIO |
| `mimetype` | String | Tipo MIME |
| `size` | Int | Tamaño en bytes |
| `id_catalogo` | Int? | Producto relacionado (opcional) |
| `id_usuario_subida` | Int | FK → usuarios |
| `fecha_subida` | DateTime | Fecha/hora de subida |

---

#### `ajustes_inventario`
Ajustes de inventario post-auditoría.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id_ajuste` | Int | PK |
| `codigo` | String | Código único: AJU-YYYYMM-#### |
| `id_auditoria` | Int? | FK → auditorias_inventario |
| `id_auditoria_detalle` | Int? | FK → auditorias_detalle |
| `id_catalogo` | Int | FK → catalogo |
| `id_bodega` | Int | FK → bodegas |
| `id_estante` | Int? | FK → estantes |
| `cantidad_anterior` | Int | Cantidad antes del ajuste |
| `cantidad_ajuste` | Int | +/- ajuste |
| `cantidad_nueva` | Int | Cantidad después del ajuste |
| `costo_unitario` | Decimal? | Costo promedio |
| `motivo` | tipo_movimiento | AJUSTE_INVENTARIO |
| `motivo_detallado` | String | Descripción del ajuste |
| `tipo_discrepancia` | tipo_discrepancia? | FALTANTE/SOBRANTE |
| `causa_discrepancia` | causa_discrepancia? | Causa identificada |
| `estado` | estado_ajuste | Estado del ajuste |
| `id_usuario_solicita` | Int | FK → usuarios |
| `id_usuario_autoriza` | Int? | FK → usuarios |
| `observaciones_autorizacion` | String? | Notas del autorizador |
| `motivo_rechazo` | String? | Si fue rechazado |
| `fecha_solicitud` | DateTime | Fecha de solicitud |
| `fecha_autorizacion` | DateTime? | Fecha de autorización/rechazo |
| `fecha_aplicacion` | DateTime? | Fecha de aplicación al inventario |
| `id_movimiento_generado` | Int? | FK → movimientos_inventario |
| `documentos_soporte` | String? | JSON array de URLs |

---

#### `snapshots_inventario`
Fotografías del estado del inventario.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id_snapshot` | Int | PK |
| `codigo` | String | Código único: SNP-YYYYMM-#### |
| `tipo` | tipo_snapshot | AUDITORIA/MENSUAL/ANUAL/MANUAL |
| `periodo` | String? | "YYYY-MM" |
| `descripcion` | String? | Descripción |
| `id_auditoria` | Int? | FK → auditorias_inventario (único) |
| `id_bodega` | Int? | FK → bodegas |
| `total_items` | Int | Total de productos |
| `total_cantidad` | Int | Cantidad total de unidades |
| `valor_total_inventario` | Decimal? | Valor monetario total |
| `fecha_snapshot` | DateTime | Fecha de creación |
| `creado_por` | Int | FK → usuarios |

**Relaciones:**
- `auditoria` → auditorias_inventario
- `bodega` → bodegas
- `usuario_creador` → usuarios
- `detalle` → snapshots_detalle[]

---

#### `snapshots_detalle`
Detalle de snapshot por producto.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id_snapshot_detalle` | Int | PK |
| `id_snapshot` | Int | FK → snapshots_inventario |
| `id_catalogo` | Int | Producto |
| `id_bodega` | Int | Bodega |
| `id_estante` | Int? | Estante |
| `cantidad_disponible` | Int | Stock disponible |
| `cantidad_reservada` | Int | Stock reservado |
| `cantidad_total` | Int | disponible + reservada |
| `costo_promedio` | Decimal | Costo promedio |
| `valor_total` | Decimal | cantidad_total * costo_promedio |

---

#### `metricas_inventario`
Métricas agregadas de auditorías.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id_metrica` | Int | PK |
| `periodo` | String | "YYYY-MM" |
| `tipo_periodo` | String | MENSUAL/TRIMESTRAL/ANUAL |
| `id_bodega` | Int? | FK → bodegas (opcional) |
| `id_categoria` | Int? | FK → categorias (opcional) |
| `total_auditorias_realizadas` | Int | Total de auditorías |
| `total_items_auditados` | Int | Total de productos auditados |
| `total_items_conformes` | Int | Items sin discrepancia |
| `total_items_con_discrepancia` | Int | Items con discrepancia |
| `accuracy_porcentaje` | Decimal | % de precisión |
| `valor_total_inventario` | Decimal? | Valor total |
| `valor_discrepancias_positivas` | Decimal? | Valor de sobrantes |
| `valor_discrepancias_negativas` | Decimal? | Valor de faltantes |
| `valor_neto_discrepancias` | Decimal? | Neto (positivas - negativas) |
| `total_movimientos` | Int | Total de movimientos |
| `total_ajustes` | Int | Total de ajustes |
| `total_ajustes_autorizados` | Int | Ajustes aprobados |
| `fecha_calculo` | DateTime | Fecha de cálculo |
| `calculado_por` | Int? | FK → usuarios |

**Índice único:** `[periodo, id_bodega, id_categoria]`

---

## DTOs

### CreateAuditoriaDto
Crear/planificar auditoría.

```typescript
{
  tipo: tipo_auditoria;                    // COMPLETA o SORPRESA
  id_bodega: number;                       // Bodega a auditar
  id_estante?: number;                     // Estante específico (opcional)
  incluir_todas_categorias?: boolean;      // Default: true
  categorias_a_auditar?: number[];         // IDs de categorías (si no todas)
  fecha_planificada?: string;              // ISO 8601
  observaciones?: string;
}
```

### IniciarConteoDto
Iniciar conteo físico.

```typescript
{
  observaciones?: string;
}
```

### RegistrarConteoDto
Registrar conteos físicos.

```typescript
{
  conteos: [
    {
      id_catalogo: number;
      cantidad_fisica: number;           // Cantidad contada
      observaciones?: string;
    },
    // ... más productos
  ];
  observaciones_generales?: string;
}
```

### EscanearSerieDto
Escanear serie individual.

```typescript
{
  id_catalogo: number;
  numero_serie: string;
  encontrado_fisicamente?: boolean;      // Default: true
  observaciones?: string;
}
```

### UploadEvidenciaDto
Subir evidencia fotográfica.

```typescript
{
  tipo: 'ESTANTE' | 'PRODUCTO' | 'GENERAL' | 'DISCREPANCIA';
  titulo?: string;
  descripcion?: string;
  id_catalogo?: number;                  // Producto relacionado (opcional)
}
```

### CreateAjusteDto
Generar ajustes desde discrepancias.

```typescript
{
  id_auditoria: number;
  ajustes: [
    {
      id_auditoria_detalle: number;
      id_catalogo: number;
      cantidad_anterior: number;
      cantidad_nueva: number;
      tipo_discrepancia?: tipo_discrepancia;
      causa_discrepancia?: causa_discrepancia;
      observaciones?: string;
    },
    // ... más ajustes
  ];
  motivo_detallado?: string;
  documentos_soporte?: string;           // JSON array de URLs
}
```

### AutorizarAjusteDto
Autorizar/rechazar ajuste.

```typescript
{
  autorizado: boolean;                   // true = aprobar, false = rechazar
  observaciones_autorizacion?: string;
  motivo_rechazo?: string;               // Requerido si autorizado = false
}
```

---

## Service - Métodos Disponibles

### CRUD de Auditorías

#### `create(createDto, id_usuario): Promise<Auditoria>`
Crear/planificar auditoría.

**Validaciones:**
- Bodega debe existir
- Estante debe pertenecer a bodega (si se especifica)
- Genera código único: `AUD-YYYYMM-####`

**Estado inicial:** `PLANIFICADA`

---

#### `findAll(filterDto): Promise<PaginatedResponse>`
Listar auditorías con filtros.

**Filtros disponibles:**
- `tipo`, `estado`, `id_bodega`, `id_estante`
- `id_usuario_planifica`, `id_usuario_ejecuta`
- `fecha_desde`, `fecha_hasta`
- Paginación: `page`, `limit`

**Incluye:**
- Bodega, estante, usuarios
- Contadores: `_count { detalle, evidencias, ajustes }`

---

#### `findOne(id): Promise<Auditoria>`
Obtener auditoría con todo su detalle.

**Incluye:**
- Bodega → sucursal
- Estante
- Usuarios (planifica, ejecuta)
- Detalle completo con productos, categorías, usuarios de conteo, series
- Evidencias con usuarios
- Ajustes con usuarios
- Snapshot

---

#### `update(id, updateDto, id_usuario): Promise<Auditoria>`
Actualizar auditoría.

**Restricción:** Solo en estado `PLANIFICADA`

---

#### `remove(id, id_usuario): Promise<Auditoria>`
Cancelar auditoría.

**Restricción:** No se puede cancelar si está `COMPLETADA` o `CANCELADA`

**Acción:** Cambia estado a `CANCELADA`

---

### Workflow de Conteo

#### `iniciarConteo(id, iniciarDto, id_usuario): Promise<Auditoria>`
Iniciar conteo físico.

**Validaciones:**
- Solo en estado `PLANIFICADA`

**Acciones:**
1. Cambia estado a `EN_PROGRESO`
2. Asigna `id_usuario_ejecuta`
3. Registra `fecha_inicio`
4. Crea registros en `auditorias_detalle` con stock actual del sistema

**Filtros aplicados:**
- `id_bodega`, `id_estante` (si aplica)
- Categorías específicas (si `incluir_todas_categorias = false`)
- Solo productos con `estado = ACTIVO`

**Resultado:** Auditoría con lista de productos a contar

---

#### `registrarConteo(id, registrarDto, id_usuario): Promise<Auditoria>`
Registrar conteos físicos de productos.

**Validaciones:**
- Solo en estado `EN_PROGRESO`
- Productos deben estar en la auditoría

**Cálculos automáticos:**
```typescript
discrepancia = cantidad_fisica - cantidad_sistema
discrepancia_valor = discrepancia * costo_promedio_sistema
porcentaje_discrepancia = |discrepancia / cantidad_sistema| * 100

tipo_discrepancia =
  discrepancia > 0 ? SOBRANTE :
  discrepancia < 0 ? FALTANTE :
  CONFORME

requiere_investigacion = porcentaje_discrepancia > 10
```

**Actualiza:**
- `cantidad_fisica`, `fue_contado = true`
- `discrepancia`, `discrepancia_valor`, `porcentaje_discrepancia`
- `tipo_discrepancia`, `requiere_investigacion`
- `id_usuario_conteo`, `fecha_conteo`

---

#### `escanearSerie(id, escanearDto, id_usuario): Promise<Serie>`
Escanear serie individual.

**Validaciones:**
- Solo en estado `EN_PROGRESO`
- Producto debe estar en la auditoría

**Verificaciones:**
1. Busca serie en `inventario_series`
2. Valida ubicación esperada vs real
3. Registra en `auditorias_series`:
   - `existe_en_sistema`
   - `estado_en_sistema`
   - `ubicacion_esperada_bodega`
   - `ubicacion_real_bodega`

**Uso:** Para productos con número de serie (ONUs, routers, switches)

---

#### `uploadEvidencia(id, file, uploadDto, id_usuario): Promise<Evidencia>`
Subir evidencia fotográfica.

**Proceso:**
1. Sube archivo a MinIO: `auditorias/{id}/{timestamp}_{filename}`
2. Registra en `auditorias_evidencias`

**Tipos de evidencia:**
- `ESTANTE`: Foto de estante completo
- `PRODUCTO`: Foto de producto específico
- `GENERAL`: Foto general de bodega
- `DISCREPANCIA`: Foto de discrepancia encontrada

**Integración:** Requiere `MinioService`

---

#### `finalizarAuditoria(id, finalizarDto, id_usuario): Promise<Auditoria>`
Finalizar auditoría y calcular resumen.

**Validaciones:**
- Solo en estado `EN_PROGRESO`
- Debe haber al menos un producto contado

**Cálculos automáticos:**
```typescript
total_items_auditados = COUNT(detalle WHERE fue_contado = true)
total_items_conformes = COUNT(detalle WHERE tipo_discrepancia = CONFORME)
total_items_con_discrepancia = COUNT(detalle WHERE tipo_discrepancia IN (FALTANTE, SOBRANTE))
valor_total_discrepancias = SUM(discrepancia_valor)
porcentaje_accuracy = (total_items_conformes / total_items_auditados) * 100
```

**Acciones:**
1. Actualiza totales en `auditorias_inventario`
2. Cambia estado a `PENDIENTE_REVISION`
3. Registra `fecha_fin`
4. **Crea snapshot automáticamente**

---

#### `finalizarYAplicarDirecto(id, id_usuario, observaciones?): Promise<ResultadoCompleto>`
**⚠️ MODO DIRECTO:** Finalizar auditoría y aplicar ajustes automáticamente SIN autorización.

**¿Cuándo usar este método?**
- Usuario tiene autoridad para ajustar inventario sin supervisión
- Levantamiento físico simple donde no se requiere workflow de autorización
- Las cantidades levantadas se consideran la "nueva realidad" del inventario

**Validaciones:**
- Solo en estado `EN_PROGRESO`
- Debe haber al menos un producto contado
- Ajustes no deben resultar en cantidades negativas

**Proceso (Transacción atómica):**
1. **Calcula resumen** (igual que `finalizarAuditoria`)
2. **Para cada item con discrepancia:**
   - Genera código de ajuste único: `AJU-YYYYMM-####`
   - Crea ajuste con estado `APLICADO` (no `PENDIENTE_AUTORIZACION`)
   - Auto-autoriza (mismo usuario como solicitante y autorizador)
   - **Actualiza inventario inmediatamente** (cantidad_disponible ± discrepancia)
   - Crea movimiento de inventario tipo `AJUSTE_INVENTARIO`
   - Vincula movimiento al ajuste
3. **Actualiza auditoría** a estado `COMPLETADA` (no `PENDIENTE_REVISION`)
4. Crea snapshot automáticamente (fuera de transacción)

**Respuesta:**
```typescript
{
  auditoria: AuditoriaCompletada,
  ajustes_aplicados: [
    {
      codigo: 'AJU-202411-0001',
      id_catalogo: 123,
      producto: 'Cable UTP Cat6',
      cantidad_anterior: 100,
      cantidad_ajuste: -5,
      cantidad_nueva: 95,
      estado: 'APLICADO',
      inventario_actualizado: { ... }
    },
    // ... más ajustes
  ],
  movimientos_generados: [
    { tipo: 'AJUSTE_INVENTARIO', ... },
    // ... más movimientos
  ],
  resumen: {
    total_items_auditados: 45,
    items_conformes: 40,
    items_con_discrepancia: 5,
    total_ajustes_aplicados: 5,
    valor_total_discrepancias: -250.50,
    porcentaje_accuracy: 88.89
  }
}
```

**Diferencias con flujo normal:**
| Aspecto | Flujo Normal | Modo Directo |
|---------|--------------|--------------|
| Finalización | → `PENDIENTE_REVISION` | → `COMPLETADA` |
| Ajustes | Estado `PENDIENTE_AUTORIZACION` | Estado `APLICADO` |
| Autorización | Requiere supervisor | Auto-autorizado |
| Aplicación a inventario | Manual (método `aplicarAjuste`) | Automática |
| Pasos | 5 pasos separados | 1 paso único |

**Trazabilidad:**
- ✅ Todos los ajustes se registran en `ajustes_inventario`
- ✅ Todos los movimientos se registran en `movimientos_inventario`
- ✅ Usuario que ejecuta queda como solicitante Y autorizador
- ✅ Snapshot histórico se crea automáticamente
- ✅ Observaciones quedan registradas en auditoría y ajustes

**Endpoint:** `POST /inventario/auditorias-inventario/:id/finalizar-y-aplicar`

**Permiso requerido:** `inventario.auditorias:finalizar_directo`

---

### Análisis y Ajustes

#### `getDiscrepancias(id): Promise<DiscrepanciasResponse>`
Obtener discrepancias de auditoría.

**Respuesta:**
```typescript
{
  auditoria: { id, codigo, tipo, estado },
  resumen: {
    total_discrepancias,
    total_faltantes,
    total_sobrantes,
    valor_faltantes,
    valor_sobrantes,
    valor_neto
  },
  discrepancias: [...],  // Todas
  faltantes: [...],      // Solo faltantes
  sobrantes: [...]       // Solo sobrantes
}
```

---

#### `generarAjustes(id, createDto, id_usuario): Promise<Ajuste[]>`
Generar ajustes desde discrepancias.

**Validaciones:**
- Solo en estados `PENDIENTE_REVISION` o `COMPLETADA`
- Detalles deben pertenecer a la auditoría
- Inventario debe existir para cada producto

**Proceso (Transacción):**
1. Valida cada detalle
2. Busca inventario actual
3. Genera código único: `AJU-YYYYMM-####`
4. Crea ajuste con estado `PENDIENTE_AUTORIZACION`
5. Calcula `cantidad_ajuste = cantidad_nueva - cantidad_anterior`

**Resultado:** Array de ajustes creados

---

#### `getAjustes(filterDto): Promise<PaginatedResponse>`
Listar ajustes con filtros.

**Filtros disponibles:**
- `estado`, `id_auditoria`, `id_catalogo`, `id_bodega`
- `tipo_discrepancia`, `causa_discrepancia`
- `id_usuario_solicita`, `id_usuario_autoriza`
- `fecha_desde`, `fecha_hasta`
- Paginación: `page`, `limit`

---

#### `autorizarAjuste(id, autorizarDto, id_usuario): Promise<Ajuste>`
Autorizar o rechazar ajuste.

**Validaciones:**
- Solo en estado `PENDIENTE_AUTORIZACION`
- Si rechaza, `motivo_rechazo` es requerido

**Acciones:**
- Cambia estado a `AUTORIZADO` o `RECHAZADO`
- Registra `id_usuario_autoriza`, `fecha_autorizacion`
- Guarda observaciones/motivo de rechazo

---

#### `aplicarAjuste(id, id_usuario): Promise<Resultado>`
Aplicar ajuste autorizado al inventario.

**Validaciones:**
- Solo en estado `AUTORIZADO`
- Inventario debe existir
- No puede resultar en cantidad negativa

**Proceso (Transacción):**
1. Busca inventario
2. Valida nueva cantidad ≥ 0
3. **Actualiza `inventario.cantidad_disponible`**
4. **Crea `movimientos_inventario`**:
   - `tipo = AJUSTE_INVENTARIO`
   - `id_bodega_destino` si ajuste > 0
   - `id_bodega_origen` si ajuste < 0
   - `cantidad = |cantidad_ajuste|`
   - `observaciones = "Ajuste {codigo} - Auditoría {codigo_aud} - {motivo}"`
5. Actualiza ajuste:
   - `estado = APLICADO`
   - `fecha_aplicacion = now()`
   - `id_movimiento_generado`

**Resultado:**
```typescript
{
  ajuste: {...},
  inventario: {...},
  movimiento: {...}
}
```

---

### Métricas y Snapshots

#### `getMetricas(queryDto): Promise<Metrica>`
Obtener métricas de período.

**Query:**
```typescript
{
  periodo: "2025-01",           // YYYY-MM
  tipo_periodo?: "MENSUAL",     // MENSUAL/TRIMESTRAL/ANUAL
  id_bodega?: number,           // Filtrar por bodega
  id_categoria?: number         // Filtrar por categoría
}
```

**Proceso:**
1. Busca métrica existente
2. Si no existe, calcula y guarda automáticamente

**Métricas calculadas:**
- Total de auditorías realizadas
- Total de items auditados/conformes/con discrepancia
- Accuracy %
- Valores de discrepancias (positivas, negativas, neto)
- Total de ajustes (solicitados, autorizados)

---

#### `createSnapshot(id_auditoria): Promise<Snapshot>`
Crear snapshot de inventario.

**Llamado automáticamente** al finalizar auditoría.

**Proceso (Transacción):**
1. Genera código: `SNP-YYYYMM-{id_auditoria}`
2. Obtiene todo el inventario de la bodega/estante auditado
3. Crea cabecera con totales:
   - `total_items`, `total_cantidad`, `valor_total_inventario`
4. Crea detalle por producto:
   - `cantidad_disponible`, `cantidad_reservada`, `cantidad_total`
   - `costo_promedio`, `valor_total`

**Uso:** Análisis histórico, reportes contables, comparaciones entre períodos

---

#### `generarReportePdf(id): Promise<Buffer>`
Generar reporte PDF de auditoría.

**Integración:** jsReport

**Template:** `templates/inventario/auditoria.html`

**Datos enviados:**
```typescript
{
  auditoria: { ...todo el detalle... },
  fecha_generacion: "DD/MM/YYYY"
}
```

---

## Workflows Principales

### Workflow 1: Auditoría Completa

```
1. POST /auditorias-inventario
   ↓ (Estado: PLANIFICADA)

2. POST /auditorias-inventario/:id/iniciar-conteo
   ↓ (Estado: EN_PROGRESO, crea detalle con stock del sistema)

3. POST /auditorias-inventario/:id/registrar-conteo (múltiples veces)
   ↓ (Registra cantidad física, calcula discrepancias)

4. POST /auditorias-inventario/:id/escanear-serie (opcional, para items con serie)
   ↓ (Valida series uno a uno)

5. POST /auditorias-inventario/:id/evidencia (opcional, múltiples veces)
   ↓ (Sube fotos de estantes/productos/discrepancias)

6. POST /auditorias-inventario/:id/finalizar
   ↓ (Estado: PENDIENTE_REVISION, calcula totales, crea snapshot)

7. GET /auditorias-inventario/:id/discrepancias
   ↓ (Revisar discrepancias encontradas)

8. POST /auditorias-inventario/:id/generar-ajustes
   ↓ (Crea ajustes en estado PENDIENTE_AUTORIZACION)

9. POST /ajustes-inventario/:id/autorizar
   ↓ (Estado: AUTORIZADO o RECHAZADO)

10. POST /ajustes-inventario/:id/aplicar
    ↓ (Estado: APLICADO, actualiza inventario, crea movimiento)
```

---

### Workflow 2: Autorización de Ajustes

```
┌─────────────────┐
│ Discrepancias   │
│ encontradas     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generar Ajustes │ ← Usuario Contador
│ (PENDIENTE)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Revisar Ajustes │ ← Supervisor
│ - Aprobar       │
│ - Rechazar      │
└────────┬────────┘
         │
         ├─────────► RECHAZADO (Fin)
         │
         ▼
┌─────────────────┐
│ AUTORIZADO      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Aplicar Ajuste  │ ← Usuario Autorizado
│ - Update inv    │
│ - Create mov    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ APLICADO        │
│ ✓ Inventario    │
│   actualizado   │
└─────────────────┘
```

---

### Workflow 3: Escaneo de Series

Para productos con número de serie (ONUs, routers, switches):

```
1. Iniciar auditoría
   ↓
2. Para cada producto serializado:
   │
   ├─ Escanear serie con lector/cámara
   │  POST /auditorias-inventario/:id/escanear-serie
   │  {
   │    id_catalogo: 15,
   │    numero_serie: "SN123456789"
   │  }
   │  ↓
   │  Sistema valida:
   │  - ¿Existe en BD?
   │  - ¿Estado correcto?
   │  - ¿Ubicación correcta?
   │  ↓
   │  Registra en auditorias_series
   │
   ├─ Repetir para cada serie
   │
3. Al finalizar:
   - Total de series escaneadas
   - Series no encontradas físicamente
   - Series en ubicación incorrecta
   - Series no registradas en sistema
```

---

## Endpoints REST ✅

**Base URL**: `/inventario/auditorias-inventario`

**Autenticación**: Todos los endpoints requieren JWT token (`Authorization: Bearer {token}`)

### 1. CRUD de Auditorías

#### 1.1. Crear Auditoría
```typescript
POST /inventario/auditorias-inventario
Headers: { Authorization: Bearer {token} }
Body: CreateAuditoriaDto

Response: {
  id_auditoria: number;
  codigo: string;              // AUD-YYYYMM-####
  tipo: tipo_auditoria;
  estado: estado_auditoria;    // PLANIFICADA
  id_bodega: number;
  bodega: { ... };
  // ... más campos
}
```

#### 1.2. Listar Auditorías
```typescript
GET /inventario/auditorias-inventario?page=1&limit=10&estado=PLANIFICADA&id_bodega=1
Headers: { Authorization: Bearer {token} }
Query params: FilterAuditoriaDto

Response: {
  data: Auditoria[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }
}
```

**Filtros disponibles**:
- `page` (number): Página actual
- `limit` (number): Items por página
- `tipo` (tipo_auditoria): COMPLETA | SORPRESA
- `estado` (estado_auditoria): PLANIFICADA | EN_PROGRESO | PENDIENTE_REVISION | COMPLETADA | CANCELADA
- `id_bodega` (number): Filtrar por bodega
- `id_estante` (number): Filtrar por estante
- `id_usuario_planifica` (number): Filtrar por quien planificó
- `id_usuario_ejecuta` (number): Filtrar por quien ejecuta
- `fecha_desde` (string ISO): Fecha inicio
- `fecha_hasta` (string ISO): Fecha fin

#### 1.3. Obtener Auditoría por ID
```typescript
GET /inventario/auditorias-inventario/:id
Headers: { Authorization: Bearer {token} }

Response: {
  id_auditoria: number;
  codigo: string;
  bodega: { ... };
  estante: { ... };
  usuario_planifica: { ... };
  usuario_ejecuta: { ... };
  detalle: AuditoriaDetalle[];    // Con productos, categorías, series
  evidencias: Evidencia[];
  ajustes: Ajuste[];
  snapshot: Snapshot;
  // ... totales y métricas
}
```

#### 1.4. Actualizar Auditoría
```typescript
PATCH /inventario/auditorias-inventario/:id
Headers: { Authorization: Bearer {token} }
Body: UpdateAuditoriaDto

⚠️ Restricción: Solo en estado PLANIFICADA
```

#### 1.5. Cancelar Auditoría
```typescript
DELETE /inventario/auditorias-inventario/:id
Headers: { Authorization: Bearer {token} }

⚠️ Restricción: No se puede cancelar si está COMPLETADA o CANCELADA
Response: { message: string; auditoria: {...} }
```

---

### 2. Workflow de Conteo

#### 2.1. Iniciar Conteo
```typescript
POST /inventario/auditorias-inventario/:id/iniciar-conteo
Headers: { Authorization: Bearer {token} }
Body: {
  observaciones?: string;
}

⚠️ Restricción: Solo desde estado PLANIFICADA
✅ Acciones:
- Cambia estado a EN_PROGRESO
- Asigna usuario ejecutor
- Crea registros de detalle con stock actual del sistema
```

#### 2.2. Registrar Conteos
```typescript
POST /inventario/auditorias-inventario/:id/registrar-conteo
Headers: { Authorization: Bearer {token} }
Body: {
  conteos: [
    {
      id_catalogo: number;
      cantidad_fisica: number;
      observaciones?: string;
    }
  ];
  observaciones_generales?: string;
}

⚠️ Restricción: Solo en estado EN_PROGRESO
✅ Cálculos automáticos:
- discrepancia = cantidad_fisica - cantidad_sistema
- tipo_discrepancia (FALTANTE/SOBRANTE/CONFORME)
- porcentaje_discrepancia
- requiere_investigacion (si > 10%)
```

#### 2.3. Escanear Serie Individual
```typescript
POST /inventario/auditorias-inventario/:id/escanear-serie
Headers: { Authorization: Bearer {token} }
Body: {
  id_catalogo: number;
  numero_serie: string;
  encontrado_fisicamente?: boolean;  // default: true
  observaciones?: string;
}

⚠️ Restricción: Solo en estado EN_PROGRESO
✅ Validaciones:
- Verifica si existe en sistema
- Valida ubicación esperada vs real
- Registra estado en sistema
```

#### 2.4. Subir Evidencia Fotográfica
```typescript
POST /inventario/auditorias-inventario/:id/evidencia
Headers: {
  Authorization: Bearer {token};
  Content-Type: multipart/form-data;
}
Body: FormData {
  file: File;                        // Imagen (JPG, PNG, etc.)
  tipo: string;                      // ESTANTE | PRODUCTO | GENERAL | DISCREPANCIA
  titulo?: string;
  descripcion?: string;
  id_catalogo?: number;              // Si tipo = PRODUCTO o DISCREPANCIA
}

✅ Almacenamiento: MinIO en ruta auditorias/{id}/{timestamp}_{filename}
Response: Evidencia con URL firmada
```

#### 2.5. Finalizar Auditoría
```typescript
POST /inventario/auditorias-inventario/:id/finalizar
Headers: { Authorization: Bearer {token} }
Body: {
  observaciones?: string;
}

⚠️ Restricción: Solo en estado EN_PROGRESO
⚠️ Validación: Debe haber al menos 1 producto contado
✅ Acciones:
- Calcula totales y accuracy %
- Cambia estado a PENDIENTE_REVISION
- Crea snapshot automático del inventario
```

#### 2.6. Finalizar y Aplicar Directo (MODO RÁPIDO)
```typescript
POST /inventario/auditorias-inventario/:id/finalizar-y-aplicar
Headers: { Authorization: Bearer {token} }
Body: {
  observaciones?: string;
}

⚠️ MODO DIRECTO: Finaliza y aplica ajustes en un solo paso SIN autorización
⚠️ Restricción: Solo en estado EN_PROGRESO
⚠️ Validación: Debe haber al menos 1 producto contado
⚠️ Permiso requerido: inventario.auditorias:finalizar_directo

✅ Acciones (TODO en transacción atómica):
1. Calcula totales y accuracy %
2. Genera ajustes automáticos para TODAS las discrepancias
3. Auto-autoriza ajustes (mismo usuario)
4. Aplica ajustes al inventario inmediatamente
5. Crea movimientos de inventario
6. Cambia estado a COMPLETADA (directo, sin PENDIENTE_REVISION)
7. Crea snapshot automático

Response: {
  auditoria: AuditoriaCompletada,
  ajustes_aplicados: [
    {
      codigo: 'AJU-202411-0001',
      id_catalogo: 123,
      producto: 'Cable UTP Cat6',
      cantidad_anterior: 100,
      cantidad_ajuste: -5,
      cantidad_nueva: 95,
      estado: 'APLICADO',
      inventario_actualizado: { cantidad_disponible: 95 }
    }
  ],
  movimientos_generados: [
    {
      tipo: 'AJUSTE_INVENTARIO',
      id_catalogo: 123,
      cantidad: 5,
      id_bodega_origen: 1,
      observaciones: 'Ajuste AJU-202411-0001 - Levantamiento AUD-202411-003'
    }
  ],
  resumen: {
    total_items_auditados: 45,
    items_conformes: 40,
    items_con_discrepancia: 5,
    total_ajustes_aplicados: 5,
    valor_total_discrepancias: -250.50,
    porcentaje_accuracy: 88.89
  }
}
```

**💡 Cuándo usar este endpoint:**
- ✅ Usuario tiene autoridad total sobre inventario
- ✅ Levantamiento físico simple sin necesidad de revisión
- ✅ Cantidades levantadas son la "nueva realidad" del sistema
- ✅ No se requiere workflow de autorización

**⚠️ Cuándo NO usarlo:**
- ❌ Discrepancias grandes que requieren investigación
- ❌ Cuando se necesita segregación de funciones (contador ≠ autorizador)
- ❌ Auditorías formales con revisión obligatoria

**Comparación de flujos:**

| Flujo Normal (5 pasos) | Flujo Directo (1 paso) |
|------------------------|------------------------|
| 1. POST /finalizar → PENDIENTE_REVISION | POST /finalizar-y-aplicar → COMPLETADA |
| 2. GET /discrepancias | (automático) |
| 3. POST /generar-ajustes → PENDIENTE_AUTORIZACION | (automático) |
| 4. POST /ajustes/:id/autorizar → AUTORIZADO | (auto-autorizado) |
| 5. POST /ajustes/:id/aplicar → APLICADO | (auto-aplicado) |

---

### 3. Análisis y Ajustes

#### 3.1. Obtener Discrepancias
```typescript
GET /inventario/auditorias-inventario/:id/discrepancias
Headers: { Authorization: Bearer {token} }

Response: {
  auditoria: { id, codigo, tipo, estado };
  resumen: {
    total_discrepancias: number;
    total_faltantes: number;
    total_sobrantes: number;
    valor_faltantes: Decimal;
    valor_sobrantes: Decimal;
    valor_neto: Decimal;
  };
  discrepancias: DetalleFull[];    // Todas
  faltantes: DetalleFull[];        // Solo FALTANTE
  sobrantes: DetalleFull[];        // Solo SOBRANTE
}
```

#### 3.2. Generar Ajustes
```typescript
POST /inventario/auditorias-inventario/:id/generar-ajustes
Headers: { Authorization: Bearer {token} }
Body: {
  ajustes: [
    {
      id_auditoria_detalle: number;
      id_catalogo: number;
      cantidad_anterior: number;
      cantidad_nueva: number;
      tipo_discrepancia?: tipo_discrepancia;
      causa_discrepancia?: causa_discrepancia;
      observaciones?: string;
    }
  ];
  motivo_detallado?: string;
  documentos_soporte?: string;       // JSON array de URLs
}

⚠️ Restricción: Solo en PENDIENTE_REVISION o COMPLETADA
✅ Genera: Ajustes en estado PENDIENTE_AUTORIZACION con código AJU-YYYYMM-####
```

#### 3.3. Generar Reporte PDF
```typescript
GET /inventario/auditorias-inventario/:id/pdf
Headers: { Authorization: Bearer {token} }

Response: Binary PDF
Headers: {
  Content-Type: application/pdf;
  Content-Disposition: inline; filename="Auditoria_{id}.pdf"
}

📄 Template: templates/inventario/auditoria.html
```

---

### 4. Gestión de Ajustes

#### 4.1. Listar Ajustes
```typescript
GET /inventario/auditorias-inventario/ajustes/listar?page=1&limit=10&estado=PENDIENTE_AUTORIZACION
Headers: { Authorization: Bearer {token} }
Query params: FilterAjusteDto

Response: {
  data: Ajuste[];
  meta: { total, page, limit, totalPages }
}
```

**Filtros disponibles**:
- `page`, `limit`: Paginación
- `estado` (estado_ajuste): PENDIENTE_AUTORIZACION | AUTORIZADO | RECHAZADO | APLICADO | CANCELADO
- `id_auditoria` (number): Filtrar por auditoría
- `id_catalogo` (number): Filtrar por producto
- `id_bodega` (number): Filtrar por bodega
- `tipo_discrepancia` (tipo_discrepancia): FALTANTE | SOBRANTE
- `causa_discrepancia` (causa_discrepancia)
- `id_usuario_solicita`, `id_usuario_autoriza` (number)
- `fecha_desde`, `fecha_hasta` (string ISO)

#### 4.2. Autorizar/Rechazar Ajuste
```typescript
POST /inventario/auditorias-inventario/ajustes/:id/autorizar
Headers: { Authorization: Bearer {token} }
Body: {
  autorizado: boolean;               // true = aprobar, false = rechazar
  observaciones_autorizacion?: string;
  motivo_rechazo?: string;           // REQUERIDO si autorizado = false
}

⚠️ Restricción: Solo en estado PENDIENTE_AUTORIZACION
✅ Cambios: estado → AUTORIZADO o RECHAZADO
```

#### 4.3. Aplicar Ajuste al Inventario
```typescript
POST /inventario/auditorias-inventario/ajustes/:id/aplicar
Headers: { Authorization: Bearer {token} }

⚠️ Restricción: Solo en estado AUTORIZADO
⚠️ Validación: No puede resultar en cantidad negativa
✅ Acciones:
- Actualiza inventario.cantidad_disponible
- Crea movimiento_inventario tipo AJUSTE_INVENTARIO
- Cambia estado a APLICADO

Response: {
  ajuste: {...};
  inventario: {...};
  movimiento: {...};
}
```

---

### 5. Métricas

#### 5.1. Dashboard de Métricas
```typescript
GET /inventario/auditorias-inventario/metricas/dashboard?periodo=2025-01&id_bodega=1
Headers: { Authorization: Bearer {token} }
Query params: {
  periodo: string;                   // YYYY-MM
  tipo_periodo?: string;             // MENSUAL | TRIMESTRAL | ANUAL
  id_bodega?: number;
  id_categoria?: number;
}

Response: {
  periodo: string;
  total_auditorias_realizadas: number;
  total_items_auditados: number;
  total_items_conformes: number;
  total_items_con_discrepancia: number;
  accuracy_porcentaje: Decimal;
  valor_total_inventario: Decimal;
  valor_discrepancias_positivas: Decimal;  // Sobrantes
  valor_discrepancias_negativas: Decimal;  // Faltantes
  valor_neto_discrepancias: Decimal;
  total_movimientos: number;
  total_ajustes: number;
  total_ajustes_autorizados: number;
  fecha_calculo: DateTime;
}

💡 Si no existe, se calcula automáticamente y se guarda
```

---

## Consideraciones Importantes

### 1. Transaccionalidad

**Operaciones críticas que usan transacciones Prisma:**
- `iniciarConteo`: Actualiza auditoría + crea detalles
- `generarAjustes`: Crea múltiples ajustes
- `aplicarAjuste`: Actualiza inventario + crea movimiento + actualiza ajuste
- `createSnapshot`: Crea cabecera + detalles

**Motivo:** Garantizar consistencia de datos (todo o nada)

---

### 2. Validaciones de Estado

**Estado de auditoría:**
- `PLANIFICADA` → Solo puede iniciarse
- `EN_PROGRESO` → Solo puede registrar conteos, escanear series, subir evidencias, finalizar
- `PENDIENTE_REVISION` → Solo puede generar ajustes
- `COMPLETADA` → Solo puede generar ajustes
- `CANCELADA` → No permite operaciones

**Estado de ajuste:**
- `PENDIENTE_AUTORIZACION` → Solo puede autorizarse/rechazarse
- `AUTORIZADO` → Solo puede aplicarse
- `APLICADO` → No permite modificaciones
- `RECHAZADO` → No permite operaciones

---

### 3. Cálculos Automáticos

**Discrepancia se calcula automáticamente:**
```typescript
discrepancia = cantidad_fisica - cantidad_sistema
discrepancia_valor = discrepancia * costo_promedio_sistema
porcentaje_discrepancia = |discrepancia / cantidad_sistema| * 100
tipo_discrepancia = discrepancia > 0 ? SOBRANTE : discrepancia < 0 ? FALTANTE : CONFORME
requiere_investigacion = porcentaje_discrepancia > 10
```

**No es necesario** enviar estos campos en los DTOs.

---

### 4. Snapshots Automáticos

Al finalizar una auditoría (`finalizarAuditoria`), se crea automáticamente un snapshot con:
- Estado completo del inventario auditado
- Cantidades disponibles y reservadas
- Costos promedio
- Valores totales

**Uso:** Comparar inventario entre períodos, reportes contables, auditorías futuras.

---

### 5. Integración con MinIO

**Evidencias fotográficas se almacenan en MinIO:**
- Bucket: configurado en `.env`
- Path: `auditorias/{id_auditoria}/{timestamp}_{filename}`
- Tipos de archivo aceptados: imágenes (JPEG, PNG, etc.)

**Requiere:** `MinioService` inyectado en el módulo

---

### 6. Generación de Códigos Únicos

**Formato de códigos:**
- Auditorías: `AUD-YYYYMM-####` (ej: `AUD-202501-0001`)
- Ajustes: `AJU-YYYYMM-####` (ej: `AJU-202501-0015`)
- Snapshots: `SNP-YYYYMM-{id_auditoria}` (ej: `SNP-202501-0003`)

**Numeración:** Secuencial por mes

---

### 7. Precisión de Inventario (Accuracy)

**Métrica clave:**
```typescript
accuracy = (total_items_conformes / total_items_auditados) * 100
```

**Interpretación:**
- 100% = Inventario perfecto
- 95-99% = Excelente
- 90-94% = Bueno
- 85-89% = Aceptable
- <85% = Requiere atención

**Umbral de investigación:** Items con discrepancia > 10% se marcan automáticamente como `requiere_investigacion = true`

---

### 8. Movimientos de Inventario

**Al aplicar ajuste, se crea movimiento automáticamente:**
- `tipo = AJUSTE_INVENTARIO`
- Si ajuste positivo → `id_bodega_destino`
- Si ajuste negativo → `id_bodega_origen`
- `cantidad = |cantidad_ajuste|`
- `observaciones = "Ajuste {codigo} - Auditoría {codigo_aud} - {motivo}"`

**Trazabilidad completa** en tabla `movimientos_inventario`

---

### 9. Series Individuales

**Para productos con número de serie:**
1. El sistema registra cada serie escaneada
2. Valida contra `inventario_series`
3. Detecta:
   - Series no registradas en sistema
   - Series en ubicación incorrecta
   - Series faltantes físicamente
   - Estado incorrecto

**Útil para:** ONUs, routers, switches, equipos de alto valor

---

### 10. Reportes PDF

**Template HTML requerido:**
- Path: `templates/inventario/auditoria.html`
- Engine: jsRender
- Sintaxis: `{{:variable}}`, `{{for items}}`, `{{if condition}}`

**Datos disponibles en template:**
```javascript
{
  auditoria: {
    codigo, tipo, estado,
    bodega: { nombre },
    usuario_planifica: { nombres, apellidos },
    detalle: [
      {
        catalogo: { codigo, nombre },
        cantidad_sistema,
        cantidad_fisica,
        discrepancia,
        // ...
      }
    ],
    // ...
  },
  fecha_generacion: "15/01/2025"
}
```

---

## Ejemplos de Uso

### Ejemplo 1: Crear y Ejecutar Auditoría Completa

```typescript
// 1. Crear auditoría
const auditoria = await service.create({
  tipo: 'COMPLETA',
  id_bodega: 1,
  id_estante: null, // Toda la bodega
  incluir_todas_categorias: true,
  fecha_planificada: '2025-01-20T10:00:00Z',
  observaciones: 'Auditoría trimestral Q1 2025'
}, id_usuario);
// → { id_auditoria: 1, codigo: "AUD-202501-0001", estado: "PLANIFICADA", ... }

// 2. Iniciar conteo
const iniciada = await service.iniciarConteo(1, {
  observaciones: 'Iniciando conteo a las 10:00 AM'
}, id_usuario);
// → Estado: EN_PROGRESO
// → Crea detalle con 150 productos

// 3. Registrar conteos
await service.registrarConteo(1, {
  conteos: [
    { id_catalogo: 15, cantidad_fisica: 23 },
    { id_catalogo: 16, cantidad_fisica: 10 },
    { id_catalogo: 17, cantidad_fisica: 45, observaciones: '2 unidades dañadas' }
  ],
  observaciones_generales: 'Primer lote de conteos'
}, id_usuario);

// 4. Escanear series (para productos serializados)
await service.escanearSerie(1, {
  id_catalogo: 15,
  numero_serie: 'ONU123456789',
  encontrado_fisicamente: true
}, id_usuario);
// → Valida si existe en sistema, ubicación, etc.

// 5. Subir evidencia
await service.uploadEvidencia(1, file, {
  tipo: 'PRODUCTO',
  titulo: 'Productos dañados',
  descripcion: 'Se encontraron 2 ONUs con empaque roto',
  id_catalogo: 17
}, id_usuario);
// → Sube a MinIO: auditorias/1/1737378000000_evidencia.jpg

// 6. Finalizar
const finalizada = await service.finalizarAuditoria(1, {
  observaciones: 'Auditoría completada sin incidentes mayores'
}, id_usuario);
// → Estado: PENDIENTE_REVISION
// → Calcula totales: accuracy = 96.7%, discrepancias = $450.50
// → Crea snapshot automáticamente

// 7. Obtener discrepancias
const discrepancias = await service.getDiscrepancias(1);
// → {
//     resumen: {
//       total_discrepancias: 5,
//       total_faltantes: 3,
//       total_sobrantes: 2,
//       valor_faltantes: 320.00,
//       valor_sobrantes: 130.50,
//       valor_neto: -189.50
//     },
//     faltantes: [...],
//     sobrantes: [...]
//   }

// 8. Generar ajustes
const ajustes = await service.generarAjustes(1, {
  id_auditoria: 1,
  ajustes: [
    {
      id_auditoria_detalle: 10,
      id_catalogo: 15,
      cantidad_anterior: 25,
      cantidad_nueva: 23,
      tipo_discrepancia: 'FALTANTE',
      causa_discrepancia: 'ERROR_REGISTRO'
    },
    // ... más ajustes
  ],
  motivo_detallado: 'Ajustes resultado de auditoría trimestral Q1'
}, id_usuario);
// → [
//     { id_ajuste: 1, codigo: "AJU-202501-0001", estado: "PENDIENTE_AUTORIZACION", ... },
//     { id_ajuste: 2, codigo: "AJU-202501-0002", estado: "PENDIENTE_AUTORIZACION", ... }
//   ]

// 9. Autorizar ajuste (supervisor)
const autorizado = await service.autorizarAjuste(1, {
  autorizado: true,
  observaciones_autorizacion: 'Aprobado. Discrepancias justificadas.'
}, id_supervisor);
// → Estado: AUTORIZADO

// 10. Aplicar ajuste
const aplicado = await service.aplicarAjuste(1, id_supervisor);
// → {
//     ajuste: { estado: "APLICADO", ... },
//     inventario: { cantidad_disponible: 23, ... },
//     movimiento: { tipo: "AJUSTE_INVENTARIO", ... }
//   }
```

---

### Ejemplo 2: Auditoría con Categorías Específicas

```typescript
const auditoria = await service.create({
  tipo: 'SORPRESA',
  id_bodega: 2,
  id_estante: 5,
  incluir_todas_categorias: false,
  categorias_a_auditar: [1, 3, 5], // Solo categorías de alto valor
  observaciones: 'Auditoría sorpresa - categorías de alto valor'
}, id_usuario);
// → Solo auditará productos de categorías 1, 3 y 5 en estante 5
```

---

### Ejemplo 3: Rechazar Ajuste

```typescript
const rechazado = await service.autorizarAjuste(2, {
  autorizado: false,
  motivo_rechazo: 'Discrepancia demasiado alta. Requiere investigación adicional antes de ajustar.'
}, id_supervisor);
// → Estado: RECHAZADO
```

---

### Ejemplo 4: Consultar Métricas

```typescript
const metricas = await service.getMetricas({
  periodo: '2025-01',
  tipo_periodo: 'MENSUAL',
  id_bodega: 1
});
// → {
//     periodo: "2025-01",
//     total_auditorias_realizadas: 3,
//     total_items_auditados: 450,
//     total_items_conformes: 435,
//     accuracy_porcentaje: 96.67,
//     valor_discrepancias_positivas: 250.00,
//     valor_discrepancias_negativas: 180.50,
//     valor_neto_discrepancias: 69.50,
//     total_ajustes: 15,
//     total_ajustes_autorizados: 12,
//     ...
//   }
```

---

## Guía para Desarrollo del Frontend (Angular)

### 📋 Checklist de Implementación

#### 1. Modelos TypeScript (`src/app/shared/models/`)

```typescript
// auditoria.model.ts
export enum TipoAuditoria {
  COMPLETA = 'COMPLETA',
  SORPRESA = 'SORPRESA'
}

export enum EstadoAuditoria {
  PLANIFICADA = 'PLANIFICADA',
  EN_PROGRESO = 'EN_PROGRESO',
  PENDIENTE_REVISION = 'PENDIENTE_REVISION',
  COMPLETADA = 'COMPLETADA',
  CANCELADA = 'CANCELADA'
}

export enum TipoDiscrepancia {
  FALTANTE = 'FALTANTE',
  SOBRANTE = 'SOBRANTE',
  CONFORME = 'CONFORME'
}

export enum CausaDiscrepancia {
  ROBO = 'ROBO',
  MERMA = 'MERMA',
  ERROR_REGISTRO = 'ERROR_REGISTRO',
  ERROR_CONTEO = 'ERROR_CONTEO',
  DANO = 'DANO',
  OTRO = 'OTRO',
  PENDIENTE_INVESTIGACION = 'PENDIENTE_INVESTIGACION'
}

export enum EstadoAjuste {
  PENDIENTE_AUTORIZACION = 'PENDIENTE_AUTORIZACION',
  AUTORIZADO = 'AUTORIZADO',
  RECHAZADO = 'RECHAZADO',
  APLICADO = 'APLICADO',
  CANCELADO = 'CANCELADO'
}

export interface Auditoria {
  id_auditoria: number;
  codigo: string;
  tipo: TipoAuditoria;
  estado: EstadoAuditoria;
  id_bodega: number;
  id_estante?: number;
  incluir_todas_categorias: boolean;
  categorias_a_auditar?: number[];
  id_usuario_planifica: number;
  id_usuario_ejecuta?: number;
  fecha_planificada?: Date;
  fecha_inicio?: Date;
  fecha_fin?: Date;
  total_items_auditados: number;
  total_items_conformes: number;
  total_items_con_discrepancia: number;
  valor_total_discrepancias: number;
  porcentaje_accuracy: number;
  observaciones?: string;
  bodega?: any;
  estante?: any;
  usuario_planifica?: any;
  usuario_ejecuta?: any;
  detalle?: AuditoriaDetalle[];
  evidencias?: Evidencia[];
  ajustes?: Ajuste[];
}

export interface AuditoriaDetalle {
  id_auditoria_detalle: number;
  id_auditoria: number;
  id_catalogo: number;
  cantidad_sistema: number;
  cantidad_reservada_sistema: number;
  costo_promedio_sistema: number;
  cantidad_fisica?: number;
  fue_contado: boolean;
  discrepancia?: number;
  discrepancia_valor?: number;
  porcentaje_discrepancia?: number;
  tipo_discrepancia?: TipoDiscrepancia;
  causa_probable?: CausaDiscrepancia;
  requiere_investigacion: boolean;
  observaciones_conteo?: string;
  catalogo?: any;
  series?: AuditoriaSerie[];
}

export interface AuditoriaSerie {
  id_auditoria_serie: number;
  numero_serie: string;
  encontrado_fisicamente: boolean;
  existe_en_sistema: boolean;
  estado_en_sistema?: string;
  ubicacion_esperada_bodega?: number;
  ubicacion_real_bodega?: number;
  observaciones?: string;
}

export interface Evidencia {
  id_evidencia: number;
  id_auditoria: number;
  tipo: 'ESTANTE' | 'PRODUCTO' | 'GENERAL' | 'DISCREPANCIA';
  titulo?: string;
  descripcion?: string;
  nombre_archivo: string;
  ruta_archivo: string;
  mimetype: string;
  size: number;
  id_catalogo?: number;
  fecha_subida: Date;
}

export interface Ajuste {
  id_ajuste: number;
  codigo: string;
  id_auditoria?: number;
  id_catalogo: number;
  id_bodega: number;
  id_estante?: number;
  cantidad_anterior: number;
  cantidad_ajuste: number;
  cantidad_nueva: number;
  tipo_discrepancia?: TipoDiscrepancia;
  causa_discrepancia?: CausaDiscrepancia;
  estado: EstadoAjuste;
  id_usuario_solicita: number;
  id_usuario_autoriza?: number;
  observaciones_autorizacion?: string;
  motivo_rechazo?: string;
  fecha_solicitud: Date;
  fecha_autorizacion?: Date;
  fecha_aplicacion?: Date;
}

export interface MetricasAuditoria {
  periodo: string;
  total_auditorias_realizadas: number;
  total_items_auditados: number;
  total_items_conformes: number;
  total_items_con_discrepancia: number;
  accuracy_porcentaje: number;
  valor_discrepancias_positivas: number;
  valor_discrepancias_negativas: number;
  valor_neto_discrepancias: number;
  total_ajustes: number;
  total_ajustes_autorizados: number;
}
```

#### 2. Servicio HTTP (`src/app/shared/services/auditorias-inventario.service.ts`)

```typescript
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Auditoria,
  Ajuste,
  MetricasAuditoria,
  FilterAuditoriaDto,
  CreateAuditoriaDto,
  // ... otros DTOs
} from '../models/auditoria.model';

@Injectable({
  providedIn: 'root'
})
export class AuditoriasInventarioService {
  private apiUrl = `${environment.apiUrl}/inventario/auditorias-inventario`;

  constructor(private http: HttpClient) {}

  // CRUD Auditorías
  create(data: CreateAuditoriaDto): Observable<Auditoria> {
    return this.http.post<Auditoria>(this.apiUrl, data);
  }

  findAll(filters: FilterAuditoriaDto): Observable<any> {
    let params = new HttpParams();
    Object.keys(filters).forEach(key => {
      if (filters[key] !== null && filters[key] !== undefined) {
        params = params.set(key, filters[key].toString());
      }
    });
    return this.http.get<any>(this.apiUrl, { params });
  }

  findOne(id: number): Observable<Auditoria> {
    return this.http.get<Auditoria>(`${this.apiUrl}/${id}`);
  }

  update(id: number, data: any): Observable<Auditoria> {
    return this.http.patch<Auditoria>(`${this.apiUrl}/${id}`, data);
  }

  cancel(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }

  // Workflow de conteo
  iniciarConteo(id: number, data: any): Observable<Auditoria> {
    return this.http.post<Auditoria>(`${this.apiUrl}/${id}/iniciar-conteo`, data);
  }

  registrarConteo(id: number, data: any): Observable<Auditoria> {
    return this.http.post<Auditoria>(`${this.apiUrl}/${id}/registrar-conteo`, data);
  }

  escanearSerie(id: number, data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${id}/escanear-serie`, data);
  }

  uploadEvidencia(id: number, formData: FormData): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${id}/evidencia`, formData);
  }

  finalizarAuditoria(id: number, data: any): Observable<Auditoria> {
    return this.http.post<Auditoria>(`${this.apiUrl}/${id}/finalizar`, data);
  }

  // Análisis y ajustes
  getDiscrepancias(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}/discrepancias`);
  }

  generarAjustes(id: number, data: any): Observable<Ajuste[]> {
    return this.http.post<Ajuste[]>(`${this.apiUrl}/${id}/generar-ajustes`, data);
  }

  generarPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/pdf`, {
      responseType: 'blob'
    });
  }

  // Ajustes
  getAjustes(filters: any): Observable<any> {
    let params = new HttpParams();
    Object.keys(filters).forEach(key => {
      if (filters[key] !== null && filters[key] !== undefined) {
        params = params.set(key, filters[key].toString());
      }
    });
    return this.http.get<any>(`${this.apiUrl}/ajustes/listar`, { params });
  }

  autorizarAjuste(id: number, data: any): Observable<Ajuste> {
    return this.http.post<Ajuste>(`${this.apiUrl}/ajustes/${id}/autorizar`, data);
  }

  aplicarAjuste(id: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/ajustes/${id}/aplicar`, {});
  }

  // Métricas
  getMetricas(query: any): Observable<MetricasAuditoria> {
    let params = new HttpParams();
    Object.keys(query).forEach(key => {
      if (query[key] !== null && query[key] !== undefined) {
        params = params.set(key, query[key].toString());
      }
    });
    return this.http.get<MetricasAuditoria>(`${this.apiUrl}/metricas/dashboard`, { params });
  }
}
```

#### 3. Componentes Sugeridos

**Estructura de carpetas**:
```
src/app/components/inventario/auditorias/
├── auditorias-list/
│   ├── auditorias-list.component.ts
│   ├── auditorias-list.component.html
│   └── auditorias-list.component.scss
├── auditoria-create/
│   ├── auditoria-create.component.ts
│   ├── auditoria-create.component.html
│   └── auditoria-create.component.scss
├── auditoria-ejecutar/
│   ├── auditoria-ejecutar.component.ts      # Conteo físico
│   ├── auditoria-ejecutar.component.html
│   └── auditoria-ejecutar.component.scss
├── auditoria-discrepancias/
│   ├── auditoria-discrepancias.component.ts
│   ├── auditoria-discrepancias.component.html
│   └── auditoria-discrepancias.component.scss
├── ajustes-list/
│   ├── ajustes-list.component.ts
│   ├── ajustes-list.component.html
│   └── ajustes-list.component.scss
├── ajustes-autorizar/
│   ├── ajustes-autorizar.component.ts
│   ├── ajustes-autorizar.component.html
│   └── ajustes-autorizar.component.scss
└── metricas-dashboard/
    ├── metricas-dashboard.component.ts
    ├── metricas-dashboard.component.html
    └── metricas-dashboard.component.scss
```

#### 4. Características Clave por Componente

**auditorias-list.component**:
- Tabla con paginación (ng-bootstrap datatable)
- Filtros: estado, bodega, fechas
- Badges de color por estado
- Botones de acción: Ver, Editar, Ejecutar, Cancelar
- Progress bar de accuracy

**auditoria-create.component**:
- Formulario reactivo con validaciones
- Select de bodega (cargar de API)
- Select de estante (filtrado por bodega)
- Checkbox "Auditar todas las categorías"
- Multi-select de categorías (si no todas)
- DatePicker para fecha planificada

**auditoria-ejecutar.component**:
- Steps wizard: Iniciar → Contar → Series → Evidencias → Finalizar
- Lista de productos a contar con inputs
- Scanner de códigos de barras/QR (para series)
- Camera/file upload para evidencias
- Progress indicator (X de Y contados)
- Resumen antes de finalizar

**auditoria-discrepancias.component**:
- Tabs: Todas | Faltantes | Sobrantes | Conformes
- Cards de resumen con valores monetarios
- Tabla detallada de discrepancias
- Filtros por tipo, % discrepancia
- Botón "Generar Ajustes" para seleccionados

**ajustes-list.component**:
- Tabla con filtros por estado
- Badges de estado con colores
- Botones: Autorizar (si PENDIENTE), Aplicar (si AUTORIZADO)
- Modal de confirmación para acciones

**metricas-dashboard.component**:
- Cards de KPIs: Total auditorías, Accuracy %, Valor discrepancias
- Gráfico de líneas: Accuracy por mes (ApexCharts)
- Gráfico de barras: Discrepancias por categoría
- Tabla: Top productos con discrepancias recurrentes
- Filtros: Período, Bodega

#### 5. Helpers y Utilidades

```typescript
// helpers/auditoria.helpers.ts

export function getBadgeClassEstadoAuditoria(estado: EstadoAuditoria): string {
  const classes = {
    PLANIFICADA: 'badge-info',
    EN_PROGRESO: 'badge-warning',
    PENDIENTE_REVISION: 'badge-primary',
    COMPLETADA: 'badge-success',
    CANCELADA: 'badge-danger'
  };
  return classes[estado] || 'badge-secondary';
}

export function getBadgeClassEstadoAjuste(estado: EstadoAjuste): string {
  const classes = {
    PENDIENTE_AUTORIZACION: 'badge-warning',
    AUTORIZADO: 'badge-info',
    RECHAZADO: 'badge-danger',
    APLICADO: 'badge-success',
    CANCELADO: 'badge-secondary'
  };
  return classes[estado] || 'badge-secondary';
}

export function getIconoTipoDiscrepancia(tipo: TipoDiscrepancia): string {
  const iconos = {
    FALTANTE: 'ri-arrow-down-circle-line text-danger',
    SOBRANTE: 'ri-arrow-up-circle-line text-success',
    CONFORME: 'ri-checkbox-circle-line text-success'
  };
  return iconos[tipo] || '';
}

export function calcularAccuracyColor(accuracy: number): string {
  if (accuracy >= 95) return 'success';
  if (accuracy >= 90) return 'warning';
  return 'danger';
}
```

#### 6. Rutas (routing)

```typescript
// inventario-routing.module.ts
const routes: Routes = [
  {
    path: 'auditorias',
    children: [
      { path: '', component: AuditoriasListComponent },
      { path: 'nueva', component: AuditoriaCreateComponent },
      { path: ':id/ejecutar', component: AuditoriaEjecutarComponent },
      { path: ':id/discrepancias', component: AuditoriaDiscrepanciasComponent },
      { path: 'ajustes', component: AjustesListComponent },
      { path: 'ajustes/:id/autorizar', component: AjustesAutorizarComponent },
      { path: 'metricas', component: MetricasDashboardComponent },
    ]
  }
];
```

#### 7. Guards y Permisos

```typescript
// Sugerencias de permisos:
// - AUDITORIA_VER: Ver auditorías
// - AUDITORIA_CREAR: Crear y planificar
// - AUDITORIA_EJECUTAR: Ejecutar conteo
// - AJUSTE_AUTORIZAR: Autorizar/rechazar ajustes
// - AJUSTE_APLICAR: Aplicar ajustes al inventario
// - METRICAS_VER: Ver dashboard de métricas
```

#### 8. Validaciones en Formularios

```typescript
// Ejemplo de validaciones en auditoria-create
this.auditoriaForm = this.fb.group({
  tipo: ['COMPLETA', Validators.required],
  id_bodega: [null, Validators.required],
  id_estante: [null],
  incluir_todas_categorias: [true],
  categorias_a_auditar: [[]],
  fecha_planificada: [null],
  observaciones: ['', Validators.maxLength(500)]
});

// Validación condicional
this.auditoriaForm.get('incluir_todas_categorias').valueChanges.subscribe(value => {
  if (!value) {
    this.auditoriaForm.get('categorias_a_auditar').setValidators([Validators.required]);
  } else {
    this.auditoriaForm.get('categorias_a_auditar').clearValidators();
  }
  this.auditoriaForm.get('categorias_a_auditar').updateValueAndValidity();
});
```

#### 9. Manejo de Errores

```typescript
// Interceptor para errores
catchError((error: HttpErrorResponse) => {
  let errorMessage = 'Error desconocido';

  if (error.error instanceof ErrorEvent) {
    // Error del cliente
    errorMessage = error.error.message;
  } else {
    // Error del servidor
    switch (error.status) {
      case 400:
        errorMessage = error.error.message || 'Datos inválidos';
        break;
      case 403:
        errorMessage = 'No se puede realizar esta acción en el estado actual';
        break;
      case 404:
        errorMessage = 'Auditoría no encontrada';
        break;
      case 500:
        errorMessage = 'Error interno del servidor';
        break;
    }
  }

  // Mostrar con SweetAlert2 o Toastr
  this.toastr.error(errorMessage, 'Error');
  return throwError(() => error);
});
```

#### 10. Testing

```typescript
// auditoria-create.component.spec.ts
describe('AuditoriaCreateComponent', () => {
  it('should create form with validators', () => {
    expect(component.auditoriaForm).toBeDefined();
    expect(component.auditoriaForm.get('tipo').hasError('required')).toBeTruthy();
  });

  it('should call service.create on submit', () => {
    spyOn(service, 'create').and.returnValue(of(mockAuditoria));
    component.auditoriaForm.patchValue(validFormData);
    component.onSubmit();
    expect(service.create).toHaveBeenCalledWith(validFormData);
  });
});
```

---

## Próximos Pasos Backend

### ✅ Completado
1. ✅ Service implementado (17 métodos)
2. ✅ Controller implementado (16 endpoints)
3. ✅ Module creado y registrado
4. ✅ DTOs con validaciones

### 📋 Pendiente

1. **Template HTML** (`templates/inventario/auditoria.html`)
   - Diseño de reporte PDF
   - Tabla de discrepancias
   - Gráficos (opcional)

2. **Testing**
   - Unit tests del service
   - Integration tests de endpoints
   - E2E tests de workflows completos

---

## Recursos Adicionales

### Documentación de Referencia
- [Prisma ORM](https://www.prisma.io/docs)
- [NestJS](https://docs.nestjs.com)
- [jsReport](https://jsreport.net/learn)
- [MinIO](https://min.io/docs/minio/linux/index.html)

### Archivos Relacionados
- Schema Prisma: `prisma/schema.prisma`
- Módulo de inventario: `src/modules/inventario/CLAUDE.md`
- Módulo de MinIO: `src/modules/minio/CLAUDE.md`

---

**Última actualización:** 2025-01-12
**Versión:** 2.0
**Estado Backend:** ✅ 100% Implementado (Service, Controller, Module)
**Estado Frontend:** 📋 Pendiente - Ver Guía de Desarrollo arriba
