# API de Facturación - Referencia Completa

## Autenticación

Todos los endpoints requieren autenticación JWT.

```
Header: Authorization: Bearer <JWT_TOKEN>
```

---

## COBROS / FACTURAS

### POST /facturacion/cobros

**Crear nuevo DTE (factura)**

Crea un nuevo Documento Tributario Electrónico. El sistema determina automáticamente si es FC (01) o CCF (03) basándose en los datos del receptor.

**Request Body:**

```json
{
  "idContrato": 123,
  "idClienteFacturacion": 456,
  "idSucursal": 789,
  "periodoFacturado": "Enero 2025",
  "items": [
    {
      "tipoItem": 2,
      "codigo": "INET-10",
      "descripcion": "Servicio de Internet 10 Mbps",
      "cantidad": 1,
      "uniMedida": 59,
      "precioUnitario": 25.00,
      "descuento": 0,
      "esGravado": true,
      "esExento": false,
      "esNoSujeto": false,
      "idCatalogo": 100
    }
  ],
  "condicionOperacion": 1,
  "pagos": [
    {
      "codigo": "01",
      "monto": 25.00,
      "referencia": "EFE001",
      "plazo": "01",
      "periodo": 0
    }
  ],
  "aplicarMora": false,
  "observaciones": "Pago en efectivo",
  "numPagoElectronico": null
}
```

**Parámetros:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `idContrato` | number | **Sí** | ID del contrato a facturar |
| `idClienteFacturacion` | number | No | ID de datos facturación específicos |
| `idSucursal` | number | No | ID de sucursal emisora |
| `periodoFacturado` | string | **Sí** | Descripción del período |
| `items` | array | **Sí** | Mínimo 1 item |
| `condicionOperacion` | 1\|2\|3 | No | 1=Contado (default), 2=Crédito, 3=Otro |
| `pagos` | array | Condicional | Requerido si condicionOperacion ≠ 1 |
| `aplicarMora` | boolean | No | Calcular mora de facturas vencidas |
| `observaciones` | string | No | Máximo 250 caracteres |
| `numPagoElectronico` | string | No | Referencia de pago electrónico |

**Item (ItemCobroDto):**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `tipoItem` | 1\|2\|3\|4 | **Sí** | 1=Bien, 2=Servicio, 3=Ambos, 4=Tributo |
| `codigo` | string | No | Código interno del producto/servicio |
| `descripcion` | string | **Sí** | Descripción del item |
| `cantidad` | number | **Sí** | Cantidad (> 0) |
| `uniMedida` | number | **Sí** | Código unidad medida (59=Servicio, 99=Otro) |
| `precioUnitario` | number | **Sí** | Precio unitario (≥ 0) |
| `descuento` | number | No | Monto descuento (≥ 0) |
| `esGravado` | boolean | No | Default: true |
| `esExento` | boolean | No | Default: false |
| `esNoSujeto` | boolean | No | Default: false |
| `idCatalogo` | number | No | ID del catálogo de productos |

**Pago (PagoCobroDto):**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `codigo` | string | **Sí** | Código forma de pago (CAT-017) |
| `monto` | number | **Sí** | Monto del pago (≥ 0) |
| `referencia` | string | No | Número de cheque, referencia, etc. |
| `plazo` | string | No | Código de plazo (CAT-018) |
| `periodo` | number | No | Cantidad de períodos |

**Response 201 (Éxito):**

```json
{
  "success": true,
  "idDte": 123,
  "codigoGeneracion": "A1B2C3D4-E5F6-G7H8-I9J0-K1L2M3N4O5P6",
  "numeroControl": "DTE-01-M001P001-000000000000001",
  "estado": "PROCESADO",
  "selloRecibido": "20219E9D4DC0292F4681AD759B0B0F5CA99DC23G",
  "totalPagar": 25.00
}
```

**Response Error:**

```json
{
  "success": false,
  "idDte": 123,
  "codigoGeneracion": "A1B2C3D4-E5F6-G7H8-I9J0-K1L2M3N4O5P6",
  "numeroControl": "DTE-01-M001P001-000000000000001",
  "estado": "RECHAZADO",
  "totalPagar": 25.00,
  "error": "Error de transmisión",
  "errores": ["Código de actividad inválido", "NRC no registrado"]
}
```

