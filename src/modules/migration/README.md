# Módulo Migration

## Descripción General

El módulo **Migration** permite migrar datos desde una base de datos MySQL legacy (sistema NEWTEL ISP) hacia la nueva base de datos PostgreSQL del sistema AFIS. Proporciona una API REST completa para controlar el proceso de migración con soporte para ejecución por módulos, modo simulación (dry-run), procesamiento por lotes y manejo robusto de errores.

**Ruta base:** `/migration`

## Arquitectura

```
migration/
├── migration.module.ts              # Módulo principal
├── migration.controller.ts          # Controlador REST
├── migration.service.ts             # Servicio orquestador
├── CLAUDE.md                        # Esta documentación
│
├── dto/
│   ├── migration-config.dto.ts      # DTOs de configuración
│   └── migration-result.dto.ts      # DTOs de resultados
│
├── interfaces/
│   ├── mapping.interface.ts         # Interfaces de mapeo y estado
│   └── mysql-tables.interface.ts    # Interfaces de tablas MySQL origen
│
├── services/
│   ├── mysql-connection.service.ts  # Conexión y queries a MySQL
│   ├── catalogos.migration.ts       # Migración de catálogos base
│   ├── clientes.migration.ts        # Migración de clientes
│   ├── contratos.migration.ts       # Migración de contratos
│   ├── documentos.migration.ts      # Migración de documentos a MinIO con IA
│   └── facturacion.migration.ts     # Migración de facturación/DTE
│
└── utils/
    └── transformers.ts              # Funciones de transformación de datos
```

## Módulos de Migración

La migración se ejecuta en orden de dependencias:

| Orden | Módulo | Descripción | Tablas Origen → Destino |
|-------|--------|-------------|-------------------------|
| 1 | `catalogos` | Catálogos base geográficos y estados | `tbl_parameters_*` → `departamentos`, `municipios`, `colonias`, `cat_estado_*` |
| 2 | `clientes` | Clientes con direcciones y datos | `tbl_customers*` → `cliente`, `clienteDirecciones`, `clienteDatosFacturacion` |
| 3 | `contratos` | Planes y contratos de servicio | `tbl_customers_plan/contract/service` → `atcPlan`, `atcContrato` |
| 4 | `documentos` | Documentos a MinIO con clasificación IA | `tbl_contract_media` → MinIO + `clienteDocumentos` |
| 5 | `facturacion` | Facturas y DTEs históricos | `tbl_bill*` → `dte_emitidos`, `dte_emitidos_detalle` |

## Endpoints API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/migration/validate` | Valida conexiones MySQL y PostgreSQL |
| `GET` | `/migration/status` | Estado actual de la migración |
| `GET` | `/migration/logs` | Logs de migración (paginados) |
| `GET` | `/migration/mapping-stats` | Estadísticas de IDs mapeados |
| `GET` | `/migration/preview/:module` | Preview de datos a migrar por módulo |
| `POST` | `/migration/execute/:module` | Ejecuta migración de un módulo |
| `POST` | `/migration/execute-all` | Ejecuta migración completa |
| `POST` | `/migration/reset` | Resetea estado y mapeos |
| `POST` | `/migration/cliente/:idCustomer` | **Migra un cliente individual por su ID de MySQL** |

### Opciones de Migración

```typescript
interface MigrationOptionsDto {
  batchSize?: number;        // Registros por lote (10-500, default: 100)
  skipExisting?: boolean;    // Usar upsert (default: true)
  dryRun?: boolean;          // Modo simulación (default: false)
  continueOnError?: boolean; // Continuar con errores (default: true)
  maxRetries?: number;       // Reintentos por registro (1-5, default: 3)
}
```

### Opciones para Migración de Cliente Individual

```typescript
interface MigrateClienteOptionsDto {
  dryRun?: boolean;           // Modo simulación (default: false)
  includeContratos?: boolean; // Migrar contratos del cliente (default: true)
  includeDocumentos?: boolean;// Migrar documentos del cliente (default: true)
  includeFacturas?: boolean;  // Migrar facturas del cliente (default: true)
}
```

