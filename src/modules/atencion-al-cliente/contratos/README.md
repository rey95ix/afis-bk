# Módulo de Contratos - Atención al Cliente

## Descripción General

El módulo de **Contratos** gestiona los contratos de servicio de los clientes del sistema AFIS. Permite crear, administrar y dar seguimiento a los contratos de servicios de telecomunicaciones (Internet, CATV, Telefonía) incluyendo la información técnica de la instalación.

Este módulo es parte del submódulo de **Atención al Cliente** y se integra con:
- Módulo de Clientes (para vincular contratos a clientes)
- Módulo de Órdenes de Trabajo (para vincular instalaciones)
- Módulo de Catálogos (para planes, ciclos y tipos de servicio)

---

## Estructura de Archivos

```
src/modules/atencion-al-cliente/contratos/
├── contratos.controller.ts              # Controlador principal de contratos
├── contratos.service.ts                 # Servicio con lógica de negocio de contratos
├── contrato-instalacion.controller.ts   # Controlador de datos de instalación
├── contrato-instalacion.service.ts      # Servicio de instalación técnica
├── dto/
│   ├── index.ts                         # Exportaciones de DTOs
│   ├── create-contrato.dto.ts           # DTO para crear contrato
│   ├── update-contrato.dto.ts           # DTO para actualizar contrato
│   ├── create-contrato-instalacion.dto.ts   # DTO para crear instalación
│   └── update-contrato-instalacion.dto.ts   # DTO para actualizar instalación
└── CLAUDE.md                            # Esta documentación

prisma/
├── schema.prisma                        # Modelos de base de datos
└── seed/
    └── contratos-catalogos.seed.ts      # Script para insertar datos iniciales
```

---

## Modelos de Base de Datos (Prisma)

### Diagrama de Relaciones

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ atcTipoServicio │────<│   atcTipoPlan   │────<│     atcPlan     │
│  (Residencial,  │     │ (Internet Res., │     │  (Plan 50Mbps,  │
│   Corporativo)  │     │  CATV Corp...)  │     │   precio, vel.) │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
┌─────────────────┐                                      │
│atcCicloFactura- │                                      │
│     ción        │──────────────────────────────────────┤
│ (día corte/venc)│                                      │
└─────────────────┘                                      │
                                                         │
┌─────────────────┐     ┌─────────────────┐              │
│     cliente     │────<│   atcContrato   │<─────────────┘
│                 │     │  (CTR-202501-   │
└─────────────────┘     │     00001)      │
                        └────────┬────────┘
┌─────────────────┐              │
│clienteDireccio- │              │
│      nes        │──────────────┤
└─────────────────┘              │
                                 │
┌─────────────────┐              │
│  orden_trabajo  │──────────────┤ (opcional)
│                 │              │
└─────────────────┘              │
                                 │
┌─────────────────┐              │
│    usuarios     │──────────────┘ (creador)
│                 │
└─────────────────┘

