# API PuntoXpress Legacy

Documentación del endpoint legacy para integradores externos de cobro.

## Información General

| Campo | Valor |
|-------|-------|
| **URL** | `POST /puntoxpress/legacy` |
| **Content-Type** | `application/json` |
| **Autenticación** | JWT Bearer Token (obtenido vía método `Autenticacion`) |

Todos los requests se envían al mismo endpoint. El campo `metodo` en el body determina la operación a ejecutar.

## Códigos de Respuesta

Todas las respuestas incluyen un campo `codigo` numérico:

| Código | Significado |
|--------|-------------|
| `0` | Operación exitosa |
| `1` | Error de autenticación (token inválido, expirado o integrador inactivo) |
| `2` | Error de validación (campos faltantes o regla de negocio violada) |
| `3` | Método no reconocido |
| `99` | Error interno del servidor |

Cuando `codigo` es distinto de `0`, la respuesta incluye un campo `mensaje` con el detalle del error.

---

## Métodos Disponibles

### 1. Autenticacion

Obtiene un token JWT para usar en los demás métodos. El token expira en **1 hora** (3600 segundos).

**Request:**

```json
{
  "metodo": "Autenticacion",
  "usuario": "mi_usuario",
  "contrasena": "mi_contraseña"
}
```

**Response exitosa:**

```json
{
  "codigo": 0,
  "estado": "OK",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "duracion": 3600
}
```

**Errores posibles:**

| codigo | mensaje |
|--------|---------|
| `1` | `Credenciales inválidas` |
| `1` | `Integrador deshabilitado` |
| `2` | `Faltan credenciales` |

---

### 2. BusquedaCorrelativo

Busca facturas pendientes por número de factura (correlativo).

**Request:**

```json
{
  "metodo": "BusquedaCorrelativo",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "correlativo": "FAC-001234"
}
```

**Response exitosa:**

```json
{
  "codigo": 0,
  "facturas": [
    {
      "id_factura": 1234,
      "numero_factura": "FAC-001234",
      "fecha_vencimiento": "2026-03-15",
      "periodo_facturado": "01/02/2026 - 28/02/2026",
      "monto": 25.99,
      "saldo_pendiente": 25.99,
      "cliente": "Juan Pérez",
      "codigo_cliente": 456,
      "vencida": false,
      "estado_factura": "PENDIENTE"
    }
  ]
}
```

**Errores posibles:**

| codigo | mensaje |
|--------|---------|
| `2` | `Falta correlativo` |

---

### 3. BusquedaCodigoCliente

Busca todas las facturas pendientes de un cliente por su código (ID). Los resultados se ordenan por fecha de creación ascendente (más antigua primero).

**Request:**

```json
{
  "metodo": "BusquedaCodigoCliente",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "codigo_cliente": 456
}
```

**Response exitosa:**

```json
{
  "codigo": 0,
  "facturas": [
    {
      "id_factura": 1233,
      "numero_factura": "FAC-001233",
      "fecha_vencimiento": "2026-02-15",
      "periodo_facturado": "01/01/2026 - 31/01/2026",
      "monto": 25.99,
      "saldo_pendiente": 25.99,
      "cliente": "Juan Pérez",
      "codigo_cliente": 456,
      "vencida": true,
      "estado_factura": "VENCIDA"
    },
    {
      "id_factura": 1234,
      "numero_factura": "FAC-001234",
      "fecha_vencimiento": "2026-03-15",
      "periodo_facturado": "01/02/2026 - 28/02/2026",
      "monto": 25.99,
      "saldo_pendiente": 25.99,
      "cliente": "Juan Pérez",
      "codigo_cliente": 456,
      "vencida": false,
      "estado_factura": "PENDIENTE"
    }
  ]
}
```

**Errores posibles:**

| codigo | mensaje |
|--------|---------|
| `2` | `Falta codigo_cliente` |

---

### 4. BusquedaDUI

Busca facturas pendientes por número de DUI del cliente. Un mismo DUI puede estar asociado a múltiples clientes; se retornan facturas de todos ellos. Los resultados se ordenan por fecha de creación ascendente.

**Request:**

```json
{
  "metodo": "BusquedaDUI",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "dui": "01234567-8"
}
```

**Response exitosa:**

```json
{
  "codigo": 0,
  "facturas": [...]
}
```

