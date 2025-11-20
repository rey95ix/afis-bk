# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **AFIS** (ixc-backend), a NestJS-based backend API for a telecommunications/ISP management system. It handles customer service operations, inventory management, work orders, and administrative functions. The system uses PostgreSQL with Prisma ORM and follows a modular architecture.

---

## 🔒 REGLA OBLIGATORIA: Decorador @RequirePermissions() en Nuevos Endpoints

**⚠️ CRÍTICO**: CADA VEZ que crees un NUEVO endpoint en CUALQUIER controlador, DEBES agregar el decorador `@RequirePermissions()` para proteger el acceso.

### Paso a Paso OBLIGATORIO para Nuevos Endpoints

#### 1. Importar el decorador
```typescript
import { RequirePermissions } from 'src/modules/auth/decorators/require-permissions.decorator';
```

#### 2. Agregar decorador al endpoint
```typescript
@Post()
@Auth()  // Autenticación JWT (si existe)
@RequirePermissions('{modulo}.{recurso}:{accion}')  // ⚠️ OBLIGATORIO
@ApiOperation({ summary: 'Descripción del endpoint' })
async metodoDelEndpoint() {
  return this.service.metodo();
}
```

#### 3. Mapeo de Métodos HTTP → Acciones

| Método HTTP | Tipo de Endpoint | Acción | Código de Permiso |
|-------------|------------------|--------|-------------------|
| GET (listar/uno) | `GET /recurso` o `GET /recurso/:id` | `:ver` | `{modulo}.{recurso}:ver` |
| POST (crear) | `POST /recurso` | `:crear` | `{modulo}.{recurso}:crear` |
| PUT/PATCH | `PUT /recurso/:id` | `:editar` | `{modulo}.{recurso}:editar` |
| DELETE | `DELETE /recurso/:id` | `:eliminar` | `{modulo}.{recurso}:eliminar` |
| POST (custom) | `POST /recurso/:id/aprobar` | `:aprobar` | `{modulo}.{recurso}:aprobar` |
| GET (PDF/Excel) | `GET /recurso/:id/pdf` | `:exportar` | `{modulo}.{recurso}:exportar` |

#### 4. Crear el permiso en SQL

Agrega el INSERT en `/Users/relex/Desktop/afis/afis-bk/prisma/migrations/permisos_completos.sql`:

```sql
INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('{modulo}.{recurso}:{accion}', 'Nombre Descriptivo', 'Descripción detallada', '{modulo}', '{recurso}', '{ACCION}', 'RECURSO', 'ACTIVO', false, false);
```

#### 5. Ejecutar el SQL
```bash
npx prisma db seed  # O ejecutar el SQL directamente
```

### Ejemplos Completos

**Ejemplo 1: Endpoint GET**
```typescript
@Get()
@Auth()
@RequirePermissions('inventario.productos:ver')
@ApiOperation({ summary: 'Listar productos' })
async findAll() {
  return this.productosService.findAll();
}
```

**Ejemplo 2: Endpoint POST**
```typescript
@Post()
@Auth()
@RequirePermissions('inventario.productos:crear')
@ApiOperation({ summary: 'Crear producto' })
async create(@Body() createDto: CreateProductoDto) {
  return this.productosService.create(createDto);
}
```

**Ejemplo 3: Endpoint Custom**
```typescript
@Post(':id/aprobar')
@Auth()
@RequirePermissions('inventario.requisiciones:aprobar')
@ApiOperation({ summary: 'Aprobar requisición' })
async aprobar(@Param('id') id: number) {
  return this.requisicionesService.aprobar(id);
}
```

### ❌ NO Agregar Decorador en Estos Casos

- **Endpoints públicos**: `auth.controller.ts` (login, forgot-password, reset-password)
- **Endpoints de desarrollo**: `seed.controller.ts`, `utilidades.controller.ts`

### ✅ Checklist para Nuevos Endpoints

