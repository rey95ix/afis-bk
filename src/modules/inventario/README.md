# Inventario Module

## Propósito
Sistema completo de gestión de inventario: compras locales, importaciones internacionales, requisiciones entre bodegas, órdenes de salida, tracking de números de serie, y auditoría completa de movimientos de inventario.

## Estructura del Módulo

```
inventario/
├── sucursales/                # Sucursales (branches)
├── bodegas/                   # Bodegas (warehouses)
├── estantes/                  # Estantes (shelves)
├── proveedores/               # Proveedores (suppliers)
├── catalogos-proveedores/     # Catálogos de proveedores
├── compras/                   # Compras locales
├── importaciones/             # Importaciones internacionales
├── requisiciones/             # Requisiciones (transferencias)
├── ordenes-salida/            # Órdenes de salida
├── items-inventario/          # Consulta de inventario
├── series/                    # Números de serie
└── movimientos-inventario/    # Historial de movimientos
```

---

## JERARQUÍA DE UBICACIONES

```
Sucursal (Branch)
    └── Bodega (Warehouse)
            └── Estante (Shelf)
```

### Tipos de Bodega
- **BODEGA**: Bodega fija en sucursal
- **CUADRILLA**: Inventario móvil de cuadrilla de técnicos

---

## 1. SUCURSALES

### Archivos
- `sucursales/sucursales.controller.ts`
- `sucursales/sucursales.service.ts`

### Endpoints
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/inventario/sucursales` | Listar sucursales |
| GET | `/inventario/sucursales/:id` | Obtener sucursal |
| POST | `/inventario/sucursales` | Crear sucursal |
| PUT | `/inventario/sucursales/:id` | Actualizar sucursal |
| DELETE | `/inventario/sucursales/:id` | Eliminar sucursal |

### Propósito
- Ubicaciones físicas de la empresa
- Contienen bodegas
- Usadas en requisiciones entre sucursales

### Tabla
- `sucursales`

---

## 2. BODEGAS

### Archivos
- `bodegas/bodegas.controller.ts`
- `bodegas/bodegas.service.ts`

### Endpoints
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/inventario/bodegas` | Listar bodegas (filtrar por sucursal) |
| GET | `/inventario/bodegas/:id` | Obtener bodega |
| POST | `/inventario/bodegas` | Crear bodega |
| PUT | `/inventario/bodegas/:id` | Actualizar bodega |
| DELETE | `/inventario/bodegas/:id` | Eliminar bodega |

### DTO
```typescript
{
  nombre: string;
  id_sucursal: number;
  tipo: TipoBodega;        // BODEGA / CUADRILLA
  descripcion?: string;
  estado?: Estado;
}
```

### Tipos
- **BODEGA**: Bodega fija para almacenamiento general
- **CUADRILLA**: Inventario móvil asignado a técnicos

### Tabla
- `bodegas`

---

## 3. ESTANTES

### Archivos
- `estantes/estantes.controller.ts`
- `estantes/estantes.service.ts`

### Endpoints
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/inventario/estantes` | Listar estantes (filtrar por bodega) |
| GET | `/inventario/estantes/:id` | Obtener estante |
| POST | `/inventario/estantes` | Crear estante |
| PUT | `/inventario/estantes/:id` | Actualizar estante |
| DELETE | `/inventario/estantes/:id` | Eliminar estante |

### DTO
```typescript
{
  nombre: string;
  id_bodega: number;
  descripcion?: string;
  capacidad?: number;
  estado?: Estado;
}
```

### Propósito
- Subdivisiones dentro de bodegas
- Ubicación específica de productos
- Facilita organización y búsqueda

### Tabla
- `estantes`

---

## 4. PROVEEDORES

### Archivos
- `proveedores/proveedores.controller.ts`
- `proveedores/proveedores.service.ts`
- `catalogos-proveedores/catalogos-proveedores.controller.ts`

### Endpoints Proveedores
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/inventario/proveedores` | Listar proveedores |
| GET | `/inventario/proveedores/:id` | Obtener proveedor |
| POST | `/inventario/proveedores` | Crear proveedor |
| PUT | `/inventario/proveedores/:id` | Actualizar proveedor |
| DELETE | `/inventario/proveedores/:id` | Eliminar proveedor |

