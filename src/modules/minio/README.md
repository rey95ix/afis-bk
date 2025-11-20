# MinIO Module

## Propósito
Servicio de almacenamiento de objetos (S3-compatible) para gestionar archivos del sistema: documentos de clientes, evidencias de órdenes de trabajo, imágenes, PDFs, y otros archivos multimedia.

## Estructura

```
minio/
├── minio.module.ts
└── minio.service.ts
```

## Tecnología
- **Librería**: `minio` (JavaScript client for MinIO)
- **Protocolo**: S3-compatible object storage
- **Alternativas**: Compatible con AWS S3, DigitalOcean Spaces, etc.

## Configuración (.env)

```env
MINIO_ENDPOINT=localhost           # Hostname del servidor MinIO
MINIO_PORT=9000                    # Puerto de MinIO (default: 9000)
MINIO_USE_SSL=false                # true para HTTPS, false para HTTP
MINIO_ACCESS_KEY=minioadmin        # Access key (similar a AWS Access Key)
MINIO_SECRET_KEY=minioadmin        # Secret key (similar a AWS Secret Key)
```

## Conceptos Básicos

### Buckets
- Contenedores para objetos (similar a carpetas principales)
- Bucket principal del sistema: `clientes-documentos`
- Se crea automáticamente al inicializar el módulo

### Objects
- Archivos almacenados en buckets
- Cada objeto tiene una key (ruta/nombre único)
- Metadata adicional puede almacenarse con cada objeto

### Presigned URLs
- URLs temporales firmadas para acceso directo
- Expiran después de cierto tiempo (default: 7 días)
- Útiles para compartir archivos sin autenticación

## Servicio Principal

### MinioService

#### Inicialización (`onModuleInit`)

Al iniciar el módulo:
1. Verifica si bucket `clientes-documentos` existe
2. Si no existe, lo crea
3. Establece política de acceso público de lectura

#### Métodos Públicos

##### `uploadFile(file: Express.Multer.File, folder?: string): Promise<string>`

Sube un archivo al bucket.

**Parámetros:**
- `file`: Archivo de Multer (desde multipart/form-data)
- `folder`: Carpeta opcional dentro del bucket (ej: 'documentos/', 'evidencias/')

**Retorna:** URL pública del archivo

**Proceso:**
1. Genera nombre único: `${folder}${timestamp}_${originalname}`
2. Determina content-type basado en extensión
3. Sube archivo con metadata (nombre original en base64)
4. Retorna URL presigned (válida por 7 días)

**Ejemplo:**
```typescript
const file: Express.Multer.File = req.file;
const url = await this.minioService.uploadFile(file, 'documentos/');
// Retorna: http://localhost:9000/clientes-documentos/documentos/1234567890_documento.pdf
```

##### `getFileUrl(objectName: string): Promise<string>`

Obtiene URL presigned de un archivo existente.

**Parámetros:**
- `objectName`: Nombre/key del objeto en bucket

**Retorna:** URL presigned válida por 7 días

**Ejemplo:**
```typescript
const url = await this.minioService.getFileUrl('documentos/1234567890_documento.pdf');
```

##### `getFile(objectName: string): Promise<Buffer>`

Descarga un archivo como Buffer.

**Parámetros:**
- `objectName`: Nombre/key del objeto

**Retorna:** Buffer con contenido del archivo

**Uso:** Para servir archivos directamente o procesarlos

**Ejemplo:**
```typescript
const buffer = await this.minioService.getFile('documentos/archivo.pdf');
res.set('Content-Type', 'application/pdf');
res.send(buffer);
```

##### `deleteFile(objectName: string): Promise<void>`

Elimina un archivo del bucket.

**Parámetros:**
- `objectName`: Nombre/key del objeto a eliminar

**Ejemplo:**
```typescript
await this.minioService.deleteFile('documentos/1234567890_old.pdf');
```