Antes de hacer commit, verifica:
- [ ] ✅ Agregaste import de `RequirePermissions`
- [ ] ✅ Agregaste decorador `@RequirePermissions()` al endpoint
- [ ] ✅ El código sigue el formato `{modulo}.{recurso}:{accion}`
- [ ] ✅ Creaste el INSERT SQL en `permisos_completos.sql`
- [ ] ✅ Ejecutaste el seed o el SQL directamente
- [ ] ✅ Probaste que usuarios sin permiso reciben HTTP 403
- [ ] ✅ Probaste que Super Admin (id_rol = 1) siempre tiene acceso

### 🔐 Jerarquía de Validación

El sistema valida en este orden:
1. **Super Admin (id_rol = 1)** → ✅ Acceso TOTAL sin validar permisos
2. **Permisos del Rol** → Verifica si el rol del usuario tiene el permiso
3. **Permisos Individuales** → Verifica permisos extra asignados al usuario
4. **Error HTTP 403** → Si no cumple ninguna condición anterior

**Ver documentación completa**: Sección "⚠️ IMPORTANTE: Creación de Permisos para Nuevos Endpoints" al final de este archivo.

---

## Documentación por Módulo

**⚠️ IMPORTANTE**: Este archivo contiene información general del sistema. Para trabajar con módulos específicos, **SIEMPRE consulta primero el archivo CLAUDE.md del módulo correspondiente** para obtener documentación detallada, evitar leer código innecesario y ahorrar tokens.

### Módulos del Sistema

Cada módulo tiene su propia documentación detallada:

| Módulo | Ubicación | Descripción |
|--------|-----------|-------------|
| **Autenticación** | [`src/modules/auth/CLAUDE.md`](src/modules/auth/CLAUDE.md) | JWT, login, password reset, guards, decoradores |
| **Administración** | [`src/modules/administracion/CLAUDE.md`](src/modules/administracion/CLAUDE.md) | Usuarios, roles, catálogo de productos, categorías, geografía, DTE |
| **Atención al Cliente** | [`src/modules/atencion-al-cliente/CLAUDE.md`](src/modules/atencion-al-cliente/CLAUDE.md) | Clientes, tickets, órdenes de trabajo, agenda, evidencias |
| **Inventario** | [`src/modules/inventario/CLAUDE.md`](src/modules/inventario/CLAUDE.md) | Compras, importaciones, requisiciones, órdenes de salida, series, movimientos |
| **Email** | [`src/modules/mail/CLAUDE.md`](src/modules/mail/CLAUDE.md) | Servicio SMTP, envío de emails, templates |
| **Almacenamiento** | [`src/modules/minio/CLAUDE.md`](src/modules/minio/CLAUDE.md) | MinIO/S3, upload de archivos, gestión de objetos |
| **Base de Datos** | [`src/modules/prisma/CLAUDE.md`](src/modules/prisma/CLAUDE.md) | Prisma ORM, conexión a PostgreSQL, logging |
| **Seed** | [`src/modules/seed/CLAUDE.md`](src/modules/seed/CLAUDE.md) | Datos iniciales del sistema |
| **Utilidades** | [`src/modules/utilidades/CLAUDE.md`](src/modules/utilidades/CLAUDE.md) | Helpers, migración de datos legacy |
| **Common** | [`src/common/CLAUDE.md`](src/common/CLAUDE.md) | Constantes, DTOs, helpers, interceptores, filtros compartidos |

### Cómo Usar Esta Documentación

1. **Para tareas generales del sistema**: Lee este archivo (CLAUDE.md raíz)
2. **Para trabajar en un módulo específico**:
   - Ve directamente al CLAUDE.md del módulo
   - Ejemplo: Para crear un endpoint de inventario → lee `src/modules/inventario/CLAUDE.md`
3. **Para entender arquitectura global**: Lee la sección "Architecture" más abajo
4. **Para setup inicial**: Lee "Essential Development Commands"

### Beneficios de la Documentación Modular

