# Flujos de Negocio - Facturación DTE

## 1. Diagrama de Estados de DTE

```
                    ┌─────────────────┐
                    │    BORRADOR     │ ← Estado inicial al guardar
                    │  (DTE creado)   │
                    └────────┬────────┘
                             │
                             │ Firma exitosa con API_FIRMADOR
                             ▼
                    ┌─────────────────┐
                    │     FIRMADO     │
                    │  (JWS listo)    │
                    └────────┬────────┘
                             │
                             │ Envío a MH
                             ▼
                    ┌─────────────────┐
                    │  TRANSMITIDO    │
                    │ (Esperando MH)  │
                    └────────┬────────┘
                             │
               ┌─────────────┴─────────────┐
               │                           │
               ▼                           ▼
      ┌─────────────────┐         ┌─────────────────┐
      │    PROCESADO    │         │    RECHAZADO    │
      │ (Sello de MH)   │         │ (Errores de MH) │
      └────────┬────────┘         └─────────────────┘
               │
               │ Anulación exitosa
               ▼
      ┌─────────────────┐
      │   INVALIDADO    │
      │ (DTE anulado)   │
      └─────────────────┘
```

---

## 2. Diagrama de Estados de Anulación

```
                    ┌─────────────────┐
                    │    PENDIENTE    │ ← Estado inicial
                    │ (Evento creado) │
                    └────────┬────────┘
                             │
                             │ Firma exitosa
                             ▼
                    ┌─────────────────┐
                    │     FIRMADA     │
                    │  (JWS listo)    │
                    └────────┬────────┘
                             │
                             │ Envío a MH
                             ▼
                    ┌─────────────────┐
                    │  TRANSMITIDA    │
                    │ (Esperando MH)  │
                    └────────┬────────┘
                             │
               ┌─────────────┴─────────────┐
               │                           │
               ▼                           ▼
      ┌─────────────────┐         ┌─────────────────┐
      │    PROCESADA    │         │    RECHAZADA    │
      │  (DTE → INVAL)  │         │ (Errores de MH) │
      └─────────────────┘         └─────────────────┘
```

---

## 3. Flujo Crear Cobro/Factura (9 pasos)

### Diagrama de Secuencia