┌─────────────────┐
│ atcContrato     │
│   Instalacion   │ (1:1 con contrato)
│ (WiFi, ONU,     │
│  técnicos)      │
└─────────────────┘
```

---

### Enum: estadoContrato

Estados posibles de un contrato de servicio:

```typescript
enum estadoContrato {
  PENDIENTE_INSTALACION   // Contrato creado, pendiente de instalar el servicio
  INSTALADO_ACTIVO        // Servicio instalado y funcionando correctamente
  SUSPENDIDO              // Servicio suspendido por falta de pago
  SUSPENDIDO_TEMPORAL     // Suspensión temporal a petición del cliente
  VELOCIDAD_REDUCIDA      // Cliente en mora con velocidad reducida al 50%
  EN_MORA                 // Cliente moroso, pendiente de suspensión
  BAJA_DEFINITIVA         // Servicio dado de baja permanentemente
  BAJA_CAMBIO_TITULAR     // Baja por cambio de titular del contrato
  CANCELADO               // Contrato cancelado antes de instalación
}
```

---

### Modelo: atcTipoServicio

Catálogo de categorías principales de servicio.

```prisma
model atcTipoServicio {
  id_tipo_servicio Int      @id @default(autoincrement())
  nombre           String   // "Residencial", "Corporativo", "Otro"
  codigo           String   @unique // "RES", "CORP", "OTRO"
  estado           estado   @default(ACTIVO)
  fecha_creacion   DateTime @default(now())

  // Relaciones
  tiposPlan atcTipoPlan[]
}
```

**Datos iniciales:**
| ID | Código | Nombre |
|----|--------|--------|
| 1 | RES | Residencial |
| 2 | CORP | Corporativo |
| 3 | OTRO | Otro |

---

### Modelo: atcTipoPlan

Catálogo de tipos de plan por categoría de servicio.

```prisma
model atcTipoPlan {
  id_tipo_plan     Int             @id @default(autoincrement())
  nombre           String          // "Internet Residencial", "CATV Corporativo"
  codigo           String          @unique // "IR", "CC", "ICC"
  id_tipo_servicio Int
  tipoServicio     atcTipoServicio @relation(...)
  estado           estado          @default(ACTIVO)
  fecha_creacion   DateTime        @default(now())

  // Relaciones
  planes atcPlan[]

  @@index([id_tipo_servicio])
}
```

**Datos iniciales (21 tipos):**

| Código | Nombre | Tipo Servicio |
|--------|--------|---------------|
| IR | Internet Residencial | Residencial |
| CR | CATV Residencial | Residencial |
| ICR | Internet + CATV Residencial | Residencial |
| TICR | Telefonía + Internet + CATV Residencial | Residencial |
| TIR | Internet + Telefonía Residencial | Residencial |
| CSR | Convenio de servicio | Residencial |
| IC | Internet Corporativo | Corporativo |
| CC | CATV Corporativo | Corporativo |
| ICC | Internet + CATV Corporativo | Corporativo |
| TIC | Telefonía + Internet Corporativo | Corporativo |
| TC | Telefonía Corporativo | Corporativo |
| TCC | Telefonía + CATV Corporativo | Corporativo |
| TICC | Telefonía + Internet + CATV Corporativo | Corporativo |
| C | Colocación | Corporativo |
| F | Fibra Oscura | Corporativo |
| M | Membresía | Otro |
| SC | Servicios Complementarios | Otro |
| VP | Venta de productos | Otro |
| FP | Financiamiento de Producto | Otro |
| APS | Acuerdo Pago de Servicio | Otro |
| A | Abonos | Otro |

---

### Modelo: atcPlan

Catálogo de planes de servicio con precios y especificaciones técnicas.

```prisma
model atcPlan {
  id_plan               Int          @id @default(autoincrement())
  nombre                String       // "Plan 50 Mbps", "Plan Empresarial 100 Mbps"
  descripcion           String?      // Descripción detallada del plan
  precio                Decimal      @db.Decimal(10, 2) // Precio mensual
  id_tipo_plan          Int
  tipoPlan              atcTipoPlan  @relation(...)
  meses_contrato        Int          @default(12) // Duración estándar del contrato

  // Datos técnicos de velocidad
  velocidad_bajada      Int?         // Velocidad download en Mbps
  velocidad_subida      Int?         // Velocidad upload en Mbps

  // Configuración de impuestos
  aplica_iva            Boolean      @default(true)
  aplica_cesc           Boolean      @default(false) // Contribución especial
  porcentaje_iva        Decimal      @default(13.00) @db.Decimal(5, 2)

  // Vigencia del plan
  fecha_inicio_vigencia DateTime?    // Desde cuándo está disponible
  fecha_fin_vigencia    DateTime?    // Hasta cuándo está disponible

  estado                estado       @default(ACTIVO)
  fecha_creacion        DateTime     @default(now())
  fecha_actualizacion   DateTime     @default(now()) @updatedAt

  // Relaciones
  contratos             atcContrato[]

  @@index([id_tipo_plan])
  @@index([estado])
}
```

---

### Modelo: atcCicloFacturacion

Catálogo de ciclos de facturación con días de corte y vencimiento.

```prisma
model atcCicloFacturacion {
  id_ciclo        Int      @id @default(autoincrement())
  nombre          String   // "Ciclo 1 - día 3 de cada mes"
  dia_corte       Int      // Día del mes para generar factura
  dia_vencimiento Int      // Día del mes para vencimiento de pago
  periodo_inicio  Int      // Día de inicio del período facturado
  periodo_fin     Int      // Día de fin del período facturado
  estado          estado   @default(ACTIVO)
  fecha_creacion  DateTime @default(now())

  // Relaciones
  contratos       atcContrato[]
}
```

**Datos iniciales (10 ciclos):**

| ID | Nombre | Día Corte | Día Vencimiento | Período |
|----|--------|-----------|-----------------|---------|
| 1 | Ciclo 1 - día 3 de cada mes | 3 | 3 | 1-31 |
| 2 | Ciclo 2 - día 12 de cada mes | 12 | 12 | 10-9 |
| 3 | Ciclo 3 - día 10 de cada mes | 10 | 10 | 6-5 |
| 4 | Ciclo 4 - día 16 de cada mes | 16 | 16 | 1-31 |
| 5 | Ciclo 5 - día 24 de cada mes | 24 | 24 | 21-20 |
| 6 | Ciclo 6 - día 7 de cada mes | 7 | 7 | 4-3 |
| 7 | Ciclo 7 - día 16 de cada mes | 16 | 16 | 13-12 |
| 8 | Ciclo 8 - día 19 de cada mes | 19 | 19 | 18-17 |
| 9 | Ciclo 9 - día 27 de cada mes | 27 | 27 | 26-25 |
| 10 | Ciclo 10 - día 5 de cada mes | 5 | 5 | 28-27 |

---

### Modelo: atcContrato

Tabla principal de contratos de servicio.

```prisma
model atcContrato {
  id_contrato           Int                  @id @default(autoincrement())
  codigo                String               @unique // "CTR-202501-00001"

  // Relación con cliente
  id_cliente            Int
  cliente               cliente              @relation(...)

  // Plan contratado
  id_plan               Int
  plan                  atcPlan              @relation(...)

  // Ciclo de facturación asignado
  id_ciclo              Int
  ciclo                 atcCicloFacturacion  @relation(...)

  // Dirección donde se presta el servicio
  id_direccion_servicio Int
  direccionServicio     clienteDirecciones   @relation(...)

  // Vinculación opcional con Orden de Trabajo de Instalación
  id_orden_trabajo      Int?
  ordenTrabajo          orden_trabajo?       @relation(...)

  // Fechas del contrato
  fecha_venta           DateTime             @default(now())
  fecha_instalacion     DateTime?            // Fecha cuando se instaló
  fecha_inicio_contrato DateTime?            // Inicio de vigencia
  fecha_fin_contrato    DateTime?            // Fin de vigencia
  meses_contrato        Int                  @default(12)

  // Estado del contrato
  estado                estadoContrato       @default(PENDIENTE_INSTALACION)

  // Auditoría
  id_usuario_creador    Int
  usuarioCreador        usuarios             @relation(...)
  fecha_creacion        DateTime             @default(now())
  fecha_actualizacion   DateTime             @default(now()) @updatedAt

  // Relaciones
  instalacion           atcContratoInstalacion?

  @@index([id_cliente])
  @@index([id_plan])
  @@index([id_ciclo])
  @@index([estado])
  @@index([fecha_venta])
  @@index([id_orden_trabajo])
}
```

**Formato del código de contrato:** `CTR-YYYYMM-#####`
- `CTR` - Prefijo fijo
- `YYYYMM` - Año y mes de creación
- `#####` - Número secuencial de 5 dígitos (reinicia cada mes)