**Códigos de Estado HTTP:**

| Código | Descripción |
|--------|-------------|
| 201 | Creado exitosamente (puede ser PROCESADO o RECHAZADO) |
| 400 | Datos inválidos o contrato no activo |
| 404 | Contrato no encontrado |
| 409 | Ya existe factura para este período |

---

### GET /facturacion/cobros

**Listar cobros/facturas con filtros**

**Query Parameters:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `idContrato` | number | Filtrar por contrato |
| `idCliente` | number | Filtrar por cliente |
| `tipoDte` | '01'\|'03'\|'05'\|'06' | Filtrar por tipo |
| `estado` | string | BORRADOR, FIRMADO, TRANSMITIDO, PROCESADO, RECHAZADO, INVALIDADO |
| `fechaDesde` | string | Formato YYYY-MM-DD |
| `fechaHasta` | string | Formato YYYY-MM-DD |
| `page` | number | Página (default: 1) |
| `limit` | number | Items por página (default: 20) |

**Ejemplo:**
```
GET /facturacion/cobros?idContrato=123&estado=PROCESADO&page=1&limit=10
```

**Response 200:**

```json
{
  "items": [
    {
      "id_dte": 123,
      "codigo_generacion": "A1B2C3D4-E5F6-G7H8-I9J0-K1L2M3N4O5P6",
      "numero_control": "DTE-01-M001P001-000000000000001",
      "tipo_dte": "01",
      "estado": "PROCESADO",
      "fecha_emision": "2025-01-15T00:00:00.000Z",
      "total_pagar": 25.00,
      "sello_recepcion": "20219E9D4DC0292F4681AD759B0B0F5CA99DC23G",
      "cliente": {
        "titular": "Juan Pérez"
      },
      "contrato": {
        "codigo": "CTR-2025-00001"
      }
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 10,
  "totalPages": 5
}
```

---

### GET /facturacion/cobros/:id

**Obtener detalle completo de un DTE**

**Parámetros URL:**
- `id` (number): ID del DTE

**Response 200:**

```json
{
  "id_dte": 123,
  "codigo_generacion": "A1B2C3D4-E5F6-G7H8-I9J0-K1L2M3N4O5P6",
  "numero_control": "DTE-01-M001P001-000000000000001",
  "tipo_dte": "01",
  "version": 1,
  "ambiente": "00",
  "estado": "PROCESADO",
  "fecha_emision": "2025-01-15T00:00:00.000Z",
  "hora_emision": "10:30:45",
  "tipo_moneda": "USD",
  "receptor_nombre": "Juan Pérez",
  "receptor_num_documento": "12345678-9",
  "receptor_correo": "juan@email.com",
  "total_gravadas": 22.12,
  "total_iva": 2.88,
  "total_pagar": 25.00,
  "total_letras": "VEINTICINCO DÓLARES CON CERO CENTAVOS",
  "sello_recepcion": "20219E9D4DC0292F4681AD759B0B0F5CA99DC23G",
  "fecha_recepcion": "2025-01-15T10:31:00.000Z",
  "detalle": [
    {
      "num_item": 1,
      "tipo_item": 2,
      "codigo": "INET-10",
      "descripcion": "Servicio de Internet 10 Mbps",
      "cantidad": 1,
      "uni_medida": 59,
      "precio_unitario": 25.00,
      "monto_descuento": 0,
      "venta_gravada": 22.12,
      "venta_exenta": 0,
      "venta_no_sujeta": 0
    }
  ],
  "cliente": {
    "id_cliente": 456,
    "titular": "Juan Pérez"
  },
  "contrato": {
    "id_contrato": 789,
    "codigo": "CTR-2025-00001"
  },
  "sucursal": {
    "id_sucursal": 1,
    "nombre": "Casa Matriz"
  },
  "anulaciones": []
}
```

**Response 404:**
```json
{
  "statusCode": 404,
  "message": "DTE 999 no encontrado"
}
```

---

## ANULACIONES

### POST /facturacion/anulaciones

**Anular un DTE existente**

Crea y procesa un evento de invalidación/anulación para un DTE.

**Request Body:**

