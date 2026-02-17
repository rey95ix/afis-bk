# Modulo: Ordenes de Compra

## Descripcion
Modulo de gestion de ordenes de compra (OC) con ciclo de vida completo. Permite crear, aprobar, emitir y recepcionar ordenes de compra con control de cantidades y series. No se limita a compras de inventario: soporta cualquier tipo de compra (bienes, servicios, etc.). La recepcion se realiza generando compras vinculadas desde la OC, permitiendo recepciones parciales.

## Estructura
```
ordenes-compra/
├── ordenes-compra.module.ts              # Modulo principal
├── ordenes-compra.controller.ts          # 14 endpoints (CRUD + workflow)
├── ordenes-compra.service.ts             # Logica de negocio y workflow
├── CLAUDE.md                             # Esta documentacion
└── dto/
    ├── create-orden-compra.dto.ts        # DTO creacion (con detalle nested)
    ├── update-orden-compra.dto.ts        # DTO actualizacion (solo BORRADOR)
    ├── filter-orden-compra.dto.ts        # DTO filtros + paginacion + enum estados
    ├── aprobar-orden-compra.dto.ts       # DTO aprobacion (observaciones opcionales)
    ├── rechazar-orden-compra.dto.ts      # DTO rechazo (motivo requerido)
    ├── emitir-orden-compra.dto.ts        # DTO emision (observaciones opcionales)
    ├── generar-compra-oc.dto.ts          # DTO generar compra (factura, series, DTE)
    ├── cerrar-orden-compra.dto.ts        # DTO cierre manual (observaciones opcionales)
    └── cancelar-orden-compra.dto.ts      # DTO cancelacion (motivo requerido)
```

## Modelos Prisma

### `ordenes_compra`
Tabla principal con campos de cabecera, FK a proveedor, sucursal, bodega, forma_pago, usuarios (crea/aprueba), totales calculados server-side, fechas de workflow y observaciones por etapa.

### `ordenes_compra_detalle`
Lineas de la OC. Campos: id_catalogo (opcional), codigo, nombre, descripcion, tiene_serie, cantidad_ordenada, cantidad_recibida, costo_unitario, subtotal, descuentos, iva, total. Cascade delete con la OC padre.

### `enum estado_orden_compra`
```
BORRADOR | PENDIENTE_APROBACION | APROBADA | RECHAZADA | EMITIDA |
RECEPCION_PARCIAL | RECEPCION_TOTAL | CERRADA | CANCELADA
```

### FK en `compras`
`compras.id_orden_compra` → vincula compras generadas desde la OC.

## Maquina de Estados

```
                          ┌──────────────┐
                          │  BORRADOR    │◄─────────────────┐
                          └──────┬───────┘                  │
                  enviarAprobacion│                   reabrir│
                                 ▼                          │
                     ┌───────────────────────┐              │
                     │ PENDIENTE_APROBACION  │              │
                     └─────┬──────────┬──────┘              │
                   aprobar │          │ rechazar             │
                           ▼          ▼                     │
                    ┌──────────┐  ┌───────────┐             │
                    │ APROBADA │  │ RECHAZADA ├─────────────┘
                    └────┬─────┘  └───────────┘
                  emitir │
                         ▼
                    ┌──────────┐
                    │ EMITIDA  │
                    └────┬─────┘
            generarCompra│
                         ▼
              ┌─────────────────────┐   generarCompra (todas recibidas)
              │ RECEPCION_PARCIAL   ├──────────────────────┐
              └─────────┬───────────┘                      │
               cerrar   │                                  ▼
              (manual)  │                          ┌──────────────┐
                        ▼                          │   CERRADA    │
                 ┌──────────────┐                  │  (auto)      │
                 │   CERRADA    │                  └──────────────┘
                 │  (manual)    │
                 └──────────────┘

  * CANCELADA: alcanzable desde BORRADOR, PENDIENTE_APROBACION, APROBADA, EMITIDA
               (EMITIDA solo si no tiene compras generadas)
```

## Endpoints

Base: `inventario/ordenes-compra`

