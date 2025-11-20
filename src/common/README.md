# Common Directory

## Propósito
Directorio de código compartido que contiene constantes, DTOs, filtros, helpers e interceptores reutilizables en todo el sistema AFIS. Proporciona funcionalidad transversal para paginación, formateo, validación, y manejo de respuestas.

## Estructura

```
common/
├── const/                         # Constantes del sistema
│   ├── directory.ts               # Rutas y configuraciones
│   ├── regrex.ts                  # Patrones regex y nombres
│   └── index.ts
├── dto/                           # DTOs compartidos
│   ├── pagination.dto.ts          # Paginación estándar
│   └── index.ts
├── filters/                       # Filtros de excepciones
│   ├── http-exception.filter.ts   # Manejo global de errores
│   └── index.ts
├── helpers/                       # Funciones de utilidad
│   ├── dates.helper.ts            # Conversión de fechas
│   ├── validate-emails.helper.ts  # Validación de emails
│   ├── delete.space.ts            # Limpieza de texto
│   ├── convert.amount.class.ts    # Números a letras
│   ├── format.number.ts           # Formateo de números
│   └── index.ts
└── intersectors/                  # Interceptores (typo: debería ser interceptors)
    ├── transformar.interceptor.ts # Transformación de respuestas
    ├── time-out.intersectors.ts   # Timeout de requests
    ├── zipkin.interceptor.ts      # (Comentado) Tracing distribuido
    └── index.ts
```

---

## 1. CONST (Constantes)

### Propósito
Constantes centralizadas para configuración, patrones regex y valores mágicos del sistema.

### Archivos

#### `const/directory.ts`

**Exports:**
```typescript
export const UPLOADFILE = './uploads';     // Directorio base para uploads
export const TIMEOUTAXIOS = 20000;         // Timeout de Axios: 20 segundos
```

**Uso:**
- Configuración de rutas de archivos
- Timeout de requests HTTP externos

---

#### `const/regrex.ts`

**Exports:**
```typescript
export const FORMAT_FECHA_YYYY_MM_DD: RegExp;     // Regex: YYYY-MM-DD
export const FORMAT_FECHA_DD_MM_YYYY: RegExp;     // Regex: DD/MM/YYYY
export const HEADER_API_BEARER_AUTH: string;      // "accessToken"
```

**Patrones Regex:**

1. **FORMAT_FECHA_YYYY_MM_DD**
   ```javascript
   /^\d{4}\-(0?[1-9]|1[012])\-(0?[1-9]|[12][0-9]|3[01])$/
   ```
   - Formato: YYYY-MM-DD
   - Ejemplos válidos: `2024-01-15`, `2024-1-5`

2. **FORMAT_FECHA_DD_MM_YYYY**
   ```javascript
   // Regex complejo con soporte de años bisiestos
   ```
   - Formato: DD/MM/YYYY
   - Valida días según el mes (28/29 en febrero, 30/31 según mes)
   - Ejemplos válidos: `15/01/2024`, `29/02/2024` (año bisiesto)

**Uso:**
```typescript
// Validación en DTOs
@Matches(FORMAT_FECHA_YYYY_MM_DD, {
  message: 'Fecha debe estar en formato YYYY-MM-DD'
})
fecha: string;

// Swagger Auth Header
import { HEADER_API_BEARER_AUTH } from 'src/common/const';

.addBearerAuth({
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
}, HEADER_API_BEARER_AUTH)
```

---

#### `const/index.ts`

Barrel export de todas las constantes:
```typescript
export { FORMAT_FECHA_YYYY_MM_DD, HEADER_API_BEARER_AUTH, FORMAT_FECHA_DD_MM_YYYY } from "./regrex"
export { UPLOADFILE } from "./directory"
```

---

## 2. DTO (Data Transfer Objects)

### Propósito
DTOs compartidos para operaciones comunes como paginación.

### Archivos

#### `dto/pagination.dto.ts`

**Exports:**
```typescript
export class PaginationDto
export interface PaginatedResult<T>
```

**PaginationDto:**
```typescript
class PaginationDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
```

**Campos:**
- `page` - Número de página (min: 1, default: 1)
- `limit` - Registros por página (min: 1, default: 10)
- `search` - Término de búsqueda opcional

