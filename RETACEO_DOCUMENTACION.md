# Documentación del Sistema de Retaceo de Importaciones

## 📋 Descripción General

El sistema de retaceo permite distribuir los gastos adicionales de una importación (flete, seguro, aduana, etc.) entre todos los items de forma proporcional, calculando así el costo final de cada producto.

## 🎯 Objetivo

Calcular el **costo unitario final** de cada item considerando:
- Precio de compra (FOB)
- Gastos adicionales distribuidos proporcionalmente (retaceo)

## 🔧 Componentes Implementados

### 1. **DTO: `calcular-retaceo.dto.ts`**
```typescript
{
  forzar_recalculo?: boolean  // Opcional, default: false
}
```

### 2. **Service: `calcularRetaceo()`**
Método principal que ejecuta el cálculo del retaceo.

### 3. **Endpoint**
```
POST /inventario/importaciones/:id/calcular-retaceo
```

## 📊 Métodos de Distribución

El sistema soporta 4 métodos de distribución:

### 1. **VALOR** (Por defecto)
Distribuye el gasto proporcionalmente al valor de cada item.

**Ejemplo:**
```
Item A: $1,000 (50% del total) → Recibe 50% del gasto
Item B: $1,000 (50% del total) → Recibe 50% del gasto
Gasto: $300 → Item A: $150, Item B: $150
```

### 2. **PESO**
Distribuye según el peso (kg) de cada item.

**Ejemplo:**
```
Item A: 10 kg (33% del total) → Recibe 33% del gasto
Item B: 20 kg (67% del total) → Recibe 67% del gasto
Gasto: $300 → Item A: $100, Item B: $200
```

### 3. **VOLUMEN**
Distribuye según el volumen (m³) de cada item.

**Ejemplo:**
```
Item A: 1 m³ (40% del total) → Recibe 40% del gasto
Item B: 1.5 m³ (60% del total) → Recibe 60% del gasto
Gasto: $300 → Item A: $120, Item B: $180
```

### 4. **CANTIDAD**
Distribuye uniformemente entre todas las unidades.

**Ejemplo:**
```
Item A: 100 unidades (67% del total)
Item B: 50 unidades (33% del total)
Gasto: $300 → Item A: $200, Item B: $100
```

## 🚀 Flujo de Uso

### Paso 1: Crear la Importación
```bash
POST /inventario/importaciones
{
  "id_proveedor": 1,
  "moneda": "USD",
  "tipo_cambio": 8.75,
  "detalle": [
    {
      "id_catalogo": 1,
      "codigo": "PROD-001",
      "nombre": "Producto A",
      "cantidad_ordenada": 100,
      "precio_unitario_usd": 10.00,
      "peso_kg": 10,
      "volumen_m3": 1.0
    },
    {
      "id_catalogo": 2,
      "codigo": "PROD-002",
      "nombre": "Producto B",
      "cantidad_ordenada": 50,
      "precio_unitario_usd": 20.00,
      "peso_kg": 20,
      "volumen_m3": 1.5
    }
  ]
}
```

### Paso 2: Agregar Gastos
```bash
POST /inventario/importaciones/1/gastos
{
  "tipo": "FLETE_INTERNACIONAL",
  "descripcion": "Flete marítimo desde Shanghai",
  "monto": 300.00,
  "moneda": "USD",
  "tipo_cambio": 8.75,
  "aplica_retaceo": true,
  "metodo_retaceo": "PESO"
}

POST /inventario/importaciones/1/gastos
{
  "tipo": "GASTOS_ADUANA",
  "descripcion": "Derechos de aduana",
  "monto": 150.00,
  "moneda": "USD",
  "tipo_cambio": 8.75,
  "aplica_retaceo": true,
  "metodo_retaceo": "VALOR"
}
```

### Paso 3: Calcular el Retaceo
```bash
POST /inventario/importaciones/1/calcular-retaceo
{
  "forzar_recalculo": false
}
```

## 📈 Ejemplo Completo de Cálculo

### Datos Iniciales:
```
Importación con tipo de cambio: 8.75

Item A:
- Cantidad: 100 unidades
- Precio: $10.00 USD
- Subtotal: $1,000 USD (50%)
- Peso: 10 kg (33%)
- Volumen: 1 m³ (40%)
- Precio Local: 87.50 c/u

Item B:
- Cantidad: 50 unidades
- Precio: $20.00 USD
- Subtotal: $1,000 USD (50%)
- Peso: 20 kg (67%)
- Volumen: 1.5 m³ (60%)
- Precio Local: 175.00 c/u

Gastos:
1. Flete: $300 USD (metodo: PESO) → $2,625 local
2. Aduana: $150 USD (metodo: VALOR) → $1,312.50 local
```

### Cálculo del Retaceo:

#### Gasto 1 - Flete ($2,625 local) por PESO:
```
Item A: $2,625 × (10kg / 30kg) = $875.00
Item B: $2,625 × (20kg / 30kg) = $1,750.00
```

#### Gasto 2 - Aduana ($1,312.50 local) por VALOR:
```
Item A: $1,312.50 × ($1,000 / $2,000) = $656.25
Item B: $1,312.50 × ($1,000 / $2,000) = $656.25
```

#### Retaceo Total por Item:
```
Item A: $875.00 + $656.25 = $1,531.25
Item B: $1,750.00 + $656.25 = $2,406.25
```