### Endpoints Catálogos de Proveedor
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/inventario/proveedores/:id/catalogos` | Catálogo del proveedor |
| POST | `/inventario/proveedores/:id/catalogos` | Agregar producto a catálogo |
| PUT | `/inventario/catalogos-proveedores/:id` | Actualizar entrada |
| DELETE | `/inventario/catalogos-proveedores/:id` | Eliminar entrada |

### Tablas
- `proveedores`
- `catalogos_proveedores` - Mapeo entre productos internos y códigos de proveedor

---

## 5. COMPRAS LOCALES

### Archivos
- `compras/compras.controller.ts`
- `compras/compras.service.ts`

### Endpoints

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET | `/inventario/compras` | Listar compras (filtros) | Sí |
| GET | `/inventario/compras/:id` | Obtener compra con detalles | Sí |
| POST | `/inventario/compras` | Crear compra | Sí |
| PUT | `/inventario/compras/:id` | Actualizar compra | Sí |
| DELETE | `/inventario/compras/:id` | Eliminar compra (soft delete) | Sí |
| POST | `/inventario/compras/:id/recepcionar` | Recepcionar en inventario | Sí |
| GET | `/inventario/compras/catalogos/tipos-factura` | Tipos de factura (DTE) | Sí |

### DTOs

#### CreateCompraDto
```typescript
{
  numero_factura: string;
  numero_quedan?: string;
  detalle: string;
  nombre_proveedor: string;
  id_proveedor: number;
  id_forma_pago: number;
  dias_credito?: number;
  id_sucursal: number;
  id_bodega: number;
  id_estante: number;              // REQUERIDO en compras
  id_tipo_factura: number;
  fecha_factura: Date;
  fecha_de_pago?: Date;
  is_dte: boolean;                 // ¿Es DTE?
  json_dte?: string;               // JSON del DTE
  numeroControl?: string;          // DTE
  codigoGeneracion?: string;       // DTE
  subtotal: number;
  descuento?: number;
  cesc?: number;                   // Impuesto CESC
  fovial?: number;                 // Impuesto FOVIAL
  cotrans?: number;                // Impuesto COTRANS
  iva: number;                     // IVA 13%
  iva_retenido?: number;           // Retención de IVA
  iva_percivido?: number;          // Percepción de IVA
  total: number;
  detalles: CreateCompraDetalleDto[];
}
```

#### CreateCompraDetalleDto
```typescript
{
  id_catalogo: number;
  cantidad: number;
  precio_unitario: number;
  descuento?: number;
  observaciones?: string;
}
```

#### FilterCompraDto
```typescript
{
  page?: number;
  limit?: number;
  search?: string;
  id_proveedor?: number;
  id_sucursal?: number;
  id_bodega?: number;
  estado?: Estado;
  fecha_desde?: Date;
  fecha_hasta?: Date;
}
```

### Proceso de Recepción

**POST `/compras/:id/recepcionar`**

1. Valida que compra exista y esté ACTIVA
2. Para cada detalle de compra:
   - Crea o actualiza `items_inventario` (stock)
   - Si producto tiene serie, crea registros en tabla `series`
   - Crea `movimientos_inventario` tipo INGRESO
3. Marca compra como recepcionada
4. Registra en bitácora

**Body**:
```typescript
{
  series?: { [id_detalle: number]: string[] }  // Para productos con serie
}
```

### Impuestos y DTE

#### Impuestos de El Salvador
- **IVA**: 13% sobre subtotal
- **CESC**: Impuesto sobre combustibles
- **FOVIAL**: Fondo de vialidad
- **COTRANS**: Contribución al transporte
- **Retenciones**: IVA retenido (1%)
- **Percepciones**: IVA percibido

#### DTE (Documento Tributario Electrónico)
- Campo `is_dte` indica si factura es electrónica
- Campos DTE: `numeroControl`, `codigoGeneracion`, `json_dte`
- Tipos de factura según catálogo DTE

### Tablas
- `compras`
- `compras_detalle`
- `items_inventario` (actualizado al recepcionar)
- `movimientos_inventario` (creado al recepcionar)
- `series` (si producto tiene serie)

---

## 6. IMPORTACIONES INTERNACIONALES

### Archivos
- `importaciones/importaciones.controller.ts`
- `importaciones/importaciones.service.ts`

### Endpoints Principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/inventario/importaciones` | Listar importaciones (paginado) |
| GET | `/inventario/importaciones/counts-by-estado` | Conteo por estado |
| GET | `/inventario/importaciones/estado/:estado` | Filtrar por estado |
| GET | `/inventario/importaciones/:id` | Obtener importación completa |
| POST | `/inventario/importaciones` | Crear importación |
| PUT | `/inventario/importaciones/:id` | Actualizar importación |
| PATCH | `/inventario/importaciones/:id/estado` | Actualizar estado |
| DELETE | `/inventario/importaciones/:id` | Cancelar importación |