Ejemplo: `CTR-202501-00001`, `CTR-202501-00002`, `CTR-202502-00001`

---

### Modelo: atcContratoInstalacion

Datos técnicos de la instalación del servicio. Relación 1:1 con el contrato.

```prisma
model atcContratoInstalacion {
  id_instalacion        Int          @id @default(autoincrement())
  id_contrato           Int          @unique // Solo una instalación por contrato
  contrato              atcContrato  @relation(...)

  // Configuración WiFi entregada al cliente
  wifi_nombre           String?      // Nombre de la red (SSID)
  wifi_password         String?      // Contraseña de la red

  // Datos técnicos del equipo ONU/ONT
  potencia_onu          String?      // Potencia óptica (ej: "-18.5 dBm")
  mac_onu               String?      // Dirección MAC (ej: "AA:BB:CC:DD:EE:FF")
  numero_serie_onu      String?      // Número de serie del equipo

  // Estado de la instalación
  fecha_instalacion     DateTime?    // Fecha y hora de la instalación
  instalado             Boolean      @default(false) // Flag de completado
  observaciones         String?      @db.Text // Notas del técnico

  // Técnicos que realizaron la instalación
  tecnicos_instalacion  String?      @db.Text // JSON array de IDs de usuarios

  fecha_creacion        DateTime     @default(now())
  fecha_actualizacion   DateTime     @default(now()) @updatedAt

  @@index([id_contrato])
}
```