## Mapeo de Tablas MySQL → PostgreSQL

### Catálogos

| MySQL | PostgreSQL | Notas |
|-------|------------|-------|
| `tbl_parameters_departament` | `departamentos` | Mapeo directo de IDs |
| `tbl_parameters_municipality` | `municipios` | FK a departamentos |
| `tbl_parameters_city` | `colonias` | FK a municipios |
| `tbl_customers_marital_status` | `cat_estado_civil` | Genera código `EC01`, `EC02`... |
| `tbl_customers_house_status` | `cat_estado_vivienda` | Genera código `EV01`, `EV02`... |

### Clientes

| MySQL | PostgreSQL | Transformaciones |
|-------|------------|------------------|
| `tbl_customers` | `cliente` | DUI normalizado, teléfonos combinados |
| `tbl_customers_location` | `clienteDirecciones` | Direcciones combinadas |
| `tbl_customers_references` | `cliente` (campos ref1/ref2) | Primera y segunda referencia |
| `tbl_customers` (NIT/NRC) | `clienteDatosFacturacion` | Solo si tiene NIT o NRC |

### Contratos

| MySQL | PostgreSQL | Transformaciones |
|-------|------------|------------------|
| `tbl_customers_plan` | `atcPlan` | Precio convertido a Decimal |
| `tbl_customers_contract` | `atcContrato` | Código único generado |
| `tbl_customers_service` | → Plan y Ciclo en contrato | Extrae plan_id y ciclo_id |

### Facturación

| MySQL | PostgreSQL | Transformaciones |
|-------|------------|------------------|
| `tbl_bill` | `dte_emitidos` | Código generación UUID, IVA 13% |
| `tbl_bill_details` | `dte_emitidos_detalle` | Numeración secuencial |

### Documentos

| MySQL | PostgreSQL / MinIO | Transformaciones |
|-------|------------|------------------|
| `tbl_contract_media` | MinIO (storage) | LONGBLOB → archivo en MinIO |
| `tbl_customers_contract_media` | `clienteDocumentos` | Clasificación con IA (GPT-4 Vision) |

**Mapeo de Columnas a Tipos de Documento:**

| Columna MySQL | Tipo Documento | Descripción |
|---------------|----------------|-------------|
| `from_identification` | `DUI_FRENTE` | Parte frontal del DUI |
| `reverse_identification` | `DUI_TRASERA` | Parte trasera del DUI |
| `from_nit` | `NIT_FRENTE` | Tarjeta NIT frontal |
| `reverse_nit` | `NIT_TRASERA` | Tarjeta NIT trasera |
| `receipt` | `RECIBO` | Recibo de servicio público |
| `signature` | `FIRMA` | Firma manuscrita |

**Flujo de Clasificación con IA:**
1. Se obtiene el archivo binario de `tbl_contract_media`
2. Se detecta el MIME type por magic bytes
3. Si es imagen (jpeg/png): Se clasifica con GPT-4 Vision
4. Si IA retorna `DESCONOCIDO` o no está disponible: Se usa el tipo de la columna MySQL
5. Se sube a MinIO en ruta: `clientes/{id_cliente}/documentos/{tipo}-{uuid}.{ext}`
6. Se registra en `clienteDocumentos`

## Mapeo de Estados

### Estados de Cliente
```typescript
ESTADO_CLIENTE_MAP = {
  1: 'ACTIVO',
  0: 'INACTIVO',
  2: 'SUSPENDIDO',
}
```

### Estados de Contrato
```typescript
ESTADO_CONTRATO_MAP = {
  1: 'ACTIVO',
  2: 'SUSPENDIDO',
  3: 'CANCELADO',
  4: 'PENDIENTE_FIRMA',
  5: 'PENDIENTE_INSTALACION',
}
```

