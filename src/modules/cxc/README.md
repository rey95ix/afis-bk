# Modulo: Cuentas por Cobrar (CxC)

## Descripcion
Modulo de gestion de cuentas por cobrar que administra el credito otorgado a clientes mediante facturas a credito. Controla saldos pendientes, registra abonos con integracion bancaria (optimistic locking), y proporciona reportes de antiguedad de deuda. Las CxC se crean automaticamente desde el modulo de facturacion al emitir una factura a credito.

## Estructura
```
cxc/
├── cxc.module.ts              # Modulo principal (exporta CxcService)
├── cxc.controller.ts          # Endpoints REST (8 endpoints)
├── cxc.service.ts             # Logica core: CRUD, abonos, saldos, reportes
├── CLAUDE.md                  # Esta documentacion
└── dto/
    ├── index.ts               # Barrel exports
    ├── consultar-cxc.dto.ts   # DTO filtros + paginacion (extiende PaginationDto)
    ├── crear-abono.dto.ts     # DTO registro de abono
    └── anular-abono.dto.ts    # DTO anulacion de abono
```

## Modelos Prisma

### `cuenta_por_cobrar`
- `id_cxc` (PK, autoincrement)
- `id_factura_directa` (FK unique → facturaDirecta) — relacion 1:1 con factura
- `id_cliente_directo` (FK → clienteDirecto)
- `monto_total`, `saldo_pendiente`, `total_abonado` — Decimal(12,2)
- `fecha_emision`, `fecha_vencimiento` — calculada con `dias_credito`
- `dias_credito` (default 30)
- `estado` — enum `estado_cxc`: PENDIENTE, PAGADA_PARCIAL, PAGADA_TOTAL, VENCIDA, ANULADA
- `monto_mora`, `id_mora_config` — configuracion de mora (opcional)
- `id_sucursal` (FK → sucursales)
- `id_usuario_crea` (FK → usuarios)
- `observaciones` (Text, opcional)
- Relacion: `abonos` → abono_cxc[]

### `abono_cxc`
- `id_abono` (PK, autoincrement)
- `id_cxc` (FK → cuenta_por_cobrar)
- `monto`, `saldo_anterior`, `saldo_posterior` — Decimal(12,2)
- `metodo_pago` — enum `metodo_pago_abono`: EFECTIVO, CHEQUE, TRANSFERENCIA, DEPOSITO, TARJETA, OTRO
- `referencia` (VarChar 200, opcional)
- `fecha_pago` (default now)
- `id_movimiento_bancario` (nullable) — vinculo con movimiento bancario creado
- `id_usuario` (FK → usuarios)
- `observaciones` (Text, opcional)
- `activo` (Boolean, default true) — soft delete para anulacion

## Endpoints (`cxc/cuentas-por-cobrar`)

| Metodo | Ruta | Permiso | Descripcion |
|--------|------|---------|-------------|
| GET | `/` | `cxc.cuentas:ver` | Listar CxC (paginado, filtros por cliente, estado, sucursal, fechas) |
| GET | `/vencidas` | `cxc.cuentas:ver` | CxC vencidas agrupadas por antiguedad (buckets 1-30, 31-60, 61-90, 90+) |
| GET | `/resumen` | `cxc.cuentas:ver` | Resumen general: pendientes, vencidas, cobrado, pagadas |
| GET | `/cliente/:id` | `cxc.cuentas:ver` | Estado de cuenta de un cliente con resumen de deuda |
| GET | `/:id` | `cxc.cuentas:ver` | Detalle de CxC con abonos activos |
| POST | `/:id/abonos` | `cxc.abonos:crear` | Registrar abono con integracion bancaria opcional |
| PATCH | `/abonos/:id/anular` | `cxc.abonos:anular` | Anular abono (reversa de saldo y movimiento bancario) |
| POST | `/actualizar-vencidos` | `cxc.cuentas:editar` | Batch: marcar como VENCIDA las CxC con fecha_vencimiento < hoy |