---

## DTOs (Data Transfer Objects)

### CreateContratoDto

```typescript
export class CreateContratoDto {
  @IsInt()
  id_cliente: number;          // ID del cliente (requerido)

  @IsInt()
  id_plan: number;             // ID del plan a contratar (requerido)

  @IsInt()
  id_ciclo: number;            // ID del ciclo de facturación (requerido)

  @IsInt()
  id_direccion_servicio: number; // ID de la dirección del cliente (requerido)

  @IsOptional()
  @IsInt()
  id_orden_trabajo?: number;   // ID de la OT de instalación (opcional)

  @IsOptional()
  @IsDateString()
  fecha_venta?: string;        // Fecha de venta (opcional, default: now)

  @IsOptional()
  @IsInt()
  @Min(1)
  meses_contrato?: number;     // Duración en meses (opcional, default: 12)
}
```

### UpdateContratoDto

Extiende de `CreateContratoDto` con campos adicionales:

```typescript
export class UpdateContratoDto extends PartialType(CreateContratoDto) {
  @IsOptional()
  @IsDateString()
  fecha_instalacion?: string;

  @IsOptional()
  @IsDateString()
  fecha_inicio_contrato?: string;

  @IsOptional()
  @IsDateString()
  fecha_fin_contrato?: string;

  @IsOptional()
  @IsEnum(EstadoContrato)
  estado?: EstadoContrato;
}
```

### CreateContratoInstalacionDto

```typescript
export class CreateContratoInstalacionDto {
  @IsInt()
  id_contrato: number;         // ID del contrato (requerido)

  @IsOptional()
  @IsString()
  wifi_nombre?: string;        // Nombre de la red WiFi

  @IsOptional()
  @IsString()
  wifi_password?: string;      // Contraseña WiFi

  @IsOptional()
  @IsString()
  potencia_onu?: string;       // Potencia óptica (ej: "-18.5 dBm")

  @IsOptional()
  @IsString()
  mac_onu?: string;            // MAC address de la ONU

  @IsOptional()
  @IsString()
  numero_serie_onu?: string;   // Número de serie del equipo

  @IsOptional()
  @IsDateString()
  fecha_instalacion?: string;  // Fecha y hora de instalación

  @IsOptional()
  @IsBoolean()
  instalado?: boolean;         // Si la instalación está completada

  @IsOptional()
  @IsString()
  observaciones?: string;      // Notas del técnico

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  tecnicos_instalacion?: number[]; // IDs de los técnicos
}
```

### UpdateContratoInstalacionDto

```typescript
export class UpdateContratoInstalacionDto extends PartialType(
  OmitType(CreateContratoInstalacionDto, ['id_contrato'] as const),
) {}
```

---

## API Endpoints

### Contratos CRUD

#### POST /atencion-al-cliente/contratos
Crear un nuevo contrato de servicio.

**Permisos:** `atencion_cliente.contratos:crear`

**Request Body:**
```json
{
  "id_cliente": 123,
  "id_plan": 5,
  "id_ciclo": 1,
  "id_direccion_servicio": 456,
  "id_orden_trabajo": 789,
  "fecha_venta": "2025-01-15",
  "meses_contrato": 12
}
```

