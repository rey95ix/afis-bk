# Módulo de Facturación DTE

## Descripción General

Módulo para la emisión de **Documentos Tributarios Electrónicos (DTE)** según las normas del Ministerio de Hacienda de El Salvador. Implementa el flujo completo de facturación electrónica: generación, firma digital, transmisión y anulación.

## Tipos de DTE Soportados

| Código | Tipo | Descripción |
|--------|------|-------------|
| `01` | FC | Factura Consumidor Final |
| `03` | CCF | Comprobante de Crédito Fiscal |

### Diferencias entre FC y CCF

| Característica | FC (01) | CCF (03) |
|----------------|---------|----------|
| Receptor obligatorio | No | Sí (NIT + NRC) |
| IVA por línea | Sí (`ivaItem`) | No |
| IVA en resumen | `totalIva` | `ivaPerci1` |
| Precios incluyen IVA | Sí | No |
| Versión schema | 1 | 3 |

## Arquitectura de Servicios

```
facturacion/
├── controllers/
│   ├── cobros.controller.ts        # REST API para facturas
│   └── anulaciones.controller.ts   # REST API para anulaciones
├── services/
│   ├── cobros.service.ts           # Orquestador principal
│   ├── anulaciones.service.ts      # Gestión de invalidaciones
│   └── mora.service.ts             # Cálculo de recargos
├── dto/
│   ├── crear-cobro.dto.ts          # Validación entrada facturas
│   └── anular-cobro.dto.ts         # Validación entrada anulaciones
├── interfaces/
│   ├── dte.interface.ts            # Tipos de DTE
│   └── anulacion.interface.ts      # Tipos de anulación
├── dte/
│   ├── builders/
│   │   ├── fc-builder.service.ts   # Constructor FC (tipo 01)
│   │   ├── ccf-builder.service.ts  # Constructor CCF (tipo 03)
│   │   ├── anulacion-builder.service.ts
│   │   └── numero-letras.util.ts   # Conversión números a letras
│   ├── signer/
│   │   └── dte-signer.service.ts   # Firma con API_FIRMADOR
│   └── transmitter/
│       ├── mh-auth.service.ts      # Autenticación con MH
│       └── mh-transmitter.service.ts # Transmisión a MH
├── ciclos/                          # Gestión de ciclos de facturación
└── docs/                            # Documentación adicional
```

## Flujo de Creación de DTE

```
1. Validaciones        → Contrato activo, datos facturación
2. Determinar tipo     → FC (01) si no tiene NIT/NRC, CCF (03) si tiene
3. Calcular mora       → Si aplicarMora=true
4. Generar IDs         → UUID (codigoGeneracion) + numeroControl
5. Construir JSON      → Builder según tipo
6. Guardar BORRADOR    → En base de datos
7. Firmar              → POST API_FIRMADOR/firmardocumento/
8. Transmitir          → POST MH/fesv/recepciondte
9. Actualizar estado   → PROCESADO o RECHAZADO
```

## Estados del DTE

```
BORRADOR → FIRMADO → TRANSMITIDO → PROCESADO
                                 → RECHAZADO
                   PROCESADO → INVALIDADO (por anulación)
```

## Configuración Requerida

### Variables de Entorno

```bash
# API Firmador (servicio local de firma digital)
API_FIRMADOR=http://localhost:8113
FIRMADOR_PASSWORD=<contraseña_certificado>

# Ministerio de Hacienda
MH_NIT=<nit_contribuyente>
MH_PASSWORD=<contraseña_portal_mh>
```

### Base de Datos (GeneralData)

- `nit` - NIT de la empresa emisora
- `nrc` - NRC de la empresa
- `razon` - Razón social
- `cod_actividad` - Código actividad económica MH
- `ambiente` - `'00'` (pruebas) o `'01'` (producción)
- `id_mora_config_default` - Configuración de mora por defecto

### Sucursales

- `cod_estable_MH` - Código de establecimiento MH
- `cod_punto_venta_MH` - Código punto de venta MH

### Bloques de Facturas (facturasBloques)

- Bloques por sucursal y tipo de DTE
- Campos: `desde`, `hasta`, `actual` (correlativo actual)

## Dependencias del Módulo

```typescript
imports: [PrismaModule, AuthModule, ConfigModule]
```

## URLs de MH

| Ambiente | URL Base |
|----------|----------|
| Pruebas | `https://apitest.dtes.mh.gob.sv` |
| Producción | `https://api.dtes.mh.gob.sv` |

### Endpoints MH Utilizados

| Operación | Endpoint |
|-----------|----------|
| Autenticación | `POST /seguridad/auth` |
| Recepción DTE | `POST /fesv/recepciondte` |
| Anulación | `POST /fesv/anulardte` |
| Consulta | `POST /fesv/recepcion/consultadte/` |

## Vigencia de Tokens MH

| Ambiente | Duración |
|----------|----------|
| Pruebas (00) | 48 horas |
| Producción (01) | 24 horas |

## Documentación Adicional

- [API.md](./docs/API.md) - Referencia completa de endpoints REST
- [FLUJOS.md](./docs/FLUJOS.md) - Diagramas de flujos de negocio
- [FRONTEND-GUIDE.md](./docs/FRONTEND-GUIDE.md) - Guía de integración frontend

## Contacto y Soporte

Para dudas sobre el módulo de facturación, consultar la documentación oficial del Ministerio de Hacienda de El Salvador sobre DTE.