**Gastos de Importación:**
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/inventario/importaciones/:id/gastos` | Agregar gasto |
| GET | `/inventario/importaciones/:id/gastos` | Listar gastos |
| DELETE | `/inventario/importaciones/:id/gastos/:id_gasto` | Eliminar gasto |

**Retaceo (Distribución de Costos):**
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/inventario/importaciones/:id/calcular-retaceo` | Calcular distribución de costos |

**Recepción:**
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/inventario/importaciones/:id/recepcionar` | Recepcionar en inventario |

**Series:**
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/inventario/importaciones/detalle/:id_detalle/series` | Series de un item |
| POST | `/inventario/importaciones/detalle/:id_detalle/series` | Agregar series |
| PUT | `/inventario/importaciones/series/:id_serie` | Actualizar serie |
| DELETE | `/inventario/importaciones/series/:id_serie` | Eliminar serie |

### DTOs

#### CreateImportacionDto
```typescript
{
  id_proveedor: number;
  numero_factura_proveedor: string;
  numero_tracking?: string;
  incoterm: string;                // FOB/CIF/EXW/DDP/etc
  puerto_origen?: string;
  puerto_destino?: string;
  naviera_courier?: string;
  fecha_embarque?: Date;
  fecha_arribo_estimado?: Date;
  moneda: string;                  // USD/EUR/CNY/etc
  subtotal_mercancia: number;
  flete_internacional?: number;
  seguro?: number;
  tipo_cambio: number;             // Tasa de cambio a moneda local
  numero_declaracion?: string;     // Declaración aduanal
  agente_aduanal?: string;
  observaciones?: string;
  detalle: CreateImportacionDetalleDto[];
}
```

#### CreateImportacionDetalleDto
```typescript
{
  id_catalogo: number;
  cantidad: number;
  precio_unitario: number;         // En moneda de importación
  peso?: number;                   // En kg
  volumen?: number;                // En m³
  observaciones?: string;
}
```

#### CreateImportacionGastoDto
```typescript
{
  tipo: TipoGastoImportacion;      // FLETE_INTERNACIONAL/FLETE_LOCAL/SEGURO/ADUANA/ALMACENAJE/OTROS
  descripcion: string;
  monto: number;
  moneda: string;
  aplicar_retaceo: boolean;        // ¿Se distribuye entre productos?
  metodo_retaceo?: MetodoRetaceo;  // VALOR/PESO/VOLUMEN/CANTIDAD
}
```

#### UpdateEstadoImportacionDto
```typescript
{
  nuevo_estado: EstadoImportacion;
  observaciones?: string;
}
```

#### RecepcionarImportacionDto
```typescript
{
  id_bodega: number;
  id_estante: number;
  fecha_recepcion_real: Date;
  observaciones?: string;
  series?: { [id_detalle: number]: string[] };  // Para productos con serie
}
```

#### AddSeriesToDetalleDto
```typescript
{
  series: string[];                // Array de números de serie
}
```

### Estados de Importación (Máquina de Estados)

```
COTIZACION
  ↓
ORDEN_COLOCADA
  ↓
EN_TRANSITO
  ↓
EN_ADUANA
  ↓
LIBERADA
  ↓
RECIBIDA / CANCELADA
```

### Funcionalidades Clave

#### 1. Incoterms
Define responsabilidades y costos:
- **FOB** (Free On Board): Vendedor paga hasta puerto de origen
- **CIF** (Cost, Insurance, Freight): Vendedor paga hasta puerto destino
- **EXW** (Ex Works): Comprador paga todo desde fábrica
- **DDP** (Delivered Duty Paid): Vendedor paga todo incluyendo aranceles

#### 2. Multi-Moneda
- Soporte para múltiples monedas (USD, EUR, CNY, etc.)
- Tipo de cambio configurable
- Conversión automática a moneda local

#### 3. Gastos de Importación

Tipos de gastos:
- **FLETE_INTERNACIONAL**: Transporte marítimo/aéreo internacional
- **FLETE_LOCAL**: Transporte local en destino
- **SEGURO**: Seguro de mercancía
- **ADUANA**: Aranceles y derechos aduanales
- **ALMACENAJE**: Almacenamiento temporal
- **OTROS**: Otros gastos

#### 4. RETACEO (Cost Distribution)