**Validaciones:**
- Conversión automática string → number
- Valores mínimos
- Swagger documentation automática

**PaginatedResult Interface:**
```typescript
interface PaginatedResult<T> {
  data: T[];                    // Array de resultados
  meta: {
    total: number;              // Total de registros
    page: number;               // Página actual
    limit: number;              // Registros por página
    totalPages: number;         // Total de páginas
  };
}
```

**Patrón de Uso Estándar:**

**Controller:**
```typescript
@Get()
async findAll(@Query() paginationDto: PaginationDto) {
  return this.service.findAll(paginationDto);
}
```

**Service:**
```typescript
async findAll(paginationDto: PaginationDto): Promise<PaginatedResult<Entity>> {
  const { page = 1, limit = 10, search = '' } = paginationDto;
  const skip = (page - 1) * limit;

  // Condiciones de búsqueda
  const where: any = { estado: 'ACTIVO' };
  if (search) {
    where.OR = [
      { nombre: { contains: search, mode: 'insensitive' } },
      { codigo: { contains: search, mode: 'insensitive' } }
    ];
  }

  // Query paralelo para datos y conteo
  const [data, total] = await Promise.all([
    this.prisma.entity.findMany({
      where,
      skip,
      take: limit,
      orderBy: { fecha_creacion: 'desc' }
    }),
    this.prisma.entity.count({ where })
  ]);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
}
```

**Módulos que Usan PaginationDto:**
- `inventario/*` - Todos los submódulos (compras, importaciones, etc.)
- `atencion-al-cliente/*` - Clientes, tickets, órdenes
- `administracion/*` - Usuarios, productos, categorías

---

## 3. FILTERS (Filtros de Excepciones)

### Propósito
Manejo centralizado y consistente de excepciones en toda la aplicación.

### Archivos

#### `filters/http-exception.filter.ts`

**Export:**
```typescript
export class AllExceptionFilter implements ExceptionFilter
```

**Descripción:**
Filtro que captura TODAS las excepciones y las formatea de manera consistente.

**Implementación:**
```typescript
@Catch()
export class AllExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const msg = exception instanceof HttpException
      ? exception.getResponse()
      : exception;

    this.logger.error(`Status ${status} Error: ${JSON.stringify(msg)}`);

    response.status(status).json({
      time: new Date().toISOString(),
      path: request.url,
      data: typeof msg.message == 'string' ? msg.message : [...msg.message],
      msg: msg.message.toString(),
      status: false
    });
  }
}
```

**Formato de Respuesta de Error:**
```json
{
  "time": "2024-01-15T10:30:00.000Z",
  "path": "/api/endpoint",
  "data": ["Error message"],
  "msg": "Error message",
  "status": false
}
```

**Características:**
- Captura HttpException y excepciones genéricas
- Default a status 500 para errores no-HTTP
- Logging automático de todos los errores
- Convierte mensajes únicos a string, arrays permanecen arrays

**Registro (no actualmente global):**
```typescript
// En main.ts (si se quisiera habilitar globalmente)
app.useGlobalFilters(new AllExceptionFilter());

// O por controlador
@UseFilters(AllExceptionFilter)
export class SomeController {}
```

---

## 4. HELPERS (Funciones de Utilidad)

### Propósito
Funciones reutilizables para operaciones comunes: fechas, validación, formateo.

### Archivos

#### `helpers/dates.helper.ts`

**Exports:**
```typescript
export const convert = (str: string) => string
export const convertWithTime = (str: string) => string
export const convertToUTC = (fecha: string, hora?: string) => Date
```

**Funciones:**

##### `convert(str: string): string`

Convierte Date a formato YYYY-MM-DD.

**Ejemplo:**
```typescript
convert('2024-01-15T10:30:00Z')  // "2024-01-15"
convert(new Date().toISOString()) // "2024-01-15"
```

**Uso:** Formateo de fechas para display, PDFs

---

##### `convertWithTime(str: string): string`

Convierte Date a timezone de El Salvador (UTC-6) con hora.

**Formato:** `YYYY-MM-DD HH:mm:ss`

**Ejemplo:**
```typescript
convertWithTime('2024-01-15T10:30:00Z')  // "2024-01-15 04:30:00"
// 10:30 UTC - 6 horas = 04:30 hora local
```

