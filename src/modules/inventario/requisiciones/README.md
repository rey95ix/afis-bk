# Módulo de Requisiciones de Inventario

Este módulo maneja las solicitudes de transferencia de inventario entre diferentes ubicaciones del sistema.

## Características

- ✅ Crear requisiciones de transferencia entre bodegas, sucursales y estantes
- ✅ Flujo de aprobación con múltiples estados
- ✅ Autorización con cantidades ajustables
- ✅ Procesamiento automático de transferencias de inventario
- ✅ Generación automática de códigos únicos (REQ-YYYYMM-#####)
- ✅ Registro completo en auditoría (log)
- ✅ Validaciones de stock disponible
- ✅ API REST completamente documentada con Swagger

## Modelos de Base de Datos

### `requisiciones_inventario`
Tabla principal que almacena las requisiciones.

**Campos principales:**
- `codigo`: Código único generado automáticamente (REQ-YYYYMM-#####)
- `tipo`: TRANSFERENCIA_BODEGA | TRANSFERENCIA_SUCURSAL | CAMBIO_ESTANTE
- `estado`: PENDIENTE | APROBADA | RECHAZADA | PROCESADA | CANCELADA
- Ubicaciones origen/destino (sucursal, bodega, estante)
- Usuarios (solicita, autoriza, procesa)
- Fechas de solicitud, autorización y proceso

### `requisiciones_detalle`
Detalle de items incluidos en la requisición.

**Campos principales:**
- `id_catalogo`: Producto a transferir
- `cantidad_solicitada`: Cantidad inicial solicitada
- `cantidad_autorizada`: Cantidad aprobada (puede ser diferente)
- `cantidad_procesada`: Cantidad finalmente transferida

## Estados del Flujo

```
PENDIENTE → APROBADA → PROCESADA
    ↓           ↓
RECHAZADA   CANCELADA
```

### PENDIENTE
- Estado inicial al crear la requisición
- Se puede editar y actualizar
- Se puede autorizar o rechazar

### APROBADA
- La requisición ha sido aprobada por un autorizador
- Se pueden ajustar las cantidades autorizadas
- Lista para ser procesada

### RECHAZADA
- La requisición fue rechazada
- No se puede procesar ni editar
- Estado final

### PROCESADA
- La transferencia de inventario se ejecutó exitosamente
- El stock fue movido entre ubicaciones
- Estado final, no se puede modificar

### CANCELADA
- La requisición fue cancelada antes de ser procesada
- Estado final

## Endpoints API

### Crear Requisición
```http
POST /inventario/requisiciones
```

**Body:**
```json
{
  "tipo": "TRANSFERENCIA_BODEGA",
  "id_bodega_origen": 1,
  "id_bodega_destino": 2,
  "motivo": "Reabastecimiento de bodega principal",
  "detalle": [
    {
      "id_catalogo": 15,
      "cantidad_solicitada": 50,
      "observaciones": "Urgente para instalaciones"
    }
  ]
}
```

**Respuesta:** Requisición creada con código único

---

### Listar Requisiciones
```http
GET /inventario/requisiciones?page=1&limit=10&estado=PENDIENTE
```

**Query params:**
- `page`: Número de página (default: 1)
- `limit`: Items por página (default: 10)
- `search`: Buscar por código o motivo
- `estado`: Filtrar por estado
- `tipo`: Filtrar por tipo
- `id_usuario_solicita`: Filtrar por usuario

**Respuesta:** Lista paginada de requisiciones

---

### Obtener Requisición por ID
```http
GET /inventario/requisiciones/:id
```

**Respuesta:** Requisición con todos sus detalles, items y usuarios

---

### Actualizar Requisición
```http
PUT /inventario/requisiciones/:id
```

**Nota:** Solo se pueden actualizar requisiciones en estado PENDIENTE

**Body:** Similar al de crear, todos los campos opcionales

---

### Autorizar/Rechazar Requisición
```http
PATCH /inventario/requisiciones/:id/autorizar
```

**Body para APROBAR:**
```json
{
  "aprobar": true,
  "observaciones_autorizacion": "Aprobado parcialmente por stock limitado",
  "detalle": [
    {
      "id_requisicion_detalle": 1,
      "cantidad_autorizada": 30
    }
  ]
}
```

**Body para RECHAZAR:**
```json
{
  "aprobar": false,
  "observaciones_autorizacion": "No hay presupuesto disponible"
}
```

Si se omite el campo `detalle` al aprobar, se autorizará la cantidad solicitada completa.

---

### Procesar Requisición
```http
PATCH /inventario/requisiciones/:id/procesar
```

**Body:**
```json
{
  "observaciones_proceso": "Transferencia completada sin novedades"
}
```

Este endpoint:
1. Valida que hay stock disponible
2. Reduce stock en origen
3. Incrementa stock en destino
4. Crea registros en `movimientos_inventario`
5. Actualiza estado a PROCESADA

**Validaciones:**
- Solo requisiciones APROBADAS pueden ser procesadas
- Verifica stock disponible en origen
- Valida que todos los items tengan cantidad autorizada

---

### Cancelar Requisición
```http
PATCH /inventario/requisiciones/:id/cancelar
```

**Nota:** No se pueden cancelar requisiciones ya procesadas

---

### Eliminar Requisición
```http
DELETE /inventario/requisiciones/:id
```

**Nota:** Elimina (cancela) la requisición si no está procesada

## Tipos de Transferencia

### 1. TRANSFERENCIA_BODEGA
Mueve inventario entre dos bodegas diferentes.

**Campos requeridos:**
- `id_bodega_origen`
- `id_bodega_destino`

**Proceso:**
- Reduce stock en `inventario` de bodega origen
- Incrementa stock en `inventario` de bodega destino
- Crea registro en `movimientos_inventario` tipo TRANSFERENCIA

### 2. TRANSFERENCIA_SUCURSAL
Mueve inventario entre bodegas principales de diferentes sucursales.

**Campos requeridos:**
- `id_sucursal_origen`
- `id_sucursal_destino`

**Proceso:**
- Busca la bodega principal de cada sucursal
- Ejecuta transferencia entre esas bodegas

### 3. CAMBIO_ESTANTE
Mueve inventario entre estantes dentro de la misma bodega.

**Campos requeridos:**
- `id_bodega_origen`
- `id_estante_origen`
- `id_estante_destino`

**Proceso:**
- Reduce stock en estante origen
- Incrementa stock en estante destino
- Mantiene la misma bodega

## Validaciones

### Al Crear/Actualizar
- Valida que origen y destino sean diferentes
- Valida campos requeridos según el tipo de transferencia
- Valida que existan los productos en el catálogo

### Al Autorizar
- Solo requisiciones PENDIENTES
- Cantidad autorizada ≤ cantidad solicitada
- No se puede aprobar sin especificar cantidades

### Al Procesar
- Solo requisiciones APROBADAS
- Verifica stock disponible en origen
- Valida que todos los items tengan cantidad autorizada > 0
- Actualiza inventario en origen y destino
- Genera movimientos de inventario

## Auditoría

Todas las acciones quedan registradas en la tabla `log`:
- CREAR_REQUISICION
- ACTUALIZAR_REQUISICION
- APROBAR_REQUISICION
- RECHAZAR_REQUISICION
- PROCESAR_REQUISICION
- CANCELAR_REQUISICION

Cada registro incluye:
- Usuario que ejecutó la acción
- Timestamp
- Código de la requisición afectada

## Autenticación

Todos los endpoints requieren autenticación JWT:
- Header: `Authorization: Bearer <token>`
- El `id_usuario` se obtiene automáticamente del token

## Ejemplos de Uso

### Caso 1: Transferencia Simple entre Bodegas
```javascript
// 1. Crear requisición
POST /inventario/requisiciones
{
  "tipo": "TRANSFERENCIA_BODEGA",
  "id_bodega_origen": 1,
  "id_bodega_destino": 2,
  "motivo": "Reabastecimiento",
  "detalle": [{ "id_catalogo": 10, "cantidad_solicitada": 100 }]
}

// 2. Autorizar
PATCH /inventario/requisiciones/1/autorizar
{ "aprobar": true }

// 3. Procesar
PATCH /inventario/requisiciones/1/procesar
{}
```

### Caso 2: Aprobación Parcial
```javascript
// Aprobar con cantidad reducida
PATCH /inventario/requisiciones/1/autorizar
{
  "aprobar": true,
  "observaciones_autorizacion": "Stock limitado",
  "detalle": [
    { "id_requisicion_detalle": 1, "cantidad_autorizada": 50 }
  ]
}
```

### Caso 3: Rechazo
```javascript
PATCH /inventario/requisiciones/1/autorizar
{
  "aprobar": false,
  "observaciones_autorizacion": "No hay presupuesto aprobado"
}
```

## Estructura de Archivos

```
requisiciones/
├── dto/
│   ├── create-requisicion.dto.ts      # DTO para crear
│   ├── update-requisicion.dto.ts      # DTO para actualizar
│   ├── authorize-requisicion.dto.ts   # DTO para autorizar
│   ├── process-requisicion.dto.ts     # DTO para procesar
│   └── index.ts                       # Exportaciones
├── requisiciones.controller.ts        # Endpoints REST
├── requisiciones.service.ts           # Lógica de negocio
├── requisiciones.module.ts            # Módulo NestJS
└── README.md                          # Esta documentación
```

## Notas Técnicas

- **Códigos únicos**: Se generan automáticamente en formato `REQ-YYYYMM-#####` (ejemplo: REQ-202501-00001)
- **Transacciones**: Las operaciones críticas (procesar) deberían usar transacciones de Prisma en producción
- **Performance**: Los endpoints de listado usan paginación para manejar grandes volúmenes
- **Relaciones**: Se incluyen datos relacionados (usuarios, bodegas, productos) en las respuestas

## Mejoras Futuras

- [ ] Notificaciones por email cuando se crea/aprueba una requisición
- [ ] Dashboard con estadísticas de requisiciones
- [ ] Exportar a Excel/PDF
- [ ] Límites de aprobación según rol de usuario
- [ ] Comentarios/historial de cambios en la requisición
- [ ] Adjuntar archivos/evidencias