✅ **Ahorro de tokens**: Solo lees el módulo que necesitas
✅ **Contexto enfocado**: Información específica sin ruido
✅ **Navegación rápida**: Encuentra lo que necesitas más rápido
✅ **Mantenimiento fácil**: Documentación organizada por área

## Essential Development Commands

### Setup
```bash
npm install                    # Install dependencies
npx prisma generate           # Generate Prisma client
npx prisma migrate dev        # Run database migrations
```

### Development
```bash
npm run start:dev             # Start development server with hot-reload
npm run start:debug           # Start in debug mode
npm run build                 # Build for production
npm run start:prod            # Run production build
```

### Database
```bash
npx prisma studio             # Open Prisma Studio for database browsing
npx prisma migrate dev --name <name>  # Create new migration
npx prisma db push            # Push schema changes without migration
```

### Code Quality
```bash
npm run lint                  # Run ESLint with auto-fix
npm run format                # Format code with Prettier
npm run test                  # Run unit tests
npm run test:watch            # Run tests in watch mode
npm run test:cov              # Run tests with coverage
npm run test:e2e              # Run end-to-end tests
```

### Testing a Single File
```bash
npm run test -- <file-path>   # Run specific test file
npm run test -- --testNamePattern="<pattern>"  # Run specific test
```

## Architecture

### Module Structure

The application is organized into the following main modules:

1. **Authentication Module** (`src/modules/auth/`)
   - JWT-based authentication using Passport
   - Password reset flow with email tokens (30-minute expiration)
   - Guards and decorators for route protection
   - Key endpoints: `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/change-password`

2. **Customer Service Module** (`src/modules/atencion-al-cliente/`)
   - **Tickets**: Customer support ticket management with severity levels
   - **Work Orders (OT)**: Field service orders linked to tickets
   - **Agenda**: Scheduling system for technician visits
   - **Catalogs**: Diagnostic/solution/closure reason catalogs
   - State machines for ticket and work order workflows

3. **Inventory Module** (`src/modules/inventario/`)
   - **Purchases (Compras)**: Local purchase management
   - **Imports (Importaciones)**: International import tracking with retaceo (cost distribution)
   - **Requisitions**: Inter-warehouse/branch transfer requests with approval workflow
   - **Exit Orders (Ordenes de Salida)**: Formal inventory exit process
   - **Warehouses (Bodegas)**: Both fixed warehouses and mobile crew inventories
   - **Serial Tracking**: Full lifecycle tracking for serialized equipment (ONUs, routers)
   - **Inventory Movements**: Comprehensive movement history with source/destination tracking

4. **Administration Module** (`src/modules/administracion/`)
   - Users, roles, branches (sucursales)
   - Product catalog and categories
   - Geographic data (departments, municipalities, colonies)
   - DTE (Electronic Tax Documents) catalogs for El Salvador compliance

5. **Utilities Module** (`src/modules/utilidades/`)
   - Common services and helpers
   - Date formatting, validation helpers
   - Shared constants and DTOs

### Key Architectural Patterns

**Prisma Integration**
- Prisma is injected as a service (`PrismaService`) in each module
- All database operations go through Prisma ORM
- Schema is located in `prisma/schema.prisma`

**State Machine Workflows**
The system uses enum-based state machines for:
- Ticket states: `ABIERTO` → `EN_DIAGNOSTICO` → `ESCALADO` → `CERRADO/CANCELADO`
- Work order states: `PENDIENTE_ASIGNACION` → `ASIGNADA` → `AGENDADA` → `EN_RUTA` → `EN_PROGRESO` → `COMPLETADA/CANCELADA`
- Requisition states: `PENDIENTE` → `APROBADA` → `PROCESADA`
- Import states: `COTIZACION` → `ORDEN_COLOCADA` → `EN_TRANSITO` → `EN_ADUANA` → `LIBERADA` → `RECIBIDA`

**Multi-User Workflow**
Many processes involve multiple users:
- Requisitions: `usuario_solicita` → `usuario_autoriza` → `usuario_procesa`
- Work Orders: Assigned to technicians, tracked by supervisors
- Imports: Requester → Receiver/Processor