**Uso:** Timestamps en reportes, logs con hora local

---

##### `convertToUTC(fecha: string, hora?: string): Date`

Convierte fecha local a UTC Date para queries de base de datos.

**Parámetros:**
- `fecha`: String de fecha (YYYY-MM-DD)
- `hora`: `"inicio"` para inicio del día (00:00:00) o cualquier otro valor para fin (23:59:59)

**Proceso:**
1. Parsea fecha a objeto Date
2. Establece hora según parámetro
3. Añade 6 horas (compensar UTC-6 de El Salvador)
4. Retorna Date UTC

**Ejemplos:**
```typescript
convertToUTC('2024-01-15', 'inicio')
// Date: 2024-01-15 06:00:00 UTC (00:00:00 hora local)

convertToUTC('2024-01-15', 'fin')
// Date: 2024-01-16 05:59:59 UTC (23:59:59 hora local)
```

**Uso en Queries:**
```typescript
// Rango de fechas en query
const where: any = {};

if (fecha_desde) {
  where.fecha_creacion = {
    gte: convertToUTC(fecha_desde, 'inicio')
  };
}

if (fecha_hasta) {
  where.fecha_creacion = {
    ...where.fecha_creacion,
    lte: convertToUTC(fecha_hasta, 'fin')
  };
}

const resultados = await this.prisma.compras.findMany({ where });
```

---

#### `helpers/validate-emails.helper.ts`

**Export:**
```typescript
export const verifyEmail = (email: string) => boolean
```

**Descripción:**
Valida emails usando regex comprehensivo.

**Regex:**
```javascript
/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
```

**Valida:**
- Parte local (antes del @)
- Parte de dominio (después del @)
- IPs como dominio
- Strings entre comillas
- Dominios multi-nivel

**Ejemplos:**
```typescript
verifyEmail('user@example.com')         // true
verifyEmail('user+tag@domain.co.uk')    // true
verifyEmail('user@[192.168.1.1]')       // true
verifyEmail('invalid.email')            // false
verifyEmail('@example.com')             // false
```

**Uso:**
```typescript
// Validación en service
if (!verifyEmail(email)) {
  throw new BadRequestException('Email inválido');
}

// Validación en DTO (mejor usar class-validator @IsEmail())
```

---

#### `helpers/delete.space.ts`

**Export:**
```typescript
export const eliminarGuionesYEspacios = (texto: string) => string
```

**Descripción:**
Elimina guiones (-) y espacios de un string.

**Implementación:**
```typescript
return texto.replace(/[-\s]/g, '');
```

**Ejemplos:**
```typescript
eliminarGuionesYEspacios('123-456-789')      // "123456789"
eliminarGuionesYEspacios('ABC 123 DEF')      // "ABC123DEF"
eliminarGuionesYEspacios('12345678-9')       // "123456789"
eliminarGuionesYEspacios('7890 - 1234')      // "78901234"
```

**Uso:**
- Normalizar DUI antes de guardar: `12345678-9` → `123456789`
- Normalizar teléfonos: `7890-1234` → `78901234`
- Normalizar NITs: `1234-567890-123-4` → `1234567890123`

---

#### `helpers/convert.amount.class.ts`

**Export:**
```typescript
export const NumeroALetras = (num: number) => string
```

**Descripción:**
Convierte cantidades numéricas a palabras en español, específicamente para moneda (dólares).

**Configuración:**
```typescript
{
  letrasMonedaPlural: 'Dólares',
  letrasMonedaSingular: 'Dólar',
  letrasMonedaCentavoPlural: "CENTAVOS",
  letrasMonedaCentavoSingular: "CENTAVO"
}
```

**Funciones Internas:**
- `Unidades(num)` - 1-9
- `Decenas(num)` - 10-99 (DIEZ, ONCE, VEINTE, etc.)
- `DecenasY(strSin, numUnidades)` - Añade "Y" conector
- `Centenas(num)` - 100-999 (CIEN, DOSCIENTOS, etc.)
- `Seccion(num, divisor, strSingular, strPlural)` - Handler genérico
- `Miles(num)` - Miles
- `Millones(num)` - Millones