**¿Qué es el Retaceo?**
Distribución proporcional de gastos adicionales (flete, seguro, aduana, etc.) entre todos los productos de la importación para calcular el costo unitario real.

**Métodos de Distribución:**

1. **POR VALOR** (VALOR):
   - Gasto distribuido proporcionalmente al valor de cada item
   - Fórmula: `costo_item / subtotal_total * gasto`

2. **POR PESO** (PESO):
   - Gasto distribuido proporcionalmente al peso
   - Fórmula: `peso_item / peso_total * gasto`

3. **POR VOLUMEN** (VOLUMEN):
   - Gasto distribuido proporcionalmente al volumen
   - Fórmula: `volumen_item / volumen_total * gasto`

4. **POR CANTIDAD** (CANTIDAD):
   - Gasto distribuido equitativamente
   - Fórmula: `(cantidad_item / cantidad_total) * gasto`

**Proceso:**
1. Crear importación con detalles
2. Agregar gastos marcados con `aplicar_retaceo=true`
3. Ejecutar `POST /importaciones/:id/calcular-retaceo`
4. Sistema calcula distribución y actualiza costos unitarios
5. Costo final = (costo item + costos distribuidos) / cantidad

**Tablas:**
- `importaciones_gastos` - Gastos registrados
- `retaceo_importacion` - Resumen del retaceo
- `retaceo_detalle` - Distribución por item

#### 5. Tracking de Números de Serie

- Se pueden agregar series antes de recepcionar
- Series vinculadas a detalles específicos
- Validación de series únicas
- Al recepcionar, series pasan a tabla principal `series`

#### 6. Recepción de Importación

**Proceso:**
1. Validar que importación esté en estado `LIBERADA`
2. Aplicar retaceo si hay gastos pendientes
3. Para cada detalle:
   - Crear/actualizar `items_inventario`
   - Transferir series a tabla `series`
   - Crear `movimientos_inventario` tipo INGRESO
4. Cambiar estado a `RECIBIDA`
5. Registrar en bitácora

#### 7. Restricciones de Edición

- Solo se puede editar en estados: `COTIZACION`, `ORDEN_COLOCADA`
- Estados posteriores son de solo lectura (excepto estado y observaciones)
- Cancelación permitida en cualquier estado antes de `RECIBIDA`

### Tablas
- `importaciones`
- `importaciones_detalle`
- `importaciones_series` (temporal, hasta recepción)
- `importaciones_gastos`
- `retaceo_importacion`
- `retaceo_detalle`
- `items_inventario` (actualizado al recepcionar)
- `movimientos_inventario` (creado al recepcionar)
- `series` (transferido al recepcionar)

---

## 7. REQUISICIONES (Transferencias)

### Archivos
- `requisiciones/requisiciones.controller.ts`
- `requisiciones/requisiciones.service.ts`

### Endpoints

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET | `/inventario/requisiciones` | Listar requisiciones (filtros) | Sí |
| GET | `/inventario/requisiciones/:id` | Obtener requisición con detalles | Sí |
| POST | `/inventario/requisiciones` | Crear requisición | Sí |
| PUT | `/inventario/requisiciones/:id` | Actualizar requisición | Sí |
| PATCH | `/inventario/requisiciones/:id/autorizar` | Autorizar o rechazar | Sí |
| PATCH | `/inventario/requisiciones/:id/procesar` | Procesar (ejecutar transferencia) | Sí |
| PATCH | `/inventario/requisiciones/:id/cancelar` | Cancelar requisición | Sí |
| GET | `/inventario/requisiciones/:id/pdf` | Generar PDF | Sí |
| DELETE | `/inventario/requisiciones/:id` | Eliminar requisición | Sí |

### DTOs

#### CreateRequisicionDto
```typescript
{
  tipo: TipoRequisicion;           // TRANSFERENCIA_BODEGA/TRANSFERENCIA_SUCURSAL/CAMBIO_ESTANTE
  id_sucursal_origen: number;
  id_bodega_origen: number;
  id_estante_origen: number;
  id_sucursal_destino: number;
  id_bodega_destino: number;
  id_estante_destino: number;
  motivo: string;
  detalle: CreateRequisicionDetalleDto[];
}
```

#### CreateRequisicionDetalleDto
```typescript
{
  id_catalogo: number;
  cantidad_solicitada: number;
  series?: number[];               // IDs de series específicas
  observaciones?: string;
}
```

#### UpdateRequisicionDto
```typescript
{
  // Solo editable en estado PENDIENTE
  motivo?: string;
  detalle?: CreateRequisicionDetalleDto[];
}
```

