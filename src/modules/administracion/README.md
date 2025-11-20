# Administracion Module

## Propósito
Gestiona la administración del sistema: usuarios, roles, catálogo de productos, categorías, datos geográficos de El Salvador, y catálogos DTE (Documentos Tributarios Electrónicos).

## Estructura del Módulo

El módulo está organizado en submódulos independientes:

```
administracion/
├── usuarios/           # Gestión de usuarios
├── roles/              # Gestión de roles
├── catalogo/           # Catálogo de productos
├── categorias/         # Categorías de productos
├── departamentos/      # Departamentos (El Salvador)
├── municipios/         # Municipios (El Salvador)
├── colonias/           # Colonias (El Salvador)
└── dte-catalogos/      # Catálogos DTE
```

---

## 1. USUARIOS

### Archivos
- `usuarios.controller.ts`
- `usuarios.service.ts`
- `dto/create-usuario.dto.ts`
- `dto/update-usuario.dto.ts`
- `dto/change-password.dto.ts`

### Endpoints

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET | `/administracion/usuarios` | Listar usuarios (paginado) | Sí |
| GET | `/administracion/usuarios/:id` | Obtener usuario por ID | Sí |
| POST | `/administracion/usuarios` | Crear usuario | Sí |
| PUT | `/administracion/usuarios/:id` | Actualizar usuario | Sí |
| PUT | `/administracion/usuarios/:id/password` | Cambiar contraseña de usuario | Sí |
| DELETE | `/administracion/usuarios/:id` | Eliminar usuario (soft delete) | Sí |

### DTOs

#### CreateUsuarioDto
```typescript
{
  nombres: string;
  apellidos: string;
  usuario: string;        // Username único
  dui?: string;
  id_rol: number;
  id_sucursal: number;
  telefono?: string;
  email?: string;
  direccion?: string;
  estado?: Estado;        // Default: ACTIVO
}
```

#### UpdateUsuarioDto
```typescript
{
  // Todos los campos de CreateUsuarioDto opcionales
  // No incluye password (usar endpoint específico)
}
```

#### ChangePasswordDto
```typescript
{
  currentPassword?: string;
  newPassword: string;
  confirmPassword: string;
}
```

### Funcionalidades Clave

#### Creación de Usuario
- **Contraseña temporal**: Se auto-genera al crear usuario
- **Retorno único**: La contraseña temporal solo se retorna en la respuesta de creación
- **Hash**: Contraseñas hasheadas con bcrypt (10 rounds)
- **Validación**: Usuario único en base de datos

#### Seguridad de Contraseñas
- **Validaciones**:
  - Mínimo 8 caracteres
  - Al menos 1 letra mayúscula
  - Al menos 1 letra minúscula
  - Al menos 1 número
- **Never Exposed**: Las contraseñas nunca se retornan en GET requests
- **Select Exclusion**: `password` excluido en queries de Prisma

#### Soft Delete
- No elimina físicamente el registro
- Cambia `estado` a `INACTIVO`
- Usuario inactivo no puede hacer login

### Tabla Principal
- `usuarios`

---

## 2. ROLES

### Archivos
- `roles.controller.ts`
- `roles.service.ts`

### Endpoints

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET | `/roles` | Listar roles activos | Sí |

### Funcionalidad
- Listado simple de roles disponibles
- Solo roles con `estado = ACTIVO`
- Usado en formularios de creación/edición de usuarios

### Tabla Principal
- `roles`

---

## 3. CATÁLOGO DE PRODUCTOS

### Archivos
- `catalogo.controller.ts`
- `catalogo.service.ts`
- `dto/create-catalogo.dto.ts`
- `dto/update-catalogo.dto.ts`

### Endpoints

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET | `/catalogo` | Listar productos (paginado, búsqueda) | Sí |
| GET | `/catalogo/next-code` | Obtener siguiente código disponible | Sí |
| GET | `/catalogo/:id` | Obtener producto por ID | Sí |
| POST | `/catalogo` | Crear producto | Sí |
| PUT | `/catalogo/:id` | Actualizar producto | Sí |
| DELETE | `/catalogo/:id` | Eliminar producto (soft delete) | Sí |