**Response (201):**
```json
{
  "id_contrato": 1,
  "codigo": "CTR-202501-00001",
  "estado": "PENDIENTE_INSTALACION",
  "fecha_venta": "2025-01-15T00:00:00.000Z",
  "meses_contrato": 12,
  "cliente": {
    "id_cliente": 123,
    "titular": "Juan Pérez",
    "dui": "12345678-9",
    "correo_electronico": "juan@email.com",
    "telefono1": "7890-1234"
  },
  "plan": {
    "id_plan": 5,
    "nombre": "Plan 50 Mbps",
    "precio": "25.00",
    "velocidad_bajada": 50,
    "velocidad_subida": 10,
    "tipoPlan": {
      "id_tipo_plan": 1,
      "nombre": "Internet Residencial",
      "codigo": "IR",
      "tipoServicio": {
        "id_tipo_servicio": 1,
        "nombre": "Residencial",
        "codigo": "RES"
      }
    }
  },
  "ciclo": {
    "id_ciclo": 1,
    "nombre": "Ciclo 1 - día 3 de cada mes",
    "dia_corte": 3,
    "dia_vencimiento": 3
  },
  "direccionServicio": {
    "id_cliente_direccion": 456,
    "direccion": "Col. Escalón, Calle Principal #123",
    "municipio": { "nombre": "San Salvador" },
    "departamento": { "nombre": "San Salvador" }
  },
  "ordenTrabajo": {
    "id_orden": 789,
    "codigo": "OT-202501-00001",
    "tipo": "INSTALACION",
    "estado": "PENDIENTE_ASIGNACION"
  },
  "usuarioCreador": {
    "id_usuario": 1,
    "nombres": "Admin",
    "apellidos": "Sistema"
  },
  "instalacion": null,
  "fecha_creacion": "2025-01-15T10:30:00.000Z"
}
```

**Errores posibles:**
- `404`: Cliente, plan, ciclo o dirección no encontrados
- `400`: La dirección no pertenece al cliente

---

#### GET /atencion-al-cliente/contratos
Listar contratos con paginación y búsqueda.

**Permisos:** `atencion_cliente.contratos:ver`

**Query Parameters:**
| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| page | number | 1 | Número de página |
| limit | number | 10 | Registros por página |
| search | string | "" | Búsqueda por código, nombre cliente, DUI o plan |

**Response (200):**
```json
{
  "data": [
    {
      "id_contrato": 1,
      "codigo": "CTR-202501-00001",
      "estado": "INSTALADO_ACTIVO",
      "cliente": { ... },
      "plan": { ... },
      "ciclo": { ... }
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 10,
    "totalPages": 15
  }
}
```

---

#### GET /atencion-al-cliente/contratos/:id
Obtener un contrato específico por ID.

**Permisos:** `atencion_cliente.contratos:ver`

**Response (200):** Objeto completo del contrato con todas sus relaciones.

**Errores posibles:**
- `404`: Contrato no encontrado

---

#### GET /atencion-al-cliente/contratos/cliente/:id_cliente
Obtener todos los contratos de un cliente específico.

**Permisos:** `atencion_cliente.contratos:ver`

**Response (200):** Array de contratos del cliente.

**Errores posibles:**
- `404`: Cliente no encontrado

---

#### GET /atencion-al-cliente/contratos/buscar/codigo/:codigo
Buscar un contrato por su código único.

**Permisos:** `atencion_cliente.contratos:ver`

**Ejemplo:** `GET /atencion-al-cliente/contratos/buscar/codigo/CTR-202501-00001`

**Response (200):** Objeto del contrato o `null` si no existe.

---

#### PUT /atencion-al-cliente/contratos/:id
Actualizar un contrato existente.

**Permisos:** `atencion_cliente.contratos:editar`

**Request Body:**
```json
{
  "id_plan": 6,
  "estado": "SUSPENDIDO",
  "fecha_fin_contrato": "2026-01-15"
}
```

**Response (200):** Objeto actualizado del contrato.

**Errores posibles:**
- `404`: Contrato, plan, ciclo o dirección no encontrados
- `400`: La nueva dirección no pertenece al cliente

---

#### DELETE /atencion-al-cliente/contratos/:id
Cancelar un contrato (soft delete - cambia estado a CANCELADO).

**Permisos:** `atencion_cliente.contratos:eliminar`

**Response (200):** Objeto del contrato con estado actualizado.

**Errores posibles:**
- `404`: Contrato no encontrado

---

### Instalación de Contratos

#### POST /atencion-al-cliente/contratos/instalacion
Registrar los datos técnicos de instalación de un contrato.

**Permisos:** `atencion_cliente.contratos:gestionar_instalacion`

**Request Body:**
```json
{
  "id_contrato": 1,
  "wifi_nombre": "NEWTEL_PEREZ_5G",
  "wifi_password": "SecureP4ss2025!",
  "potencia_onu": "-18.5 dBm",
  "mac_onu": "AA:BB:CC:DD:EE:FF",
  "numero_serie_onu": "HWTC12345678",
  "fecha_instalacion": "2025-01-20T14:30:00Z",
  "instalado": true,
  "observaciones": "Instalación completada sin inconvenientes. Cliente satisfecho.",
  "tecnicos_instalacion": [10, 15]
}
```

