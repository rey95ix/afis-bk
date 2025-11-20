# Prisma Module

## Propósito
Módulo wrapper para Prisma ORM. Proporciona servicio centralizado de acceso a base de datos PostgreSQL y métodos utilitarios para operaciones comunes como logging de acciones.

## Estructura

```
prisma/
├── prisma.module.ts
└── prisma.service.ts
```

## Tecnología
- **ORM**: Prisma
- **Base de datos**: PostgreSQL
- **Schema**: `prisma/schema.prisma`

## Configuración (.env)

```env
DATABASE_URL="postgresql://user:password@localhost:5432/dbname?schema=public"
```

## Servicio Principal

### PrismaService

**Extends**: `PrismaClient`

El servicio extiende PrismaClient de Prisma, heredando todos sus métodos y añadiendo funcionalidad adicional.

#### Lifecycle Hooks

##### `onModuleInit()`
- Se ejecuta al inicializar el módulo
- Conecta automáticamente a la base de datos usando `$connect()`
- No requiere llamada manual a connect

##### `onModuleDestroy()`
- Se ejecuta al destruir el módulo
- Desconecta automáticamente de la base de datos usando `$disconnect()`
- Garantiza cierre limpio de conexiones

#### Métodos Heredados de PrismaClient

Todos los modelos de Prisma están disponibles directamente:

```typescript
// Ejemplos de uso
await this.prisma.usuarios.findUnique({ where: { id: 1 } });
await this.prisma.cliente.findMany({ where: { estado: 'ACTIVO' } });
await this.prisma.compras.create({ data: { ... } });
await this.prisma.ticket_soporte.update({ where: { id: 1 }, data: { ... } });
```

#### Métodos Personalizados

##### `executeRawQuery(query: string, params?: any[]): Promise<any>`

Ejecuta query SQL raw con parámetros parametrizados.

**Parámetros:**
- `query`: Query SQL con placeholders `$1`, `$2`, etc.
- `params`: Array de parámetros (opcional)

**Retorna:** Número de filas afectadas

**Ejemplo:**
```typescript
await this.prisma.executeRawQuery(
  'UPDATE productos SET stock = stock - $1 WHERE id = $2',
  [5, 123]
);
```

**Uso:** Para queries complejos que no son fáciles con Prisma Client

##### `queryRaw<T>(query: string, params?: any[]): Promise<T[]>`

Ejecuta SELECT query y retorna resultados.

**Parámetros:**
- `query`: Query SQL SELECT con placeholders
- `params`: Array de parámetros (opcional)

**Retorna:** Array de resultados tipados

**Ejemplo:**
```typescript
const results = await this.prisma.queryRaw<{ total: number }>(
  'SELECT COUNT(*) as total FROM usuarios WHERE estado = $1',
  ['ACTIVO']
);
console.log(results[0].total);
```

##### `logAction(accion: string, id_usuario: number, descripcion: string, nivel?: string): Promise<void>`

Registra una acción en la tabla de bitácora (log).

**Parámetros:**
- `accion`: Tipo de acción (ej: 'LOGIN', 'CREATE_USER', 'UPDATE_PRODUCT')
- `id_usuario`: ID del usuario que ejecuta la acción
- `descripcion`: Descripción detallada de la acción
- `nivel`: Nivel de log (opcional: 'info', 'warn', 'error') - default: 'info'

**Retorna:** Promise<void>

**Ejemplo:**
```typescript
await this.prisma.logAction(
  'CREATE_CLIENTE',
  user.id_usuario,
  `Cliente creado: ${cliente.titular} (ID: ${cliente.id_cliente})`,
  'info'
);
```

**Uso:** Auditoría de todas las operaciones importantes del sistema

**Tabla**: Inserta registro en tabla `log`

## Uso en Otros Módulos

### Importación

```typescript
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  // ...
})
export class UsuariosModule {}
```

### Inyección

```typescript
import { PrismaService } from '../prisma/prisma.service';

constructor(private readonly prisma: PrismaService) {}
```