### DTOs

#### CreateCatalogoDto
```typescript
{
  codigo: string;                    // Auto-generado o manual
  nombre: string;
  descripcion?: string;
  precio: number;
  id_categoria: number;
  codigo_proveedor?: string;
  sku?: string;
  unidad_medida?: string;
  marca?: string;
  modelo?: string;
  tiene_serie: boolean;              // ¿Requiere número de serie?
  stock_minimo?: number;
  stock_maximo?: number;
  imagen_url?: string;
  estado?: Estado;                   // Default: ACTIVO
}
```

### Generación Automática de Códigos

El sistema auto-genera códigos de producto basados en la jerarquía de categorías:

#### Formato
```
{CódigoCategoría}{CódigoSubcategoría}{Secuencial4Dígitos}
```

#### Ejemplo
- Categoría: "AA" (Electrónica)
- Subcategoría: "01" (Routers)
- Secuencial: 0001
- **Código generado**: `AA010001`

#### Proceso
1. Obtener categoría del producto
2. Si tiene categoría padre, usar código de ambas
3. Consultar último código usado en esa categoría
4. Incrementar secuencial
5. Retornar código sugerido

#### Endpoint Helper
```
GET /catalogo/next-code?id_categoria={id}
```
Retorna el siguiente código disponible para esa categoría.

### Control de Series
- Campo `tiene_serie` indica si el producto requiere tracking de números de serie
- Productos con `tiene_serie=true`:
  - Requieren serie en compras/importaciones
  - Se registran en tabla `series`
  - Tienen historial completo de movimientos
- Ejemplos: ONUs, routers, modems, equipos

### Tabla Principal
- `catalogo`

### Relaciones
- `categorias` - Categoría del producto
- `items_inventario` - Stock en bodegas
- `series` - Números de serie (si tiene_serie=true)

---

## 4. CATEGORÍAS

### Archivos
- `categorias.controller.ts`
- `categorias.service.ts`
- `dto/create-categoria.dto.ts`
- `dto/update-categoria.dto.ts`

### Endpoints

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET | `/categorias` | Listar categorías | Sí |
| GET | `/categorias/:id` | Obtener categoría | Sí |
| POST | `/categorias` | Crear categoría | Sí |
| PUT | `/categorias/:id` | Actualizar categoría | Sí |
| DELETE | `/categorias/:id` | Eliminar categoría | Sí |

### DTOs

#### CreateCategoriaDto
```typescript
{
  nombre: string;
  descripcion?: string;
  codigo: string;              // Código de 2 caracteres (ej: "AA", "01")
  id_categoria_padre?: number; // Para subcategorías
  estado?: Estado;
}
```

### Jerarquía
- **Categorías padre**: `id_categoria_padre = null`
- **Subcategorías**: Tienen `id_categoria_padre` apuntando a padre
- Dos niveles de jerarquía (padre → hijo)

### Uso
- Organización del catálogo de productos
- Generación de códigos de producto
- Filtrado y búsqueda

### Tabla Principal
- `categorias`

---

## 5. DATOS GEOGRÁFICOS (El Salvador)

### Jerarquía
```
Departamento (14 departamentos)
    └── Municipio (262 municipios)
            └── Colonia/Barrio (miles de colonias)
```

### DEPARTAMENTOS

#### Archivos
- `departamentos/departamentos.controller.ts`
- `departamentos/departamentos.service.ts`

#### Endpoints
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/departamentos` | Listar departamentos |
| GET | `/departamentos/:id` | Obtener departamento |
| POST | `/departamentos` | Crear departamento |
| PUT | `/departamentos/:id` | Actualizar departamento |
| DELETE | `/departamentos/:id` | Eliminar departamento |

#### Tabla
- `departamentos`

---

### MUNICIPIOS

#### Archivos
- `municipios/municipios.controller.ts`
- `municipios/municipios.service.ts`

#### Endpoints
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/municipios` | Listar municipios (filtrar por departamento) |
| GET | `/municipios/:id` | Obtener municipio |
| POST | `/municipios` | Crear municipio |
| PUT | `/municipios/:id` | Actualizar municipio |
| DELETE | `/municipios/:id` | Eliminar municipio |