**Ejemplos:**
```typescript
NumeroALetras(125.50)
// "CIENTO VEINTICINCO Dólares CON CINCUENTA CENTAVOS"

NumeroALetras(1.00)
// "UN Dólar CON CERO CENTAVOS"

NumeroALetras(1000.99)
// "UN MIL Dólares CON NOVENTA Y NUEVE CENTAVOS"

NumeroALetras(1000000.00)
// "UN MILLON DE Dólares CON CERO CENTAVOS"
```

**Uso:**
- Generación de facturas
- Impresión de cheques
- Reportes financieros formales

---

#### `helpers/format.number.ts`

**Exports:**
```typescript
export const formatNumber = (value: any, digits = 2) => string
export const formatNumberDecimal = (value: number, digits = 5) => number
export const formatNumberDecimalSinValidacion = (value: number, digits = 5) => number
```

##### `formatNumber(value: any, digits = 2): string`

Formatea número a string con decimales fijos.

**Default:** 2 decimales

**Manejo de null/undefined/NaN:** Retorna `'0.00'`

**Ejemplos:**
```typescript
formatNumber(123.456)          // "123.46"
formatNumber(10)               // "10.00"
formatNumber(99.9, 3)          // "99.900"
formatNumber(null)             // "0.00"
formatNumber(undefined)        // "0.00"
```

**Uso:** Display de precios, cantidades en UI

---

##### `formatNumberDecimal(value: number, digits = 5): number`

Formatea número con precisión específica, retorna tipo number.

**Default:** 5 decimales

**Regla especial:** Si parte decimal < 0.01, trunca a entero pero mantiene formato

**Ejemplos:**
```typescript
formatNumberDecimal(123.456789)     // 123.45679
formatNumberDecimal(10.005)         // 10.005
formatNumberDecimal(10.0001)        // 10.00000 (< 0.01, truncado)
formatNumberDecimal(99.123, 2)      // 99.12
```

**Uso:** Cálculos precisos, costos unitarios

---

##### `formatNumberDecimalSinValidacion(value: number, digits = 5): number`

Igual que `formatNumberDecimal` pero sin regla de truncamiento < 0.01.

**Ejemplos:**
```typescript
formatNumberDecimalSinValidacion(10.0001)    // 10.0001
formatNumberDecimalSinValidacion(0.00005, 5) // 0.00005
```

**Uso:** Cuando se necesita precisión completa sin truncamiento

---

## 5. INTERSECTORS (Interceptores)

**Nota:** Nombre del directorio tiene typo - debería ser "interceptors"

### Propósito
Interceptores de NestJS para cross-cutting concerns: transformación de respuestas, timeouts, tracing.

### Archivos

#### `intersectors/transformar.interceptor.ts`

**Exports:**
```typescript
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>>
export interface Response<T>
```

**Descripción:**
Transforma TODAS las respuestas exitosas a formato consistente.

**Response Interface:**
```typescript
interface Response<T> {
  data: T;              // Datos de respuesta original
  status: boolean;      // true para éxito
  msg: string;          // "Success"
}
```

**Implementación:**
```typescript
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => ({
        data,
        status: true,
        msg: 'Success',
      })),
    );
  }
}
```

**Registro Global:**
```typescript
// main.ts
app.useGlobalInterceptors(new TransformInterceptor());
```

**Efecto:**

**Sin interceptor:**
```json
{ "id": 1, "nombre": "Juan" }
```

**Con interceptor:**
```json
{
  "data": { "id": 1, "nombre": "Juan" },
  "status": true,
  "msg": "Success"
}
```

**Impacto:**
- Todos los endpoints automáticamente envuelven respuestas
- Cliente siempre recibe estructura consistente
- Facilita manejo de respuestas en frontend

---

#### `intersectors/time-out.intersectors.ts`

**Export:**
```typescript
export class TimeOutIntersector implements NestInterceptor
```

**Descripción:**
Añade protección de timeout a requests.

**Timeout:** 30 segundos (30000ms)

**Implementación:**
```typescript
@Injectable()
export class TimeOutIntersector implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(timeout(30000));
  }
}
```

**Comportamiento:**
- Si request tarda > 30 segundos → TimeoutError
- Previene requests colgados
- Protege contra queries lentos o APIs externas lentas

**Registro:**
```typescript
// No está registrado globalmente actualmente
// Usar por controlador o método:
@UseInterceptors(TimeOutIntersector)
export class SomeController { }
```