```
Frontend                 Backend (CobrosService)              API_FIRMADOR              MH
    │                            │                                │                      │
    │ POST /facturacion/cobros   │                                │                      │
    │ ─────────────────────────> │                                │                      │
    │                            │                                │                      │
    │                            │ ┌─────────────────────────────────────────────────┐   │
    │                            │ │ PASO 1: Validaciones                            │   │
    │                            │ │ - Verificar contrato existe                     │   │
    │                            │ │ - Estado: INSTALADO_ACTIVO, EN_MORA o           │   │
    │                            │ │   VELOCIDAD_REDUCIDA                            │   │
    │                            │ │ - Obtener datos facturación cliente             │   │
    │                            │ │ - Verificar NIT/NRC empresa emisora             │   │
    │                            │ │ - Obtener sucursal                              │   │
    │                            │ │ - Verificar bloque facturas disponible          │   │
    │                            │ └─────────────────────────────────────────────────┘   │
    │                            │                                │                      │
    │                            │ ┌─────────────────────────────────────────────────┐   │
    │                            │ │ PASO 2: Determinar tipo DTE                     │   │
    │                            │ │ - Si receptor tiene NIT + NRC → CCF (03)        │   │
    │                            │ │ - En otro caso → FC (01)                        │   │
    │                            │ └─────────────────────────────────────────────────┘   │
    │                            │                                │                      │
    │                            │ ┌─────────────────────────────────────────────────┐   │
    │                            │ │ PASO 3: Calcular mora (si aplicarMora=true)     │   │
    │                            │ │ - Obtener config mora (contrato o default)      │   │
    │                            │ │ - Buscar facturas vencidas                      │   │
    │                            │ │ - Aplicar fórmula según tipo_calculo            │   │
    │                            │ │ - Crear item de mora (servicio exento)          │   │
    │                            │ └─────────────────────────────────────────────────┘   │
    │                            │                                │                      │
    │                            │ ┌─────────────────────────────────────────────────┐   │
    │                            │ │ PASO 4: Generar identificación                  │   │
    │                            │ │ - codigoGeneracion = UUID v4                    │   │
    │                            │ │ - numeroControl = DTE-XX-YYYYYYYY-ZZZ...        │   │
    │                            │ └─────────────────────────────────────────────────┘   │
    │                            │                                │                      │
    │                            │ ┌─────────────────────────────────────────────────┐   │
    │                            │ │ PASO 5: Construir JSON del DTE                  │   │
    │                            │ │ - Usar FcBuilder o CcfBuilder                   │   │
    │                            │ │ - Calcular totales (gravada, exenta, IVA)       │   │
    │                            │ │ - Convertir total a letras                      │   │
    │                            │ └─────────────────────────────────────────────────┘   │
    │                            │                                │                      │
    │                            │ ┌─────────────────────────────────────────────────┐   │
    │                            │ │ PASO 6: Guardar BORRADOR en BD                  │   │
    │                            │ │ - Crear registro dte_emitidos                   │   │
    │                            │ │ - Guardar detalle en dte_emitidos_detalle       │   │
    │                            │ │ - Estado = BORRADOR                             │   │
    │                            │ └─────────────────────────────────────────────────┘   │
    │                            │                                │                      │
    │                            │ PASO 7: Firmar                 │                      │
    │                            │ POST /firmardocumento/         │                      │
    │                            │ ─────────────────────────────> │                      │
    │                            │                                │                      │
    │                            │ <───────────────────────────── │                      │
    │                            │ JWS firmado                    │                      │
    │                            │ Estado = FIRMADO               │                      │
    │                            │                                │                      │
    │                            │ PASO 8: Transmitir a MH                               │
    │                            │ POST /fesv/recepciondte        │                      │
    │                            │ ──────────────────────────────────────────────────────>
    │                            │                                │                      │
    │                            │ <──────────────────────────────────────────────────────
    │                            │ Respuesta MH (sello o errores)│                      │
    │                            │                                │                      │
    │                            │ ┌─────────────────────────────────────────────────┐   │
    │                            │ │ PASO 9: Actualizar estado final                 │   │
    │                            │ │ - Si éxito: PROCESADO + sello_recepcion         │   │
    │                            │ │ - Si error: RECHAZADO + errores                 │   │
    │                            │ │ - Incrementar correlativo bloque                │   │
    │                            │ └─────────────────────────────────────────────────┘   │
    │                            │                                │                      │
    │ <───────────────────────── │                                │                      │
    │ Response con resultado     │                                │                      │
    │                            │                                │                      │
```

### Resumen de Pasos

| Paso | Acción | Resultado |
|------|--------|-----------|
| 1 | Validaciones | Datos verificados |
| 2 | Determinar tipo | FC (01) o CCF (03) |
| 3 | Calcular mora | Items + mora si aplica |
| 4 | Generar IDs | UUID + numeroControl |
| 5 | Construir JSON | DTE completo |
| 6 | Guardar | Estado BORRADOR |
| 7 | Firmar | Estado FIRMADO |
| 8 | Transmitir | Envío a MH |
| 9 | Actualizar | PROCESADO o RECHAZADO |

---

## 4. Flujo Anular DTE (7 pasos)

### Diagrama de Secuencia

