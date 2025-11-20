# Seed Module

## Propósito
Módulo para inicializar la base de datos con datos esenciales del sistema. Crea registros base necesarios para que la aplicación funcione correctamente en desarrollo y producción.

## Estructura

```
seed/
├── seed.module.ts
├── seed.controller.ts
└── seed.service.ts
```

## ⚠️ Nota Importante

**Este módulo tiene un comentario TODO que indica que debe ser eliminado después de completar las migraciones.**

Razón: Los seeds deberían ejecutarse como parte del proceso de migración de base de datos, no como endpoints HTTP en producción.

## Endpoint

### POST `/seed`

Ejecuta el proceso de seeding completo.

**Auth:** No requiere autenticación (⚠️ riesgo de seguridad)

**Retorna:** Confirmación de datos creados

**Uso:**
```bash
curl -X POST http://localhost:4000/seed
```

## Datos Creados por el Seed

### 1. Sucursal Inicial

**Tabla:** `sucursales`

```typescript
{
  nombre: 'Casa Matriz',
  direccion: 'Dirección principal',
  telefono: '0000-0000',
  estado: 'ACTIVO'
}
```

### 2. Roles

**Tabla:** `roles`

#### Admin
```typescript
{
  nombre: 'Admin',
  descripcion: 'Administrador del sistema',
  estado: 'ACTIVO'
}
```

#### Facturación
```typescript
{
  nombre: 'Facturacion',
  descripcion: 'Personal de facturación',
  estado: 'ACTIVO'
}
```

### 3. Usuario Administrador

**Tabla:** `usuarios`

```typescript
{
  nombres: 'System',
  apellidos: 'Admin',
  usuario: 'sysadmin',
  email: 'sysadmin@ixc.com',
  password: bcrypt.hash('Admin123$', 10),
  id_rol: <id_rol_admin>,
  id_sucursal: <id_sucursal_casa_matriz>,
  estado: 'ACTIVO'
}
```

**Credenciales por defecto:**
- Usuario: `sysadmin`
- Email: `sysadmin@ixc.com`
- Password: `Admin123$`

### 4. Tipos de Factura (DTE)

**Tabla:** `facturas_tipos`

Lista de tipos de factura según normativa DTE de El Salvador:

| Código | Nombre |
|--------|--------|
| 01 | Factura |
| 03 | Comprobante de Crédito Fiscal |
| 04 | Nota de Remisión |
| 05 | Nota de Crédito |
| 06 | Nota de Débito |
| 07 | Comprobante de Retención |
| 08 | Comprobante de Liquidación |
| 09 | Documento Contable de Liquidación |
| 11 | Factura de Exportación |
| 14 | Factura de Sujeto Excluido |
| 15 | Comprobante de Donación |

### 5. Datos Generales del Sistema

**Tabla:** `general_data`

```typescript
{
  nombre_empresa: 'IXC',
  direccion: 'San Salvador',
  telefono: '0000-0000',
  email: 'info@ixc.com',
  sitio_web: 'www.ixc.com',
  // ... otros campos de configuración
}
```

### 6. Bloques de Facturas

**Tabla:** `facturas_bloques`

Bloques iniciales de numeración para facturas electrónicas:

```typescript
{
  id_tipo_factura: <tipo>,
  serie: 'A',
  numero_inicial: 1,
  numero_final: 100000,
  numero_actual: 1,
  estado: 'ACTIVO'
}
```

Se crean bloques para cada tipo de factura.

## Lógica del Servicio

### seedDatabase()

**Proceso:**

1. **Verificar si ya existen datos**
   - Consulta tabla `usuarios`
   - Si ya hay usuarios, retorna sin hacer nada (evita duplicados)

2. **Crear Sucursal**
   - Crea sucursal "Casa Matriz"
   - Obtiene ID generado

3. **Crear Roles**
   - Crea rol "Admin"
   - Crea rol "Facturacion"
   - Obtiene IDs generados

4. **Crear Usuario Admin**
   - Hashea password con bcrypt
   - Vincula con rol Admin y Casa Matriz
   - Crea usuario

5. **Crear Tipos de Factura**
   - Inserta todos los tipos DTE
   - Según catálogo oficial de El Salvador

6. **Crear General Data**
   - Datos básicos de configuración
   - Información de la empresa

