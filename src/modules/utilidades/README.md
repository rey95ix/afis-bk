# Utilidades Module

## Propósito
Módulo de utilidades y herramientas auxiliares. Incluye servicios para importación de datos desde sistemas legacy (MySQL) y otras funciones de utilidad general.

## Estructura

```
utilidades/
├── utilidades.module.ts
├── utilidades.controller.ts
├── import-data.service.ts
├── mysql-connection.service.ts
└── README.md
```

## Componentes

### 1. ImportDataService

Servicio para importar datos desde sistemas legacy.

**Propósito:**
- Migración de datos desde base de datos antigua
- Transformación de datos legacy a formato nuevo
- Carga masiva de registros

**Uso típico:**
```typescript
await this.importDataService.importCustomers();
await this.importDataService.importProducts();
```

**Nota:** Este servicio es temporal, usado durante migración inicial del sistema legacy.

### 2. MySQLConnectionService

Servicio para conectarse a bases de datos MySQL legacy.

**Propósito:**
- Conectar con sistema antiguo durante migración
- Extraer datos de base de datos MySQL
- Facilitar transición desde sistema anterior

**Configuración (.env):**
```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=password
MYSQL_DATABASE=legacy_db
```

**Uso:**
```typescript
const connection = await this.mysqlService.getConnection();
const [rows] = await connection.execute('SELECT * FROM old_customers');
await connection.end();
```

### 3. UtilidadesController

Controlador con endpoints de utilidad.

**Endpoints típicos:**
- Operaciones de mantenimiento
- Utilidades de desarrollo
- Scripts administrativos

## Casos de Uso

### Migración de Datos Legacy

**Escenario:**
Empresa está migrando desde sistema antiguo en MySQL a AFIS (PostgreSQL con Prisma).

**Proceso:**

1. **Configurar conexión MySQL:**
   ```env
   MYSQL_HOST=old-system.local
   MYSQL_DATABASE=old_afis_db
   ```

2. **Crear script de importación:**
   ```typescript
   async importCustomers() {
     const oldData = await this.mysqlService.query('SELECT * FROM clientes');

     for (const oldCustomer of oldData) {
       await this.prisma.cliente.create({
         data: {
           titular: oldCustomer.nombre,
           dui: oldCustomer.dui,
           telefono1: oldCustomer.telefono,
           // Mapeo de campos legacy a nuevos
         }
       });
     }
   }
   ```

3. **Ejecutar importación:**
   ```bash
   curl -X POST http://localhost:4000/utilidades/import-customers
   ```

### Utilidades de Desarrollo

**Ejemplos de utilidades comunes:**

#### Generar datos de prueba
```typescript
async generateTestData() {
  // Crear clientes de prueba
  // Crear productos de prueba
  // Crear órdenes de prueba
}
```

#### Limpiar datos de desarrollo
```typescript
async cleanTestData() {
  await this.prisma.ticket_soporte.deleteMany({
    where: { descripcion_problema: { contains: '[TEST]' } }
  });
}
```

#### Validar integridad de datos
```typescript
async validateDataIntegrity() {
  // Verificar referencias rotas
  // Verificar estados inválidos
  // Generar reporte
}
```

## README del Módulo

El módulo incluye un archivo README.md con:
- Instrucciones de uso
- Ejemplos de scripts
- Documentación de migración
- Troubleshooting

## Seguridad

### ⚠️ Consideraciones Importantes

1. **Endpoints de Utilidades**
   - Deben estar protegidos con autenticación
   - Solo accesibles para administradores
   - Deshabilitar en producción si no son necesarios

2. **Conexión MySQL**
   - Credenciales en variables de entorno
   - Solo usar durante migración
   - Desconectar cuando termine migración

3. **Operaciones Masivas**
   - Usar transacciones
   - Implementar rollback en caso de error
   - Logging detallado de operaciones

### Protección Recomendada

```typescript
@Controller('utilidades')
@Auth(ValidRoles.admin)  // Solo admin
export class UtilidadesController {

  @Post('import-data')
  async importData() {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Not allowed in production');
    }
    // ...
  }
}
```

## Patrones Comunes

### 1. Importación con Validación

```typescript
async importWithValidation(data: any[]) {
  const results = {
    success: 0,
    failed: 0,
    errors: []
  };

  for (const item of data) {
    try {
      // Validar datos
      if (!this.validateItem(item)) {
        results.failed++;
        results.errors.push({ item, reason: 'Invalid data' });
        continue;
      }

      // Importar
      await this.prisma.something.create({ data: item });
      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push({ item, error: error.message });
    }
  }

  return results;
}
```

### 2. Importación por Lotes