```json
{
  "idDte": 123,
  "tipoAnulacion": 2,
  "motivoAnulacion": null,
  "nombreResponsable": "Roberto García",
  "tipoDocResponsable": "36",
  "numDocResponsable": "0614-123456-789-0",
  "nombreSolicita": "Manuel López",
  "tipoDocSolicita": "13",
  "numDocSolicita": "12345678-9",
  "codigoGeneracionReemplazo": null
}
```

**Parámetros:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `idDte` | number | **Sí** | ID del DTE a anular |
| `tipoAnulacion` | 1\|2\|3 | **Sí** | 1=Error info, 2=Rescindir, 3=Otro |
| `motivoAnulacion` | string | Si tipo=3 | Máximo 250 caracteres |
| `nombreResponsable` | string | **Sí** | Quien autoriza (máx 200) |
| `tipoDocResponsable` | string | **Sí** | 36=NIT, 13=DUI, etc. |
| `numDocResponsable` | string | **Sí** | Número documento (máx 25) |
| `nombreSolicita` | string | **Sí** | Quien solicita (máx 200) |
| `tipoDocSolicita` | string | **Sí** | Tipo documento |
| `numDocSolicita` | string | **Sí** | Número documento |
| `codigoGeneracionReemplazo` | UUID | Si tipo=1 | DTE de reemplazo |

**Tipos de Anulación:**

| Código | Descripción | Requisitos |
|--------|-------------|------------|
| 1 | Error en información | Requiere DTE de reemplazo |
| 2 | Rescindir operación | - |
| 3 | Otro | Requiere motivoAnulacion |

**Plazos de Anulación:**

| Tipo DTE | Plazo |
|----------|-------|
| 01 (FC) | 90 días (3 meses) |
| 03 (CCF) | 1 día hábil siguiente |
| 05 (NC) | 1 día |
| 06 (ND) | 1 día |
| 11 (FEXE) | 90 días |
| 14 (FSEE) | 90 días |

**Response 201 (Éxito):**

```json
{
  "success": true,
  "idAnulacion": 45,
  "codigoGeneracionAnulacion": "X1Y2Z3W4-A5B6-C7D8-E9F0-G1H2I3J4K5L6",
  "estado": "PROCESADA",
  "selloRecibido": "20219E9D4DC0292F4681AD759B0B0F5CA99DC23G"
}
```

**Response Error:**

```json
{
  "success": false,
  "idAnulacion": 45,
  "codigoGeneracionAnulacion": "X1Y2Z3W4-A5B6-C7D8-E9F0-G1H2I3J4K5L6",
  "estado": "RECHAZADA",
  "error": "Plazo de anulación expirado",
  "errores": ["El DTE supera el plazo permitido para anulación"]
}
```

**Códigos de Estado HTTP:**

| Código | Descripción |
|--------|-------------|
| 201 | Procesado (puede ser PROCESADA o RECHAZADA) |
| 400 | Datos inválidos o fuera de plazo |
| 404 | DTE no encontrado |
| 409 | DTE ya fue anulado previamente |

---

### GET /facturacion/anulaciones

**Listar anulaciones con filtros**

**Query Parameters:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `idDte` | number | Filtrar por DTE original |
| `estado` | string | PENDIENTE, FIRMADA, TRANSMITIDA, PROCESADA, RECHAZADA |
| `fechaDesde` | string | Formato YYYY-MM-DD |
| `fechaHasta` | string | Formato YYYY-MM-DD |
| `page` | number | Página (default: 1) |
| `limit` | number | Items por página (default: 20) |

**Response 200:**