```
Frontend                 Backend (AnulacionesService)         API_FIRMADOR              MH
    │                            │                                │                      │
    │ POST /facturacion/anulaciones                               │                      │
    │ ─────────────────────────> │                                │                      │
    │                            │                                │                      │
    │                            │ ┌─────────────────────────────────────────────────┐   │
    │                            │ │ PASO 1: Validaciones                            │   │
    │                            │ │ - DTE existe                                    │   │
    │                            │ │ - Estado = PROCESADO                            │   │
    │                            │ │ - Tiene sello_recepcion de MH                   │   │
    │                            │ │ - No tiene anulación previa PROCESADA           │   │
    │                            │ │ - Dentro del plazo (90 días FC, 1 día CCF)      │   │
    │                            │ │ - Si tipo=1: existe DTE reemplazo PROCESADO     │   │
    │                            │ │ - Si tipo=3: tiene motivoAnulacion              │   │
    │                            │ └─────────────────────────────────────────────────┘   │
    │                            │                                │                      │
    │                            │ ┌─────────────────────────────────────────────────┐   │
    │                            │ │ PASO 2: Preparar datos                          │   │
    │                            │ │ - Datos del emisor (empresa)                    │   │
    │                            │ │ - Datos del DTE original                        │   │
    │                            │ │ - Datos del motivo de anulación                 │   │
    │                            │ └─────────────────────────────────────────────────┘   │
    │                            │                                │                      │
    │                            │ ┌─────────────────────────────────────────────────┐   │
    │                            │ │ PASO 3: Construir evento de anulación           │   │
    │                            │ │ - Generar codigoGeneracion (UUID v4)            │   │
    │                            │ │ - Construir JSON según schema MH v2             │   │
    │                            │ └─────────────────────────────────────────────────┘   │
    │                            │                                │                      │
    │                            │ ┌─────────────────────────────────────────────────┐   │
    │                            │ │ PASO 4: Guardar anulación PENDIENTE             │   │
    │                            │ │ - Crear registro dte_anulaciones                │   │
    │                            │ │ - Estado = PENDIENTE                            │   │
    │                            │ └─────────────────────────────────────────────────┘   │
    │                            │                                │                      │
    │                            │ PASO 5: Firmar evento          │                      │
    │                            │ POST /firmardocumento/         │                      │
    │                            │ ─────────────────────────────> │                      │
    │                            │ <───────────────────────────── │                      │
    │                            │ Estado = FIRMADA               │                      │
    │                            │                                │                      │
    │                            │ PASO 6: Transmitir a MH                               │
    │                            │ POST /fesv/anulardte           │                      │
    │                            │ ──────────────────────────────────────────────────────>
    │                            │ <──────────────────────────────────────────────────────
    │                            │                                │                      │
    │                            │ ┌─────────────────────────────────────────────────┐   │
    │                            │ │ PASO 7: Actualizar estados                      │   │
    │                            │ │ - Anulación: PROCESADA o RECHAZADA              │   │
    │                            │ │ - Si éxito: DTE original → INVALIDADO           │   │
    │                            │ └─────────────────────────────────────────────────┘   │
    │                            │                                │                      │
    │ <───────────────────────── │                                │                      │
    │ Response                   │                                │                      │
```

### Validaciones de Anulación

