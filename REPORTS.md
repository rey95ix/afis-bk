# 📄 Guía de Generación de Reportes PDF con jsReport

Esta guía documenta el proceso completo para crear reportes en PDF usando jsReport en el backend de NestJS.

## 📋 Tabla de Contenidos

- [Arquitectura](#arquitectura)
- [Configuración Inicial](#configuración-inicial)
- [Estructura de Carpetas](#estructura-de-carpetas)
- [Crear un Nuevo Reporte - Paso a Paso](#crear-un-nuevo-reporte---paso-a-paso)
- [Ejemplo Completo: Reporte de Requisición](#ejemplo-completo-reporte-de-requisición)
- [Plantillas HTML con jsRender](#plantillas-html-con-jsrender)
- [Mejores Prácticas](#mejores-prácticas)
- [Troubleshooting](#troubleshooting)

---

## 🏗️ Arquitectura

El sistema de generación de reportes utiliza:

- **jsReport**: Servicio externo para renderizar plantillas HTML a PDF
- **jsRender**: Motor de plantillas para datos dinámicos
- **Axios**: Cliente HTTP para comunicación con jsReport
- **Express Response**: Para enviar archivos PDF al cliente

### Flujo de Datos

```
Cliente (Angular)
    ↓
    GET /modulo/entidad/:id/pdf
    ↓
Controlador NestJS
    ↓
Servicio NestJS
    ↓
    1. Obtiene datos de BD (Prisma)
    ↓
    2. Lee plantilla HTML
    ↓
    3. Prepara datos para plantilla
    ↓
    4. Envía a jsReport API
    ↓
    5. Recibe PDF (Buffer)
    ↓
Cliente recibe PDF y lo abre en navegador
```

---

## ⚙️ Configuración Inicial

### 1. Variables de Entorno

Agregar en `.env`:

```bash
# jsReport Configuration
API_REPORT=https://reports.edal.group/api/report
```

### 2. Dependencias Necesarias

```bash
npm install axios
```

Tipos de TypeScript (ya incluidos):
- `fs` (nativo de Node.js)
- `path` (nativo de Node.js)
- `express` (para tipos Response)

---

## 📁 Estructura de Carpetas

```
afis-backend-nestjs/
├── templates/                    # Plantillas HTML para reportes (EN LA RAÍZ)
│   ├── inventario/
│   │   ├── requisicion.html     # Plantilla de requisición
│   │   └── existencias-inventario.html  # Plantilla de existencias
│   ├── ventas/
│   │   └── factura.html         # Ejemplo: plantilla de factura
│   └── compras/
│       └── orden-compra.html    # Ejemplo: plantilla de orden de compra
│
└── src/
    └── modules/
        └── inventario/
            └── requisiciones/
                ├── requisiciones.controller.ts   # Endpoint GET /:id/pdf
                └── requisiciones.service.ts      # Método generatePdf()
```

**Convención de nombres:**
- Carpetas: nombre del módulo en minúsculas
- Archivos: nombre-de-entidad.html (kebab-case)

**⚠️ IMPORTANTE:**
- Los templates están en la **RAÍZ del proyecto**, NO en `src/templates/`
- Esto evita problemas con el build y el Dockerfile
- La carpeta `templates/` debe estar al mismo nivel que `src/`, `dist/`, `package.json`, etc.

---

## 🚀 Crear un Nuevo Reporte - Paso a Paso

### Paso 1: Crear la Plantilla HTML

**Ubicación:** `templates/{modulo}/{entidad}.html` **(en la raíz del proyecto)**

```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>{{:titulo}}</title>
    <style>
        /* Estilos CSS para el reporte */
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
        }
        .header {
            text-align: center;
            margin-bottom: 20px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>{{:titulo}}</h1>
    </div>

    <!-- Contenido dinámico con jsRender -->
    <table>
        <thead>
            <tr>
                <th>Columna 1</th>
                <th>Columna 2</th>
            </tr>
        </thead>
        <tbody>
            {{for items}}
            <tr>
                <td>{{:nombre}}</td>
                <td>{{:valor}}</td>
            </tr>
            {{/for}}
        </tbody>
    </table>
</body>
</html>
```

### Paso 2: Agregar Método en el Servicio

**Archivo:** `src/modules/{modulo}/{entidad}/{entidad}.service.ts`

```typescript
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

@Injectable()
export class EntidadService {

  /**
   * Genera un PDF de la entidad usando jsReport
   * @param id ID de la entidad
   * @returns Buffer con el PDF generado
   */
  async generatePdf(id: number): Promise<Buffer> {
    // 1. Obtener datos de la base de datos
    const entidad = await this.findOne(id);

    // 2. Leer plantilla HTML
    const templatePath = path.join(
      process.cwd(),
      'templates/{modulo}/{entidad}.html'
    );

    if (!fs.existsSync(templatePath)) {
      throw new NotFoundException('Plantilla de reporte no encontrada');
    }

    const templateHtml = fs.readFileSync(templatePath, 'utf-8');

    // 3. Preparar datos para la plantilla
    const templateData = {
      titulo: 'Título del Reporte',
      fecha: new Date().toLocaleDateString('es-SV'),
      ...entidad, // Spread de datos de la entidad
      // Agregar campos calculados o formateados
      items: entidad.items.map(item => ({
        ...item,
        // Formatear datos si es necesario
      }))
    };

    // 4. Configurar petición a jsReport
    const API_REPORT = process.env.API_REPORT || 'https://reports.edal.group/api/report';

    try {
      const response = await axios.post(
        API_REPORT,
        {
          template: {
            content: templateHtml,
            engine: 'jsrender',      // Motor de plantillas
            recipe: 'chrome-pdf',     // Tipo de salida
          },
          data: templateData,
          options: {
            reportName: `Entidad_${entidad.codigo}`,
          },
        },
        {
          responseType: 'arraybuffer',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return Buffer.from(response.data);
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new BadRequestException('Error al generar el PDF');
    }
  }
}
```

### Paso 3: Crear Endpoint en el Controlador

**Archivo:** `src/modules/{modulo}/{entidad}/{entidad}.controller.ts`

```typescript
import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Entidad')
@Controller('modulo/entidad')
export class EntidadController {
  constructor(private readonly entidadService: EntidadService) {}

  @Get(':id/pdf')
  @ApiOperation({
    summary: 'Generar PDF de la entidad',
    description: 'Genera un documento PDF con los detalles de la entidad.',
  })
  @ApiResponse({
    status: 200,
    description: 'PDF generado exitosamente.',
    content: {
      'application/pdf': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Entidad no encontrada.' })
  @ApiResponse({ status: 400, description: 'Error al generar el PDF.' })
  async generatePdf(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.entidadService.generatePdf(id);

    // inline = abrir en navegador, attachment = descargar
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Entidad_${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }
}
```

### Paso 4: Integración en el Frontend (Angular)

**Servicio Frontend:**

```typescript
// src/app/shared/services/entidad.service.ts

openPdf(id: number, codigo: string): void {
  this.http.get(`${this.apiUrl}/${id}/pdf`, {
    responseType: 'blob',
    observe: 'response'
  }).subscribe({
    next: (response) => {
      const blob = new Blob([response.body!], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);

      // Abrir en nueva pestaña
      const newWindow = window.open(url, '_blank');

      if (!newWindow) {
        // Fallback: descargar si el popup fue bloqueado
        const link = document.createElement('a');
        link.href = url;
        link.download = `Entidad_${codigo}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 100);
    },
    error: (error) => {
      console.error('Error al abrir PDF:', error);
      throw error;
    }
  });
}
```

**Componente Frontend:**

```typescript
// Método en el componente
verPdf(entidad: Entidad): void {
  Swal.fire({
    title: 'Generando PDF',
    text: 'Por favor espere...',
    icon: 'info',
    allowOutsideClick: false,
    showConfirmButton: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    this.entidadService.openPdf(entidad.id, entidad.codigo);

    setTimeout(() => {
      Swal.close();
    }, 1000);
  } catch (error) {
    Swal.fire('Error', 'Error al generar el PDF', 'error');
  }
}
```

---

## 📝 Ejemplo Completo: Reporte de Requisición

### Plantilla HTML

**Ubicación:** `templates/inventario/requisicion.html` **(en la raíz del proyecto)**

```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Requisición {{:codigo}}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 11px;
            padding: 20px;
        }
        .header {
            text-align: center;
            margin-bottom: 25px;
            border-bottom: 3px solid #2c3e50;
            padding-bottom: 15px;
        }
        .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 3px;
            font-weight: 600;
        }
        .badge.aprobada {
            background-color: #d1ecf1;
            color: #0c5460;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>REQUISICIÓN DE INVENTARIO</h1>
    </div>

    <div>
        <strong>Código:</strong> {{:codigo}}<br>
        <strong>Estado:</strong>
        <span class="badge {{:estadoClass}}">{{:estado}}</span>
    </div>

    <h3>Detalle de Productos</h3>
    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Producto</th>
                <th>Cantidad</th>
            </tr>
        </thead>
        <tbody>
            {{for detalle}}
            <tr>
                <td>{{:#index + 1}}</td>
                <td>{{:catalogo.nombre}}</td>
                <td>{{:cantidad_solicitada}}</td>
            </tr>
            {{/for}}
        </tbody>
    </table>
</body>
</html>
```

### Servicio Backend

**Ubicación:** `src/modules/inventario/requisiciones/requisiciones.service.ts`

```typescript
async generatePdf(id: number): Promise<Buffer> {
  const requisicion = await this.findOne(id);

  const templatePath = path.join(
    process.cwd(),
    'templates/inventario/requisicion.html'
  );

  if (!fs.existsSync(templatePath)) {
    throw new NotFoundException('Plantilla de reporte no encontrada');
  }

  const templateHtml = fs.readFileSync(templatePath, 'utf-8');

  // Formatear fechas
  const formatDate = (date: Date | null): string => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('es-SV', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const ESTADO_CLASS = {
    PENDIENTE: 'pendiente',
    APROBADA: 'aprobada',
    RECHAZADA: 'rechazada',
  };

  const templateData = {
    ...requisicion,
    estadoClass: ESTADO_CLASS[requisicion.estado] || 'pendiente',
    fechaCreacion: formatDate(requisicion.fecha_creacion),
  };

  const API_REPORT = process.env.API_REPORT;

  try {
    const response = await axios.post(
      API_REPORT,
      {
        template: {
          content: templateHtml,
          engine: 'jsrender',
          recipe: 'chrome-pdf',
        },
        data: templateData,
      },
      {
        responseType: 'arraybuffer',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return Buffer.from(response.data);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new BadRequestException('Error al generar el PDF');
  }
}
```

---

## 🎨 Plantillas HTML con jsRender

### Sintaxis Básica de jsRender

#### 1. Interpolación de Variables

```html
{{:nombreVariable}}
```

#### 2. Condicionales

```html
{{if condicion}}
    <p>Contenido si es verdadero</p>
{{else}}
    <p>Contenido si es falso</p>
{{/if}}
```

Ejemplo:
```html
{{if usuario_autoriza}}
    <div>Autorizado por: {{:usuario_autoriza.nombres}}</div>
{{/if}}
```

#### 3. Bucles

```html
{{for items}}
    <tr>
        <td>{{:#index + 1}}</td>
        <td>{{:nombre}}</td>
    </tr>
{{/for}}
```

Variables especiales en bucles:
- `#index` - Índice del elemento (base 0)
- `#data` - Elemento actual
- `~root` - Acceso a datos raíz

#### 4. Acceso a Datos Raíz

Desde dentro de un bucle:
```html
{{for detalle}}
    {{if ~root.mostrarAutorizada}}
        <td>{{:cantidad_autorizada}}</td>
    {{/if}}
{{/for}}
```

### Estilos CSS Recomendados

```css
/* Reset básico */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-size: 11px;
    line-height: 1.4;
    color: #333;
    padding: 20px;
}

/* Tablas */
table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 15px;
}

table thead {
    background-color: #2c3e50;
    color: white;
}

table th,
table td {
    padding: 8px;
    text-align: left;
    border: 1px solid #ddd;
}

table tbody tr:nth-child(even) {
    background-color: #f9f9f9;
}

/* Badges */
.badge {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
}

/* Clases de utilidad */
.text-center { text-align: center; }
.text-right { text-align: right; }

/* Impresión */
@media print {
    body {
        padding: 10px;
    }
}
```

---

## ✅ Mejores Prácticas

### 1. Organización de Plantillas

- **Una plantilla por archivo**: No combinar múltiples reportes en un archivo
- **Estilos inline**: Usar `<style>` dentro del `<head>` para portabilidad
- **Nombres descriptivos**: `factura.html`, `orden-compra.html`, etc.

### 2. Preparación de Datos

```typescript
// ✅ BUENO: Preparar datos antes de enviar a jsReport
const templateData = {
  ...entidad,
  fechaFormateada: formatDate(entidad.fecha),
  totalFormateado: formatCurrency(entidad.total),
  items: entidad.items.map(item => ({
    ...item,
    subtotal: item.cantidad * item.precio
  }))
};

// ❌ MALO: Enviar datos sin formatear
const templateData = entidad;
```

### 3. Manejo de Errores

```typescript
try {
  const response = await axios.post(API_REPORT, payload, config);
  return Buffer.from(response.data);
} catch (error) {
  // Registrar error detallado para debugging
  console.error('Error generating PDF:', {
    message: error.message,
    response: error.response?.data,
    status: error.response?.status
  });

  throw new BadRequestException(
    'Error al generar el PDF. Por favor intente nuevamente.'
  );
}
```

### 4. Performance

- **Cachear plantillas**: Si la plantilla es estática, leerla una sola vez
- **Limitar datos**: Solo enviar datos necesarios para el reporte
- **Timeout**: Configurar timeout apropiado para axios

```typescript
const response = await axios.post(
  API_REPORT,
  payload,
  {
    responseType: 'arraybuffer',
    timeout: 30000, // 30 segundos
    headers: {
      'Content-Type': 'application/json',
    },
  }
);
```

### 5. Seguridad

- **Validar ID**: Usar `ParseIntPipe` en controladores
- **Autenticación**: Proteger endpoints con guards
- **Sanitizar datos**: Escapar HTML en datos dinámicos

```typescript
@Get(':id/pdf')
@Auth() // Guard de autenticación
async generatePdf(
  @Param('id', ParseIntPipe) id: number,
  @GetUser('id_usuario') id_usuario: number,
  @Res() res: Response,
) {
  // Verificar permisos si es necesario
  const pdfBuffer = await this.service.generatePdf(id);
  // ...
}
```

---

## 🔧 Troubleshooting

### Error: "Plantilla de reporte no encontrada"

**Causa:** La ruta al archivo de plantilla es incorrecta.

**Solución:**
```typescript
// Usar process.cwd() que apunta a la raíz del proyecto
const templatePath = path.join(
  process.cwd(),
  'templates/modulo/archivo.html'
);

// Debug: Imprimir la ruta
console.log('Template path:', templatePath);
console.log('Exists:', fs.existsSync(templatePath));
console.log('Current working directory:', process.cwd());
```

**Nota:** Usar `process.cwd()` en lugar de `__dirname` porque los templates están en la raíz del proyecto, no dentro de `src/`. Esto funciona tanto en desarrollo como en producción.

### Error: Axios timeout

**Causa:** jsReport tarda demasiado en generar el PDF.

**Solución:**
```typescript
const response = await axios.post(
  API_REPORT,
  payload,
  {
    responseType: 'arraybuffer',
    timeout: 60000, // Aumentar timeout a 60 segundos
    headers: {
      'Content-Type': 'application/json',
    },
  }
);
```

### PDF se descarga en lugar de abrirse

**Causa:** Header `Content-Disposition` está configurado como `attachment`.

**Solución:**
```typescript
res.set({
  'Content-Type': 'application/pdf',
  'Content-Disposition': `inline; filename="reporte.pdf"`, // ← inline
  'Content-Length': pdfBuffer.length,
});
```

### Datos no aparecen en la plantilla

**Causa:** Sintaxis incorrecta de jsRender o datos mal estructurados.

**Solución:**
```typescript
// 1. Verificar estructura de datos
console.log('Template data:', JSON.stringify(templateData, null, 2));

// 2. Verificar sintaxis en plantilla
// ✅ Correcto
{{:campo}}

// ❌ Incorrecto
{campo}
{{campo}}
```

### Error de tipos TypeScript con Response

**Causa:** Import incorrecto del tipo `Response` de Express.

**Solución:**
```typescript
// ✅ Correcto
import type { Response } from 'express';

// ❌ Incorrecto
import { Response } from 'express';
```

---

## 📚 Recursos Adicionales

- [Documentación de jsReport](https://jsreport.net/learn)
- [Sintaxis de jsRender](https://www.jsviews.com/#jsrender)
- [NestJS File Upload/Download](https://docs.nestjs.com/techniques/file-upload)
- [Axios Documentation](https://axios-http.com/docs/intro)

---

## 📞 Contacto y Soporte

Para dudas o problemas con la generación de reportes, contactar al equipo de desarrollo.

---

**Última actualización:** 2025-01-08