#### AuthorizeRequisicionDto
```typescript
{
  aprobada: boolean;               // true=aprobar, false=rechazar
  observaciones_autorizacion?: string;
  cantidades_autorizadas?: {       // Autorización parcial
    [id_detalle: number]: number;
  };
}
```

#### ProcessRequisicionDto
```typescript
{
  observaciones_proceso?: string;
  series_transferidas?: {
    [id_detalle: number]: number[];  // IDs de series a transferir
  };
}
```

### Estados de Requisición (Máquina de Estados)

```
PENDIENTE
  ↓
APROBADA / RECHAZADA
  ↓
PROCESADA / CANCELADA
```

### Tipos de Requisición

1. **TRANSFERENCIA_BODEGA**
   - Entre bodegas de la misma sucursal
   - No cambia sucursal

2. **TRANSFERENCIA_SUCURSAL**
   - Entre sucursales diferentes
   - Cambia sucursal y bodega

3. **CAMBIO_ESTANTE**
   - Dentro de la misma bodega
   - Solo cambia estante

### Workflow Multi-Usuario

#### Roles:
1. **Usuario Solicitante** (`usuario_solicita`)
   - Crea la requisición
   - Estado: PENDIENTE

2. **Usuario Autorizador** (`usuario_autoriza`)
   - Aprueba o rechaza
   - Puede autorizar cantidades parciales
   - Estado: APROBADA / RECHAZADA

3. **Usuario Procesador** (`usuario_procesa`)
   - Ejecuta la transferencia física
   - Registra movimientos de inventario
   - Estado: PROCESADA

### Funcionalidades Clave

#### Autorización Parcial
El autorizador puede modificar cantidades:
```typescript
{
  aprobada: true,
  cantidades_autorizadas: {
    1: 50,   // Detalle 1: autorizar 50 unidades (en vez de 100 solicitadas)
    2: 30    // Detalle 2: autorizar 30 unidades
  }
}
```

#### Transferencia de Series
Para productos con número de serie:
1. En creación: especificar IDs de series deseadas
2. En procesamiento: especificar IDs de series a transferir
3. Sistema valida que series estén disponibles en origen
4. Al procesar, actualiza ubicación de series

#### Procesamiento (Ejecución)

**POST `/requisiciones/:id/procesar`**

1. Valida que requisición esté APROBADA
2. Para cada detalle:
   - Reduce stock en origen
   - Aumenta stock en destino
   - Si tiene series, actualiza ubicación de cada serie
   - Crea 2 movimientos: SALIDA (origen) + INGRESO (destino)
3. Marca requisición como PROCESADA
4. Registra en bitácora

#### Validaciones
- Stock disponible en origen
- Series válidas y disponibles
- Destino diferente de origen
- Usuario autorizador ≠ usuario solicitante (configuración)

### PDF Generation
Genera documento de requisición con:
- Datos de origen y destino
- Lista de productos solicitados/autorizados
- Series incluidas (si aplica)
- Historial de estados
- Firmas (solicitante, autorizador, procesador)

Template: `templates/inventario/requisicion.html`

### Tablas
- `requisiciones`
- `requisiciones_detalle`
- `requisiciones_series`
- `items_inventario` (actualizado al procesar)
- `series` (ubicación actualizada al procesar)
- `movimientos_inventario` (creado al procesar)

---

## 8. ÓRDENES DE SALIDA

### Archivos
- `ordenes-salida/ordenes-salida.controller.ts`
- `ordenes-salida/ordenes-salida.service.ts`

### Endpoints

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET | `/inventario/ordenes-salida` | Listar órdenes (filtros) | Sí |
| GET | `/inventario/ordenes-salida/estadisticas` | Estadísticas | Sí |
| GET | `/inventario/ordenes-salida/:id` | Obtener orden con detalles | Sí |
| GET | `/inventario/ordenes-salida/:id/pdf` | Generar PDF | Sí |
| POST | `/inventario/ordenes-salida` | Crear orden | Sí |
| PUT | `/inventario/ordenes-salida/:id` | Actualizar orden | Sí |
| POST | `/inventario/ordenes-salida/:id/enviar-autorizacion` | Enviar a autorización | Sí |
| POST | `/inventario/ordenes-salida/:id/autorizar` | Autorizar orden | Sí |
| POST | `/inventario/ordenes-salida/:id/rechazar` | Rechazar orden | Sí |
| POST | `/inventario/ordenes-salida/:id/procesar` | Procesar (ejecutar salida) | Sí |
| POST | `/inventario/ordenes-salida/:id/cancelar` | Cancelar orden | Sí |
| DELETE | `/inventario/ordenes-salida/:id` | Eliminar orden | Sí |