```json
{
  "items": [
    {
      "id_anulacion": 45,
      "codigo_generacion": "X1Y2Z3W4-A5B6-C7D8-E9F0-G1H2I3J4K5L6",
      "estado": "PROCESADA",
      "tipo_invalidacion": "RESCINDIR_OPERACION",
      "fecha_creacion": "2025-01-20T14:30:00.000Z",
      "sello_recepcion": "20219E9D4DC0292F4681AD759B0B0F5CA99DC23G",
      "dte": {
        "numero_control": "DTE-01-M001P001-000000000000001",
        "tipo_dte": "01",
        "receptor_nombre": "Juan Pérez"
      }
    }
  ],
  "total": 10,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

---

### GET /facturacion/anulaciones/:id

**Obtener detalle completo de una anulación**

**Response 200:**

```json
{
  "id_anulacion": 45,
  "codigo_generacion": "X1Y2Z3W4-A5B6-C7D8-E9F0-G1H2I3J4K5L6",
  "version": 2,
  "ambiente": "00",
  "estado": "PROCESADA",
  "tipo_invalidacion": "RESCINDIR_OPERACION",
  "motivo_invalidacion": null,
  "nombre_responsable": "Roberto García",
  "tipo_doc_responsable": "36",
  "num_doc_responsable": "0614-123456-789-0",
  "nombre_solicita": "Manuel López",
  "tipo_doc_solicita": "13",
  "num_doc_solicita": "12345678-9",
  "sello_recepcion": "20219E9D4DC0292F4681AD759B0B0F5CA99DC23G",
  "fecha_recepcion": "2025-01-20T14:31:00.000Z",
  "dte": {
    "id_dte": 123,
    "codigo_generacion": "A1B2C3D4-E5F6-G7H8-I9J0-K1L2M3N4O5P6",
    "numero_control": "DTE-01-M001P001-000000000000001",
    "tipo_dte": "01",
    "receptor_nombre": "Juan Pérez"
  },
  "usuarioCrea": {
    "id_usuario": 1,
    "nombres": "Admin",
    "apellidos": "System"
  }
}
```

---

## CICLOS DE FACTURACIÓN

### POST /facturacion/ciclos

**Crear nuevo ciclo**

```json
{
  "nombre": "Ciclo 1 - día 3",
  "dia_corte": 3,
  "dia_vencimiento": 15,
  "periodo_inicio": 1,
  "periodo_fin": 31
}
```

### GET /facturacion/ciclos

**Listar ciclos con paginación**

### GET /facturacion/ciclos/all

**Obtener todos los ciclos activos (para selects)**

### GET /facturacion/ciclos/:id

**Obtener ciclo por ID**

### GET /facturacion/ciclos/:id/contratos

**Obtener contratos de un ciclo**

### PUT /facturacion/ciclos/:id

**Actualizar ciclo**

### DELETE /facturacion/ciclos/:id

**Eliminar ciclo (soft delete)**

---

## Catálogos de Referencia

### Formas de Pago (CAT-017)

| Código | Descripción |
|--------|-------------|
| 01 | Efectivo |
| 02 | Tarjeta de Crédito |
| 03 | Tarjeta de Débito |
| 04 | Cheque |
| 05 | Transferencia |
| 06 | Vale |
| 99 | Otro |

### Unidades de Medida

| Código | Descripción |
|--------|-------------|
| 1 | Unidad |
| 59 | Servicio |
| 99 | Otro |

### Plazos (CAT-018)

| Código | Descripción |
|--------|-------------|
| 01 | Días |
| 02 | Meses |
| 03 | Años |

### Tipos de Documento Identificación

| Código | Descripción |
|--------|-------------|
| 36 | NIT |
| 13 | DUI |
| 02 | Carnet de Residente |
| 03 | Pasaporte |
| 37 | Otro |

---

## Estados del Sistema

### Estados de DTE (estado_dte)

| Estado | Descripción |
|--------|-------------|
| BORRADOR | Creado, pendiente de firma |
| FIRMADO | Firmado, pendiente de transmisión |
| TRANSMITIDO | Enviado a MH, esperando respuesta |
| PROCESADO | Aceptado por MH |
| RECHAZADO | Rechazado por MH |
| INVALIDADO | Anulado exitosamente |

### Estados de Anulación (estado_anulacion)

| Estado | Descripción |
|--------|-------------|
| PENDIENTE | Creada, pendiente de procesar |
| FIRMADA | Evento firmado |
| TRANSMITIDA | Enviada a MH |
| PROCESADA | Aceptada por MH |
| RECHAZADA | Rechazada por MH |

### Tipos de Invalidación (tipo_invalidacion)

| Enum | Código | Descripción |
|------|--------|-------------|
| ERROR_INFORMACION | 1 | Error en información del DTE |
| RESCINDIR_OPERACION | 2 | Rescindir la operación |
| OTRO | 3 | Otro motivo |