### Ejemplos de Uso

#### Query Simple

```typescript
const usuario = await this.prisma.usuarios.findUnique({
  where: { id_usuario: 1 }
});
```

#### Query con Relaciones

```typescript
const cliente = await this.prisma.cliente.findUnique({
  where: { id_cliente: 1 },
  include: {
    cliente_direcciones: true,
    cliente_datos_facturacion: true,
    ticket_soporte: true
  }
});
```

#### Create

```typescript
const nuevoCliente = await this.prisma.cliente.create({
  data: {
    titular: 'Juan Pérez',
    dui: '12345678-9',
    telefono1: '7890-1234',
    estado: 'ACTIVO'
  }
});

// Log de la acción
await this.prisma.logAction(
  'CREATE_CLIENTE',
  userId,
  `Cliente creado: ${nuevoCliente.titular}`
);
```

#### Update

```typescript
const updated = await this.prisma.catalogo.update({
  where: { id_catalogo: 1 },
  data: { precio: 50.00 }
});
```

#### Soft Delete

```typescript
const deleted = await this.prisma.usuarios.update({
  where: { id_usuario: 1 },
  data: { estado: 'INACTIVO' }
});

await this.prisma.logAction(
  'DELETE_USUARIO',
  currentUserId,
  `Usuario desactivado: ${deleted.usuario}`
);
```

#### Transacciones

```typescript
await this.prisma.$transaction(async (tx) => {
  // Reducir stock
  await tx.items_inventario.update({
    where: { id: 1 },
    data: { cantidad_disponible: { decrement: 10 } }
  });

  // Crear movimiento
  await tx.movimientos_inventario.create({
    data: {
      tipo_movimiento: 'SALIDA',
      id_catalogo: 1,
      cantidad: 10,
      // ...
    }
  });
});
```

## Prisma Schema

### Ubicación
`prisma/schema.prisma`

### Comandos Útiles

```bash
# Generar Prisma Client después de cambios en schema
npx prisma generate

# Crear nueva migración
npx prisma migrate dev --name nombre_migracion

# Aplicar migraciones pendientes
npx prisma migrate deploy

# Push schema sin crear migración (desarrollo)
npx prisma db push

# Abrir Prisma Studio (GUI para ver datos)
npx prisma studio

# Resetear base de datos (CUIDADO: borra datos)
npx prisma migrate reset
```

## Convenciones del Schema

### Nombres de Tablas
- Minúsculas con guiones bajos
- Plural o singular según contexto
- Ejemplos: `usuarios`, `cliente`, `ticket_soporte`, `orden_trabajo`

### Campos Comunes

#### IDs
```prisma
id_usuario    Int @id @default(autoincrement())
id_cliente    Int @id @default(autoincrement())
```

#### Timestamps
```prisma
fecha_creacion              DateTime @default(now())
fecha_ultima_actualizacion  DateTime @updatedAt
```

#### Estados
```prisma
estado  Estado @default(ACTIVO)

enum Estado {
  ACTIVO
  INACTIVO
  SUSPENDIDO
}
```

#### Foreign Keys
```prisma
id_sucursal  Int
sucursal     sucursales @relation(fields: [id_sucursal], references: [id_sucursal], onDelete: NoAction)
```

### Enums Principales

```prisma
enum Estado {
  ACTIVO
  INACTIVO
  SUSPENDIDO
}

enum EstadoTicket {
  ABIERTO
  EN_DIAGNOSTICO
  ESCALADO
  CERRADO
  CANCELADO
}

enum EstadoOrdenTrabajo {
  PENDIENTE_ASIGNACION
  ASIGNADA
  AGENDADA
  EN_RUTA
  EN_PROGRESO
  COMPLETADA
  CANCELADA
  REPROGRAMADA
}

enum EstadoImportacion {
  COTIZACION
  ORDEN_COLOCADA
  EN_TRANSITO
  EN_ADUANA
  LIBERADA
  RECIBIDA
  CANCELADA
}

// ... y muchos más
```