**Comportamiento especial:**
- Si `instalado: true`, el contrato automáticamente cambia a estado `INSTALADO_ACTIVO`
- Se actualiza `fecha_instalacion` y `fecha_inicio_contrato` en el contrato

**Response (201):**
```json
{
  "id_instalacion": 1,
  "id_contrato": 1,
  "wifi_nombre": "NEWTEL_PEREZ_5G",
  "wifi_password": "SecureP4ss2025!",
  "potencia_onu": "-18.5 dBm",
  "mac_onu": "AA:BB:CC:DD:EE:FF",
  "numero_serie_onu": "HWTC12345678",
  "fecha_instalacion": "2025-01-20T14:30:00.000Z",
  "instalado": true,
  "observaciones": "Instalación completada sin inconvenientes.",
  "tecnicos_instalacion": "[10, 15]",
  "contrato": {
    "codigo": "CTR-202501-00001",
    "cliente": { ... },
    "plan": { ... }
  }
}
```

**Errores posibles:**
- `404`: Contrato no encontrado
- `409`: Ya existe una instalación para este contrato

---

#### GET /atencion-al-cliente/contratos/instalacion/contrato/:id_contrato
Obtener datos de instalación por ID de contrato.

**Permisos:** `atencion_cliente.contratos:ver`

**Response (200):** Objeto de instalación con datos del contrato.

**Errores posibles:**
- `404`: Instalación no encontrada para el contrato

---

#### GET /atencion-al-cliente/contratos/instalacion/:id
Obtener datos de instalación por ID de instalación.

**Permisos:** `atencion_cliente.contratos:ver`

**Response (200):** Objeto de instalación.

**Errores posibles:**
- `404`: Instalación no encontrada

---

#### PUT /atencion-al-cliente/contratos/instalacion/:id
Actualizar datos de instalación.

**Permisos:** `atencion_cliente.contratos:gestionar_instalacion`

**Request Body:**
```json
{
  "potencia_onu": "-17.2 dBm",
  "observaciones": "Se ajustó la potencia óptica",
  "instalado": true
}
```

**Comportamiento especial:**
- Si se cambia `instalado` de `false` a `true`, el contrato se actualiza automáticamente

**Response (200):** Objeto actualizado de instalación.

---

#### DELETE /atencion-al-cliente/contratos/instalacion/:id
Eliminar datos de instalación (hard delete).

**Permisos:** `atencion_cliente.contratos:gestionar_instalacion`

**Response (200):** Objeto eliminado.

**Errores posibles:**
- `404`: Instalación no encontrada

---

### Catálogos (Solo Lectura)

Todos los endpoints de catálogos requieren el permiso `atencion_cliente.catalogos:ver`.

#### GET /api/catalogos/tipos-servicio
Lista los tipos de servicio disponibles.

**Response:**
```json
[
  { "id_tipo_servicio": 1, "codigo": "RES", "nombre": "Residencial", "estado": "ACTIVO" },
  { "id_tipo_servicio": 2, "codigo": "CORP", "nombre": "Corporativo", "estado": "ACTIVO" },
  { "id_tipo_servicio": 3, "codigo": "OTRO", "nombre": "Otro", "estado": "ACTIVO" }
]
```

---

#### GET /api/catalogos/tipos-plan
Lista los tipos de plan con su tipo de servicio.

**Response:**
```json
[
  {
    "id_tipo_plan": 1,
    "codigo": "IR",
    "nombre": "Internet Residencial",
    "estado": "ACTIVO",
    "tipoServicio": {
      "id_tipo_servicio": 1,
      "codigo": "RES",
      "nombre": "Residencial"
    }
  }
]
```

---

#### GET /api/catalogos/planes
Lista los planes de servicio activos.

**Response:**
```json
[
  {
    "id_plan": 1,
    "nombre": "Plan 50 Mbps",
    "descripcion": "Internet residencial 50 Mbps",
    "precio": "25.00",
    "velocidad_bajada": 50,
    "velocidad_subida": 10,
    "meses_contrato": 12,
    "aplica_iva": true,
    "aplica_cesc": false,
    "porcentaje_iva": "13.00",
    "tipoPlan": {
      "nombre": "Internet Residencial",
      "tipoServicio": {
        "nombre": "Residencial"
      }
    }
  }
]
```