### DTOs

#### CreateOrdenSalidaDto
```typescript
{
  id_bodega: number;
  motivo: string;
  tipo_salida: TipoSalida;         // VENTA/DONACION/GARANTIA/BAJA/OTRO
  detalle: CreateOrdenSalidaDetalleDto[];
  observaciones?: string;
}
```

#### CreateOrdenSalidaDetalleDto
```typescript
{
  id_catalogo: number;
  cantidad: number;
  series?: number[];               // IDs de series a sacar
  observaciones?: string;
}
```

#### AutorizarOrdenSalidaDto
```typescript
{
  observaciones_autorizacion?: string;
}
```

#### RechazarOrdenSalidaDto
```typescript
{
  motivo_rechazo: string;
}
```

#### ProcesarOrdenSalidaDto
```typescript
{
  observaciones_proceso?: string;
  series_salientes?: {
    [id_detalle: number]: number[];  // IDs de series que salen
  };
}
```

#### CancelarOrdenSalidaDto
```typescript
{
  motivo_cancelacion: string;
}
```

#### FilterOrdenSalidaDto
```typescript
{
  page?: number;
  limit?: number;
  search?: string;
  estado?: EstadoOrdenSalida;
  tipo_salida?: TipoSalida;
  id_bodega?: number;
  fecha_desde?: Date;
  fecha_hasta?: Date;
}
```

### Estados de Orden de Salida (Máquina de Estados)

```
BORRADOR
  ↓
PENDIENTE_AUTORIZACION
  ↓
AUTORIZADA / RECHAZADA
  ↓
PROCESADA / CANCELADA
```

### Tipos de Salida

- **VENTA**: Salida por venta a cliente
- **DONACION**: Salida por donación
- **GARANTIA**: Salida por garantía del proveedor
- **BAJA**: Salida por obsolescencia/daño
- **OTRO**: Otro tipo de salida

### Workflow

1. **Creación** (BORRADOR)
   - Usuario crea orden de salida
   - Define productos y cantidades
   - Estado: BORRADOR

2. **Enviar a Autorización**
   - Usuario solicita autorización
   - Estado: PENDIENTE_AUTORIZACION

3. **Autorización**
   - Supervisor revisa y autoriza/rechaza
   - Estado: AUTORIZADA / RECHAZADA

4. **Procesamiento** (Ejecución)
   - Usuario procesa la salida física
   - Reduce stock en inventario
   - Crea movimientos
   - Actualiza series (estado → BAJA/DONADO/etc)
   - Estado: PROCESADA

### Funcionalidades Clave

#### Validación de Stock
Antes de procesar, valida:
- Stock disponible en bodega
- Series especificadas existen y están disponibles
- Cantidades no exceden disponibles

#### Series en Salida
Para productos con serie:
- Especificar series al crear orden
- Series se marcan como reservadas
- Al procesar, se cambia estado de serie según tipo:
  - VENTA → INSTALADA_CLIENTE
  - BAJA → BAJA
  - DONACION → DONADA
  - GARANTIA → EN_GARANTIA

#### Procesamiento

**POST `/ordenes-salida/:id/procesar`**

1. Valida que orden esté AUTORIZADA
2. Valida stock disponible
3. Para cada detalle:
   - Reduce stock en bodega
   - Actualiza estado de series
   - Crea `movimientos_inventario` tipo SALIDA
4. Marca orden como PROCESADA
5. Registra en bitácora

#### Estadísticas
Endpoint `/estadisticas` retorna:
- Total de salidas por tipo
- Total de salidas por estado
- Valor total de salidas
- Salidas por período

#### PDF Generation
Genera documento de orden de salida con:
- Datos de bodega y usuario
- Lista de productos
- Series incluidas
- Autorizaciones y firmas

Template: `templates/inventario/orden-salida.html`

### Tablas
- `ordenes_salida`
- `ordenes_salida_detalle`
- `items_inventario` (actualizado al procesar)
- `series` (estado actualizado al procesar)
- `movimientos_inventario` (creado al procesar)

---

## 9. ITEMS INVENTARIO & SERIES

### Archivos Items
- `items-inventario/items-inventario.controller.ts`
- `items-inventario/items-inventario.service.ts`

### Archivos Series
- `series/series.controller.ts`
- `series/series.service.ts`