**Serial Number Tracking**
Equipment with serial numbers (ONUs, routers) have full lifecycle tracking:
- Ingress (via purchase or import) → Available → Reserved → Assigned to OT → Installed at client
- Full history in `historial_series` table

**Inventory Locations**
- Three-level hierarchy: Branch (Sucursal) → Warehouse (Bodega) → Shelf (Estante)
- Warehouses can be of type `BODEGA` (fixed) or `CUADRILLA` (mobile crew inventory)

## Critical Implementation Details

### ⚠️ IMPORTANTE: Estructura de Respuestas API

**NUNCA envolver respuestas en un objeto `data` adicional en los servicios**

El sistema tiene un `TransformInterceptor` global que automáticamente envuelve TODAS las respuestas exitosas en el siguiente formato:

```typescript
{
  "data": <tu_respuesta>,
  "status": true,
  "msg": "Success"
}
```

**❌ INCORRECTO - Doble envoltura:**
```typescript
// Service
async findAll() {
  return {
    data: items,  // ❌ NO hacer esto
    meta: { ... }
  };
}

// Resultado final (doble envoltura):
{
  "data": {
    "data": [...],  // ❌ data dentro de data
    "meta": { ... }
  },
  "status": true,
  "msg": "Success"
}
```

**✅ CORRECTO - Retorno directo:**
```typescript
// Service
async findAll() {
  return {
    items,      // ✅ Retornar directamente
    meta: { ... }
  };
}

// Resultado final (interceptor lo envuelve):
{
  "data": {
    "items": [...],  // ✅ Estructura correcta
    "meta": { ... }
  },
  "status": true,
  "msg": "Success"
}
```

**Patrón estándar para paginación:**
```typescript
async findAll(filters: FilterDto) {
  const [items, total] = await Promise.all([
    this.prisma.table.findMany({ ... }),
    this.prisma.table.count({ ... })
  ]);

  // ✅ Retornar objeto plano, el interceptor lo envolverá
  return {
    items,  // o el nombre plural de la entidad (ej: auditorias, compras, etc.)
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
}
```

**Ubicación del interceptor:**
- `src/common/intersectors/transformar.interceptor.ts`
- Registrado globalmente en `main.ts`
- Aplica a TODOS los endpoints automáticamente

**Ver también:**
- `src/common/CLAUDE.md` - Sección "INTERSECTORS" para más detalles

---

### PDF Report Generation

Reports are generated using jsReport (external service). Process:

1. **Template Location**: HTML templates are in `templates/` directory at project root (NOT in `src/`)
2. **Service Method Pattern**:
   ```typescript
   async generatePdf(id: number): Promise<Buffer> {
     const data = await this.findOne(id);
     const templatePath = path.join(process.cwd(), 'templates/modulo/archivo.html');
     const templateHtml = fs.readFileSync(templatePath, 'utf-8');

     const response = await axios.post(process.env.API_REPORT, {
       template: { content: templateHtml, engine: 'jsrender', recipe: 'chrome-pdf' },
       data: templateData
     }, { responseType: 'arraybuffer' });

     return Buffer.from(response.data);
   }
   ```
3. **Controller Pattern**:
   ```typescript
   @Get(':id/pdf')
   async generatePdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
     const pdfBuffer = await this.service.generatePdf(id);
     res.set({
       'Content-Type': 'application/pdf',
       'Content-Disposition': `inline; filename="Report_${id}.pdf"`,
       'Content-Length': pdfBuffer.length
     });
     res.end(pdfBuffer);
   }
   ```
4. **Template Syntax**: Uses jsRender syntax (`{{:variable}}`, `{{for items}}`, `{{if condition}}`)

Detailed documentation: See `REPORTS.md`

### Authentication & Guards

- JWT tokens are issued on login
- Password reset tokens expire after 30 minutes
- Use `@Auth()` decorator (or similar guard) to protect routes
- Use `@GetUser()` decorator to extract user from JWT payload