### Estados de Factura
```typescript
ESTADO_FACTURA_MAP = {
  1: 'PROCESADO',
  2: 'BORRADOR',
  3: 'INVALIDADO',
}
```

### Tipo de Persona
```typescript
TIPO_PERSONA_MAP = {
  1: 'PERSONA',
  2: 'EMPRESA',
}
```

## Sistema de Mapeo de IDs

El módulo mantiene un mapeo en memoria de IDs entre MySQL y PostgreSQL:

```typescript
interface TableMappings {
  departamentos: Map<number, number>;    // oldId → newId
  municipios: Map<number, number>;
  colonias: Map<number, number>;
  estadoCivil: Map<number, number>;
  estadoVivienda: Map<number, number>;
  clientes: Map<number, number>;
  direcciones: Map<number, number>;
  planes: Map<number, number>;
  ciclosFacturacion: Map<number, number>;
  contratos: Map<number, number>;
  facturas: Map<number, number>;
  documentos: Map<number, number>;       // tbl_contract_media.id → clienteDocumentos.id
}
```

Este mapeo permite:
- Resolver FKs entre tablas relacionadas
- Evitar duplicados (upsert por ID mapeado)
- Rastrear migración incremental

## Funciones de Transformación (`utils/transformers.ts`)

| Función | Descripción |
|---------|-------------|
| `parseDate()` | Convierte fechas MySQL a Date JS |
| `combinePhones()` | Combina phone/cellphone/whatsapp en telefono1/telefono2 |
| `cleanString()` | Limpia y normaliza strings |
| `cleanStringOrNull()` | Limpia string, retorna null si vacío |
| `normalizeDUI()` | Formato: `########-#` |
| `normalizeNIT()` | Formato: `####-######-###-#` |
| `combineAddress()` | Combina address/avenue/street |
| `mapEstadoCliente()` | MySQL status → Enum Prisma |
| `mapEstadoContrato()` | MySQL status → Enum Prisma |
| `mapEstadoFactura()` | MySQL status → Enum Prisma |
| `mapTipoPersona()` | MySQL tipo → 'PERSONA' / 'EMPRESA' |
| `mapTipoDTE()` | bill_concept → Código DTE ('01', '03') |
| `toDecimal()` | Convierte a número con 2 decimales |
| `generateContractCode()` | Genera `CTR-YYYYMM-#####` |
| `generateUUID()` | Genera UUID v4 para DTE |
| `truncateString()` | Trunca string a longitud máxima |

## Variables de Entorno

```env
# Conexión a MySQL Legacy
MYSQL_LEGACY_HOST=localhost
MYSQL_LEGACY_PORT=3306
MYSQL_LEGACY_USER=root
MYSQL_LEGACY_PASSWORD=password
MYSQL_LEGACY_DATABASE=newtel_db
```

## Flujo de Migración Completa

```
1. POST /migration/validate
   └── Verificar conexiones MySQL y PostgreSQL

2. GET /migration/preview/catalogos
   └── Ver cantidad de registros a migrar

3. POST /migration/execute/catalogos { dryRun: true }
   └── Simular migración de catálogos

4. POST /migration/execute-all
   {
     "batchSize": 100,
     "skipExisting": true,
     "continueOnError": true
   }
   └── Ejecutar migración completa

5. GET /migration/status
   └── Verificar progreso y resultados

6. GET /migration/mapping-stats
   └── Ver estadísticas de mapeo
```

## Estructura de Resultados

```typescript
interface MigrationModuleResult {
  module: string;           // Nombre del módulo
  success: boolean;         // Si fue exitoso
  totalRecords: number;     // Total en origen
  migratedRecords: number;  // Migrados exitosamente
  skippedRecords: number;   // Omitidos (existentes o errores)
  errors: MigrationError[]; // Lista de errores
  duration: number;         // Duración en ms
  startedAt: Date;
  completedAt: Date;
}

interface MigrationError {
  table: string;            // Tabla donde ocurrió
  recordId: number;         // ID del registro
  field?: string;           // Campo específico
  message: string;          // Mensaje de error
  originalData?: unknown;   // Datos originales (opcional)
}
```

