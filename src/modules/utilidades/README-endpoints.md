# Módulo de Utilidades

Este módulo proporciona herramientas para conectarse a bases de datos MySQL externas e importar datos a la base de datos PostgreSQL (Prisma) del sistema.

## Características

- ✅ Conexión a bases de datos MySQL externas
- ✅ Inspección de esquema de base de datos (tablas, columnas, tipos de datos)
- ✅ Vista previa de datos antes de importar
- ✅ Importación de datos con mapeo de campos configurable
- ✅ Registro de auditoría de importaciones
- ✅ Manejo de errores por registro
- ✅ Protección con JWT en todos los endpoints

## Endpoints Disponibles

Todos los endpoints requieren autenticación JWT. Base URL: `/utilidades`

### 1. Conectar a MySQL

**POST** `/utilidades/mysql/connect`

Establece una conexión con una base de datos MySQL.

**Body:**
```json
{
  "host": "localhost",
  "port": 3306,
  "user": "root",
  "password": "password",
  "database": "mi_base_datos"
}
```

**Respuesta:**
```json
{
  "data": {
    "success": true,
    "message": "Conexión exitosa a MySQL"
  },
  "statusCode": 200,
  "message": "Conexión establecida"
}
```

### 2. Verificar Estado de Conexión

**GET** `/utilidades/mysql/status`

Verifica si existe una conexión activa a MySQL.

**Respuesta:**
```json
{
  "data": {
    "connected": true,
    "message": "Conexión MySQL activa"
  },
  "statusCode": 200,
  "message": "Estado obtenido"
}
```

### 3. Obtener Información de Base de Datos

**GET** `/utilidades/mysql/database-info`

Obtiene información completa sobre tablas, columnas y conteo de registros.

**Respuesta:**
```json
{
  "data": {
    "tables": [
      {
        "name": "productos",
        "columns": [
          {
            "columnName": "id",
            "dataType": "int",
            "isNullable": "NO",
            "columnKey": "PRI"
          },
          {
            "columnName": "nombre",
            "dataType": "varchar",
            "isNullable": "NO",
            "columnKey": ""
          }
        ],
        "recordCount": 150
      }
    ]
  },
  "statusCode": 200,
  "message": "Información obtenida"
}
```

### 4. Previsualizar Datos de Tabla

**GET** `/utilidades/mysql/preview-table?tableName=productos&limit=10`

Obtiene una muestra de registros de una tabla específica.

**Query Parameters:**
- `tableName` (requerido): Nombre de la tabla
- `limit` (opcional): Número de registros (1-100, default: 10)

**Respuesta:**
```json
{
  "data": [
    { "id": 1, "nombre": "Producto 1", "precio": 100.00 },
    { "id": 2, "nombre": "Producto 2", "precio": 200.00 }
  ],
  "statusCode": 200,
  "message": "Vista previa obtenida"
}
```

### 5. Importar Tabla

**POST** `/utilidades/mysql/import-table`

Importa todos los registros de una tabla MySQL a un modelo de Prisma.

**Body:**
```json
{
  "tableName": "productos",
  "targetModel": "producto",
  "mapping": {
    "id_producto": "id",
    "nombre_producto": "nombre",
    "precio_venta": "precio"
  }
}
```

**Respuesta:**
```json
{
  "data": {
    "tableName": "productos",
    "totalRecords": 150,
    "importedRecords": 148,
    "failedRecords": 2,
    "errors": [
      { "record": 5, "error": "Dato duplicado" },
      { "record": 23, "error": "Campo requerido faltante" }
    ]
  },
  "statusCode": 200,
  "message": "Importación completada"
}
```

## Flujo de Trabajo Recomendado

1. **Conectar** a la base de datos MySQL usando `/mysql/connect`
2. **Verificar conexión** con `/mysql/status`
3. **Explorar esquema** usando `/mysql/database-info`
4. **Previsualizar datos** de la tabla a importar con `/mysql/preview-table`
5. **Configurar mapeo** de campos (si los nombres difieren entre MySQL y Prisma)
6. **Importar tabla** usando `/mysql/import-table`