---

#### `intersectors/zipkin.interceptor.ts`

**Estado:** ⚠️ COMPLETAMENTE COMENTADO

**Descripción:**
Era para distributed tracing con Zipkin (observabilidad de microservicios).

**Características (cuando activo):**
- Tracing de HTTP requests
- Registro de detalles request/response
- Envío de traces a servidor Zipkin
- Tracking de errores y latencia

**Nota:** Todo el archivo está comentado, indica que tracing distribuido no está implementado o fue removido.

---

## Patrones de Uso Comunes

### 1. Patrón de Paginación (Muy Frecuente)

**Controller:**
```typescript
import { PaginationDto } from 'src/common/dto';

@Get()
async findAll(@Query() paginationDto: PaginationDto) {
  return this.service.findAll(paginationDto);
}
```

**Service:**
```typescript
import { PaginationDto, PaginatedResult } from 'src/common/dto';

async findAll(paginationDto: PaginationDto): Promise<PaginatedResult<Usuario>> {
  const { page = 1, limit = 10, search = '' } = paginationDto;
  const skip = (page - 1) * limit;

  const where: any = { estado: 'ACTIVO' };
  if (search) {
    where.OR = [
      { nombres: { contains: search, mode: 'insensitive' } },
      { apellidos: { contains: search, mode: 'insensitive' } }
    ];
  }

  const [data, total] = await Promise.all([
    this.prisma.usuarios.findMany({ where, skip, take: limit }),
    this.prisma.usuarios.count({ where })
  ]);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
}
```

---

### 2. Patrón de Filtrado por Fechas

```typescript
import { convertToUTC } from 'src/common/helpers';

async findByDateRange(fecha_desde: string, fecha_hasta: string) {
  const where: any = {};

  if (fecha_desde) {
    where.fecha_creacion = {
      gte: convertToUTC(fecha_desde, 'inicio')
    };
  }

  if (fecha_hasta) {
    where.fecha_creacion = {
      ...where.fecha_creacion,
      lte: convertToUTC(fecha_hasta, 'fin')
    };
  }

  return this.prisma.compras.findMany({ where });
}
```

---

### 3. Patrón de Formateo en PDFs

```typescript
import { convert, convertWithTime, formatNumber } from 'src/common/helpers';

async generatePdf(id: number) {
  const compra = await this.findOne(id);

  const templateData = {
    numero_factura: compra.numero_factura,
    fecha: convert(compra.fecha_factura),           // "2024-01-15"
    fecha_hora: convertWithTime(compra.fecha_creacion),  // "2024-01-15 10:30:00"
    subtotal: formatNumber(compra.subtotal, 2),     // "99.99"
    total: formatNumber(compra.total, 2)            // "125.50"
  };

  // Generar PDF...
}
```

---

### 4. Patrón de Normalización de Datos

```typescript
import { eliminarGuionesYEspacios } from 'src/common/helpers';

async createCliente(dto: CreateClienteDto) {
  // Normalizar DUI antes de guardar
  const duiNormalizado = dto.dui
    ? eliminarGuionesYEspacios(dto.dui)
    : null;

  return this.prisma.cliente.create({
    data: {
      ...dto,
      dui: duiNormalizado  // "123456789" en vez de "12345678-9"
    }
  });
}
```

---

### 5. Patrón de Validación de Email

```typescript
import { verifyEmail } from 'src/common/helpers';

async validateEmail(email: string) {
  if (!verifyEmail(email)) {
    throw new BadRequestException('Email inválido');
  }
  // Continuar...
}
```

---

## Convenciones de Importación

### Siempre usar imports absolutos:

```typescript
// ✅ CORRECTO
import { PaginationDto, PaginatedResult } from 'src/common/dto';
import { convert, convertToUTC, formatNumber } from 'src/common/helpers';
import { HEADER_API_BEARER_AUTH, FORMAT_FECHA_YYYY_MM_DD } from 'src/common/const';
import { TransformInterceptor } from 'src/common/intersectors';
import { AllExceptionFilter } from 'src/common/filters';

// ❌ INCORRECTO
import { PaginationDto } from '../../common/dto';
import { convert } from '../../../common/helpers';
```

### Barrel Exports

