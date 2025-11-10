# 📊 Guía de Generación de Reportes Excel con ExcelJS

Esta guía documenta el proceso completo para crear reportes en formato Excel (.xlsx) usando ExcelJS en el backend de NestJS.

## 📋 Tabla de Contenidos

- [Arquitectura](#arquitectura)
- [Configuración Inicial](#configuración-inicial)
- [Crear un Nuevo Reporte Excel - Paso a Paso](#crear-un-nuevo-reporte-excel---paso-a-paso)
- [Ejemplo Completo: Reporte de Existencias](#ejemplo-completo-reporte-de-existencias)
- [Estilos y Formato](#estilos-y-formato)
- [Mejores Prácticas](#mejores-prácticas)
- [Troubleshooting](#troubleshooting)

---

## 🏗️ Arquitectura

El sistema de generación de reportes Excel utiliza:

- **ExcelJS**: Librería para crear y manipular archivos Excel
- **Express Response**: Para enviar archivos Excel al cliente
- **Buffer**: Para manejo eficiente de archivos en memoria

### Flujo de Datos

```
Cliente (Angular)
    ↓
    GET /modulo/entidad/excel
    ↓
Controlador NestJS
    ↓
Servicio NestJS
    ↓
    1. Obtiene datos de BD (Prisma)
    ↓
    2. Crea workbook con ExcelJS
    ↓
    3. Crea hojas (worksheets)
    ↓
    4. Aplica estilos y formato
    ↓
    5. Genera Buffer del archivo
    ↓
Cliente recibe Excel y lo descarga
```

---

## ⚙️ Configuración Inicial

### 1. Instalar Dependencias

```bash
npm install exceljs
```

### 2. Tipos de TypeScript

ExcelJS incluye sus propios tipos TypeScript, no se necesita instalar `@types/exceljs`.

---

## 🚀 Crear un Nuevo Reporte Excel - Paso a Paso

### Paso 1: Importar ExcelJS en el Servicio

**Archivo:** `src/modules/{modulo}/{entidad}/{entidad}.service.ts`

```typescript
import * as ExcelJS from 'exceljs';
```

### Paso 2: Agregar Método en el Servicio

```typescript
@Injectable()
export class EntidadService {

  /**
   * Genera un archivo Excel con datos de la entidad
   * @returns Buffer con el archivo Excel generado
   */
  async generateExcel(): Promise<Buffer> {
    // 1. Obtener datos de la base de datos
    const datos = await this.obtenerDatos();

    // 2. Crear workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema de Inventario';
    workbook.created = new Date();
    workbook.modified = new Date();

    // 3. Crear hoja de trabajo
    const sheet = workbook.addWorksheet('Datos', {
      properties: { tabColor: { argb: '3498db' } },
    });

    // 4. Definir columnas
    sheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Nombre', key: 'nombre', width: 30 },
      { header: 'Cantidad', key: 'cantidad', width: 15 },
    ];

    // 5. Estilo del header
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '2c3e50' },
    };
    sheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 25;

    // 6. Agregar datos
    datos.forEach((item) => {
      sheet.addRow({
        id: item.id,
        nombre: item.nombre,
        cantidad: item.cantidad,
      });
    });

    // 7. Aplicar bordes a todas las celdas
    sheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });

      // Alternar color de fondo en filas
      if (rowNumber > 1 && rowNumber % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'f8f9fa' },
        };
      }
    });

    // 8. Generar buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
```

### Paso 3: Crear Endpoint en el Controlador

**Archivo:** `src/modules/{modulo}/{entidad}/{entidad}.controller.ts`

```typescript
import {
  Controller,
  Get,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('Módulo')
@Controller('modulo/entidad')
export class EntidadController {
  constructor(private readonly entidadService: EntidadService) {}

  @Get('excel')
  @ApiOperation({
    summary: 'Generar Excel de datos',
    description: 'Genera un archivo Excel con los datos de la entidad.',
  })
  @ApiResponse({
    status: 200,
    description: 'Excel generado exitosamente.',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Error al generar el Excel.' })
  async generateExcel(@Res() res: Response) {
    const excelBuffer = await this.entidadService.generateExcel();

    const fileName = `Reporte_${new Date().getTime()}.xlsx`;

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': excelBuffer.length,
    });

    res.end(excelBuffer);
  }
}
```

### Paso 4: Integración en el Frontend (Angular)

**Servicio Frontend:**

```typescript
// src/app/shared/services/entidad.service.ts

downloadExcel(): void {
  this.http.get(`${this.apiUrl}/excel`, {
    responseType: 'blob',
    observe: 'response'
  }).subscribe({
    next: (response) => {
      const blob = new Blob([response.body!], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);

      // Descargar archivo
      const link = document.createElement('a');
      link.href = url;

      // Extraer nombre del header si está disponible
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `Reporte_${new Date().getTime()}.xlsx`;
      if (contentDisposition) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(contentDisposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 100);
    },
    error: (error) => {
      console.error('Error al descargar Excel:', error);
      throw error;
    }
  });
}
```

**Componente Frontend:**

```typescript
// Método en el componente
descargarExcel(): void {
  Swal.fire({
    title: 'Generando Excel',
    text: 'Por favor espere mientras se genera el archivo...',
    icon: 'info',
    allowOutsideClick: false,
    showConfirmButton: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    this.entidadService.downloadExcel();

    setTimeout(() => {
      Swal.fire({
        title: 'Éxito',
        text: 'El archivo Excel se ha descargado correctamente.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    }, 1500);
  } catch (error) {
    Swal.fire('Error', 'Error al generar el Excel', 'error');
  }
}
```

---

## 📝 Ejemplo Completo: Reporte de Existencias

### Servicio Backend

**Ubicación:** `src/modules/inventario/items-inventario/items-inventario.service.ts`

```typescript
async generateExistenciasExcel(): Promise<Buffer> {
  // 1. Obtener datos
  const distribucion = await this.getDistribucion();
  const alertas = await this.getAlertas();

  // 2. Crear workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Inventario';
  workbook.created = new Date();

  // 3. Crear hoja de resumen
  const sheetResumen = workbook.addWorksheet('Resumen General', {
    properties: { tabColor: { argb: '3498db' } },
  });

  // Header con merge de celdas
  sheetResumen.mergeCells('A1:D1');
  sheetResumen.getCell('A1').value = 'REPORTE DE EXISTENCIAS DE INVENTARIO';
  sheetResumen.getCell('A1').font = { size: 16, bold: true, color: { argb: '2c3e50' } };
  sheetResumen.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  sheetResumen.getRow(1).height = 30;

  // Tabla de métricas
  sheetResumen.addRow([]);
  sheetResumen.addRow(['Métrica', 'Valor']);
  sheetResumen.getRow(4).font = { bold: true, color: { argb: 'FFFFFF' } };
  sheetResumen.getRow(4).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '2c3e50' },
  };

  sheetResumen.addRow(['Total Items', distribucion.resumen_general.total_items]);
  sheetResumen.addRow(['Total Disponible', distribucion.resumen_general.total_disponible]);

  // 4. Crear hoja de distribución por bodega
  const sheetBodegas = workbook.addWorksheet('Distribución por Bodega');

  sheetBodegas.columns = [
    { header: '#', key: 'index', width: 8 },
    { header: 'Bodega', key: 'nombre_bodega', width: 30 },
    { header: 'Disponible', key: 'cantidad_disponible', width: 15 },
  ];

  distribucion.por_bodega.forEach((bodega, index) => {
    sheetBodegas.addRow({
      index: index + 1,
      nombre_bodega: bodega.nombre_bodega,
      cantidad_disponible: bodega.cantidad_disponible,
    });
  });

  // 5. Generar buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
```

---

## 🎨 Estilos y Formato

### Colores con ARGB

ExcelJS usa formato ARGB (Alpha, Red, Green, Blue) en hexadecimal:

```typescript
// Formato: ARGB (8 dígitos hexadecimales)
{ argb: 'FF2c3e50' }  // FF = opaco, 2c3e50 = color
{ argb: '2c3e50' }    // También acepta sin alpha (asume FF)
```

**Colores recomendados:**
```typescript
const COLORES = {
  PRIMARIO: '2c3e50',      // Azul oscuro
  EXITO: '27ae60',         // Verde
  ADVERTENCIA: 'f39c12',   // Naranja
  PELIGRO: 'e74c3c',       // Rojo
  INFO: '3498db',          // Azul
  SECUNDARIO: '95a5a6',    // Gris
  FONDO_CLARO: 'f8f9fa',   // Gris claro
  BLANCO: 'FFFFFF',
};
```

### Bordes

```typescript
cell.border = {
  top: { style: 'thin', color: { argb: '000000' } },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};

// Estilos disponibles:
// 'thin', 'medium', 'thick', 'double', 'dotted', 'dashed'
```

### Alineación

```typescript
cell.alignment = {
  horizontal: 'center',  // 'left', 'center', 'right', 'justify'
  vertical: 'middle',    // 'top', 'middle', 'bottom'
  wrapText: true,        // Ajustar texto
};
```

### Fuentes

```typescript
cell.font = {
  name: 'Calibri',
  size: 12,
  bold: true,
  italic: false,
  underline: false,
  color: { argb: 'FFFFFF' },
};
```

### Relleno (Fill)

```typescript
// Sólido
cell.fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: '2c3e50' },
};

// Degradado
cell.fill = {
  type: 'gradient',
  gradient: 'angle',
  degree: 45,
  stops: [
    { position: 0, color: { argb: '3498db' } },
    { position: 1, color: { argb: '2980b9' } },
  ],
};
```

### Merge de Celdas

```typescript
// Merge por rango
sheet.mergeCells('A1:D1');

// Merge por coordenadas (fila inicio, columna inicio, fila fin, columna fin)
sheet.mergeCells(1, 1, 1, 4);
```

### Altura y Ancho

```typescript
// Altura de fila
sheet.getRow(1).height = 30;

// Ancho de columna
sheet.getColumn(1).width = 20;
sheet.getColumn('A').width = 20;  // También por letra
```

---

## ✅ Mejores Prácticas

### 1. Estructura de Hojas Múltiples

```typescript
// Crear múltiples hojas con propósitos claros
const sheetResumen = workbook.addWorksheet('Resumen');
const sheetDetalle = workbook.addWorksheet('Detalle');
const sheetAlertas = workbook.addWorksheet('Alertas');

// Usar colores de pestañas para identificar
sheetResumen.properties.tabColor = { argb: '3498db' };  // Azul
sheetDetalle.properties.tabColor = { argb: '27ae60' };  // Verde
sheetAlertas.properties.tabColor = { argb: 'e74c3c' };  // Rojo
```

### 2. Formatear Datos Antes de Agregar

```typescript
// ✅ BUENO: Preparar datos con formato
const datos = items.map(item => ({
  codigo: item.codigo,
  nombre: item.nombre,
  cantidad: item.cantidad,
  fecha: new Date(item.fecha).toLocaleDateString('es-SV'),
  total: `$${item.total.toFixed(2)}`,
}));

datos.forEach(row => sheet.addRow(row));

// ❌ MALO: Datos sin formato
items.forEach(item => sheet.addRow(item));
```

### 3. Manejo de Datos Grandes

```typescript
// Para archivos grandes, usar streaming
const stream = await workbook.xlsx.write(writeStream);

// Para reportes normales, usar buffer
const buffer = await workbook.xlsx.writeBuffer();
```

### 4. Validación de Datos

```typescript
// Agregar validación a celdas
sheet.getCell('B2').dataValidation = {
  type: 'list',
  allowBlank: true,
  formulae: ['"ACTIVO,INACTIVO"'],
};
```

### 5. Fórmulas en Celdas

```typescript
// Agregar fórmulas
sheet.getCell('D10').value = { formula: 'SUM(D2:D9)' };

// Fórmula con resultado precalculado
sheet.getCell('D10').value = {
  formula: 'SUM(D2:D9)',
  result: 1234,
};
```

### 6. Protección de Hojas

```typescript
// Proteger hoja con contraseña
await sheet.protect('password123', {
  selectLockedCells: true,
  selectUnlockedCells: true,
});

// Desbloquear celdas específicas
sheet.getCell('A1').protection = {
  locked: false,
};
```

### 7. Congelar Paneles

```typescript
// Congelar primera fila (header)
sheet.views = [
  { state: 'frozen', xSplit: 0, ySplit: 1 }
];

// Congelar primera columna y primera fila
sheet.views = [
  { state: 'frozen', xSplit: 1, ySplit: 1 }
];
```

### 8. Auto-filtros

```typescript
// Agregar filtros a headers
sheet.autoFilter = 'A1:E1';

// Con rango específico
sheet.autoFilter = {
  from: 'A1',
  to: 'E1',
};
```

---

## 🔧 Troubleshooting

### Error: "Cannot read property 'xlsx' of undefined"

**Causa:** Importación incorrecta de ExcelJS.

**Solución:**
```typescript
// ✅ Correcto
import * as ExcelJS from 'exceljs';

// ❌ Incorrecto
import ExcelJS from 'exceljs';
import { Workbook } from 'exceljs';
```

### Error: "Buffer is not defined"

**Causa:** Intentar usar Buffer en navegador.

**Solución:** Buffer debe usarse solo en el backend. En el frontend, usa Blob:
```typescript
// Backend
return Buffer.from(buffer);

// Frontend
const blob = new Blob([response.body!], { type: 'application/...' });
```

### Archivo Excel descarga pero no se abre

**Causa:** Content-Type incorrecto.

**Solución:**
```typescript
res.set({
  'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'Content-Disposition': 'attachment; filename="reporte.xlsx"',
});
```

### Estilos no se aplican correctamente

**Causa:** Aplicar estilos después de agregar datos o formato ARGB incorrecto.

**Solución:**
```typescript
// Definir estilos del header ANTES de agregar datos
sheet.getRow(1).font = { bold: true };

// Usar formato ARGB correcto (6 u 8 dígitos hex)
{ argb: '2c3e50' }  // ✅
{ argb: '#2c3e50' } // ❌ No usar #
```

### Archivo muy pesado

**Causa:** Demasiados datos o estilos complejos.

**Solución:**
```typescript
// Limitar cantidad de registros
const datos = await this.getData();
const datosLimitados = datos.slice(0, 10000);

// Simplificar estilos
// En lugar de aplicar estilos celda por celda:
sheet.eachRow((row) => {
  row.eachCell((cell) => {
    // Aplicar estilo a toda la fila
  });
});
```

### Memoria insuficiente en archivos grandes

**Causa:** writeBuffer carga todo en memoria.

**Solución:**
```typescript
// Usar streaming para archivos grandes
import { createWriteStream } from 'fs';

const stream = createWriteStream('./reporte.xlsx');
await workbook.xlsx.write(stream);
```

---

## 📚 Recursos Adicionales

- [Documentación de ExcelJS](https://github.com/exceljs/exceljs)
- [ExcelJS API Reference](https://github.com/exceljs/exceljs#interface)
- [Ejemplos de ExcelJS](https://github.com/exceljs/exceljs/tree/master/spec)

---

## 🆚 Comparación: PDF vs Excel

| Característica | PDF | Excel |
|----------------|-----|-------|
| **Editable** | ❌ No | ✅ Sí |
| **Fórmulas** | ❌ No | ✅ Sí |
| **Tamaño** | Menor | Mayor |
| **Análisis de datos** | ❌ Limitado | ✅ Completo |
| **Presentación** | ✅ Mejor | Regular |
| **Impresión** | ✅ Mejor | Regular |
| **Uso recomendado** | Documentos oficiales | Análisis y reportes |

---

**Última actualización:** 2025-01-08