---

#### GET /api/catalogos/ciclos-facturacion
Lista los ciclos de facturación disponibles.

**Response:**
```json
[
  {
    "id_ciclo": 1,
    "nombre": "Ciclo 1 - día 3 de cada mes",
    "dia_corte": 3,
    "dia_vencimiento": 3,
    "periodo_inicio": 1,
    "periodo_fin": 31,
    "estado": "ACTIVO"
  }
]
```

---

#### GET /api/catalogos/estados-contrato
Lista los estados posibles de un contrato.

**Response:**
```json
[
  { "value": "PENDIENTE_INSTALACION", "label": "Pendiente de Instalación" },
  { "value": "INSTALADO_ACTIVO", "label": "Instalado - Activo" },
  { "value": "SUSPENDIDO", "label": "Suspendido" },
  { "value": "SUSPENDIDO_TEMPORAL", "label": "Suspendido Temporal" },
  { "value": "VELOCIDAD_REDUCIDA", "label": "Velocidad Reducida" },
  { "value": "EN_MORA", "label": "En Mora" },
  { "value": "BAJA_DEFINITIVA", "label": "Baja Definitiva" },
  { "value": "BAJA_CAMBIO_TITULAR", "label": "Baja por Cambio de Titular" },
  { "value": "CANCELADO", "label": "Cancelado" }
]
```

---

## Flujos de Trabajo

### 1. Crear un Nuevo Contrato

```
┌─────────────────┐
│ Validar cliente │
│    existe       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Validar plan   │
│    existe       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Validar ciclo   │
│    existe       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│Validar dirección│
│pertenece cliente│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│Validar OT existe│
│  (si se envía)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generar código  │
│CTR-YYYYMM-##### │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Crear contrato  │
│estado: PENDIENTE│
│  _INSTALACION   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Registrar log   │
│ CREAR_CONTRATO  │
└─────────────────┘
```

### 2. Completar Instalación

```
┌─────────────────┐
│Validar contrato │
│    existe       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Verificar no    │
│existe instalac. │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│Crear registro de│
│  instalación    │
└────────┬────────┘
         │
         ▼
    ┌────┴────┐
    │instalado│
    │= true?  │
    └────┬────┘
    SI   │   NO
    ▼    │    ▼
┌───────┐│┌───────┐
│Cambiar││ │ Fin   │
│contrato││└───────┘
│a ACTIVO││
└───┬───┘│
    │    │
    ▼    │
┌───────┐│
│Setear ││
│fechas ││
└───────┘│
         │
         ▼
┌─────────────────┐
│ Registrar log   │
│CREAR_INSTALACION│
└─────────────────┘
```

### 3. Cambio de Plan

```typescript
// Actualizar contrato con nuevo plan
await contratosService.update(id_contrato, {
  id_plan: nuevo_id_plan,
}, id_usuario);
```

### 4. Suspender Servicio

```typescript
// Cambiar estado a suspendido
await contratosService.update(id_contrato, {
  estado: 'SUSPENDIDO',
}, id_usuario);
```

### 5. Dar de Baja

```typescript
// Cancelar contrato
await contratosService.remove(id_contrato, id_usuario);
// El estado cambia a CANCELADO
```

---

## Permisos Requeridos

