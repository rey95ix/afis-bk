# Documentación - Módulo de Órdenes de Salida

## Descripción General

El módulo de **Órdenes de Salida** permite gestionar todas las salidas de inventario de las bodegas, con un flujo completo de autorización y procesamiento que garantiza el control y trazabilidad de los materiales.

## Tabla de Contenidos

- [Estados de una Orden de Salida](#estados-de-una-orden-de-salida)
- [Tipos de Órdenes de Salida](#tipos-de-órdenes-de-salida)
- [Flujo Completo](#flujo-completo)
- [Endpoints Disponibles](#endpoints-disponibles)
- [Casos de Uso](#casos-de-uso)

---

## Estados de una Orden de Salida

Una orden de salida pasa por los siguientes estados durante su ciclo de vida:

1. **BORRADOR**: Estado inicial cuando se crea la orden. Permite ediciones.
2. **PENDIENTE_AUTORIZACION**: La orden fue enviada para revisión y autorización.
3. **AUTORIZADA**: La orden fue aprobada y está lista para ser procesada.
4. **RECHAZADA**: La orden fue rechazada por el autorizador.
5. **PROCESADA**: La salida fue ejecutada físicamente del inventario.
6. **CANCELADA**: La orden fue cancelada (puede hacerse antes de procesar).

### Diagrama de Estados

```
┌──────────┐
│ BORRADOR │ ─────┐
└──────────┘      │
     │            │ (Eliminar)
     │ (Enviar)   │
     ▼            ▼
┌───────────────────────┐      ┌───────────┐
│ PENDIENTE_AUTORIZACION│──────│ CANCELADA │
└───────────────────────┘      └───────────┘
     │           │
     │(Autorizar)│(Rechazar)
     ▼           ▼
┌────────────┐  ┌───────────┐
│ AUTORIZADA │  │ RECHAZADA │
└────────────┘  └───────────┘
     │
     │(Procesar)
     ▼
┌───────────┐
│ PROCESADA │
└───────────┘
```

---

## Tipos de Órdenes de Salida

El sistema soporta los siguientes tipos de salidas:

- **VENTA**: Salida por venta a clientes
- **DONACION**: Salida por donación
- **BAJA_INVENTARIO**: Baja de productos defectuosos o no utilizables
- **DEVOLUCION_PROVEEDOR**: Devolución de mercancía a proveedores
- **TRASLADO_EXTERNO**: Traslado a ubicaciones externas
- **CONSUMO_INTERNO**: Uso interno de materiales
- **MERMA**: Pérdida de inventario
- **OTRO**: Otros tipos no especificados

---

## Flujo Completo

### 1. Crear Orden de Salida (BORRADOR)

**Endpoint**: `POST /inventario/ordenes-salida`

**Descripción**: Crea una nueva orden de salida en estado BORRADOR.

**Request Body**:
```json
{
  "tipo": "VENTA",
  "id_bodega_origen": 1,
  "id_sucursal_origen": 1,
  "destinatario": "Juan Pérez",
  "documento_destinatario": "01234567-8",
  "direccion_destino": "Calle Principal #123, San Salvador",
  "telefono_destinatario": "7123-4567",
  "numero_documento": "FAC-2025-0001",
  "referencia_externa": "ORDEN-CLIENTE-123",
  "motivo": "Venta de productos según orden del cliente",
  "id_usuario_solicita": 1,
  "detalle": [
    {
      "id_catalogo": 5,
      "cantidad_solicitada": 10,
      "costo_unitario": 25.50,
      "observaciones": "Material en buen estado"
    },
    {
      "id_catalogo": 8,
      "cantidad_solicitada": 5,
      "costo_unitario": 15.00
    }
  ]
}
```

**Response**:
```json
{
  "statusCode": 200,
  "data": {
    "id_orden_salida": 1,
    "codigo": "OS-202511-00001",
    "tipo": "VENTA",
    "estado": "BORRADOR",
    "destinatario": "Juan Pérez",
    "subtotal": 330.00,
    "total": 330.00,
    "detalle": [...]
  },
  "message": "OK"
}
```

**Notas**:
- El código se genera automáticamente con formato `OS-YYYYMM-#####`
- Los subtotales se calculan automáticamente
- Se valida la existencia de la bodega y productos

---

### 2. Actualizar Orden de Salida (BORRADOR)

**Endpoint**: `PATCH /inventario/ordenes-salida/:id`

**Descripción**: Permite modificar una orden que está en estado BORRADOR.

**Request Body** (todos los campos son opcionales):
```json
{
  "destinatario": "Juan Carlos Pérez",
  "telefono_destinatario": "7123-9999",
  "detalle": [
    {
      "id_catalogo": 5,
      "cantidad_solicitada": 15,
      "costo_unitario": 25.50
    }
  ]
}
```

**Restricción**: Solo se pueden actualizar órdenes en estado BORRADOR.

---

### 3. Enviar a Autorización

**Endpoint**: `POST /inventario/ordenes-salida/:id/enviar-autorizacion`

**Descripción**: Cambia el estado de BORRADOR a PENDIENTE_AUTORIZACION.

**Request Body**:
```json
{
  "id_usuario": 1
}
```

**Validaciones**:
- La orden debe estar en estado BORRADOR
- Debe tener al menos un producto en el detalle

---

### 4a. Autorizar Orden de Salida

**Endpoint**: `POST /inventario/ordenes-salida/:id/autorizar`

**Descripción**: Autoriza la orden y especifica las cantidades aprobadas para cada item.

**Request Body**:
```json
{
  "id_usuario_autoriza": 2,
  "observaciones_autorizacion": "Autorizado según solicitud aprobada",
  "detalle": [
    {
      "id_orden_salida_detalle": 1,
      "cantidad_autorizada": 10
    },
    {
      "id_orden_salida_detalle": 2,
      "cantidad_autorizada": 5
    }
  ]
}
```

**Validaciones**:
- La orden debe estar en estado PENDIENTE_AUTORIZACION
- Se verifica que haya stock suficiente en la bodega para cada item
- Las cantidades autorizadas pueden ser menores o iguales a las solicitadas

---

### 4b. Rechazar Orden de Salida

**Endpoint**: `POST /inventario/ordenes-salida/:id/rechazar`

**Descripción**: Rechaza una orden con un motivo específico.

**Request Body**:
```json
{
  "id_usuario_autoriza": 2,
  "motivo_rechazo": "No hay suficiente stock en bodega para este pedido"
}
```

**Restricción**: Solo se pueden rechazar órdenes en estado PENDIENTE_AUTORIZACION.

---

### 5. Procesar Orden de Salida

**Endpoint**: `POST /inventario/ordenes-salida/:id/procesar`

**Descripción**: Ejecuta la salida física del inventario. Descuenta las cantidades del stock.

**Request Body**:
```json
{
  "id_usuario_procesa": 3,
  "observaciones_proceso": "Salida procesada exitosamente",
  "fecha_salida_efectiva": "2025-11-08T10:30:00Z"
}
```

**Proceso Interno**:
1. Verifica que la orden esté en estado AUTORIZADA
2. Por cada item del detalle:
   - Descuenta la cantidad autorizada del inventario de la bodega
   - Crea un registro en `movimientos_inventario` con tipo `SALIDA_OT`
   - Actualiza `cantidad_procesada` en el detalle
3. Cambia el estado de la orden a PROCESADA
4. Registra log de auditoría

**Validaciones**:
- La orden debe estar en estado AUTORIZADA
- Debe haber stock suficiente al momento de procesar (validación doble)

**Nota**: Esta operación utiliza una **transacción de base de datos** para garantizar la consistencia del inventario.

---

### 6. Cancelar Orden de Salida

**Endpoint**: `POST /inventario/ordenes-salida/:id/cancelar`

**Descripción**: Cancela una orden antes de ser procesada.

**Request Body**:
```json
{
  "id_usuario": 1,
  "motivo": "Solicitud cancelada por el cliente"
}
```

**Restricciones**:
- No se pueden cancelar órdenes ya PROCESADAS
- Se puede cancelar en estados: BORRADOR, PENDIENTE_AUTORIZACION, AUTORIZADA, RECHAZADA

---

### 7. Eliminar Orden de Salida

**Endpoint**: `DELETE /inventario/ordenes-salida/:id?id_usuario=1`

**Descripción**: Elimina permanentemente una orden de salida.

**Query Parameters**:
- `id_usuario`: ID del usuario que elimina

**Restricciones**:
- Solo se pueden eliminar órdenes en estado BORRADOR o CANCELADA
- No se puede eliminar una orden procesada (para mantener trazabilidad)

---

## Endpoints de Consulta

### Listar Órdenes con Filtros

**Endpoint**: `GET /inventario/ordenes-salida`

**Query Parameters** (todos opcionales):

| Parámetro | Tipo | Descripción | Ejemplo |
|-----------|------|-------------|---------|
| `estado` | enum | Estado de la orden | `PENDIENTE_AUTORIZACION` |
| `tipo` | enum | Tipo de orden | `VENTA` |
| `id_bodega_origen` | number | ID de bodega de origen | `1` |
| `id_sucursal_origen` | number | ID de sucursal de origen | `1` |
| `id_usuario_solicita` | number | ID del usuario solicitante | `1` |
| `codigo` | string | Código de la orden (búsqueda parcial) | `OS-202511` |
| `fecha_desde` | date | Fecha desde (ISO 8601) | `2025-01-01` |
| `fecha_hasta` | date | Fecha hasta (ISO 8601) | `2025-12-31` |
| `page` | number | Número de página | `1` |
| `limit` | number | Registros por página | `10` |

**Ejemplo**:
```
GET /inventario/ordenes-salida?estado=PENDIENTE_AUTORIZACION&id_bodega_origen=1&page=1&limit=10
```

**Response**:
```json
{
  "statusCode": 200,
  "data": {
    "data": [
      {
        "id_orden_salida": 1,
        "codigo": "OS-202511-00001",
        "estado": "PENDIENTE_AUTORIZACION",
        ...
      }
    ],
    "meta": {
      "total": 25,
      "page": 1,
      "limit": 10,
      "totalPages": 3
    }
  },
  "message": "OK"
}
```

---

### Obtener Orden por ID

**Endpoint**: `GET /inventario/ordenes-salida/:id`

**Descripción**: Obtiene los detalles completos de una orden específica.

**Response**: Incluye toda la información de la orden, detalle, bodega, usuarios, etc.

---

### Obtener Estadísticas

**Endpoint**: `GET /inventario/ordenes-salida/estadisticas`

**Query Parameters**:
- `id_bodega` (opcional): Filtrar estadísticas por bodega

**Ejemplo**:
```
GET /inventario/ordenes-salida/estadisticas?id_bodega=1
```

**Response**:
```json
{
  "statusCode": 200,
  "data": {
    "total": 150,
    "por_estado": {
      "borradores": 10,
      "pendientes_autorizacion": 5,
      "autorizadas": 3,
      "procesadas": 125,
      "rechazadas": 4,
      "canceladas": 3
    }
  },
  "message": "OK"
}
```

---

## Casos de Uso

### Caso de Uso 1: Salida por Venta Normal

**Flujo**:
1. **Vendedor** crea la orden con los productos vendidos → Estado: BORRADOR
2. **Vendedor** revisa y envía a autorización → Estado: PENDIENTE_AUTORIZACION
3. **Supervisor** revisa el stock y autoriza la orden → Estado: AUTORIZADA
4. **Bodeguero** procesa la salida física → Estado: PROCESADA

---

### Caso de Uso 2: Salida Rechazada por Falta de Stock

**Flujo**:
1. **Vendedor** crea la orden → Estado: BORRADOR
2. **Vendedor** envía a autorización → Estado: PENDIENTE_AUTORIZACION
3. **Supervisor** intenta autorizar pero el sistema detecta falta de stock → Error
4. **Supervisor** rechaza la orden con motivo "Stock insuficiente" → Estado: RECHAZADA

---

### Caso de Uso 3: Baja de Inventario por Productos Defectuosos

**Flujo**:
1. **Técnico** crea orden tipo BAJA_INVENTARIO con los materiales defectuosos → Estado: BORRADOR
2. **Técnico** envía a autorización → Estado: PENDIENTE_AUTORIZACION
3. **Jefe de Bodega** autoriza la baja → Estado: AUTORIZADA
4. **Bodeguero** procesa la salida (descuenta del inventario) → Estado: PROCESADA

---

### Caso de Uso 4: Cancelación de Orden Autorizada

**Flujo**:
1. Orden fue creada, enviada y autorizada → Estado: AUTORIZADA
2. **Cliente cancela el pedido**
3. **Vendedor** cancela la orden con motivo → Estado: CANCELADA
4. La orden queda registrada para auditoría pero no se procesa

---

## Auditoría y Trazabilidad

Cada acción en el módulo de órdenes de salida genera un registro de auditoría:

- **CREAR_ORDEN_SALIDA**: Cuando se crea una nueva orden
- **ACTUALIZAR_ORDEN_SALIDA**: Cuando se modifica una orden en borrador
- **ENVIAR_AUTORIZACION_ORDEN_SALIDA**: Cuando se envía a autorización
- **AUTORIZAR_ORDEN_SALIDA**: Cuando se autoriza
- **RECHAZAR_ORDEN_SALIDA**: Cuando se rechaza
- **PROCESAR_ORDEN_SALIDA**: Cuando se procesa la salida física
- **CANCELAR_ORDEN_SALIDA**: Cuando se cancela
- **ELIMINAR_ORDEN_SALIDA**: Cuando se elimina

Estos logs se almacenan en la tabla `log` con el usuario, acción y descripción.

---

## Movimientos de Inventario

Cuando una orden se **procesa**, se generan automáticamente registros en la tabla `movimientos_inventario`:

- **tipo**: `SALIDA_OT`
- **id_catalogo**: Producto que salió
- **id_bodega_origen**: Bodega de donde salió
- **cantidad**: Cantidad procesada
- **costo_unitario**: Costo del producto
- **id_orden_salida**: Referencia a la orden de salida
- **id_usuario**: Usuario que procesó
- **fecha_movimiento**: Timestamp automático

Esto permite tener un historial completo de todos los movimientos de inventario.

---

## Validaciones Importantes

### Al Crear/Actualizar
- La bodega debe existir
- Todos los productos del detalle deben existir en el catálogo
- Las cantidades deben ser mayores a 0

### Al Autorizar
- Debe haber stock suficiente en la bodega para cada item
- Las cantidades autorizadas no pueden ser negativas
- Todos los items del detalle deben tener cantidad autorizada

### Al Procesar
- **Validación doble** de stock (por seguridad)
- Se usa una **transacción** para garantizar que si falla un item, se revierten todos los cambios
- Se actualizan las cantidades en inventario y se registran los movimientos

---

## Mejores Prácticas

1. **Siempre enviar a autorización**: No procesar directamente desde BORRADOR
2. **Revisar stock antes de autorizar**: El sistema lo valida, pero es buena práctica verificar
3. **Usar observaciones**: Agregar comentarios útiles en cada etapa
4. **No eliminar órdenes procesadas**: Mantener trazabilidad
5. **Cancelar en lugar de eliminar**: Si una orden no se va a usar, cancelarla en lugar de eliminarla
6. **Especificar fechas de salida**: Usar `fecha_salida_efectiva` para reflejar la fecha real

---

## Códigos de Error Comunes

| Código | Mensaje | Solución |
|--------|---------|----------|
| 404 | Orden de salida no encontrada | Verificar que el ID sea correcto |
| 404 | Bodega no encontrada | Verificar que la bodega exista |
| 404 | Producto no encontrado | Verificar que los IDs de catálogo sean correctos |
| 400 | Solo se pueden modificar órdenes en BORRADOR | No intentar editar órdenes ya enviadas |
| 400 | Stock insuficiente | Reducir cantidades o esperar reabastecimiento |
| 400 | Solo se pueden autorizar órdenes en PENDIENTE_AUTORIZACION | Verificar el estado actual |
| 400 | No se pueden cancelar órdenes procesadas | Las órdenes procesadas no se pueden cancelar |

---

## Swagger/OpenAPI

Todos los endpoints están documentados con Swagger. Para acceder a la documentación interactiva:

```
http://localhost:4000/api
```

Buscar la sección **"Órdenes de Salida"** para probar los endpoints directamente desde el navegador.

---

## Resumen de Endpoints

| Método | Endpoint | Descripción | Estado Requerido |
|--------|----------|-------------|------------------|
| POST | `/inventario/ordenes-salida` | Crear orden | - |
| GET | `/inventario/ordenes-salida` | Listar con filtros | - |
| GET | `/inventario/ordenes-salida/estadisticas` | Obtener estadísticas | - |
| GET | `/inventario/ordenes-salida/:id` | Obtener por ID | - |
| PATCH | `/inventario/ordenes-salida/:id` | Actualizar orden | BORRADOR |
| POST | `/inventario/ordenes-salida/:id/enviar-autorizacion` | Enviar a autorización | BORRADOR |
| POST | `/inventario/ordenes-salida/:id/autorizar` | Autorizar | PENDIENTE_AUTORIZACION |
| POST | `/inventario/ordenes-salida/:id/rechazar` | Rechazar | PENDIENTE_AUTORIZACION |
| POST | `/inventario/ordenes-salida/:id/procesar` | Procesar salida | AUTORIZADA |
| POST | `/inventario/ordenes-salida/:id/cancelar` | Cancelar | Cualquiera excepto PROCESADA |
| DELETE | `/inventario/ordenes-salida/:id` | Eliminar | BORRADOR o CANCELADA |

---

## Soporte y Contacto

Para preguntas o soporte adicional, contactar al equipo de desarrollo.

**Versión del Documento**: 1.0
**Fecha**: 2025-11-08
**Autor**: Sistema AFIS