Detailed documentation: See `AUTH_PASSWORD_RESET_DOC.md`

### File Uploads

- Static files served from `uploads/` directory at `/uploads/` URL path
- MinIO is configured for object storage (check `.env.example`)
- Document uploads (client documents, work order evidences) stored with metadata

### Email Integration

- SMTP configuration in `.env` (host, port, user, password, from address)
- Used for password reset emails
- Frontend URL is constructed from `FRONTEND_URL` env var

### Retaceo (Import Cost Distribution)

For international imports, additional costs (freight, customs, insurance) are distributed across items:
- Method can be by `VALOR` (value), `PESO` (weight), `VOLUMEN` (volume), or `CANTIDAD` (quantity)
- Final unit cost = (item cost + distributed costs) / quantity
- Tables: `importaciones_gastos`, `retaceo_importacion`, `retaceo_detalle`

## Environment Configuration

Key variables (see `.env.example`):
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret for JWT token signing
- `PORT`: API port (default 4000)
- `API_REPORT`: jsReport service URL for PDF generation
- `MINIO_*`: MinIO object storage credentials
- `SMTP_*`: Email server configuration
- `FRONTEND_URL`: Frontend base URL for email links

## Database Schema Highlights

- **Estado enum**: `ACTIVO`, `SUPENDIDO`, `INACTIVO` (used across many tables)
- **Timestamps**: Most tables have `fecha_creacion` and `fecha_ultima_actualizacion`
- **Soft deletes**: Use `estado = INACTIVO` rather than hard deletes
- **Foreign key naming**: Convention is `fk_{table}_{referenced_table}`

## Common Pitfalls

1. **Template paths**: Always use `process.cwd()` not `__dirname` when loading templates from root `templates/` folder
2. **Prisma relations**: Many relations use `onDelete: NoAction`, so check for dependencies before deleting
3. **Estado vs Estado enums**: Multiple enum types exist (estado, estado_ticket, estado_orden, etc.) - use the correct one
4. **Date handling**: Dates are stored as DateTime in Prisma; format appropriately for display
5. **Transaction handling**: For complex operations (like receiving an import), use Prisma transactions to ensure atomicity

## Swagger/API Documentation

- Swagger UI available at `http://localhost:{PORT}/api` after starting the server
- Use `@ApiTags()`, `@ApiOperation()`, `@ApiResponse()` decorators for documentation
- Bearer auth is configured as `HEADER_API_BEARER_AUTH` constant

## Testing Conventions

- Test files use `.spec.ts` extension
- Located alongside source files in `src/`
- Use Jest as test runner
- Mock Prisma service in tests using `PrismaService` mock

---

## ⚠️ IMPORTANTE: Creación de Permisos para Nuevos Endpoints

**REGLA OBLIGATORIA**: Cada vez que crees un NUEVO endpoint en cualquier controlador, DEBES crear el permiso correspondiente.

### 1. Analizar el Endpoint

Antes de crear el permiso, identifica:
- **Método HTTP**: GET, POST, PUT, PATCH, DELETE
- **Ruta**: `/modulo/recurso` o `/modulo/recurso/:id/accion`
- **Acción**: VER, CREAR, EDITAR, ELIMINAR, APROBAR, EXPORTAR, etc.

### 2. Determinar el Código del Permiso

**Formato estándar**: `{modulo}.{recurso}:{accion}`

#### Mapeo de Métodos HTTP a Acciones

| Método HTTP | Tipo de Endpoint | Acción | Ejemplo |
|-------------|------------------|--------|---------|
| GET (listar) | `GET /recurso` | `:ver` | `inventario.compras:ver` |
| GET (uno) | `GET /recurso/:id` | `:ver` | `inventario.compras:ver` |
| POST (crear) | `POST /recurso` | `:crear` | `inventario.compras:crear` |
| PUT/PATCH | `PUT /recurso/:id` | `:editar` | `inventario.compras:editar` |
| DELETE | `DELETE /recurso/:id` | `:eliminar` | `inventario.compras:eliminar` |
| POST (aprobar) | `POST /recurso/:id/aprobar` | `:aprobar` | `inventario.requisiciones:aprobar` |
| POST (procesar) | `POST /recurso/:id/procesar` | `:custom` | `inventario.compras:recepcionar` |
| GET (PDF/Excel) | `GET /recurso/:id/pdf` | `:exportar` | `inventario.compras:exportar` |