```typescript
async importInBatches(data: any[], batchSize = 100) {
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);

    await this.prisma.$transaction(async (tx) => {
      for (const item of batch) {
        await tx.something.create({ data: item });
      }
    });

    console.log(`Processed ${i + batch.length}/${data.length}`);
  }
}
```

### 3. Mapeo de Datos Legacy

```typescript
function mapLegacyToNew(legacy: LegacyCustomer): CreateClienteDto {
  return {
    titular: legacy.nombre_completo,
    dui: legacy.documento_identidad,
    telefono1: legacy.tel_principal,
    telefono2: legacy.tel_secundario,
    correo_electronico: legacy.email,
    estado: legacy.activo ? 'ACTIVO' : 'INACTIVO',
    // ... más mapeos
  };
}
```

## Funciones de Utilidad Común

### Formateo de Datos

```typescript
export class DataFormatters {
  static formatDUI(dui: string): string {
    // 12345678-9
    return dui.replace(/(\d{8})(\d)/, '$1-$2');
  }

  static formatPhone(phone: string): string {
    // 7890-1234
    return phone.replace(/(\d{4})(\d{4})/, '$1-$2');
  }

  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-SV', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }
}
```

### Validadores

```typescript
export class Validators {
  static isValidDUI(dui: string): boolean {
    return /^\d{8}-\d$/.test(dui);
  }

  static isValidNIT(nit: string): boolean {
    return /^\d{4}-\d{6}-\d{3}-\d$/.test(nit);
  }

  static isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
```

### Helpers de Fecha

```typescript
export class DateHelpers {
  static formatDate(date: Date): string {
    return new Intl.DateTimeFormat('es-SV').format(date);
  }

  static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  static diffInDays(date1: Date, date2: Date): number {
    const diff = Math.abs(date1.getTime() - date2.getTime());
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }
}
```

## Dependencias

### NPM Packages
- `mysql2` - Cliente MySQL (si se usa MySQLConnectionService)

### Módulos Internos
- `PrismaModule` - Para operaciones en PostgreSQL destino
- Otros módulos según necesidad

## Cuándo Usar Este Módulo

### ✅ Usar para:
- Migración de datos legacy
- Scripts administrativos
- Utilidades de desarrollo
- Operaciones de mantenimiento
- Helpers compartidos

### ❌ No usar para:
- Lógica de negocio principal
- Endpoints de producción regulares
- Servicios core del sistema

## Ciclo de Vida

### Durante Migración
1. Configurar conexiones legacy
2. Implementar scripts de importación
3. Ejecutar importación con validación
4. Verificar integridad de datos

### Post-Migración
1. Deshabilitar conexión MySQL
2. Eliminar código de importación legacy
3. Mantener solo utilidades generales
4. Documentar utilidades que permanecen

## Limpieza Post-Migración

Después de completar migración:

```typescript
// Eliminar o comentar:
// - MySQLConnectionService
// - ImportDataService
// - Endpoints de importación

// Mantener:
// - Helpers generales
// - Utilidades de desarrollo
// - Scripts administrativos
```

## Mejores Prácticas

1. **Logging Detallado**
   ```typescript
   console.log(`Importing ${data.length} records...`);
   console.log(`Success: ${results.success}, Failed: ${results.failed}`);
   ```

2. **Manejo de Errores**
   ```typescript
   try {
     await importData();
   } catch (error) {
     console.error('Import failed:', error);
     // Rollback if needed
   }
   ```

3. **Progress Reporting**
   ```typescript
   for (let i = 0; i < items.length; i++) {
     if (i % 100 === 0) {
       console.log(`Progress: ${i}/${items.length}`);
     }
   }
   ```

4. **Dry Run Mode**
   ```typescript
   async import(data: any[], dryRun = false) {
     if (dryRun) {
       console.log('DRY RUN - No data will be saved');
       // Validate only
     } else {
       // Actually import
     }
   }
   ```

## Troubleshooting

### MySQL Connection Issues
- Verificar credenciales en .env
- Verificar host y puerto accesibles
- Verificar permisos de usuario MySQL

### Importación Lenta
- Usar transacciones por lotes
- Deshabilitar índices temporalmente
- Importar en paralelo (con cuidado)

### Datos Inconsistentes
- Implementar validación pre-importación
- Usar dry-run para probar
- Mantener logs detallados

## Notas de Implementación

1. **Temporal**: Este módulo es principalmente para migración, considerar eliminarlo después
2. **Protección**: Proteger todos los endpoints con autenticación admin
3. **Documentación**: Mantener README.md actualizado con instrucciones
4. **Testing**: Probar importaciones en ambiente de desarrollo primero
5. **Rollback**: Tener plan de rollback para importaciones masivas