#### Relación
- `id_departamento` - Foreign key a departamentos

#### Tabla
- `municipios`

---

### COLONIAS

#### Archivos
- `colonias/colonias.controller.ts`
- `colonias/colonias.service.ts`

#### Endpoints
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/colonias` | Listar colonias (filtrar por municipio) |
| GET | `/colonias/:id` | Obtener colonia |
| POST | `/colonias` | Crear colonia |
| PUT | `/colonias/:id` | Actualizar colonia |
| DELETE | `/colonias/:id` | Eliminar colonia |

#### Relación
- `id_municipio` - Foreign key a municipios

#### Tabla
- `colonias`

---

### Uso en el Sistema
Estas entidades geográficas se usan en:
- Direcciones de clientes
- Ubicación de sucursales
- Direcciones de servicio
- Reportes por zona geográfica

---

## 6. DTE CATÁLOGOS

### Archivos
- `dte-catalogos/dte-catalogos.controller.ts`
- `dte-catalogos/dte-catalogos.service.ts`

### Propósito
Gestiona catálogos para cumplimiento de **Documentos Tributarios Electrónicos (DTE)** según normativa del Ministerio de Hacienda de El Salvador.

### Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/dte-catalogos` | Listar catálogos DTE |
| GET | `/dte-catalogos/:id` | Obtener catálogo |
| POST | `/dte-catalogos` | Crear catálogo |
| PUT | `/dte-catalogos/:id` | Actualizar catálogo |
| DELETE | `/dte-catalogos/:id` | Eliminar catálogo |

### Tipos de Catálogos
- Tipos de documentos tributarios
- Tipos de establecimiento
- Tipos de ítem
- Unidades de medida tributarias
- Códigos de tributos
- Condiciones de operación

### Tabla Principal
- `dte_catalogos`

### Uso
- Facturación electrónica
- Generación de documentos tributarios
- Cumplimiento fiscal

---

## Reglas de Negocio Transversales

### Estados
Enum `Estado`:
- `ACTIVO` - Registro activo y utilizable
- `INACTIVO` - Registro desactivado (soft delete)
- `SUSPENDIDO` - Temporalmente desactivado

### Soft Deletes
- **Nunca eliminar físicamente** registros de catálogos
- Usar `estado = INACTIVO`
- Mantener integridad referencial
- Permitir restauración si es necesario

### Auditoría
- Todas las operaciones CUD se registran en tabla `log`
- Incluye: acción, usuario, timestamp, descripción

### Paginación
- Parámetros estándar: `page`, `limit`, `search`
- Respuesta: `{ data: [], meta: { total, page, limit, totalPages } }`

### Validaciones
- Códigos únicos (usuarios, productos, categorías)
- Referencias válidas (FK constraints)
- Estados válidos según enum

---

## Dependencias de Módulos

- `PrismaModule` - Acceso a base de datos
- `AuthModule` - Protección de rutas

---

## Tablas de Base de Datos

| Tabla | Descripción |
|-------|-------------|
| `usuarios` | Usuarios del sistema |
| `roles` | Roles y permisos |
| `catalogo` | Productos y servicios |
| `categorias` | Categorías de productos |
| `departamentos` | Departamentos de El Salvador |
| `municipios` | Municipios de El Salvador |
| `colonias` | Colonias/barrios de El Salvador |
| `dte_catalogos` | Catálogos para DTE |
| `log` | Bitácora de acciones |

---

## Notas de Implementación

1. **Códigos de Producto**: Usar endpoint `/catalogo/next-code` para obtener código sugerido antes de crear producto
2. **Contraseñas Temporales**: Guardar y enviar al usuario la contraseña temporal generada al crear usuario (solo se muestra una vez)
3. **Jerarquías**: Respetar jerarquías en categorías y geografía (no permitir huérfanos)
4. **Productos con Serie**: Verificar campo `tiene_serie` antes de operaciones de inventario
5. **DTE**: Consultar normativa actualizada de Ministerio de Hacienda para catálogos DTE