##### `listFiles(prefix?: string): Promise<string[]>`

Lista archivos en el bucket.

**Parámetros:**
- `prefix`: Filtro opcional por prefijo (ej: 'documentos/')

**Retorna:** Array de nombres de objetos

**Ejemplo:**
```typescript
const files = await this.minioService.listFiles('evidencias/');
// Retorna: ['evidencias/foto1.jpg', 'evidencias/foto2.jpg', ...]
```

##### `fileExists(objectName: string): Promise<boolean>`

Verifica si un archivo existe.

**Parámetros:**
- `objectName`: Nombre/key del objeto

**Retorna:** `true` si existe, `false` si no

**Ejemplo:**
```typescript
const exists = await this.minioService.fileExists('documentos/archivo.pdf');
```

##### `getFileMetadata(objectName: string): Promise<any>`

Obtiene metadata de un archivo.

**Parámetros:**
- `objectName`: Nombre/key del objeto

**Retorna:** Objeto con metadata (size, etag, lastModified, etc.)

**Ejemplo:**
```typescript
const metadata = await this.minioService.getFileMetadata('documentos/archivo.pdf');
console.log(metadata.size, metadata.lastModified);
```

## Uso en Otros Módulos

### Importación

```typescript
import { MinioModule } from '../minio/minio.module';

@Module({
  imports: [MinioModule],
  // ...
})
export class ClientesModule {}
```

### Inyección

```typescript
import { MinioService } from '../minio/minio.service';

constructor(private readonly minioService: MinioService) {}
```

### Upload de Archivo

```typescript
// En controller
@Post('upload')
@UseInterceptors(FileInterceptor('file'))
async uploadDocument(
  @UploadedFile() file: Express.Multer.File
) {
  const url = await this.minioService.uploadFile(file, 'documentos/');
  return { url };
}
```

## Organización de Archivos

### Estructura de Carpetas Recomendada

```
clientes-documentos/
├── documentos/              # Documentos de clientes (DUI, NIT, etc.)
├── evidencias/              # Evidencias de órdenes de trabajo
│   ├── fotos/
│   ├── videos/
│   └── speedtests/
├── facturas/                # Facturas y documentos contables
├── reportes/                # Reportes generados
└── temp/                    # Archivos temporales
```

### Convención de Nombres

Formato recomendado: `{folder}/{timestamp}_{original_name}`

Ejemplo: `documentos/1704067200000_dui_juan_perez.pdf`

**Ventajas:**
- Nombres únicos (timestamp)
- Trazabilidad (nombre original)
- Organización (carpetas)

## Tipos de Archivo Soportados

### Imágenes
- JPG/JPEG (image/jpeg)
- PNG (image/png)
- GIF (image/gif)
- WebP (image/webp)

### Documentos
- PDF (application/pdf)
- Word (application/msword, .docx)
- Excel (application/vnd.ms-excel, .xlsx)

### Videos
- MP4 (video/mp4)
- WebM (video/webm)
- AVI (video/x-msvideo)

### Otros
- JSON (application/json)
- XML (application/xml)
- CSV (text/csv)
- TXT (text/plain)

## Límites y Restricciones

### Tamaño de Archivo
- **Recomendado**: < 10 MB para uploads web
- **Máximo MinIO**: Sin límite (depende de configuración)
- **Límite Multer**: Configurar en controller

```typescript
@UseInterceptors(FileInterceptor('file', {
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
}))
```

### Validación de Tipo

```typescript
@UseInterceptors(FileInterceptor('file', {
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.match(/\/(jpg|jpeg|png|pdf)$/)) {
      return cb(new Error('Solo imágenes y PDFs'), false);
    }
    cb(null, true);
  }
}))
```

## Bucket Policy

### Política Pública de Lectura