## Sistema de Logs

El módulo mantiene hasta 1000 logs en memoria con niveles:
- `INFO` - Operaciones normales
- `WARN` - Advertencias (registros omitidos, datos incompletos)
- `ERROR` - Errores de migración

```typescript
interface MigrationLog {
  id: number;
  timestamp: Date;
  level: 'INFO' | 'WARN' | 'ERROR';
  module: string;
  message: string;
  details?: unknown;
}
```

## Consideraciones de Seguridad

- **Autenticación**: Todos los endpoints requieren `@Auth()` y `@ApiBearerAuth`
- **Permisos**: Se recomienda restringir a administradores
- **Datos sensibles**: No se migran contraseñas de usuarios legacy
- **Backup**: Realizar backup de PostgreSQL antes de migrar

## Manejo de Casos Especiales

### DUI Duplicado
Si un cliente no tiene DUI, se genera uno temporal: `MIGRADO-{id_customers}`

### Contrato sin Dirección
Se crea una dirección placeholder: "Dirección migrada - pendiente actualizar"

### Factura sin Cliente
Se migra con `id_cliente: null`, vinculada solo por nombre

### Código de Contrato Duplicado
Se añade sufijo: `{codigo}-MIG{id_original}`

## Dependencias

```json
{
  "mysql2": "^3.x",      // Conexión a MySQL
  "@nestjs/config": "^3.x",
  "@prisma/client": "^5.x"
}
```

**Módulos NestJS:**
- `MinioModule` - Almacenamiento de archivos en MinIO (S3-compatible)
- `OpenaiModule` - Clasificación de documentos con GPT-4 Vision

## Ejemplo de Uso con cURL

```bash
# 1. Validar conexiones
curl -X POST http://localhost:4000/migration/validate \
  -H "Authorization: Bearer $TOKEN"

# 2. Preview de clientes
curl http://localhost:4000/migration/preview/clientes \
  -H "Authorization: Bearer $TOKEN"

# 3. Migrar solo catálogos
curl -X POST http://localhost:4000/migration/execute/catalogos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 100, "dryRun": false}'

# 4. Migrar todo
curl -X POST http://localhost:4000/migration/execute-all \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 100, "skipExisting": true}'

# 5. Ver estado
curl http://localhost:4000/migration/status \
  -H "Authorization: Bearer $TOKEN"

# 6. Migrar un cliente individual (NUEVO)
curl -X POST http://localhost:4000/migration/cliente/123 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": false, "includeContratos": true, "includeDocumentos": true, "includeFacturas": true}'

# 7. Simular migración de cliente individual
curl -X POST http://localhost:4000/migration/cliente/123 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

## Notas de Desarrollo

1. **Orden de ejecución**: Los módulos DEBEN ejecutarse en orden (catalogos → clientes → contratos → documentos → facturacion) para que los mapeos de FK funcionen correctamente.

2. **Modo DryRun**: Usar siempre primero `dryRun: true` para verificar transformaciones sin modificar datos.

3. **Batch Size**: Ajustar según memoria disponible. 100 es un buen balance entre velocidad y uso de recursos.

4. **Reintentos**: El sistema reintenta automáticamente errores transitorios de conexión.

5. **Rollback**: No hay rollback automático. Si es necesario, eliminar registros manualmente y resetear estado con `/migration/reset`.

---

**Última actualización**: Enero 2025
**Versión**: 1.2

### Changelog
- **1.2**: Agregado endpoint `POST /migration/cliente/:idCustomer` para migrar un cliente individual con todos sus datos relacionados
- **1.1**: Agregado módulo `documentos` para migración de archivos a MinIO con clasificación IA (GPT-4 Vision)
- **1.0**: Versión inicial con catalogos, clientes, contratos y facturacion
