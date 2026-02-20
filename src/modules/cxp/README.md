# Modulo de Cuentas por Pagar (CxP)

## Descripcion

Modulo para gestionar las cuentas por pagar a proveedores. Se crea automaticamente una CxP cuando una compra se registra como credito. Permite registrar pagos parciales/totales y provee reportes de vencimiento.

## Estructura

```
cxp/
├── cxp.module.ts          # Modulo NestJS
├── cxp.service.ts         # Logica de negocio
├── cxp.controller.ts      # Endpoints REST
├── dto/
│   ├── index.ts
│   ├── consultar-cxp.dto.ts    # Filtros de consulta
│   ├── crear-pago.dto.ts       # Registro de pagos
│   └── anular-pago.dto.ts      # Anulacion de pagos
└── README.md
```

## Modelos Prisma

### cuenta_por_pagar
- `id_cxp` (PK)
- `id_compras` (FK unique a compras)
- `id_proveedor` (FK a proveedores)
- `monto_total`, `saldo_pendiente`, `total_pagado`
- `fecha_emision`, `fecha_vencimiento`, `dias_credito`
- `estado` (PENDIENTE | PAGADA_PARCIAL | PAGADA_TOTAL | VENCIDA | ANULADA)
- `id_sucursal`, `id_usuario_crea`

### pago_cxp
- `id_pago` (PK)
- `id_cxp` (FK a cuenta_por_pagar)
- `monto`, `saldo_anterior`, `saldo_posterior`
- `metodo_pago` (reutiliza enum metodo_pago_abono)
- `referencia`, `fecha_pago`, `id_movimiento_bancario`
- `id_usuario`, `activo` (soft delete)

## Endpoints

| Metodo | Ruta | Permiso | Descripcion |
|--------|------|---------|-------------|
| GET | `/cxp/cuentas-por-pagar` | `cxp.cuentas:ver` | Listar con filtros y paginacion |
| GET | `/cxp/cuentas-por-pagar/vencidas` | `cxp.cuentas:ver` | Vencidas con aging buckets |
| GET | `/cxp/cuentas-por-pagar/resumen` | `cxp.cuentas:ver` | Resumen general |
| GET | `/cxp/cuentas-por-pagar/proveedor/:id` | `cxp.cuentas:ver` | Estado de cuenta proveedor |
| GET | `/cxp/cuentas-por-pagar/:id` | `cxp.cuentas:ver` | Detalle de una CxP |
| POST | `/cxp/cuentas-por-pagar/:id/pagos` | `cxp.pagos:crear` | Registrar pago |
| PATCH | `/cxp/cuentas-por-pagar/pagos/:id/anular` | `cxp.pagos:anular` | Anular pago |
| POST | `/cxp/cuentas-por-pagar/actualizar-vencidos` | `cxp.cuentas:editar` | Batch update vencidos |

## Reglas de Negocio

1. **Creacion automatica**: Al crear compra con `es_credito=true`, se genera CxP con estado PENDIENTE
2. **Pagos parciales**: Multiples pagos hasta completar el saldo. Estado cambia a PAGADA_PARCIAL
3. **Pago total**: Cuando saldo_pendiente = 0, estado cambia a PAGADA_TOTAL
4. **Movimientos bancarios**: Pagos con CHEQUE/TRANSFERENCIA/DEPOSITO crean movimiento bancario tipo SALIDA
5. **Anulacion de pagos**: Revierte el saldo y crea movimiento bancario tipo ENTRADA (reversa)
6. **Anulacion por compra**: Si se elimina una compra, la CxP se anula (solo si no tiene pagos)
7. **Vencimiento**: Cuentas vencidas se agrupan en buckets 1-30, 31-60, 61-90, 90+ dias
8. **Optimistic locking**: Actualizacion de saldos bancarios usa version check

## Integraciones

- **compras.service.ts**: Llama a `crearCuentaPorPagar()` al crear compra a credito y `anularCxpPorCompra()` al eliminar
- **ordenes-compra.service.ts**: Llama a `crearCuentaPorPagar()` al generar compra desde OC con credito
- **Modulo de Bancos**: Movimientos bancarios SALIDA/ENTRADA para pagos/reversas

## Permisos

- `cxp.cuentas:ver` - Consultar cuentas por pagar
- `cxp.cuentas:editar` - Actualizar estados vencidos
- `cxp.pagos:crear` - Registrar pagos
- `cxp.pagos:anular` - Anular pagos