#### Ejemplos Completos

```typescript
// GET /inventario/compras
Código: 'inventario.compras:ver'

// POST /inventario/compras
Código: 'inventario.compras:crear'

// PATCH /inventario/compras/:id
Código: 'inventario.compras:editar'

// DELETE /inventario/compras/:id
Código: 'inventario.compras:eliminar'

// POST /inventario/compras/:id/recepcionar
Código: 'inventario.compras:recepcionar'  // Acción custom

// GET /inventario/compras/pdf
Código: 'inventario.compras:exportar'

// POST /inventario/requisiciones/:id/aprobar
Código: 'inventario.requisiciones:aprobar'

// GET /atencion-al-cliente/clientes
Código: 'atencion_cliente.clientes:ver'
```

### 3. Crear el INSERT SQL

Una vez identificado el código, agrega el INSERT a: `prisma/migrations/permisos_completos.sql`

```sql
INSERT INTO permisos (
  codigo,
  nombre,
  descripcion,
  modulo,
  recurso,
  accion,
  tipo,
  estado,
  es_critico,
  requiere_auditoria
) VALUES (
  '{modulo}.{recurso}:{accion}',                    -- Código único
  '{Nombre Descriptivo}',                           -- Nombre corto
  '{Descripción detallada de lo que permite}',      -- Descripción
  '{modulo}',                                       -- Módulo
  '{recurso}',                                      -- Recurso
  '{ACCION_EN_MAYUSCULAS}',                        -- VER, CREAR, EDITAR, etc.
  'RECURSO',                                        -- Tipo (casi siempre RECURSO)
  'ACTIVO',                                         -- Estado
  false,                                            -- es_critico (true si es peligroso)
  false                                             -- requiere_auditoria
);
```

#### Ejemplo Real

```sql
INSERT INTO permisos (
  codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria
) VALUES (
  'inventario.compras:crear',
  'Crear Compras',
  'Permite crear nuevas órdenes de compra locales',
  'inventario',
  'compras',
  'CREAR',
  'RECURSO',
  'ACTIVO',
  false,
  true  -- Requiere auditoría porque crea registros financieros
);
```

### 4. Agregar el Decorador al Endpoint

**Patrón estándar**:

```typescript
import { RequirePermissions } from 'src/modules/auth/decorators/require-permissions.decorator';

@Controller('inventario/compras')
export class ComprasController {

  @RequirePermissions('inventario.compras:ver')
  @Get()
  async findAll() {
    return this.service.findAll();
  }

  @RequirePermissions('inventario.compras:crear')
  @Post()
  async create(@Body() dto: CreateCompraDto) {
    return this.service.create(dto);
  }

  @RequirePermissions('inventario.compras:editar')
  @Patch(':id')
  async update(@Param('id') id: number, @Body() dto: UpdateCompraDto) {
    return this.service.update(id, dto);
  }

  @RequirePermissions('inventario.compras:eliminar')
  @Delete(':id')
  async remove(@Param('id') id: number) {
    return this.service.remove(id);
  }

  @RequirePermissions('inventario.compras:recepcionar')
  @Post(':id/recepcionar')
  async recepcionar(@Param('id') id: number) {
    return this.service.recepcionar(id);
  }
}
```

### 5. Ejecutar el INSERT en la Base de Datos

**Opción A - Ejecutar SQL directamente**:
```bash
# Conectarse a PostgreSQL y ejecutar el INSERT
psql -U postgres -d afis -f prisma/migrations/permisos_completos.sql
```

**Opción B - Volver a ejecutar seed (más fácil)**:
```bash
# El seed ejecuta automáticamente todos los permisos del archivo
npx prisma db seed
```