## Reglas de Negocio

### Flujo de Estados
```
PENDIENTE → PAGADA_PARCIAL → PAGADA_TOTAL
    ↓              ↓
  VENCIDA    VENCIDA (si pasa fecha_vencimiento)
    ↓
PAGADA_PARCIAL → PAGADA_TOTAL

Cualquier estado (sin abonos) → ANULADA (por anulacion de factura)
```

### Creacion de CxC
- Solo se crean desde `crearCuentaPorCobrar()`, invocado por facturacion al crear factura a credito
- Requiere cliente registrado (`id_cliente_directo`)
- `fecha_vencimiento` = `fecha_emision` + `dias_credito`
- Saldo inicial = monto_total, total_abonado = 0
- Acepta `tx` (Prisma.TransactionClient) para participar en la transaccion de facturacion

### Calculo de Saldos en Abonos
- `saldo_posterior` = `saldo_pendiente` - `monto_abono`
- `total_abonado` = `total_abonado` + `monto_abono`
- Si `saldo_posterior` == 0 → estado = PAGADA_TOTAL, factura.estado_pago = PAGADO
- Si `saldo_posterior` > 0 → estado = PAGADA_PARCIAL, factura.estado_pago = PARCIAL
- Monto del abono NO puede exceder saldo pendiente
- No se permiten abonos a CxC con estado PAGADA_TOTAL o ANULADA

### Integracion Bancaria en Abonos
- Si se proporciona `id_cuenta_bancaria` en el abono:
  - Valida que metodo_pago sea compatible (CHEQUE, TRANSFERENCIA, DEPOSITO)
  - Crea movimiento bancario tipo ENTRADA con modulo_origen = CUENTAS_POR_COBRAR
  - Actualiza saldo de cuenta bancaria con optimistic locking (version check)
  - Vincula `id_movimiento_bancario` al abono
  - ConflictException si falla el version check

### Anulacion de Abonos
- Marca abono como `activo = false` (soft delete)
- Recalcula saldo CxC: `saldo_pendiente` + monto, `total_abonado` - monto
- Actualiza estado CxC y estado_pago de factura
- Si tenia movimiento bancario: crea movimiento de reversa (SALIDA) con optimistic locking
- No se puede anular un abono ya anulado ni de una CxC anulada

### Anulacion de CxC por Factura
- `anularCxcPorFactura()` invocado desde facturacion al anular una factura
- Si la CxC tiene abonos (total_abonado > 0) → BadRequestException (debe anular abonos primero)
- Cambia estado a ANULADA
- Acepta `tx` para participar en la transaccion de facturacion

### Reporte de Vencidas
- Agrupa CxC vencidas en buckets de antiguedad: 1-30, 31-60, 61-90, 90+ dias
- Calcula total y count por bucket
- Filtrable por sucursal

## Integracion con Otros Modulos

### Facturacion → CxC (consumo principal)
- Facturacion importa `CxcModule` y usa `CxcService.crearCuentaPorCobrar()` al crear factura a credito
- Facturacion usa `CxcService.anularCxcPorFactura()` al anular factura
- Ambos metodos aceptan `tx` (Prisma.TransactionClient) para transacciones atomicas

### CxC → Bancos
- Al registrar abono con cuenta bancaria, CxC crea movimiento bancario directamente via Prisma
- Usa optimistic locking (campo `version` de cuenta_bancaria) para concurrencia
- `modulo_origen`: `CUENTAS_POR_COBRAR`, `documento_origen_id`: id_cxc

## Permisos (6 totales)
- `cxc.cuentas:ver` — Ver listado y detalles de CxC
- `cxc.cuentas:crear` — Crear CxC (requiere auditoria)
- `cxc.cuentas:editar` — Editar CxC y actualizar estados (requiere auditoria)
- `cxc.abonos:ver` — Ver abonos de CxC
- `cxc.abonos:crear` — Registrar abonos (requiere auditoria)
- `cxc.abonos:anular` — Anular abonos (critico, requiere auditoria)