Cada subdirectorio tiene `index.ts` que exporta todo:

```typescript
// Usar exports del index
import { convert, formatNumber, verifyEmail } from 'src/common/helpers';

// En vez de
import { convert } from 'src/common/helpers/dates.helper';
import { formatNumber } from 'src/common/helpers/format.number';
```

---

## Tabla Resumen de Funciones

| Categoría | Función | Uso Principal | Frecuencia |
|-----------|---------|---------------|------------|
| **Paginación** | `PaginationDto` | Query params de listados | Muy Alta |
| **Paginación** | `PaginatedResult<T>` | Respuesta de listados | Muy Alta |
| **Fechas** | `convert()` | Display formato YYYY-MM-DD | Alta |
| **Fechas** | `convertWithTime()` | Display con hora local | Media |
| **Fechas** | `convertToUTC()` | Queries con rango de fechas | Alta |
| **Números** | `formatNumber()` | Display de precios/cantidades | Alta |
| **Números** | `formatNumberDecimal()` | Cálculos precisos | Media |
| **Números** | `NumeroALetras()` | Facturas, cheques | Baja |
| **Validación** | `verifyEmail()` | Validar emails | Media |
| **Texto** | `eliminarGuionesYEspacios()` | Normalizar DUI/NIT/teléfono | Media |
| **Constantes** | `FORMAT_FECHA_*` | Validación de fechas | Media |
| **Constantes** | `HEADER_API_BEARER_AUTH` | Swagger config | Baja |
| **Interceptores** | `TransformInterceptor` | Respuestas (automático) | Muy Alta |
| **Interceptores** | `TimeOutIntersector` | Timeout protection | Baja |
| **Filtros** | `AllExceptionFilter` | Manejo de errores | Baja |

---

## Mejores Prácticas

### 1. Paginación
- **Siempre** usar `PaginationDto` para listados
- **Siempre** retornar `PaginatedResult<T>`
- Incluir `search` para filtrado básico
- Usar `skip` y `take` de Prisma

### 2. Fechas
- **Display:** `convert()` o `convertWithTime()`
- **Queries:** `convertToUTC()` con "inicio"/"fin"
- **Recordar:** El Salvador es UTC-6
- **PDFs:** Siempre formatear fechas

### 3. Números
- **Display:** `formatNumber(value, 2)`
- **Cálculos:** `formatNumberDecimal(value, 5)`
- **Montos en letras:** `NumeroALetras()`
- **Manejar null/undefined:** Helpers ya lo hacen

### 4. Validación
- **Emails:** Usar `@IsEmail()` de class-validator (preferido) o `verifyEmail()`
- **Fechas:** Usar `FORMAT_FECHA_*` con `@Matches()`
- **Normalización:** `eliminarGuionesYEspacios()` antes de guardar

### 5. Respuestas
- `TransformInterceptor` está global - todas las respuestas se envuelven
- No necesitas wrappear manualmente
- Estructura siempre: `{ data, status, msg }`

### 6. Manejo de Errores
- Usar excepciones estándar de NestJS
- `AllExceptionFilter` disponible pero no global
- Considerar habilitarlo globalmente para consistencia

---

## Módulos que Usan Common

**Todos los módulos usan common**, especialmente:

| Módulo | Uso Principal |
|--------|---------------|
| `inventario/*` | Paginación, fechas, formateo de números |
| `atencion-al-cliente/*` | Paginación, fechas, emails |
| `administracion/*` | Paginación, validación emails, normalización |
| `auth` | Constantes (Bearer header) |
| Todos | TransformInterceptor (automático) |

---

## Notas de Implementación

1. **Typo en directorio:** `intersectors` debería ser `interceptors` - considerar renombrar
2. **TransformInterceptor es global:** Todas las respuestas se transforman automáticamente
3. **Timezone hardcoded:** El Salvador (UTC-6) - si se internacionaliza, refactorizar helpers de fecha
4. **Zipkin comentado:** Si se necesita tracing, descomentar y configurar
5. **Null safety:** Todos los helpers manejan null/undefined defensivamente
6. **Regex de fechas:** Soportan años bisiestos correctamente
7. **Barrel exports:** Mantener `index.ts` actualizados al agregar nuevos helpers
8. **Testing:** Considerar tests unitarios para helpers matemáticos/validación