El módulo configura automáticamente política pública:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"AWS": ["*"]},
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::clientes-documentos/*"]
    }
  ]
}
```

**Resultado:** Los archivos son accesibles públicamente mediante URL

**Seguridad:** Para archivos privados, usar presigned URLs en vez de URLs directas

## Presigned URLs

### ¿Qué son?
URLs temporales firmadas que permiten acceso sin credenciales.

### Configuración
- **Expiración actual**: 7 días (604800 segundos)
- **Modificar**: Cambiar parámetro en `getFileUrl()`

### Ejemplo de URL

```
http://localhost:9000/clientes-documentos/documentos/archivo.pdf?
X-Amz-Algorithm=AWS4-HMAC-SHA256&
X-Amz-Credential=minioadmin/20240101/us-east-1/s3/aws4_request&
X-Amz-Date=20240101T000000Z&
X-Amz-Expires=604800&
X-Amz-SignedHeaders=host&
X-Amz-Signature=...
```

## Metadata de Archivos

### Metadata Personalizada

Al subir archivos, se almacena metadata:

```typescript
const metaData = {
  'Content-Type': contentType,
  'x-amz-meta-original-name': Buffer.from(file.originalname).toString('base64')
};
```

### Recuperar Metadata

```typescript
const metadata = await this.minioService.getFileMetadata('archivo.pdf');
const originalName = Buffer.from(
  metadata.metaData['x-amz-meta-original-name'],
  'base64'
).toString('utf-8');
```

## Módulos que Usan MinIO

| Módulo | Uso |
|--------|-----|
| `atencion-al-cliente` | Documentos de clientes, evidencias de OT |
| `administracion` | Imágenes de productos |

## Instalación de MinIO Server

### Docker (Desarrollo)

```bash
docker run -p 9000:9000 -p 9001:9001 \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  minio/minio server /data --console-address ":9001"
```

**Consola Web**: http://localhost:9001

### Docker Compose

```yaml
version: '3'
services:
  minio:
    image: minio/minio
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data

volumes:
  minio_data:
```

## Troubleshooting

### Error: "Connection refused"
- Verificar que MinIO server esté corriendo
- Verificar MINIO_ENDPOINT y MINIO_PORT
- Verificar firewall/red

### Error: "Access Denied"
- Verificar MINIO_ACCESS_KEY y MINIO_SECRET_KEY
- Verificar política del bucket
- Verificar permisos del usuario

### Archivos no accesibles
- Verificar política pública del bucket
- Verificar URLs presigned no expiradas
- Verificar que objeto existe

### Bucket no se crea
- Verificar permisos de usuario MinIO
- Verificar logs del servidor MinIO
- Crear bucket manualmente desde consola

## Mejores Prácticas

1. **Nombres únicos**: Usar timestamps o UUIDs en nombres
2. **Organización**: Usar carpetas para categorizar archivos
3. **Metadata**: Almacenar nombre original y otros datos relevantes
4. **Validación**: Validar tipo y tamaño antes de subir
5. **Limpieza**: Implementar proceso para eliminar archivos huérfanos
6. **Backup**: Configurar replicación en producción
7. **CDN**: Considerar CDN para servir archivos estáticos

## Alternativas a MinIO

### AWS S3
Cambiar configuración:
```env
MINIO_ENDPOINT=s3.amazonaws.com
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=your-aws-access-key
MINIO_SECRET_KEY=your-aws-secret-key
```

### DigitalOcean Spaces
```env
MINIO_ENDPOINT=nyc3.digitaloceanspaces.com
MINIO_USE_SSL=true
```

## Notas de Implementación

1. **Inicialización**: Bucket se crea automáticamente en `onModuleInit`
2. **Content-Type**: Se detecta automáticamente según extensión
3. **Nombres Base64**: Metadata de nombre original se almacena en base64 para evitar problemas con caracteres especiales
4. **URLs Públicas**: Todos los archivos son accesibles públicamente (cambiar política si se requiere privacidad)
5. **Streaming**: Para archivos grandes, considerar streaming en vez de cargar todo en memoria
