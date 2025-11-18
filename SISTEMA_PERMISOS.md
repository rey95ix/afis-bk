# 🔐 Sistema de Permisos y Políticas de AFIS

## Tabla de Contenidos
1. [Introducción](#introducción)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Modelo de Datos](#modelo-de-datos)
4. [Flujos de Autorización](#flujos-de-autorización)
5. [Uso en Backend](#uso-en-backend)
6. [API REST para Frontend](#api-rest-para-frontend)
7. [Implementación en Frontend](#implementación-en-frontend)
8. [Permisos Predefinidos](#permisos-predefinidos)
9. [Políticas Predefinidas](#políticas-predefinidas)
10. [Ejemplos Prácticos](#ejemplos-prácticos)

---

## Introducción

AFIS implementa un sistema completo de **autorización granular basado en permisos y políticas** (RBAC + ABAC).

### Características Principales

✅ **Permisos Granulares**: Control a nivel de `módulo.recurso:acción`
✅ **Herencia de Roles**: Usuarios heredan permisos de su rol asignado
✅ **Permisos Adicionales**: Usuarios pueden tener permisos extra individuales
✅ **Políticas Condicionales**: Validación basada en contexto (sucursal, propietario, estado)
✅ **Caché Inteligente**: Permisos cacheados en memoria (5 min TTL)
✅ **Auditoría Automática**: Registro de acciones críticas
✅ **150+ Permisos Predefinidos**: Cobertura completa de módulos existentes

### Conceptos Clave

**Permiso**: Define QUÉ acción puede realizar un usuario sobre QUÉ recurso
- Formato: `modulo.recurso:accion`
- Ejemplo: `inventario.compras:crear`, `atencion_cliente.tickets:ver`

**Rol**: Agrupa permisos para asignarlos masivamente a usuarios
- Ejemplo: Rol "Inventario" tiene todos los permisos de `inventario.*`

**Política**: Define CUÁNDO o BAJO QUÉ CONDICIONES se permite una acción
- Ejemplo: Solo editar recursos de la misma sucursal
- Ejemplo: Solo aprobar requisiciones en estado PENDIENTE

---

## Arquitectura del Sistema

### Diagrama de Flujo de Autorización

```
Usuario → JWT → JwtStrategy → Cargar Usuario + Rol + Permisos
                    ↓
            PermissionsGuard → Verificar Permisos
                    ↓
            PoliciesService → Evaluar Políticas
                    ↓
                ✅ PERMITIDO / ❌ FORBIDDEN
```

### Componentes del Sistema

#### Backend (NestJS)

1. **Guards**
   - `PermissionsGuard`: Valida permisos granulares
   - `UserRoleGuard`: Valida roles (legacy, compatible)

2. **Servicios**
   - `PermissionsService`: Consulta y caché de permisos
   - `PoliciesService`: Evaluación de políticas

3. **Decoradores**
   - `@RequirePermissions(...permisos)`: Protege endpoints con permisos
   - `@Policy(codigo)`: Aplica política condicional
   - `@Auth()`: Autenticación básica (legacy)
   - `@GetUser()`: Extrae usuario del JWT

4. **Estrategia JWT**
   - Valida token
   - Carga usuario con rol incluido
   - Inyecta en `request.user`

#### Frontend (Angular)

(Por implementar - ver sección de Frontend)

---

## Modelo de Datos

### Tablas Principales

#### `permisos`
Catálogo de todos los permisos del sistema

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id_permiso` | INT | PK |
| `codigo` | STRING | Código único (`modulo.recurso:accion`) |
| `nombre` | STRING | Nombre descriptivo |
| `descripcion` | TEXT | Descripción detallada |
| `modulo` | STRING | Módulo al que pertenece |
| `recurso` | STRING | Recurso específico |
| `accion` | ENUM | VER, CREAR, EDITAR, ELIMINAR, APROBAR, etc. |
| `tipo` | ENUM | RECURSO / FUNCIONAL |
| `es_critico` | BOOLEAN | Si es una acción crítica (ej: eliminar) |
| `requiere_auditoria` | BOOLEAN | Si se debe auditar su uso |
| `estado` | ENUM | ACTIVO / INACTIVO |

#### `rol_permisos`
Relación muchos-a-muchos: Roles ↔ Permisos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id_rol_permiso` | INT | PK |
| `id_rol` | INT | FK a `roles` |
| `id_permiso` | INT | FK a `permisos` |
| `fecha_creacion` | DATETIME | Timestamp |

Constraint único: `[id_rol, id_permiso]`

#### `usuario_permisos`
Permisos adicionales asignados individualmente a usuarios

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id_usuario_permiso` | INT | PK |
| `id_usuario` | INT | FK a `usuarios` |
| `id_permiso` | INT | FK a `permisos` |
| `asignado_por` | INT | Usuario que asignó el permiso |
| `motivo` | TEXT | Justificación de asignación |
| `fecha_expiracion` | DATETIME | Si el permiso expira |
| `fecha_creacion` | DATETIME | Timestamp |

Constraint único: `[id_usuario, id_permiso]`

#### `politicas`
Catálogo de políticas condicionales

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id_politica` | INT | PK |
| `codigo` | STRING | Código único de la política |
| `nombre` | STRING | Nombre descriptivo |
| `descripcion` | TEXT | Descripción |
| `tipo` | ENUM | SUCURSAL, PROPIETARIO, ESTADO_RECURSO, CUSTOM |
| `configuracion` | JSON | Configuración flexible |
| `handler` | STRING | Nombre del handler que valida |
| `estado` | ENUM | ACTIVO / INACTIVO |

#### `permiso_politicas`
Relación muchos-a-muchos: Permisos ↔ Políticas

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id_permiso_politica` | INT | PK |
| `id_permiso` | INT | FK a `permisos` |
| `id_politica` | INT | FK a `politicas` |
| `es_obligatoria` | BOOLEAN | Si la política es obligatoria |

#### Modificaciones a Tablas Existentes

**`roles`**
- ✅ Agregado: `descripcion` (TEXT)
- ✅ Agregado: Relación `rol_permisos`

**`usuarios`**
- ✅ Agregado: Relación `usuario_permisos`

---

## Flujos de Autorización

### Flujo 1: Autenticación y Carga de Usuario

```typescript
// 1. Usuario hace login
POST /auth/sign-in
{
  usuario: "admin@example.com",
  password: "***"
}

// 2. Backend genera JWT
{
  token: "eyJhbGc...",
  usuario: {
    id_usuario: 1,
    nombres: "Admin",
    id_rol: 1,
    roles: { nombre: "Admin" }
  }
}

// 3. Frontend guarda token en localStorage

// 4. Request subsecuente incluye token
GET /inventario/compras
Headers: { Authorization: "Bearer eyJhbGc..." }

// 5. JwtStrategy valida y carga usuario con rol
user = await prisma.usuarios.findFirst({
  where: { id_usuario: 1 },
  include: { roles: true }
})

// 6. Usuario inyectado en request.user
```

### Flujo 2: Validación de Permisos (Sin Política)

```typescript
// Endpoint protegido
@RequirePermissions('inventario.compras:ver')
@Get()
async findAll(@GetUser() user) { ... }

// PermissionsGuard ejecuta:
1. Extrae permisos requeridos: ['inventario.compras:ver']
2. Consulta permisos del usuario (con caché):
   - Permisos del rol
   - Permisos individuales del usuario
   - Combina y deduplica
3. Verifica si tiene al menos uno: hasAnyPermission()
4. ✅ Permitir o ❌ Forbidden
```

### Flujo 3: Validación con Política Condicional

```typescript
// Endpoint con política
@RequirePermissions('atencion_cliente.tickets:editar')
@Policy('same_sucursal')
@Patch(':id')
async update(@Param('id') id: number) { ... }

// PermissionsGuard ejecuta:
1. Valida permiso 'atencion_cliente.tickets:editar' ✅
2. Detecta política 'same_sucursal'
3. Construye contexto:
   {
     user: { id_usuario: 1, id_sucursal: 2 },
     resource: ticket (debe cargarse previamente),
     params: { id: 123 }
   }
4. PoliciesService evalúa:
   - Carga política 'same_sucursal' de BD
   - Ejecuta handler 'SameSucursalPolicy'
   - Compara: user.id_sucursal === ticket.id_sucursal
5. ✅ Permitir si iguales o ❌ Forbidden
```

### Flujo 4: Carga de Permisos con Caché

```typescript
// Primera consulta (sin caché)
getUserPermissions(id_usuario: 1)
→ Query a BD (3 queries: usuario + rol + permisos)
→ Combina resultados: ['perm1', 'perm2', ...]
→ Guarda en caché: { permissions, timestamp }
→ Retorna permisos

// Segunda consulta (5 min después, con caché)
getUserPermissions(id_usuario: 1)
→ Consulta caché
→ ✅ Retorna directamente (sin query a BD)

// Después de 5 minutos (caché expirado)
getUserPermissions(id_usuario: 1)
→ Caché expirado
→ Query a BD nuevamente
→ Actualiza caché
```

### Flujo 5: Invalidación de Caché

```typescript
// Cuando se modifican permisos de un usuario
async asignarPermisoAUsuario(id_usuario, id_permiso) {
  await prisma.usuario_permisos.create({ ... });

  // Invalidar caché del usuario
  this.permissionsService.clearCache(id_usuario);
}

// Cuando se modifican permisos de un rol
async asignarPermisoARol(id_rol, id_permiso) {
  await prisma.rol_permisos.create({ ... });

  // Invalidar caché de TODOS los usuarios con este rol
  this.permissionsService.clearCache(); // Sin parámetro = todo el caché
}
```

---

## Uso en Backend

### Proteger Endpoints con Permisos

#### Ejemplo Básico

```typescript
import { RequirePermissions } from 'src/modules/auth/decorators';
import { PermissionsGuard } from 'src/modules/auth/guards/permissions.guard';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Controller('inventario/compras')
@UseGuards(AuthGuard(), PermissionsGuard) // Aplicar guards
export class ComprasController {

  // Listar compras (solo lectura)
  @RequirePermissions('inventario.compras:ver')
  @Get()
  async findAll() { ... }

  // Crear compra
  @RequirePermissions('inventario.compras:crear')
  @Post()
  async create(@Body() dto: CreateCompraDto) { ... }

  // Editar compra
  @RequirePermissions('inventario.compras:editar')
  @Patch(':id')
  async update(@Param('id') id: number, @Body() dto: UpdateCompraDto) { ... }

  // Eliminar compra (requiere permiso específico)
  @RequirePermissions('inventario.compras:eliminar')
  @Delete(':id')
  async remove(@Param('id') id: number) { ... }

  // Acción custom: Recepcionar compra
  @RequirePermissions('inventario.compras:custom')
  @Patch(':id/recepcionar')
  async recepcionar(@Param('id') id: number) { ... }
}
```

#### Múltiples Permisos (OR Logic)

```typescript
// Usuario necesita AL MENOS UNO de estos permisos
@RequirePermissions(
  'inventario.compras:crear',
  'inventario.compras:editar'
)
@Post()
async createOrUpdate() { ... }
```

#### Con Política Condicional

```typescript
@RequirePermissions('inventario.requisiciones:aprobar')
@Policy('requisicion_pendiente') // Solo si está PENDIENTE
@Patch(':id/aprobar')
async aprobar(
  @Param('id') id: number,
  @Req() request: Request
) {
  // IMPORTANTE: Cargar recurso ANTES del guard
  const requisicion = await this.service.findOne(id);
  request.resource = requisicion; // Agregar a request para la política

  return this.service.aprobar(id);
}
```

#### Sin Permisos (Solo Autenticación)

```typescript
// Solo requiere estar autenticado, sin validar permisos
@UseGuards(AuthGuard())
@Get('me')
async getProfile(@GetUser() user) {
  return user;
}
```

### Verificar Permisos Programáticamente

```typescript
import { PermissionsService } from 'src/modules/auth/services/permissions.service';

@Injectable()
export class MiServicio {
  constructor(
    private readonly permissionsService: PermissionsService
  ) {}

  async miMetodo(id_usuario: number) {
    // Verificar un permiso específico
    const canCreate = await this.permissionsService.hasPermission(
      id_usuario,
      'inventario.compras:crear'
    );

    if (!canCreate) {
      throw new ForbiddenException('No puede crear compras');
    }

    // Verificar si tiene al menos uno
    const canManage = await this.permissionsService.hasAnyPermission(
      id_usuario,
      ['inventario.compras:crear', 'inventario.compras:editar']
    );

    // Obtener todos los permisos del usuario
    const permisos = await this.permissionsService.getUserPermissions(id_usuario);
    // ['inventario.compras:ver', 'inventario.compras:crear', ...]

    // Obtener permisos agrupados por módulo
    const permisosPorModulo = await this.permissionsService.getUserPermissionsByModule(id_usuario);
    // {
    //   inventario: ['inventario.compras:ver', 'inventario.compras:crear'],
    //   atencion_cliente: ['atencion_cliente.tickets:ver']
    // }

    // Verificar acceso a módulo completo
    const canAccessInventory = await this.permissionsService.canAccessModule(
      id_usuario,
      'inventario'
    );
  }
}
```

### Evaluar Políticas Programáticamente

```typescript
import { PoliciesService } from 'src/modules/auth/services/policies.service';

@Injectable()
export class MiServicio {
  constructor(
    private readonly policiesService: PoliciesService
  ) {}

  async validarAcceso(usuario, recurso) {
    // Construir contexto de política
    const context = {
      user: usuario,
      resource: recurso,
      params: {},
      query: {},
      body: {}
    };

    // Evaluar una política
    const result = await this.policiesService.evaluatePolicy(
      'same_sucursal',
      context
    );

    if (!result) {
      throw new ForbiddenException('Recurso de otra sucursal');
    }

    // Evaluar múltiples políticas (todas deben cumplirse)
    const allPassed = await this.policiesService.evaluateAllPolicies(
      ['same_sucursal', 'is_owner'],
      context
    );
  }
}
```

---

## API REST para Frontend

**✅ IMPLEMENTADO**: Todos los endpoints están completamente implementados y funcionales.

### Endpoints de Permisos

#### `POST /permissions`
✅ **Crear un nuevo permiso**

**Auth**: Requerido (Bearer token)

**Body:**
```json
{
  "codigo": "inventario.compras:crear",
  "nombre": "Crear Compras",
  "descripcion": "Permite crear nuevas órdenes de compra",
  "modulo": "inventario",
  "recurso": "compras",
  "accion": "CREAR",
  "tipo": "RECURSO",  // Opcional, default: RECURSO
  "es_critico": false,  // Opcional, default: false
  "requiere_auditoria": false  // Opcional, default: false
}
```

**Response:**
```json
{
  "data": {
    "permiso": {
      "id_permiso": 151,
      "codigo": "inventario.compras:crear",
      "nombre": "Crear Compras",
      ...
    },
    "message": "Permiso creado exitosamente"
  },
  "status": true,
  "msg": "Success"
}
```

---

#### `GET /permissions`
✅ **Listar todos los permisos con paginación y filtros**

**Auth**: Requerido

**Query params:**
- `page`: Número de página (default: 1)
- `limit`: Elementos por página (default: 10)
- `modulo`: Filtrar por módulo (ej: `inventario`)
- `recurso`: Filtrar por recurso (ej: `compras`)
- `accion`: Filtrar por acción (ej: `VER`, `CREAR`)
- `estado`: Filtrar por estado (`ACTIVO`, `INACTIVO`)
- `search`: Búsqueda en código o nombre

**Example**: `GET /permissions?page=1&limit=20&modulo=inventario&estado=ACTIVO`

**Response:**
```json
{
  "data": {
    "permisos": [
      {
        "id_permiso": 1,
        "codigo": "inventario.compras:ver",
        "nombre": "Ver Compras",
        "descripcion": "Ver órdenes de compra",
        "modulo": "inventario",
        "recurso": "compras",
        "accion": "VER",
        "tipo": "RECURSO",
        "es_critico": false,
        "requiere_auditoria": false,
        "estado": "ACTIVO",
        "fecha_creacion": "2025-01-15T10:30:00Z",
        "fecha_ultima_actualizacion": "2025-01-15T10:30:00Z"
      }
    ],
    "meta": {
      "total": 150,
      "page": 1,
      "limit": 20,
      "totalPages": 8
    }
  },
  "status": true,
  "msg": "Success"
}
```

---

#### `GET /permissions/grouped-by-module`
✅ **Obtener permisos agrupados por módulo** (útil para UI de asignación)

**Auth**: Requerido

**Response:**
```json
{
  "data": {
    "modulos": [
      {
        "nombre": "inventario",
        "permisos": [
          {
            "id_permiso": 1,
            "codigo": "inventario.compras:ver",
            "nombre": "Ver Compras",
            "accion": "VER",
            ...
          },
          {
            "id_permiso": 2,
            "codigo": "inventario.compras:crear",
            "nombre": "Crear Compras",
            "accion": "CREAR",
            ...
          }
        ],
        "total": 15
      },
      {
        "nombre": "atencion_cliente",
        "permisos": [...],
        "total": 20
      }
    ],
    "total": 150
  },
  "status": true,
  "msg": "Success"
}
```

---

#### `GET /permissions/:id`
✅ **Obtener detalle de un permiso con relaciones**

**Auth**: Requerido

**Response:**
```json
{
  "data": {
    "permiso": {
      "id_permiso": 1,
      "codigo": "inventario.compras:ver",
      "nombre": "Ver Compras",
      ...,
      "rol_permisos": [
        {
          "roles": {
            "id_rol": 2,
            "nombre": "Inventario"
          }
        }
      ],
      "usuario_permisos": [
        {
          "usuarios": {
            "id_usuario": 5,
            "nombres": "Juan Pérez",
            "usuario": "jperez"
          }
        }
      ],
      "permiso_politicas": [
        {
          "politicas": {
            "codigo": "same_sucursal",
            "nombre": "Misma Sucursal"
          }
        }
      ]
    },
    "estadisticas": {
      "roles_asignados": 3,
      "usuarios_asignados": 2,
      "politicas_asignadas": 1
    }
  },
  "status": true,
  "msg": "Success"
}
```

---

#### `PATCH /permissions/:id`
✅ **Actualizar un permiso**

**Auth**: Requerido

**Body** (todos los campos opcionales):
```json
{
  "nombre": "Ver Compras (Actualizado)",
  "descripcion": "Nueva descripción",
  "es_critico": true,
  "requiere_auditoria": true,
  "estado": "ACTIVO"
}
```

**Response:**
```json
{
  "data": {
    "permiso": { ... },
    "message": "Permiso actualizado exitosamente"
  },
  "status": true,
  "msg": "Success"
}
```

---

#### `DELETE /permissions/:id`
✅ **Eliminar un permiso** (soft delete, cambia estado a INACTIVO)

**Auth**: Requerido

**Response:**
```json
{
  "data": {
    "permiso": { ... },
    "message": "Permiso desactivado exitosamente"
  },
  "status": true,
  "msg": "Success"
}
```

---

#### `POST /permissions/:id/policies`
✅ **Asignar una política a un permiso**

**Auth**: Requerido

**Body:**
```json
{
  "id_politica": 3
}
```

**Response:**
```json
{
  "data": {
    "permiso_politica": {
      "id_permiso_politica": 10,
      "id_permiso": 15,
      "id_politica": 3,
      "permisos": { ... },
      "politicas": { ... }
    },
    "message": "Política asignada al permiso exitosamente"
  },
  "status": true,
  "msg": "Success"
}
```

---

#### `DELETE /permissions/:id/policies/:id_politica`
✅ **Remover una política de un permiso**

**Auth**: Requerido

**Response:**
```json
{
  "data": {
    "message": "Política removida del permiso exitosamente"
  },
  "status": true,
  "msg": "Success"
}
```

---

### Endpoints de Roles (Gestión de Permisos)

#### `GET /roles/:id/permissions`
✅ **Obtener permisos asignados a un rol**

**Auth**: Requerido

**Response:**
```json
{
  "data": {
    "rol": {
      "id_rol": 2,
      "nombre": "Inventario",
      "descripcion": "Gestión completa de inventario"
    },
    "permisos": [
      {
        "id_permiso": 15,
        "codigo": "inventario.compras:ver",
        "nombre": "Ver Compras",
        ...
      }
    ],
    "permisos_por_modulo": {
      "inventario": [
        { "codigo": "inventario.compras:ver", ... },
        { "codigo": "inventario.compras:crear", ... }
      ]
    },
    "total_permisos": 25
  },
  "status": true,
  "msg": "Success"
}
```

---

#### `POST /roles/:id/permissions`
✅ **Asignar permisos a un rol** (reemplaza permisos actuales)

**Auth**: Requerido

**Body:**
```json
{
  "id_permisos": [1, 2, 3, 15, 20, 25]
}
```

**Response:**
```json
{
  "data": {
    "rol": {
      "id_rol": 2,
      "nombre": "Inventario"
    },
    "permisos_asignados": 6,
    "permisos": [
      { "id_permiso": 1, "codigo": "inventario.compras:ver", ... },
      ...
    ],
    "message": "Permisos asignados al rol exitosamente"
  },
  "status": true,
  "msg": "Success"
}
```

---

#### `DELETE /roles/:id/permissions/:id_permiso`
✅ **Remover un permiso específico de un rol**

**Auth**: Requerido

**Response:**
```json
{
  "data": {
    "message": "Permiso removido del rol exitosamente"
  },
  "status": true,
  "msg": "Success"
}
```

---

### Endpoints de Permisos de Usuario

#### `GET /users/:id_usuario/permissions`
✅ **Obtener todos los permisos de un usuario** (rol + individuales)

**Auth**: Requerido

**Response:**
```json
{
  "data": {
    "usuario": {
      "id_usuario": 5,
      "nombre": "Juan Pérez",
      "usuario": "jperez",
      "rol": {
        "id_rol": 3,
        "nombre": "Facturacion"
      }
    },
    "permisos_rol": [
      {
        "id_permiso": 100,
        "codigo": "dashboard.ventas:ver",
        "nombre": "Ver Dashboard de Ventas",
        ...
      }
    ],
    "permisos_individuales": [
      {
        "id_permiso": 15,
        "codigo": "inventario.compras:ver",
        "nombre": "Ver Compras",
        "asignado_por": 1,
        "motivo": "Necesita ver compras para su trabajo",
        "fecha_expiracion": null,
        "fecha_creacion": "2025-01-10T15:20:00Z"
      }
    ],
    "todos_los_permisos": [
      "dashboard.ventas:ver",
      "inventario.compras:ver"
    ],
    "estadisticas": {
      "permisos_del_rol": 10,
      "permisos_individuales": 1,
      "total_permisos": 11
    }
  },
  "status": true,
  "msg": "Success"
}
```

---

#### `POST /users/:id_usuario/permissions`
✅ **Asignar permiso individual a un usuario**

**Auth**: Requerido

**Body:**
```json
{
  "id_permiso": 15,
  "motivo": "Necesita acceso temporal para proyecto X",  // Opcional
  "fecha_expiracion": "2025-12-31T23:59:59.000Z"  // Opcional
}
```

**Response:**
```json
{
  "data": {
    "usuario_permiso": {
      "id_usuario_permiso": 25,
      "id_usuario": 5,
      "id_permiso": 15,
      "asignado_por": 1,
      "motivo": "Necesita acceso temporal para proyecto X",
      "fecha_expiracion": "2025-12-31T23:59:59.000Z",
      "fecha_creacion": "2025-01-17T18:45:00Z",
      "permisos": {
        "codigo": "inventario.compras:ver",
        "nombre": "Ver Compras",
        ...
      }
    },
    "message": "Permiso asignado al usuario exitosamente"
  },
  "status": true,
  "msg": "Success"
}
```

---

#### `DELETE /users/:id_usuario/permissions/:id_permiso`
✅ **Remover permiso individual de un usuario**

**Auth**: Requerido

**Note**: Solo remueve permisos individuales, no afecta permisos del rol

**Response:**
```json
{
  "data": {
    "message": "Permiso individual removido del usuario exitosamente"
  },
  "status": true,
  "msg": "Success"
}
```

---

#### `GET /users/:id_usuario/permissions/grouped-by-module`
✅ **Obtener permisos del usuario agrupados por módulo**

**Auth**: Requerido

**Response:**
```json
{
  "data": {
    "id_usuario": 5,
    "permisos_por_modulo": {
      "inventario": [
        "inventario.compras:ver",
        "inventario.compras:crear"
      ],
      "dashboard": [
        "dashboard.ventas:ver"
      ]
    },
    "total_modulos": 2
  },
  "status": true,
  "msg": "Success"
}
```

---

### Endpoints de Políticas

#### `POST /policies`
✅ **Crear una nueva política**

**Auth**: Requerido

**Body:**
```json
{
  "codigo": "custom_policy",
  "nombre": "Política Personalizada",
  "descripcion": "Descripción de la política",
  "tipo": "CUSTOM",
  "handler": "CustomPolicyHandler",
  "configuracion": {
    "campo_validar": "valor_esperado"
  }
}
```

---

#### `GET /policies`
✅ **Listar políticas con paginación y filtros**

**Auth**: Requerido

**Query params:**
- `page`, `limit`: Paginación
- `tipo`: Filtrar por tipo (`SUCURSAL`, `PROPIETARIO`, `ESTADO_RECURSO`, `CUSTOM`)
- `estado`: Filtrar por estado
- `search`: Búsqueda en código o nombre

**Response:**
```json
{
  "data": {
    "politicas": [
      {
        "id_politica": 1,
        "codigo": "same_sucursal",
        "nombre": "Misma Sucursal",
        "descripcion": "Valida que usuario y recurso pertenezcan a la misma sucursal",
        "tipo": "SUCURSAL",
        "handler": "SameSucursalPolicy",
        "configuracion": {
          "campo_usuario": "id_sucursal",
          "campo_recurso": "id_sucursal"
        },
        "estado": "ACTIVO",
        "total_permisos": 15,
        "permiso_politicas": [...]
      }
    ],
    "meta": {
      "total": 6,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  },
  "status": true,
  "msg": "Success"
}
```

---

#### `GET /policies/:id`
✅ **Ver detalle de una política**

**Auth**: Requerido

**Response:**
```json
{
  "data": {
    "politica": {
      "id_politica": 1,
      "codigo": "same_sucursal",
      "nombre": "Misma Sucursal",
      ...,
      "permiso_politicas": [
        {
          "permisos": {
            "id_permiso": 15,
            "codigo": "inventario.requisiciones:aprobar",
            "nombre": "Aprobar Requisiciones",
            ...
          }
        }
      ]
    },
    "estadisticas": {
      "permisos_asignados": 15
    }
  },
  "status": true,
  "msg": "Success"
}
```

---

#### `PATCH /policies/:id`
✅ **Actualizar una política**

**Auth**: Requerido

**Body** (todos opcionales):
```json
{
  "nombre": "Nuevo nombre",
  "descripcion": "Nueva descripción",
  "configuracion": { ... },
  "estado": "ACTIVO"
}
```

---

#### `DELETE /policies/:id`
✅ **Eliminar una política** (soft delete)

**Auth**: Requerido

---

#### `GET /policies/:codigo/test`
✅ **Probar evaluación de una política** (testing endpoint)

**Auth**: Requerido

**Body:**
```json
{
  "user": {
    "id_usuario": 5,
    "id_sucursal": 1
  },
  "resource": {
    "id_sucursal": 1
  }
}
```

**Response:**
```json
{
  "data": {
    "codigo": "same_sucursal",
    "resultado": true,
    "contexto_usado": { ... },
    "message": "La política se cumple con el contexto proporcionado"
  },
  "status": true,
  "msg": "Success"
}
```

---

## Implementación en Frontend

### 1. Modelo de Datos (TypeScript)

```typescript
// src/app/shared/models/permiso.model.ts
export interface Permiso {
  id_permiso: number;
  codigo: string; // 'inventario.compras:ver'
  nombre: string;
  descripcion?: string;
  modulo: string;
  recurso: string;
  accion: TipoAccion;
  tipo: TipoPermiso;
  es_critico: boolean;
  requiere_auditoria: boolean;
  estado: Estado;
}

export enum TipoAccion {
  VER = 'VER',
  CREAR = 'CREAR',
  EDITAR = 'EDITAR',
  ELIMINAR = 'ELIMINAR',
  APROBAR = 'APROBAR',
  RECHAZAR = 'RECHAZAR',
  EXPORTAR = 'EXPORTAR',
  IMPRIMIR = 'IMPRIMIR',
  CUSTOM = 'CUSTOM'
}

export enum TipoPermiso {
  RECURSO = 'RECURSO',
  FUNCIONAL = 'FUNCIONAL'
}

// src/app/shared/models/usuario-permisos.model.ts
export interface UsuarioPermisos {
  permisos_rol: string[]; // Códigos de permisos del rol
  permisos_individuales: PermisoIndividual[];
  permisos_totales: string[]; // Todos combinados
}

export interface PermisoIndividual {
  codigo: string;
  asignado_por: string;
  motivo?: string;
  fecha_expiracion?: Date;
}
```

### 2. Servicio de Permisos

```typescript
// src/app/shared/services/permissions.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PermissionsService {
  // Permisos del usuario actual (se cargan en login)
  private userPermissionsSubject = new BehaviorSubject<string[]>([]);
  public userPermissions$ = this.userPermissionsSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Carga permisos del usuario actual
   * Debe llamarse después del login
   */
  loadUserPermissions(id_usuario: number): Observable<string[]> {
    return this.http.get<ApiResponse>(`/usuarios/${id_usuario}/permisos`).pipe(
      map(res => res.data.permisos_totales),
      tap(permisos => this.userPermissionsSubject.next(permisos))
    );
  }

  /**
   * Verifica si el usuario tiene un permiso específico
   */
  hasPermission(permissionCode: string): boolean {
    const permisos = this.userPermissionsSubject.value;
    return permisos.includes(permissionCode);
  }

  /**
   * Verifica si el usuario tiene AL MENOS UNO de los permisos
   */
  hasAnyPermission(permissionCodes: string[]): boolean {
    const permisos = this.userPermissionsSubject.value;
    return permissionCodes.some(code => permisos.includes(code));
  }

  /**
   * Verifica si el usuario tiene TODOS los permisos
   */
  hasAllPermissions(permissionCodes: string[]): boolean {
    const permisos = this.userPermissionsSubject.value;
    return permissionCodes.every(code => permisos.includes(code));
  }

  /**
   * Verifica si el usuario puede acceder a un módulo
   */
  canAccessModule(moduleName: string): boolean {
    const permisos = this.userPermissionsSubject.value;
    return permisos.some(p => p.startsWith(`${moduleName}.`));
  }

  /**
   * Limpia permisos (logout)
   */
  clearPermissions(): void {
    this.userPermissionsSubject.next([]);
  }
}
```

### 3. Directiva Estructural para Mostrar/Ocultar Elementos

```typescript
// src/app/shared/directives/has-permission.directive.ts
import { Directive, Input, TemplateRef, ViewContainerRef, OnInit } from '@angular/core';
import { PermissionsService } from '../services/permissions.service';

@Directive({
  selector: '[hasPermission]'
})
export class HasPermissionDirective implements OnInit {
  @Input() hasPermission!: string | string[];
  @Input() hasPermissionMode: 'any' | 'all' = 'any'; // 'any' o 'all'

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private permissionsService: PermissionsService
  ) {}

  ngOnInit() {
    this.updateView();

    // Re-evaluar cuando cambien los permisos
    this.permissionsService.userPermissions$.subscribe(() => {
      this.updateView();
    });
  }

  private updateView() {
    const permissions = Array.isArray(this.hasPermission)
      ? this.hasPermission
      : [this.hasPermission];

    const hasAccess = this.hasPermissionMode === 'all'
      ? this.permissionsService.hasAllPermissions(permissions)
      : this.permissionsService.hasAnyPermission(permissions);

    if (hasAccess) {
      this.viewContainer.createEmbeddedView(this.templateRef);
    } else {
      this.viewContainer.clear();
    }
  }
}
```

**Uso en template:**

```html
<!-- Mostrar solo si tiene el permiso -->
<button *hasPermission="'inventario.compras:crear'">
  Nueva Compra
</button>

<!-- Mostrar si tiene al menos uno de los permisos -->
<div *hasPermission="['inventario.compras:crear', 'inventario.compras:editar']">
  Gestionar Compras
</div>

<!-- Mostrar solo si tiene TODOS los permisos -->
<button
  *hasPermission="['inventario.compras:editar', 'inventario.compras:aprobar']"
  [hasPermissionMode]="'all'">
  Editar y Aprobar
</button>
```

### 4. Guard de Rutas

```typescript
// src/app/shared/guards/permissions.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { PermissionsService } from '../services/permissions.service';

@Injectable({
  providedIn: 'root'
})
export class PermissionsGuard implements CanActivate {
  constructor(
    private permissionsService: PermissionsService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    const requiredPermissions = route.data['permissions'] as string[];

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const hasAccess = this.permissionsService.hasAnyPermission(requiredPermissions);

    if (!hasAccess) {
      // Redirigir a página de acceso denegado
      this.router.navigate(['/403']);
      return false;
    }

    return true;
  }
}
```

**Uso en routing:**

```typescript
const routes: Routes = [
  {
    path: 'inventario/compras',
    component: ComprasComponent,
    canActivate: [AuthGuard, PermissionsGuard],
    data: {
      permissions: ['inventario.compras:ver']
    }
  },
  {
    path: 'administracion/usuarios',
    component: UsuariosComponent,
    canActivate: [AuthGuard, PermissionsGuard],
    data: {
      permissions: ['administracion.usuarios:ver', 'administracion.usuarios:crear']
    }
  }
];
```

### 5. Integración con Login

```typescript
// src/app/authentication/login/login.component.ts
login() {
  this.authService.login(this.credentials).subscribe({
    next: (response) => {
      // Guardar token
      this.tokenService.saveToken(response.data.token);

      // Guardar usuario
      this.authService.setCurrentUser(response.data.usuario);

      // ✅ CARGAR PERMISOS DEL USUARIO
      this.permissionsService.loadUserPermissions(response.data.usuario.id_usuario)
        .subscribe(() => {
          // Redirigir al dashboard
          this.router.navigate(['/dashboards/sales']);
        });
    }
  });
}
```

### 6. Componente de Administración de Permisos

```typescript
// src/app/components/administracion/permisos/permisos-rol/permisos-rol.component.ts
export class PermisosRolComponent implements OnInit {
  rol: Rol;
  permisosDisponibles: Permiso[] = [];
  permisosAsignados: Permiso[] = [];
  permisosAgrupados: Record<string, Permiso[]> = {};

  constructor(
    private permisosService: PermisosService,
    private rolesService: RolesService
  ) {}

  ngOnInit() {
    // Cargar permisos disponibles
    this.permisosService.getAllGrouped().subscribe(grouped => {
      this.permisosAgrupados = grouped;
    });

    // Cargar permisos del rol
    this.rolesService.getPermisos(this.rol.id_rol).subscribe(permisos => {
      this.permisosAsignados = permisos;
    });
  }

  togglePermiso(permiso: Permiso) {
    const index = this.permisosAsignados.findIndex(p => p.id_permiso === permiso.id_permiso);

    if (index >= 0) {
      // Remover permiso
      this.rolesService.removePermiso(this.rol.id_rol, permiso.id_permiso).subscribe();
      this.permisosAsignados.splice(index, 1);
    } else {
      // Agregar permiso
      this.rolesService.addPermiso(this.rol.id_rol, permiso.id_permiso).subscribe();
      this.permisosAsignados.push(permiso);
    }
  }

  hasPermiso(permiso: Permiso): boolean {
    return this.permisosAsignados.some(p => p.id_permiso === permiso.id_permiso);
  }
}
```

**Template:**

```html
<!-- permisos-rol.component.html -->
<div class="permisos-container">
  <h3>Permisos del Rol: {{ rol.nombre }}</h3>

  <div *ngFor="let modulo of permisosAgrupados | keyvalue">
    <h4>{{ modulo.key }}</h4>

    <div *ngFor="let recurso of modulo.value | keyvalue">
      <h5>{{ recurso.key }}</h5>

      <div class="checkbox-group">
        <label *ngFor="let permiso of recurso.value">
          <input
            type="checkbox"
            [checked]="hasPermiso(permiso)"
            (change)="togglePermiso(permiso)"
          />
          {{ permiso.nombre }}
          <span *ngIf="permiso.es_critico" class="badge badge-danger">Crítico</span>
        </label>
      </div>
    </div>
  </div>
</div>
```

---

## Permisos Predefinidos

El sistema incluye **150+ permisos** predefinidos organizados por módulo.

### Formato de Códigos

```
modulo.recurso:accion
```

Ejemplos:
- `dashboard.ventas:ver`
- `inventario.compras:crear`
- `atencion_cliente.tickets:custom`
- `administracion.usuarios:eliminar`

### Listado por Módulo

#### Dashboard (4 permisos)
- `dashboard.ventas:ver`
- `dashboard.inventario:ver`
- `dashboard.atencion_cliente:ver`
- `dashboard.metricas:ver`

#### Administración - Usuarios (6 permisos)
- `administracion.usuarios:ver`
- `administracion.usuarios:crear`
- `administracion.usuarios:editar`
- `administracion.usuarios:eliminar` ⚠️ CRÍTICO
- `administracion.usuarios:custom` (Resetear contraseña) ⚠️ CRÍTICO
- `administracion.usuarios:custom` (Asignar permisos)

#### Administración - Roles (5 permisos)
- `administracion.roles:ver`
- `administracion.roles:crear`
- `administracion.roles:editar`
- `administracion.roles:eliminar` ⚠️ CRÍTICO
- `administracion.roles:custom` (Asignar permisos)

#### Administración - Permisos (4 permisos)
- `administracion.permisos:ver`
- `administracion.permisos:crear` ⚠️ CRÍTICO
- `administracion.permisos:editar` ⚠️ CRÍTICO
- `administracion.permisos:eliminar` ⚠️ CRÍTICO

#### Administración - Políticas (4 permisos)
- `administracion.politicas:ver`
- `administracion.politicas:crear` ⚠️ CRÍTICO
- `administracion.politicas:editar` ⚠️ CRÍTICO
- `administracion.politicas:eliminar` ⚠️ CRÍTICO

#### Atención al Cliente - Clientes (5 permisos)
- `atencion_cliente.clientes:ver`
- `atencion_cliente.clientes:crear`
- `atencion_cliente.clientes:editar`
- `atencion_cliente.clientes:eliminar`
- `atencion_cliente.clientes:exportar`

#### Atención al Cliente - Tickets (6 permisos)
- `atencion_cliente.tickets:ver`
- `atencion_cliente.tickets:crear`
- `atencion_cliente.tickets:editar`
- `atencion_cliente.tickets:custom` (Cerrar)
- `atencion_cliente.tickets:custom` (Escalar)
- `atencion_cliente.tickets:custom` (Reasignar)

#### Atención al Cliente - Órdenes de Trabajo (8 permisos)
- `atencion_cliente.ordenes_trabajo:ver`
- `atencion_cliente.ordenes_trabajo:crear`
- `atencion_cliente.ordenes_trabajo:editar`
- `atencion_cliente.ordenes_trabajo:custom` (Asignar técnico)
- `atencion_cliente.ordenes_trabajo:custom` (Completar)
- `atencion_cliente.ordenes_trabajo:custom` (Cancelar)
- `atencion_cliente.ordenes_trabajo:custom` (Cargar evidencias)
- `atencion_cliente.ordenes_trabajo:imprimir`

#### Inventario - Compras (7 permisos)
- `inventario.compras:ver`
- `inventario.compras:crear`
- `inventario.compras:editar`
- `inventario.compras:eliminar`
- `inventario.compras:custom` (Recepcionar)
- `inventario.compras:imprimir`
- `inventario.compras:exportar`

#### Inventario - Importaciones (7 permisos)
- `inventario.importaciones:ver`
- `inventario.importaciones:crear`
- `inventario.importaciones:editar`
- `inventario.importaciones:eliminar`
- `inventario.importaciones:custom` (Gestionar gastos)
- `inventario.importaciones:custom` (Calcular retaceo)
- `inventario.importaciones:custom` (Recepcionar)

#### Inventario - Requisiciones (7 permisos)
- `inventario.requisiciones:ver`
- `inventario.requisiciones:crear`
- `inventario.requisiciones:editar`
- `inventario.requisiciones:eliminar`
- `inventario.requisiciones:aprobar` ⚠️ CRÍTICO
- `inventario.requisiciones:rechazar`
- `inventario.requisiciones:custom` (Procesar)

#### Inventario - Órdenes de Salida (7 permisos)
- `inventario.ordenes_salida:ver`
- `inventario.ordenes_salida:crear`
- `inventario.ordenes_salida:editar`
- `inventario.ordenes_salida:eliminar`
- `inventario.ordenes_salida:aprobar` ⚠️ CRÍTICO
- `inventario.ordenes_salida:rechazar`
- `inventario.ordenes_salida:custom` (Procesar)

#### Inventario - Auditorías (6 permisos)
- `inventario.auditorias:ver`
- `inventario.auditorias:crear`
- `inventario.auditorias:editar`
- `inventario.auditorias:custom` (Ejecutar)
- `inventario.auditorias:custom` (Finalizar)
- `inventario.auditorias:exportar`

#### Inventario - Ajustes (6 permisos)
- `inventario.ajustes:ver`
- `inventario.ajustes:crear`
- `inventario.ajustes:editar`
- `inventario.ajustes:eliminar`
- `inventario.ajustes:aprobar` ⚠️ CRÍTICO + AUDITORÍA
- `inventario.ajustes:rechazar` + AUDITORÍA

#### Reportes (4 permisos)
- `reportes.inventario:ver`
- `reportes.ventas:ver`
- `reportes.clientes:ver`
- `reportes.financieros:ver` ⚠️ CRÍTICO

**Total**: ~150 permisos

---

## Políticas Predefinidas

### 1. `same_sucursal` (Misma Sucursal)
**Tipo**: SUCURSAL
**Handler**: `SameSucursalPolicy`
**Descripción**: Valida que el usuario y el recurso pertenezcan a la misma sucursal

**Configuración:**
```json
{
  "campo_usuario": "id_sucursal",
  "campo_recurso": "id_sucursal"
}
```

**Lógica:**
```typescript
return user.id_sucursal === resource.id_sucursal
```

**Uso:**
```typescript
@RequirePermissions('atencion_cliente.tickets:editar')
@Policy('same_sucursal')
@Patch(':id')
update() { ... }
```

### 2. `is_owner` (Es Propietario)
**Tipo**: PROPIETARIO
**Handler**: `IsOwnerPolicy`
**Descripción**: Valida que el usuario sea el creador/propietario del recurso

**Configuración:**
```json
{
  "campo_usuario": "id_usuario",
  "campo_recurso": "id_usuario"
}
```

**Lógica:**
```typescript
return user.id_usuario === resource.id_usuario
```

**Uso:**
```typescript
// Solo puede editar sus propios tickets
@RequirePermissions('atencion_cliente.tickets:editar')
@Policy('is_owner')
@Patch(':id')
update() { ... }
```

### 3. `ticket_not_closed` (Ticket No Cerrado)
**Tipo**: ESTADO_RECURSO
**Handler**: `TicketNotClosedPolicy`
**Descripción**: Valida que el ticket no esté cerrado o cancelado

**Configuración:**
```json
{
  "estados_permitidos": ["ABIERTO", "EN_DIAGNOSTICO", "ESCALADO"]
}
```

**Lógica:**
```typescript
return ['ABIERTO', 'EN_DIAGNOSTICO', 'ESCALADO'].includes(resource.estado)
```

**Uso:**
```typescript
// Solo editar tickets no cerrados
@RequirePermissions('atencion_cliente.tickets:editar')
@Policy('ticket_not_closed')
@Patch(':id')
update() { ... }
```

### 4. `orden_not_completed` (Orden No Completada)
**Tipo**: ESTADO_RECURSO
**Handler**: `OrdenNotCompletedPolicy`

**Configuración:**
```json
{
  "estados_bloqueados": ["COMPLETADA", "CANCELADA"]
}
```

### 5. `requisicion_pendiente` (Requisición Pendiente)
**Tipo**: ESTADO_RECURSO
**Handler**: `RequisicionPendientePolicy`

**Configuración:**
```json
{
  "estados_permitidos": ["PENDIENTE"]
}
```

**Uso:**
```typescript
// Solo aprobar requisiciones pendientes
@RequirePermissions('inventario.requisiciones:aprobar')
@Policy('requisicion_pendiente')
@Patch(':id/aprobar')
aprobar() { ... }
```

### 6. `ajuste_pendiente_autorizacion` (Ajuste Pendiente)
**Tipo**: ESTADO_RECURSO
**Handler**: `AjustePendientePolicy`

**Configuración:**
```json
{
  "estados_permitidos": ["PENDIENTE_AUTORIZACION"]
}
```

---

## Ejemplos Prácticos

### Ejemplo 1: Gestión de Compras

#### Backend

```typescript
// compras.controller.ts
import { RequirePermissions, Policy } from 'src/modules/auth/decorators';
import { PermissionsGuard } from 'src/modules/auth/guards/permissions.guard';
import { AuthGuard } from '@nestjs/passport';

@Controller('inventario/compras')
@UseGuards(AuthGuard(), PermissionsGuard)
export class ComprasController {

  // Ver compras (todos con permiso)
  @RequirePermissions('inventario.compras:ver')
  @Get()
  findAll() {
    return this.service.findAll();
  }

  // Crear compra (solo con permiso)
  @RequirePermissions('inventario.compras:crear')
  @Post()
  create(@Body() dto: CreateCompraDto, @GetUser() user) {
    return this.service.create(dto, user.id_usuario);
  }

  // Editar compra (solo de la misma sucursal)
  @RequirePermissions('inventario.compras:editar')
  @Policy('same_sucursal')
  @Patch(':id')
  async update(
    @Param('id') id: number,
    @Body() dto: UpdateCompraDto,
    @Req() request: Request
  ) {
    // Cargar compra para validar política
    const compra = await this.service.findOne(id);
    request.resource = compra;

    return this.service.update(id, dto);
  }

  // Recepcionar compra (acción custom crítica)
  @RequirePermissions('inventario.compras:custom')
  @Patch(':id/recepcionar')
  recepcionar(@Param('id') id: number) {
    return this.service.recepcionar(id);
  }
}
```

#### Frontend

```typescript
// compras.component.ts
export class ComprasComponent {
  canCreate = false;
  canEdit = false;
  canReceive = false;

  constructor(private permissionsService: PermissionsService) {
    this.canCreate = this.permissionsService.hasPermission('inventario.compras:crear');
    this.canEdit = this.permissionsService.hasPermission('inventario.compras:editar');
    this.canReceive = this.permissionsService.hasPermission('inventario.compras:custom');
  }
}
```

```html
<!-- compras.component.html -->
<button
  *hasPermission="'inventario.compras:crear'"
  (click)="openCreateDialog()">
  Nueva Compra
</button>

<table>
  <tr *ngFor="let compra of compras">
    <td>{{ compra.numero_factura }}</td>
    <td>
      <button
        *hasPermission="'inventario.compras:editar'"
        (click)="edit(compra)">
        Editar
      </button>

      <button
        *hasPermission="'inventario.compras:custom'"
        [disabled]="compra.recepcionada"
        (click)="recepcionar(compra)">
        Recepcionar
      </button>
    </td>
  </tr>
</table>
```

### Ejemplo 2: Aprobar Requisiciones

#### Backend

```typescript
@RequirePermissions('inventario.requisiciones:aprobar')
@Policy('requisicion_pendiente') // Solo si está PENDIENTE
@Patch(':id/aprobar')
async aprobar(
  @Param('id') id: number,
  @Body() dto: AprobarRequisicionDto,
  @Req() request: Request,
  @GetUser() user
) {
  // Cargar requisición
  const requisicion = await this.service.findOne(id);

  // Agregar a request para política
  request.resource = requisicion;

  // Aprobar
  return this.service.aprobar(id, dto, user.id_usuario);
}
```

#### Frontend

```typescript
aprobar(requisicion: Requisicion) {
  // Validar estado en frontend también
  if (requisicion.estado !== 'PENDIENTE') {
    Swal.fire('Error', 'Solo se pueden aprobar requisiciones pendientes', 'error');
    return;
  }

  // Confirmar
  Swal.fire({
    title: '¿Aprobar requisición?',
    text: `Requisición ${requisicion.codigo}`,
    icon: 'question',
    showCancelButton: true
  }).then(result => {
    if (result.isConfirmed) {
      this.service.aprobar(requisicion.id_requisicion).subscribe({
        next: () => {
          Swal.fire('Aprobada', 'Requisición aprobada exitosamente', 'success');
          this.loadRequisiciones();
        },
        error: (err) => {
          Swal.fire('Error', err.error.message, 'error');
        }
      });
    }
  });
}
```

```html
<button
  *hasPermission="'inventario.requisiciones:aprobar'"
  [disabled]="requisicion.estado !== 'PENDIENTE'"
  (click)="aprobar(requisicion)">
  Aprobar
</button>
```

### Ejemplo 3: Administrador Asigna Permisos

#### Backend

```typescript
@RequirePermissions('administracion.usuarios:custom') // Asignar permisos
@Post('usuarios/:id/permisos')
async asignarPermiso(
  @Param('id') id_usuario: number,
  @Body() dto: AsignarPermisoDto,
  @GetUser() adminUser
) {
  await this.usuariosService.asignarPermiso(
    id_usuario,
    dto.id_permiso,
    adminUser.id_usuario,
    dto.motivo,
    dto.fecha_expiracion
  );

  // Invalidar caché de permisos del usuario
  this.permissionsService.clearCache(id_usuario);

  return { message: 'Permiso asignado exitosamente' };
}
```

#### Frontend

```typescript
// asignar-permisos.component.ts
export class AsignarPermisosComponent {
  usuario: Usuario;
  permisosDisponibles: Permiso[] = [];
  permisoSeleccionado: Permiso;
  motivo: string;
  fechaExpiracion: Date;

  constructor(
    private usuariosService: UsuariosService,
    private permisosService: PermisosService
  ) {}

  asignar() {
    const dto = {
      id_permiso: this.permisoSeleccionado.id_permiso,
      motivo: this.motivo,
      fecha_expiracion: this.fechaExpiracion
    };

    this.usuariosService.asignarPermiso(this.usuario.id_usuario, dto).subscribe({
      next: () => {
        Swal.fire('Éxito', 'Permiso asignado', 'success');
        this.loadPermisos();
      }
    });
  }
}
```

---

## Notas Finales

### Mejores Prácticas

1. **Principio de Privilegio Mínimo**: Asignar solo los permisos estrictamente necesarios
2. **Revisar Permisos Críticos**: Monitorear uso de permisos marcados como `es_critico`
3. **Documentar Permisos Individuales**: Siempre incluir `motivo` al asignar permisos extra
4. **Expiración de Permisos Temporales**: Usar `fecha_expiracion` para permisos temporales
5. **Invalidar Caché**: Recordar invalidar caché al modificar permisos
6. **Auditar Acciones**: Revisar logs de acciones con `requiere_auditoria`

### Próximos Pasos

- [ ] Implementar endpoints de administración de permisos
- [ ] Implementar endpoints de administración de políticas
- [ ] Crear componentes de administración en frontend
- [ ] Agregar políticas personalizadas según necesidades
- [ ] Implementar auditoría avanzada de permisos
- [ ] Crear reportes de uso de permisos

---

**Última actualización**: 2025-11-17
**Versión**: 1.0
**Autor**: Sistema AFIS - Módulo de Autorizacion