### Endpoints Items
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/inventario/items` | Listar stock (filtros múltiples) |
| GET | `/inventario/items/bodega/:id_bodega` | Stock por bodega |
| GET | `/inventario/items/catalogo/:id_catalogo` | Stock de un producto |
| GET | `/inventario/items/disponibles` | Solo items con stock > 0 |

### Endpoints Series
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/inventario/series` | Buscar series (filtros) |
| GET | `/inventario/series/:id` | Detalles de una serie |
| GET | `/inventario/series/numero/:numero_serie` | Buscar por número |
| GET | `/inventario/series/disponibles/:id_catalogo` | Series disponibles de un producto |
| GET | `/inventario/series/:id/historial` | Historial completo de movimientos |

### Items Inventario

**Tabla**: `items_inventario`

**Campos clave:**
```typescript
{
  id_catalogo: number;
  id_bodega: number;
  id_estante: number;
  cantidad_disponible: number;
  cantidad_reservada: number;
  cantidad_total: number;          // disponible + reservada
  costo_promedio: number;
  fecha_ultima_actualizacion: Date;
}
```

**Funcionalidad:**
- Vista consolidada de stock por producto/bodega/estante
- Calcula disponibilidad real
- Maneja reservas
- Costo promedio ponderado

### Series

**Tabla**: `series`

**Campos clave:**
```typescript
{
  numero_serie: string;            // Número de serie único
  id_catalogo: number;
  id_bodega: number;
  id_estante: number;
  estado_serie: EstadoSerie;       // DISPONIBLE/RESERVADA/INSTALADA_CLIENTE/BAJA/etc
  id_orden_trabajo?: number;       // Si está instalada en OT
  id_cliente?: number;             // Si está con cliente
  fecha_ingreso: Date;
  observaciones?: string;
}
```

**Estados de Serie:**
- `DISPONIBLE` - En bodega, disponible para uso
- `RESERVADA` - Reservada para orden/requisición
- `INSTALADA_CLIENTE` - Instalada en cliente
- `EN_TRANSITO` - En tránsito entre bodegas
- `BAJA` - Dada de baja
- `EN_GARANTIA` - En proceso de garantía
- `DONADA` - Donada
- `ROBADA` - Reportada como robada

### Historial de Series

**Tabla**: `historial_series`

Registra cada movimiento/cambio de una serie:
```typescript
{
  id_serie: number;
  accion: string;                  // INGRESO/SALIDA/TRANSFERENCIA/INSTALACION/etc
  estado_anterior?: EstadoSerie;
  estado_nuevo: EstadoSerie;
  id_bodega_origen?: number;
  id_bodega_destino?: number;
  id_usuario: number;
  fecha: Date;
  observaciones?: string;
  metadata_json?: string;          // Datos adicionales del contexto
}
```

**Uso:**
- Trazabilidad completa
- Auditoría de movimientos
- Lifecycle tracking
- Detección de patrones

---

## 10. MOVIMIENTOS INVENTARIO

### Archivos
- `movimientos-inventario/movimientos-inventario.controller.ts`
- `movimientos-inventario/movimientos-inventario.service.ts`

### Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/inventario/movimientos` | Listar movimientos (filtros) |
| GET | `/inventario/movimientos/:id` | Obtener movimiento |
| GET | `/inventario/movimientos/producto/:id_catalogo` | Movimientos de un producto |
| GET | `/inventario/movimientos/bodega/:id_bodega` | Movimientos de una bodega |

### Tabla

**movimientos_inventario**

```typescript
{
  tipo_movimiento: TipoMovimiento; // INGRESO/SALIDA/TRANSFERENCIA/AJUSTE
  id_catalogo: number;
  id_bodega_origen?: number;
  id_estante_origen?: number;
  id_bodega_destino?: number;
  id_estante_destino?: number;
  cantidad: number;
  costo_unitario?: number;
  id_serie?: number;               // Si es movimiento de serie
  id_usuario: number;
  tipo_documento: string;          // COMPRA/IMPORTACION/REQUISICION/ORDEN_SALIDA/OT/AJUSTE
  id_documento: number;            // ID del documento origen
  fecha: Date;
  observaciones?: string;
}
```

### Tipos de Movimiento

- **INGRESO**: Entrada a inventario
  - Origen: Compra, Importación
  - Destino: Bodega/Estante

- **SALIDA**: Salida de inventario
  - Origen: Bodega/Estante
  - Destino: Venta, Baja, Donación, OT

- **TRANSFERENCIA**: Movimiento entre ubicaciones
  - Origen: Bodega/Estante origen
  - Destino: Bodega/Estante destino
  - Documento: Requisición