## Tabla de Bitácora (Log)

### Estructura

```prisma
model log {
  id_log      Int      @id @default(autoincrement())
  accion      String
  id_usuario  Int?
  descripcion String
  nivel       String   @default("info")  // info, warn, error
  fecha       DateTime @default(now())

  usuario     usuarios? @relation(fields: [id_usuario], references: [id_usuario])
}
```

### Acciones Comunes

| Acción | Descripción |
|--------|-------------|
| `LOGIN_SUCCESS` | Login exitoso |
| `LOGIN_FAILED` | Login fallido |
| `CREATE_*` | Creación de entidad |
| `UPDATE_*` | Actualización de entidad |
| `DELETE_*` | Eliminación de entidad |
| `CHANGE_PASSWORD` | Cambio de contraseña |
| `RESET_PASSWORD` | Reset de contraseña |
| `UPLOAD_FILE` | Subida de archivo |

### Niveles de Log

- **info**: Operaciones normales
- **warn**: Advertencias, operaciones sospechosas
- **error**: Errores, excepciones

## Mejores Prácticas

### 1. Siempre usar Transactions para Operaciones Múltiples

```typescript
// MAL
await this.prisma.items_inventario.update(...);
await this.prisma.movimientos_inventario.create(...);
// Si falla la segunda, la primera ya se aplicó

// BIEN
await this.prisma.$transaction(async (tx) => {
  await tx.items_inventario.update(...);
  await tx.movimientos_inventario.create(...);
});
```

### 2. Logging de Acciones Importantes

```typescript
// Siempre registrar CUD operations
await this.prisma.logAction('CREATE_ORDEN', userId, description);
```

### 3. Select Solo Campos Necesarios

```typescript
// Evitar traer password
const usuario = await this.prisma.usuarios.findUnique({
  where: { id_usuario: 1 },
  select: {
    id_usuario: true,
    nombres: true,
    apellidos: true,
    email: true
    // password: false (excluido)
  }
});
```

### 4. Usar Include para Relaciones

```typescript
// Cargar relaciones solo cuando sea necesario
const compra = await this.prisma.compras.findUnique({
  where: { id_compra: 1 },
  include: {
    compras_detalle: true,
    proveedor: true,
    sucursal: true
  }
});
```

### 5. Validar Existencia Antes de Update/Delete

```typescript
const exists = await this.prisma.cliente.findUnique({
  where: { id_cliente: id }
});
if (!exists) {
  throw new NotFoundException('Cliente no encontrado');
}
```

## Troubleshooting

### Error: "Prisma Client is not ready yet"
- Ejecutar `npx prisma generate`
- Reiniciar servidor de desarrollo

### Error: "Can't reach database server"
- Verificar DATABASE_URL en .env
- Verificar que PostgreSQL esté corriendo
- Verificar credenciales y permisos

### Error: "Unique constraint failed"
- Verificar que no exista registro con mismo valor único
- Revisar constraints en schema

### Migraciones Pendientes
```bash
npx prisma migrate deploy
```

### Schema Out of Sync
```bash
npx prisma db push  # Solo en desarrollo
```

## Dependencias

### NPM Packages
- `@prisma/client` - Cliente Prisma generado
- `prisma` - CLI de Prisma (dev dependency)

### Módulos que Importan PrismaModule
- Todos los módulos del sistema (es el módulo de acceso a datos)

## Notas de Implementación

1. **Auto-connect**: No es necesario llamar a `$connect()` manualmente
2. **Global Module**: Prisma se exporta globalmente, disponible en todos los módulos
3. **Soft Deletes**: Preferir `estado = INACTIVO` en vez de `DELETE FROM`
4. **Logging**: Usar `logAction()` para auditoría completa
5. **Raw Queries**: Usar con precaución, preferir Prisma Client cuando sea posible
6. **Migrations**: Nunca editar migraciones existentes, crear nuevas