| Metodo | Ruta | Permiso | Descripcion |
|--------|------|---------|-------------|
| POST | `/` | `inventario.ordenes_compra:crear` | Crear OC en estado BORRADOR |
| GET | `/` | `inventario.ordenes_compra:ver` | Listar OC con filtros y paginacion |
| GET | `/estadisticas` | `inventario.ordenes_compra:ver` | Conteos por estado |
| GET | `/:id` | `inventario.ordenes_compra:ver` | Detalle de OC con relaciones |
| PUT | `/:id` | `inventario.ordenes_compra:editar` | Actualizar OC (solo BORRADOR) |
| DELETE | `/:id` | `inventario.ordenes_compra:eliminar` | Eliminar OC (BORRADOR o CANCELADA) |
| POST | `/:id/enviar-aprobacion` | `inventario.ordenes_compra:enviar_aprobacion` | BORRADOR → PENDIENTE_APROBACION |
| POST | `/:id/aprobar` | `inventario.ordenes_compra:aprobar` | PENDIENTE_APROBACION → APROBADA |
| POST | `/:id/rechazar` | `inventario.ordenes_compra:rechazar` | PENDIENTE_APROBACION → RECHAZADA |
| POST | `/:id/reabrir` | `inventario.ordenes_compra:editar` | RECHAZADA → BORRADOR |
| POST | `/:id/emitir` | `inventario.ordenes_compra:emitir` | APROBADA → EMITIDA |
| POST | `/:id/generar-compra` | `inventario.ordenes_compra:generar_compra` | EMITIDA/RECEPCION_PARCIAL → crea compra vinculada |
| POST | `/:id/cerrar` | `inventario.ordenes_compra:cerrar` | RECEPCION_PARCIAL → CERRADA (manual) |
| POST | `/:id/cancelar` | `inventario.ordenes_compra:cancelar` | Cancelar OC (varios estados) |

## DTOs

### CreateOrdenCompraDto
Cabecera: `id_proveedor` (req), `id_sucursal?`, `id_bodega?`, `id_forma_pago?`, `dias_credito?`, `moneda?` (default USD), `motivo?`, `observaciones?`, `fecha_entrega_esperada?`.
Detalle nested (array req): `id_catalogo?`, `codigo?`, `nombre` (req), `descripcion?`, `tiene_serie?`, `cantidad_ordenada` (req, min 1), `costo_unitario?`, `descuento_porcentaje?`, `descuento_monto?`, `observaciones?`.

### UpdateOrdenCompraDto
Mismos campos que Create pero todos opcionales. Solo aplicable en estado BORRADOR.

### FilterOrdenCompraDto
`estado?`, `id_proveedor?`, `id_sucursal?`, `id_bodega?`, `codigo?`, `search?`, `fecha_desde?`, `fecha_hasta?`, `page?` (default 1), `limit?` (default 10). Define tambien el enum `EstadoOrdenCompra`.

### AprobarOrdenCompraDto
`observaciones_aprobacion?` - notas de aprobacion.

### RechazarOrdenCompraDto
`motivo_rechazo` (req) - razon del rechazo.

### EmitirOrdenCompraDto
`observaciones?` - notas de emision.

### GenerarCompraOcDto
Cabecera: `numero_factura` (req), `numero_quedan?`, `id_estante` (req), `id_tipo_factura?`, `fecha_factura` (req), `fecha_de_pago?`, `is_dte?`, `json_dte?`, `numeroControl?`, `codigoGeneracion?`.
Detalle nested (array req): `id_orden_compra_detalle` (req), `cantidad_a_recibir` (req, min 1), `costo_unitario?`, `series?` (string[], requerido si tiene_serie).

### CerrarOrdenCompraDto
`observaciones?` - notas de cierre.

### CancelarOrdenCompraDto
`motivo` (req) - razon de cancelacion.

## Reglas de Negocio