```
┌────────────────────────────────────────────────────────────┐
│                    VALIDAR DTE                              │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ¿DTE existe?                                              │
│       │                                                    │
│       ├── NO ──> Error 404: DTE no encontrado              │
│       │                                                    │
│       └── SÍ                                               │
│            │                                               │
│            ▼                                               │
│  ¿Estado = PROCESADO?                                      │
│       │                                                    │
│       ├── NO ──> Error 400: Solo se pueden anular          │
│       │          DTEs en estado PROCESADO                  │
│       │                                                    │
│       └── SÍ                                               │
│            │                                               │
│            ▼                                               │
│  ¿Tiene sello de MH?                                       │
│       │                                                    │
│       ├── NO ──> Error 400: DTE no tiene sello MH          │
│       │                                                    │
│       └── SÍ                                               │
│            │                                               │
│            ▼                                               │
│  ¿Ya fue anulado?                                          │
│       │                                                    │
│       ├── SÍ ──> Error 409: DTE ya fue anulado             │
│       │                                                    │
│       └── NO                                               │
│            │                                               │
│            ▼                                               │
│  ¿Dentro del plazo?                                        │
│       │                                                    │
│       ├── NO ──> Error 400: Plazo expirado                 │
│       │          (90 días FC, 1 día CCF)                   │
│       │                                                    │
│       └── SÍ ──> Continuar con anulación                   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 5. Flujo Cálculo de Mora

```
┌─────────────────────────────────────────────────────────────┐
│              INICIO: aplicarMora = true                     │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Buscar configuración de mora del contrato                  │
│  atcContrato.id_mora_config                                 │
└────────────────────────────┬────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
     ┌─────────────────┐          ┌─────────────────┐
     │  Config existe  │          │  Config NO      │
     │  y está activa  │          │  existe         │
     └────────┬────────┘          └────────┬────────┘
              │                             │
              │                             ▼
              │              ┌─────────────────────────────────┐
              │              │  Buscar config default empresa  │
              │              │  GeneralData.id_mora_config_    │
              │              │  default                        │
              │              └────────────────┬────────────────┘
              │                               │
              │                    ┌──────────┴──────────┐
              │                    │                     │
              │                    ▼                     ▼
              │           ┌─────────────┐       ┌─────────────┐
              │           │   Existe    │       │  NO existe  │
              │           │   activa    │       │             │
              │           └──────┬──────┘       └──────┬──────┘
              │                  │                     │
              │                  │                     ▼
              └──────────────────┴─────────────>  RETURN
                                 │               aplicaMora=false
                                 │               montoMora=0
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│  Obtener facturas vencidas del contrato                     │
│  WHERE estado = PROCESADO                                   │
│    AND fecha_emision < (hoy - dias_gracia)                  │
└────────────────────────────┬────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
     ┌─────────────────┐          ┌─────────────────┐
     │  Hay facturas   │          │  NO hay         │
     │  vencidas       │          │  facturas       │
     └────────┬────────┘          └────────┬────────┘
              │                             │
              │                             ▼
              │                     RETURN aplicaMora=false
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│  POR CADA factura vencida:                                  │
│                                                             │
│  1. Calcular días de atraso                                 │
│     diasAtraso = (hoy - fecha_vencimiento) / días          │
│                                                             │
│  2. Aplicar fórmula según tipo_calculo:                     │
│                                                             │
│     MONTO_FIJO:                                             │
│       mora = valor × multiplicador_frecuencia               │
│                                                             │
│     PORCENTAJE_SALDO:                                       │
│       base = es_acumulativa ? (original + acumulada)        │
│                            : original                       │
│       mora = (base × valor/100) × multiplicador             │
│                                                             │
│     PORCENTAJE_MONTO_ORIGINAL:                              │
│       mora = (original × valor/100) × multiplicador         │
│                                                             │
│  3. Multiplicador según frecuencia:                         │
│     UNICA   → 1                                             │
│     DIARIA  → diasAtraso                                    │
│     SEMANAL → ceil(diasAtraso / 7)                          │
│     MENSUAL → ceil(diasAtraso / 30)                         │
│                                                             │
│  4. Aplicar topes:                                          │
│     mora = min(mora, mora_maxima)                           │
│     mora = min(mora, original × porcentaje_maximo / 100)    │
│                                                             │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Sumar mora de todas las facturas                           │
│  moraTotal = sum(mora_por_factura)                          │
│  Redondear a 2 decimales                                    │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Crear item de mora en el DTE:                              │
│                                                             │
│  {                                                          │
│    tipoItem: 2,              // Servicio                    │
│    descripcion: "Mora por pago tardío (N días)",            │
│    cantidad: 1,                                             │
│    uniMedida: 99,            // Otro                        │
│    precioUnitario: moraTotal,                               │
│    esGravado: false,                                        │
│    esExento: true            // Generalmente exenta         │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Flujo de Integración con API_FIRMADOR

```
┌─────────────────────────────────────────────────────────────┐
│                    DTE JSON (sin firmar)                    │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  POST http://localhost:8113/firmardocumento/                │
│                                                             │
│  Request:                                                   │
│  {                                                          │
│    "nit": "0614-123456-789-0",                              │
│    "activo": true,                                          │
│    "passwordPri": "${FIRMADOR_PASSWORD}",                   │
│    "dteJson": { ... DTE completo ... }                      │
│  }                                                          │
│                                                             │
│  Timeout: 30 segundos                                       │
└────────────────────────────┬────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
     ┌─────────────────┐          ┌─────────────────┐
     │  status: "OK"   │          │ status: "ERROR" │
     └────────┬────────┘          └────────┬────────┘
              │                             │
              ▼                             ▼
     ┌─────────────────┐          ┌─────────────────┐
     │  body: JWS      │          │  body: mensaje  │
     │  (documento     │          │  de error       │
     │   firmado)      │          │                 │
     └────────┬────────┘          └────────┬────────┘
              │                             │
              ▼                             ▼
     ┌─────────────────┐          ┌─────────────────┐
     │  success: true  │          │  success: false │
     │  documentoFirmado│         │  error: mensaje │
     └─────────────────┘          └─────────────────┘
```

---

## 7. Flujo de Integración con MH

### Autenticación

```
┌─────────────────────────────────────────────────────────────┐
│  Verificar si hay token válido en cache                     │
└────────────────────────────┬────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
     ┌─────────────────┐          ┌─────────────────┐
     │  Token válido   │          │  No hay token   │
     │  (no expirado)  │          │  o está vencido │
     └────────┬────────┘          └────────┬────────┘
              │                             │
              ▼                             ▼
     ┌─────────────────┐     ┌────────────────────────────────┐
     │  Usar token     │     │  POST /seguridad/auth          │
     │  existente      │     │                                │
     └─────────────────┘     │  Body (URLParams):             │
                             │  user=${NIT}&pwd=${PASSWORD}   │
                             │                                │
                             │  Vigencia:                     │
                             │  - Pruebas: 48 horas           │
                             │  - Producción: 24 horas        │
                             └────────────────┬───────────────┘
                                              │
                                              ▼
                             ┌────────────────────────────────┐
                             │  Guardar token en cache        │
                             │  con timestamp de expiración   │
                             └────────────────────────────────┘
```

### Transmisión de DTE

```
┌─────────────────────────────────────────────────────────────┐
│  POST {MH_URL}/fesv/recepciondte                            │
│                                                             │
│  Headers:                                                   │
│    Authorization: Bearer ${token}                           │
│    Content-Type: application/json                           │
│                                                             │
│  Body:                                                      │
│  {                                                          │
│    "ambiente": "00",          // 00=pruebas, 01=prod        │
│    "idEnvio": 1,                                            │
│    "version": 1,              // 1 para FC, 3 para CCF      │
│    "tipoDte": "01",           // 01=FC, 03=CCF              │
│    "documento": "eyJhbGci...", // JWS firmado               │
│    "codigoGeneracion": "A1B2..." // UUID del DTE            │
│  }                                                          │
│                                                             │
│  Timeout: 8 segundos (según manual MH)                      │
│  Reintentos: 2 adicionales si timeout                       │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Respuesta MH:                                              │
│                                                             │
│  {                                                          │
│    "estado": "PROCESADO",    // o "RECHAZADO"               │
│    "selloRecibido": "20219E...",  // 40 caracteres          │
│    "fhProcesamiento": "15/01/2025 10:30:00",                │
│    "codigoMsg": "001",                                      │
│    "descripcionMsg": "DTE RECIBIDO SATISFACTORIAMENTE",     │
│    "observaciones": []       // Errores si RECHAZADO        │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Formato del Número de Control

```
DTE-XX-YYYYYYYY-ZZZZZZZZZZZZZZZ
 │   │     │            │
 │   │     │            └── Correlativo (15 dígitos, padded)
 │   │     │
 │   │     └── codEstableMH + codPuntoVentaMH (8 caracteres)
 │   │
 │   └── Tipo de DTE (01, 03, etc.)
 │
 └── Prefijo fijo

Ejemplo: DTE-01-M001P001-000000000000001
```

---

## 9. Resumen de Tiempos y Límites

| Operación | Timeout | Reintentos |
|-----------|---------|------------|
| Firma (API_FIRMADOR) | 30 segundos | No |
| Autenticación MH | Default axios | No |
| Transmisión DTE | 8 segundos | 2 |
| Transmisión Anulación | 8 segundos | 2 |

| Recurso | Vigencia |
|---------|----------|
| Token MH (pruebas) | 48 horas |
| Token MH (producción) | 24 horas |
| Anular FC | 90 días |
| Anular CCF | 1 día hábil |