| Permiso | Descripción | Endpoints |
|---------|-------------|-----------|
| `atencion_cliente.contratos:crear` | Crear nuevos contratos | POST /contratos |
| `atencion_cliente.contratos:ver` | Ver contratos y sus datos | GET /contratos/* |
| `atencion_cliente.contratos:editar` | Actualizar contratos | PUT /contratos/:id |
| `atencion_cliente.contratos:eliminar` | Cancelar contratos | DELETE /contratos/:id |
| `atencion_cliente.contratos:gestionar_instalacion` | Gestionar instalaciones | POST, PUT, DELETE /instalacion/* |
| `atencion_cliente.catalogos:ver` | Ver catálogos | GET /api/catalogos/* |

---

## Registro de Acciones (Log)

Todas las operaciones importantes se registran en la tabla `log`:

| Acción | Descripción |
|--------|-------------|
| `CREAR_CONTRATO` | Cuando se crea un nuevo contrato |
| `ACTUALIZAR_CONTRATO` | Cuando se actualiza un contrato |
| `CANCELAR_CONTRATO` | Cuando se cancela un contrato |
| `CREAR_INSTALACION_CONTRATO` | Cuando se registra una instalación |
| `ACTUALIZAR_INSTALACION_CONTRATO` | Cuando se actualiza una instalación |
| `ELIMINAR_INSTALACION_CONTRATO` | Cuando se elimina una instalación |

---

## Ejecutar Seed de Datos

Para insertar los datos iniciales de catálogos:

```bash
cd afis-bk
npx ts-node prisma/seed/contratos-catalogos.seed.ts
```

**Salida esperada:**
```
🌱 Iniciando seed de catálogos de contratos...
📦 Insertando tipos de servicio...
✅ 3 tipos de servicio insertados
📦 Insertando tipos de plan...
✅ 21 tipos de plan insertados
📦 Insertando ciclos de facturación...
✅ 10 ciclos de facturación insertados
🎉 Seed de catálogos de contratos completado!
```

---

## Ejemplos de Código

### Crear contrato completo

```typescript
// En el controlador o desde otro servicio
const nuevoContrato = await this.contratosService.create({
  id_cliente: 123,
  id_plan: 5,
  id_ciclo: 1,
  id_direccion_servicio: 456,
  id_orden_trabajo: 789, // Opcional
  meses_contrato: 12,
}, usuario.id_usuario);

console.log(nuevoContrato.codigo); // "CTR-202501-00001"
```

### Registrar instalación y activar contrato

```typescript
const instalacion = await this.contratoInstalacionService.create({
  id_contrato: 1,
  wifi_nombre: "NEWTEL_CLIENTE",
  wifi_password: "Secure123!",
  potencia_onu: "-18.5 dBm",
  mac_onu: "AA:BB:CC:DD:EE:FF",
  numero_serie_onu: "HWTC12345678",
  instalado: true, // Esto activa el contrato automáticamente
  tecnicos_instalacion: [10, 15],
}, usuario.id_usuario);
```

### Buscar contratos de un cliente

```typescript
const contratos = await this.contratosService.findByCliente(123);
// Retorna array con todos los contratos del cliente
```

### Cambiar estado de contrato

```typescript
await this.contratosService.update(1, {
  estado: 'SUSPENDIDO',
}, usuario.id_usuario);
```

---

## Notas de Desarrollo

1. **Código automático**: Se genera secuencialmente por mes con formato `CTR-YYYYMM-#####`

2. **Soft delete**: Los contratos nunca se eliminan físicamente, solo cambian a estado `CANCELADO`

3. **Instalación única**: Cada contrato solo puede tener un registro de instalación (relación 1:1)

4. **Validaciones estrictas**: Se validan todas las FK antes de crear/actualizar

5. **Activación automática**: Al marcar `instalado: true` en la instalación, el contrato cambia automáticamente a `INSTALADO_ACTIVO`

6. **Auditoría completa**: Todas las acciones se registran en la tabla `log`

7. **Técnicos como JSON**: El campo `tecnicos_instalacion` almacena un array de IDs como JSON string

8. **Índices optimizados**: Se crearon índices en campos frecuentemente consultados (estado, fecha_venta, id_cliente)

---

## Integración con Frontend

El frontend debe implementar:

1. **Formulario de creación de contrato**:
   - Select de cliente (con búsqueda)
   - Select de plan (filtrado por tipo de servicio)
   - Select de ciclo de facturación
   - Select de dirección del cliente
   - Selector de OT de instalación (opcional)

2. **Formulario de instalación**:
   - Campos de WiFi (nombre y contraseña)
   - Campos técnicos de ONU
   - Multiselect de técnicos
   - Checkbox de "instalación completada"

3. **Lista de contratos**:
   - Tabla paginada con búsqueda
   - Filtros por estado
   - Acciones: ver, editar, cancelar

4. **Vista de detalle de contrato**:
   - Información del cliente
   - Información del plan
   - Estado del contrato
   - Datos de instalación (si existen)
   - Historial de cambios

---

**Última actualización**: Diciembre 2024
**Versión del módulo**: 1.0.0
**Autor**: Sistema AFIS