El array `facturas` tiene la misma estructura descrita en [Formato de Factura](#formato-de-factura).

**Errores posibles:**

| codigo | mensaje |
|--------|---------|
| `2` | `Falta dui` |

---

### 5. BusquedaNombre

Busca facturas pendientes por nombre del cliente (búsqueda parcial, case-insensitive). Retorna un máximo de **50 facturas**.

**Request:**

```json
{
  "metodo": "BusquedaNombre",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "nombre": "Juan"
}
```

**Response exitosa:**

```json
{
  "codigo": 0,
  "facturas": [...]
}
```

**Errores posibles:**

| codigo | mensaje |
|--------|---------|
| `2` | `Falta nombre` |

---

### 6. AplicarPago

Registra un pago (abono) sobre una factura pendiente.

**Request:**

```json
{
  "metodo": "AplicarPago",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "id_factura": 1233,
  "monto": 25.99,
  "colector": "María López",
  "referencia": "REC-00567"
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id_factura` | number | Sí | ID de la factura (campo `id_factura` de la búsqueda) |
| `monto` | number | Sí | Monto a abonar (máximo 2 decimales) |
| `colector` | string | Sí | Nombre de la persona que recibe el pago |
| `referencia` | string | No | Referencia o número de recibo del pago |

**Response exitosa:**

```json
{
  "codigo": 0,
  "estado": "OK",
  "mensaje": "Pago aplicado con éxito",
  "id_pago": 789
}
```

El `id_pago` retornado es necesario para anular el pago posteriormente.

**Errores posibles:**

| codigo | mensaje |
|--------|---------|
| `2` | `Faltan campos requeridos: id_factura, monto, colector` |
| `2` | `Factura #1233 no encontrada` |
| `2` | `Factura #1233 no está pendiente de pago (estado: PAGADA_TOTAL)` |
| `2` | `El monto ($30.00) excede el saldo pendiente ($25.99)` |
| `2` | `Debe pagar primero la factura más antigua (CXC #101)` |

---

### 7. AnularPago

Anula (revierte) un pago previamente aplicado vía PuntoXpress. Solo se pueden anular pagos realizados por PuntoXpress.

**Request:**

```json
{
  "metodo": "AnularPago",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "id_pago": 789,
  "motivo": "Cliente solicitó reversión"
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id_pago` | number | Sí | ID del pago retornado por `AplicarPago` |
| `motivo` | string | Sí | Razón de la anulación |

**Response exitosa:**

```json
{
  "codigo": 0,
  "estado": "OK",
  "mensaje": "Pago anulado con éxito"
}
```

**Errores posibles:**

| codigo | mensaje |
|--------|---------|
| `2` | `Faltan campos requeridos: id_pago, motivo` |
| `2` | `Pago #789 no encontrado` |
| `2` | `Este pago ya fue anulado` |
| `2` | `Este pago no fue realizado por PuntoXpress` |
| `2` | `No se puede anular un pago de una cuenta ya anulada` |

---

## Formato de Factura

Todas las búsquedas retornan facturas con esta estructura:

| Campo | Tipo | Descripción |
|-------|------|-------------| 
| `numero_factura` | string | Número/correlativo de la factura |
| `fecha_vencimiento` | string | Fecha de vencimiento en formato `YYYY-MM-DD` |
| `periodo_facturado` | string | Período cubierto, ej: `"01/02/2026 - 28/02/2026"` |
| `monto` | number | Monto total de la factura |
| `saldo_pendiente` | number | Saldo pendiente de pago |
| `cliente` | string | Nombre del titular |
| `codigo_cliente` | number | ID del cliente |
| `vencida` | boolean | `true` si la fecha de vencimiento ya pasó |
| `estado_factura` | string | Estado de la cuenta: `PENDIENTE`, `PAGADA_PARCIAL` o `VENCIDA` |

Solo se retornan facturas activas con cuentas por cobrar en estado `PENDIENTE`, `PAGADA_PARCIAL` o `VENCIDA`.

---

## Reglas de Negocio

1. **Factura más antigua primero**: Al aplicar un pago, se valida que la factura sea la más antigua del cliente con saldo pendiente. Si existe una factura con fecha de emisión anterior, el pago será rechazado. Esto garantiza que los clientes paguen en orden cronológico.

2. **Monto no puede exceder saldo**: El monto del pago no puede ser mayor al saldo pendiente de la factura.

3. **Pagos parciales**: Se permiten pagos por montos menores al saldo pendiente. La factura pasa a estado `PAGADA_PARCIAL` y el saldo se reduce proporcionalmente.

4. **Anulación restringida**: Solo se pueden anular pagos realizados por PuntoXpress. No es posible anular pagos de otros canales.

5. **Activación automática** (si está habilitada en el servidor): Cuando un cliente en estado `SUSPENDIDO` paga todas sus facturas pendientes, su cuenta se reactiva automáticamente a estado `ACTIVO`.

---

## Flujo de Integración Típico

```
1. POST /puntoxpress/legacy  { metodo: "Autenticacion", ... }
   → Obtener token JWT

2. POST /puntoxpress/legacy  { metodo: "BusquedaDUI", token: "...", dui: "..." }
   → Obtener listado de facturas pendientes

3. POST /puntoxpress/legacy  { metodo: "AplicarPago", token: "...", id_factura_directa: N, ... }
   → Registrar pago (siempre comenzar por la factura más antigua)

4. (Opcional) POST /puntoxpress/legacy  { metodo: "AnularPago", token: "...", id_pago: N, ... }
   → Revertir un pago si es necesario
```

**Nota:** El token expira en 1 hora. Renueve el token antes de que expire llamando nuevamente a `Autenticacion`.