1. **Edicion solo en BORRADOR**: update() valida que la OC este en estado BORRADOR; de lo contrario lanza BadRequestException.
2. **Al menos un detalle**: enviarAprobacion() valida que la OC tenga al menos una linea de detalle.
3. **Codigo auto-generado**: formato `OC-YYYYMM-#####`, secuencial por mes.
4. **Totales calculados server-side**: IVA fijo 13%. subtotal, descuento, iva y total se recalculan en create/update.
5. **Validacion de cantidades en recepcion**: generarCompra() verifica que `cantidad_a_recibir <= cantidad_restante` por linea.
6. **Series obligatorias si tiene_serie**: cuando `tiene_serie=true`, la cantidad de series debe coincidir exactamente con `cantidad_a_recibir`. Se validan duplicados.
7. **Auto-cierre**: si tras generar compra todas las lineas tienen `cantidad_recibida >= cantidad_ordenada`, la OC pasa automaticamente a CERRADA con `fecha_cierre`.
8. **Cancelacion con restricciones**: una OC EMITIDA no se puede cancelar si ya tiene compras generadas.
9. **Eliminacion restringida**: solo se pueden eliminar OC en estado BORRADOR o CANCELADA.
10. **Transaccion atomica en generarCompra**: crea la compra, las series, actualiza cantidades recibidas y el estado de la OC en una sola transaccion Prisma.

## Permisos (11 totales)

### CRUD estandar (4)
| Permiso | Descripcion |
|---------|-------------|
| `inventario.ordenes_compra:ver` | Ver listado y detalles |
| `inventario.ordenes_compra:crear` | Crear nuevas OC |
| `inventario.ordenes_compra:editar` | Modificar OC en borrador + reabrir |
| `inventario.ordenes_compra:eliminar` | Eliminar OC (critico) |

### Custom workflow (7)
| Permiso | Descripcion |
|---------|-------------|
| `inventario.ordenes_compra:enviar_aprobacion` | Enviar OC a aprobacion |
| `inventario.ordenes_compra:aprobar` | Aprobar OC pendientes |
| `inventario.ordenes_compra:rechazar` | Rechazar OC |
| `inventario.ordenes_compra:emitir` | Emitir OC al proveedor |
| `inventario.ordenes_compra:generar_compra` | Generar compra desde OC |
| `inventario.ordenes_compra:cerrar` | Cerrar OC manualmente |
| `inventario.ordenes_compra:cancelar` | Cancelar OC |

Todos los permisos tienen `requiere_auditoria: true`. `eliminar` ademas tiene `es_critico: true`.

## Integracion con Otros Modulos

- **ComprasModule**: `generarCompra()` crea un registro en `compras` vinculado via `id_orden_compra`. Tambien crea `ComprasDetalle` e `inventario_series`.
- **Proveedores**: FK `id_proveedor` para vincular la OC al proveedor.
- **Catalogo**: FK opcional `id_catalogo` en detalle para vincular a productos del catalogo.
- **Sucursales / Bodegas / Estantes**: destino de la mercaderia. El estante se valida contra la bodega de la OC al generar compra.
- **dTEFormaPago**: FK `id_forma_pago` para condiciones de pago.

## Pendientes / Roadmap

### 1. Soporte para compras de servicios
Las OC no se limitan a inventario. Se necesita soportar lineas de servicio: sin vinculo a catalogo, sin serie, sin bodega/estante obligatorio. El modelo ya permite `id_catalogo` nullable, pero falta formalizar el concepto de "linea de servicio" y ajustar validaciones.

### 2. Mejora en carga de DTE JSON
Al convertir OC → Compra, la UI ya soporta DTE (campo `json_dte`, `is_dte`, `numeroControl`, `codigoGeneracion`). Pendiente mejorar la experiencia de carga del JSON (drag & drop, input file, parseo automatico de campos del DTE).

### 3. Desembolsos anticipados en emision
En la transicion EMITIDA, a veces se realizan pagos anticipados (deposito, cheque) sin factura del proveedor. Esto requiere integracion con `MovimientosBancariosService.crearMovimiento()` del modulo Bancos (`modulo_origen: 'COMPRAS'`). **Propuesta**: agregar endpoint `POST /:id/registrar-desembolso` que cree un movimiento bancario tipo SALIDA y lo vincule a la OC.

### 4. Conexion con Cuentas por Pagar (CXP)
Si `id_forma_pago` indica credito, al generar compra se deberia crear automaticamente una Cuenta por Pagar. Modulo CXP pendiente de desarrollo. Conexion prevista: `compras.id_orden_compra → cxp.id_compra`.