- **AJUSTE**: Ajuste de inventario
  - Correcciones, tomas físicas

### Documentos Origen

| tipo_documento | id_documento | Descripción |
|----------------|--------------|-------------|
| COMPRA | id_compra | Compra local |
| IMPORTACION | id_importacion | Importación internacional |
| REQUISICION | id_requisicion | Transferencia interna |
| ORDEN_SALIDA | id_orden_salida | Salida formal |
| ORDEN_TRABAJO | id_orden_trabajo | Material usado en OT |
| AJUSTE | id_ajuste | Ajuste manual |

### Funcionalidades

- **Trazabilidad completa**: Cada movimiento vinculado a documento origen
- **Auditoría**: Todos los movimientos registrados con usuario y fecha
- **Consultas**: Filtrar por producto, bodega, fecha, tipo, documento
- **Reportes**: Base para reportes de movimientos y análisis

### Filtros Comunes

```typescript
{
  page?: number;
  limit?: number;
  tipo_movimiento?: TipoMovimiento;
  id_catalogo?: number;
  id_bodega_origen?: number;
  id_bodega_destino?: number;
  tipo_documento?: string;
  fecha_desde?: Date;
  fecha_hasta?: Date;
}
```

---

## Reglas de Negocio Transversales

### Validación de Stock
- Nunca permitir stock negativo
- Validar disponibilidad antes de transferencias/salidas
- Considerar stock reservado vs disponible

### Números de Serie
- Serie única en todo el sistema
- Validación de existencia y disponibilidad
- Tracking completo de lifecycle
- Historial inmutable

### Costos
- **Compras**: Costo según factura
- **Importaciones**: Costo con retaceo aplicado
- **Inventario**: Costo promedio ponderado
- Actualización automática al recibir

### Ubicaciones
- Jerarquía: Sucursal → Bodega → Estante
- Validación de existencia
- No permitir ubicaciones huérfanas

### Estados
- Usar enums definidos en Prisma
- Transiciones válidas según máquina de estados
- No permitir saltos de estados

### Multi-Usuario
- Segregación de funciones en workflows
- Registro de todos los usuarios involucrados
- Bitácora de todas las acciones

### Auditoría
- Todas las operaciones CUD → tabla `log`
- Todos los movimientos → tabla `movimientos_inventario`
- Todas las series → tabla `historial_series`

---

## Dependencias de Módulos

- `PrismaModule` - Base de datos
- `AuthModule` - Autenticación
- `AdministracionModule` - Catálogo, usuarios, sucursales

---

## Tablas de Base de Datos

| Tabla | Descripción |
|-------|-------------|
| `sucursales` | Sucursales/branches |
| `bodegas` | Bodegas/warehouses |
| `estantes` | Estantes/shelves |
| `proveedores` | Proveedores/suppliers |
| `catalogos_proveedores` | Catálogos de proveedores |
| `compras` | Compras locales |
| `compras_detalle` | Detalles de compras |
| `importaciones` | Importaciones internacionales |
| `importaciones_detalle` | Detalles de importaciones |
| `importaciones_series` | Series temporales de importación |
| `importaciones_gastos` | Gastos de importación |
| `retaceo_importacion` | Resumen de retaceo |
| `retaceo_detalle` | Detalle de distribución de costos |
| `requisiciones` | Requisiciones/transferencias |
| `requisiciones_detalle` | Detalles de requisiciones |
| `requisiciones_series` | Series en requisiciones |
| `ordenes_salida` | Órdenes de salida |
| `ordenes_salida_detalle` | Detalles de órdenes salida |
| `items_inventario` | Stock consolidado |
| `series` | Números de serie |
| `historial_series` | Historial de movimientos de series |
| `movimientos_inventario` | Todos los movimientos de inventario |
| `log` | Bitácora general |

---

## Notas de Implementación

1. **Retaceo**: Siempre calcular antes de recepcionar importación
2. **Series**: Validar unicidad global del número de serie
3. **Stock**: Usar transacciones de Prisma para operaciones que afecten múltiples registros
4. **PDFs**: Templates en `/templates/inventario/`
5. **Costos**: Mantener costo promedio ponderado en `items_inventario`
6. **Reservas**: Implementar mecanismo de reserva temporal para órdenes pendientes
7. **Workflows**: Respetar segregación de funciones (solicita ≠ autoriza ≠ procesa)
8. **Estados**: Nunca saltar estados en máquinas de estado