#### Retaceo por Unidad:
```
Item A: $1,531.25 / 100 unidades = $15.31 por unidad
Item B: $2,406.25 / 50 unidades = $48.13 por unidad
```

#### Costo Unitario Final:
```
Item A: $87.50 + $15.31 = $102.81 por unidad
Item B: $175.00 + $48.13 = $223.13 por unidad
```

## 🗄️ Tablas Actualizadas

### `importaciones_detalle`
Se actualizan los siguientes campos:
- `costo_unitario_final`: Precio unitario local + retaceo total por unidad
- `costo_total_final`: Costo unitario final × cantidad ordenada

### `retaceo_importacion`
Se crea **UN REGISTRO POR CADA GASTO** que aplica retaceo:
- `id_importacion`: ID de la importación
- `id_gasto`: ID del gasto específico
- `metodo_aplicado`: Método usado (VALOR, PESO, VOLUMEN, CANTIDAD)
- `monto_total_distribuir`: Monto del gasto a distribuir
- `fecha_calculo`: Fecha y hora del cálculo
- `calculado_por`: ID del usuario que ejecutó el cálculo

### `retaceo_detalle`
Se crean registros por cada combinación gasto-item:
- `id_retaceo`: Referencia al retaceo_importacion (gasto)
- `id_importacion_detalle`: Item afectado
- `base_calculo`: Valor usado como base (valor USD, peso kg, volumen m³, o cantidad)
- `porcentaje_asignado`: Proporción aplicada (0.0 a 1.0)
- `monto_asignado`: Monto calculado para este item desde este gasto
- `monto_unitario`: Monto asignado / cantidad ordenada

## ⚠️ Validaciones

El sistema valida:

1. ✅ La importación debe existir
2. ✅ Debe haber al menos un gasto con `aplica_retaceo = true`
3. ✅ La importación debe tener items en el detalle
4. ✅ Si el método es PESO, los items deben tener peso registrado
5. ✅ Si el método es VOLUMEN, los items deben tener volumen registrado
6. ✅ No permite recalcular si ya existe un retaceo (usar `forzar_recalculo: true`)

## 🔄 Recalcular Retaceo

Si necesitas recalcular (por ejemplo, después de agregar más gastos):

```bash
POST /inventario/importaciones/1/calcular-retaceo
{
  "forzar_recalculo": true
}
```

Esto:
1. Elimina el retaceo anterior
2. Recalcula con todos los gastos actuales
3. Actualiza los costos finales

## 📊 Consultar Resultados

Obtener la importación con el retaceo calculado:

```bash
GET /inventario/importaciones/1
```

Respuesta incluye:
```json
{
  "data": {
    "id_importacion": 1,
    "numero_orden": "IMP-202501-00001",
    "detalle": [
      {
        "id_importacion_detalle": 1,
        "codigo": "PROD-001",
        "nombre": "Producto A",
        "precio_unitario_usd": "10.00",
        "precio_unitario_local": "87.50",
        "costo_unitario_final": "102.81",
        "costo_total_final": "10281.00"
      }
    ],
    "retaceo": [
      {
        "id_retaceo": 1,
        "id_gasto": 1,
        "metodo_aplicado": "PESO",
        "monto_total_distribuir": "2625.00",
        "fecha_calculo": "2025-01-20T10:30:00Z",
        "gasto": {
          "tipo": "FLETE_INTERNACIONAL",
          "descripcion": "Flete marítimo"
        },
        "detalle": [
          {
            "id_importacion_detalle": 1,
            "base_calculo": "10.00",
            "porcentaje_asignado": "0.3333",
            "monto_asignado": "875.00",
            "monto_unitario": "8.75"
          }
        ]
      },
      {
        "id_retaceo": 2,
        "id_gasto": 2,
        "metodo_aplicado": "VALOR",
        "monto_total_distribuir": "1312.50",
        "fecha_calculo": "2025-01-20T10:30:00Z",
        "gasto": {
          "tipo": "GASTOS_ADUANA",
          "descripcion": "Derechos de aduana"
        },
        "detalle": [
          {
            "id_importacion_detalle": 1,
            "base_calculo": "1000.00",
            "porcentaje_asignado": "0.5000",
            "monto_asignado": "656.25",
            "monto_unitario": "6.56"
          }
        ]
      }
    ]
  }
}
```

## 🎯 Casos de Uso

### Caso 1: Importación Simple
- Productos con valores similares
- Usar método **VALOR** para todos los gastos

### Caso 2: Productos Pesados
- Items con pesos muy diferentes
- Usar método **PESO** para flete y transporte

### Caso 3: Productos Voluminosos
- Items con volúmenes muy diferentes
- Usar método **VOLUMEN** para almacenamiento

### Caso 4: Productos Uniformes
- Todos los items son similares
- Usar método **CANTIDAD** para distribución equitativa

## 🔍 Log de Auditoría

Cada cálculo de retaceo genera un registro en la tabla `log`:
```
Acción: CALCULAR_RETACEO_IMPORTACION
Usuario: ID del usuario
Descripción: "Retaceo calculado para importación IMP-202501-00001"
```

## ⚡ Performance

- El cálculo se ejecuta en una **transacción única**
- Todos los registros se crean/actualizan atómicamente
- Si falla algún paso, se revierte todo (rollback)

## 🛠️ Mantenimiento

### Ver gastos con retaceo:
```bash
GET /inventario/importaciones/1/gastos
```

### Modificar método de retaceo de un gasto:
Actualizar el gasto y recalcular el retaceo con `forzar_recalculo: true`