## Personalización

### Personalizar Importación por Modelo

La función `importRecord()` en `import-data.service.ts:160` debe ser personalizada según tus modelos de Prisma:

```typescript
private async importRecord(
  targetModel: string,
  record: any,
  userId: number,
): Promise<any> {
  // Ejemplo para diferentes modelos
  switch (targetModel) {
    case 'producto':
      return await this.prismaService.producto.create({
        data: {
          ...record,
          id_usuario_creacion: userId
        }
      });

    case 'categoria':
      return await this.prismaService.categoria.create({ data: record });

    // Agregar más casos según tus modelos
    default:
      throw new Error(`Modelo ${targetModel} no configurado para importación`);
  }
}
```

## Estructura del Módulo

```
utilidades/
├── dto/
│   ├── mysql-connection.dto.ts    # DTO para conexión MySQL
│   ├── import-table.dto.ts         # DTO para importar tabla
│   └── preview-table.dto.ts        # DTO para previsualizar
├── mysql-connection.service.ts     # Servicio de conexión MySQL
├── import-data.service.ts          # Servicio de importación
├── utilidades.controller.ts        # Controlador REST
├── utilidades.module.ts            # Módulo NestJS
└── README.md                       # Esta documentación
```

## Seguridad

- ✅ Todos los endpoints requieren autenticación JWT
- ✅ Las credenciales de MySQL no se almacenan (solo en memoria durante la sesión)
- ✅ Validación de entrada con class-validator
- ✅ Pool de conexiones limitado (10 conexiones máximo)
- ✅ Registro de auditoría de todas las importaciones

## Dependencias

- `mysql2` - Cliente MySQL para Node.js con soporte de promesas
- `@prisma/client` - ORM para PostgreSQL
- `class-validator` - Validación de DTOs
- `@nestjs/swagger` - Documentación API

## Notas Importantes

1. **Mapeo de Campos**: Si los nombres de columnas en MySQL difieren de los campos en Prisma, usa el parámetro `mapping` en la importación.

2. **Tipos de Datos**: Puede que necesites transformar tipos de datos entre MySQL y PostgreSQL (ej: DATETIME vs TIMESTAMP).

3. **Relaciones**: Este módulo maneja importación de tablas individuales. Para relaciones complejas, importa en el orden correcto (tablas padre antes que tablas hijo).

4. **Performance**: Para tablas muy grandes (>10,000 registros), considera implementar importación por lotes.

5. **Personalización Requerida**: La función `importRecord()` debe ser implementada según tus modelos específicos de Prisma.

## Ejemplo de Uso Completo

```bash
# 1. Conectar a MySQL
curl -X POST http://localhost:4000/utilidades/mysql/connect \
  -H "Authorization: Bearer <tu-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "host": "192.168.1.100",
    "port": 3306,
    "user": "admin",
    "password": "secret",
    "database": "sistema_antiguo"
  }'

# 2. Ver información de tablas
curl -X GET http://localhost:4000/utilidades/mysql/database-info \
  -H "Authorization: Bearer <tu-token>"

# 3. Previsualizar datos
curl -X GET "http://localhost:4000/utilidades/mysql/preview-table?tableName=productos&limit=5" \
  -H "Authorization: Bearer <tu-token>"

# 4. Importar tabla
curl -X POST http://localhost:4000/utilidades/mysql/import-table \
  -H "Authorization: Bearer <tu-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "tableName": "productos",
    "targetModel": "producto",
    "mapping": {
      "id": "id_producto",
      "nombre": "nombre_producto"
    }
  }'
```

## Swagger Documentation

Una vez que el servidor esté corriendo, puedes acceder a la documentación interactiva de Swagger en:

**http://localhost:4000/api#/Utilidades**

Aquí podrás probar todos los endpoints directamente desde el navegador.