7. **Crear Bloques de Facturas**
   - Para cada tipo de factura
   - Asigna rango de numeración

8. **Retornar Confirmación**
   - Mensaje de éxito
   - Detalles de datos creados

## Uso en Desarrollo

### Primera Configuración

1. **Setup de base de datos:**
   ```bash
   npx prisma migrate dev
   ```

2. **Ejecutar seed:**
   ```bash
   # Opción 1: Endpoint HTTP
   curl -X POST http://localhost:4000/seed

   # Opción 2: Script Prisma (recomendado)
   npx prisma db seed
   ```

3. **Login con credenciales:**
   - Usuario: `sysadmin`
   - Password: `Admin123$`

### Reset de Base de Datos

```bash
# Resetear y volver a seed
npx prisma migrate reset
# Ejecutará automáticamente seed si está configurado en package.json
```

## Configuración de Prisma Seed (Recomendado)

### package.json

```json
{
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

### prisma/seed.ts

```typescript
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Lógica de seed aquí (copiar de seed.service.ts)
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

## Seguridad

### ⚠️ Problemas de Seguridad Actual

1. **Endpoint Público**
   - No requiere autenticación
   - Cualquiera puede ejecutarlo
   - Podría recrear datos en producción

2. **Credenciales Hardcoded**
   - Password por defecto conocido
   - Debe cambiarse en producción

### 🔒 Recomendaciones

1. **Deshabilitar en Producción**
   ```typescript
   if (process.env.NODE_ENV === 'production') {
     throw new ForbiddenException('Seed disabled in production');
   }
   ```

2. **Proteger con Auth**
   ```typescript
   @Post('seed')
   @Auth(ValidRoles.superadmin)
   async seed() {
     // ...
   }
   ```

3. **Usar Prisma Seed**
   - Ejecutar como script CLI
   - No exponer como endpoint HTTP

4. **Cambiar Password Inicial**
   - Forzar cambio en primer login
   - Usar password complejo único

## Idempotencia

El seed actual es **parcialmente idempotente**:

- ✅ Verifica si ya existen usuarios antes de ejecutar
- ❌ No verifica existencia de otros datos
- ❌ No maneja updates, solo inserts

### Mejora Recomendada

```typescript
async seedDatabase() {
  // Verificar cada entidad individualmente
  const adminRole = await this.prisma.roles.findFirst({
    where: { nombre: 'Admin' }
  });

  if (!adminRole) {
    await this.prisma.roles.create({
      data: { nombre: 'Admin', ... }
    });
  }

  // Repetir para cada entidad
}
```

## Migraciones vs Seeds

### Cuándo usar cada uno

**Migraciones:**
- Cambios de estructura de base de datos
- Creación/modificación de tablas
- Cambios de tipos de datos
- Constraints, índices, relaciones

**Seeds:**
- Datos iniciales requeridos
- Configuración por defecto
- Datos de desarrollo/testing
- Catálogos estáticos

## Plan de Transición

### Paso 1: Crear Seed Script
Mover lógica a `prisma/seed.ts`

### Paso 2: Actualizar package.json
Configurar comando de seed

### Paso 3: Deshabilitar Endpoint
Comentar o eliminar controller en producción

### Paso 4: Documentar
Actualizar README con instrucciones de seed

### Paso 5: Eliminar Módulo
Una vez migrado, eliminar módulo seed completo

## Dependencias

- `PrismaModule` - Acceso a base de datos
- `bcrypt` - Hash de passwords

## Módulos que Dependen del Seed

- Ninguno (el seed debe ejecutarse antes que la aplicación funcione)

## Datos que Otros Módulos Esperan

| Módulo | Dependencia |
|--------|-------------|
| `auth` | Usuario admin, roles |
| `administracion` | Sucursal inicial, tipos de factura |
| `inventario` | Sucursal para bodegas |
| Todos | General data para configuración |

## Notas de Implementación

1. **TODO Existente**: Eliminar este módulo después de implementar seeds en Prisma
2. **No en Producción**: No ejecutar seed en producción después de setup inicial
3. **Password Seguro**: Cambiar credenciales de admin inmediatamente
4. **Idempotencia**: Mejorar para permitir múltiples ejecuciones seguras
5. **Script CLI**: Preferir script de Prisma sobre endpoint HTTP