### 6. Asignar Permiso al Rol Admin

**AUTOMÁTICO**: El seed del sistema asigna automáticamente TODOS los permisos activos al rol Admin (id_rol = 1).

Si creaste el permiso manualmente sin seed, asígnalo así:

```sql
-- Asignar nuevo permiso al rol Admin
INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT 1, id_permiso
FROM permisos
WHERE codigo = 'inventario.compras:crear';
```

---

## 🔒 Sistema de Autorización: Jerarquía de Validación

El sistema valida permisos en el siguiente orden:

### 1. SUPER ADMIN (id_rol = 1) → Acceso TOTAL ✅

```typescript
// Usuario con id_rol = 1 (SUPER ADMINISTRADOR)
// Tiene acceso ILIMITADO a TODOS los endpoints
// NO se validan permisos ni políticas
// Bypass total del sistema de permisos

if (user.id_rol === 1) {
  return true; // ✅ Super Admin puede hacer TODO
}
```

### 2. Permisos del Rol → Verificar permisos heredados del rol

```typescript
// Usuario hereda TODOS los permisos asignados a su rol
// Ejemplo: Rol "Inventario" tiene permisos inventario.*
const permisosRol = await getPermisosDelRol(user.id_rol);
```

### 3. Permisos Individuales → Permisos extra asignados al usuario

```typescript
// Usuario puede tener permisos ADICIONALES más allá de su rol
// Ejemplo: Usuario "Facturación" puede ver inventario.compras:ver
const permisosIndividuales = await getPermisosIndividuales(user.id_usuario);
```

### 4. Error HTTP 403 → No tiene ningún permiso

```typescript
// Si no cumple con ninguna de las validaciones anteriores
throw new ForbiddenException('No tiene permisos para esta acción');
```

---

## Ejemplo Completo: Flujo de Autorización

```typescript
// Endpoint protegido
@RequirePermissions('inventario.compras:eliminar')
@Delete(':id')
async remove(@Param('id') id: number) {
  return this.service.remove(id);
}

// CASO 1: Usuario con id_rol = 1 (SUPER ADMIN)
// ✅ Acceso INMEDIATO - No verifica nada más

// CASO 2: Usuario con id_rol = 3 (Facturación)
// ❌ Su rol NO tiene "inventario.compras:eliminar"
// ✅ Verificar permisos individuales...
// ✅ Tiene permiso individual asignado → Acceso permitido

// CASO 3: Usuario con id_rol = 4 (Técnico)
// ❌ Su rol NO tiene "inventario.compras:eliminar"
// ❌ NO tiene permiso individual asignado
// ❌ HTTP 403 Forbidden

// CASO 4: Usuario con id_rol = 2 (Inventario)
// ✅ Su rol SÍ tiene "inventario.compras:eliminar" → Acceso permitido
```

---

## Checklist para Nuevos Endpoints

Al crear un nuevo endpoint, verifica:

- [ ] ✅ Identificaste el módulo, recurso y acción
- [ ] ✅ Creaste el código en formato `modulo.recurso:accion`
- [ ] ✅ Agregaste el INSERT a `prisma/migrations/permisos_completos.sql`
- [ ] ✅ Agregaste el decorador `@RequirePermissions()` al endpoint
- [ ] ✅ Ejecutaste el SQL o el seed
- [ ] ✅ Verificaste que el rol Admin tiene el permiso
- [ ] ✅ Probaste el endpoint con un usuario sin permiso (debe dar 403)
- [ ] ✅ Probaste el endpoint con Super Admin (debe funcionar siempre)

---

## Ubicación de Archivos Clave

- **SQL de Permisos**: `prisma/migrations/permisos_completos.sql`
- **Guard de Permisos**: `src/modules/auth/guards/permissions.guard.ts`
- **Decorador**: `src/modules/auth/decorators/require-permissions.decorator.ts`
- **Documentación**: `SISTEMA_PERMISOS.md`
