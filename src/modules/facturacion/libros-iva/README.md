# Módulo de Libros de IVA

Este módulo implementa los reportes de Libros de IVA requeridos por el Ministerio de Hacienda de El Salvador para la declaración F-07.

## Libros Implementados

| Anexo | Nombre | Tipo DTE | Código DTE |
|-------|--------|----------|------------|
| Anexo 1 | Ventas a Contribuyentes | CCF | 03 |
| Anexo 2 | Ventas a Consumidor Final | Factura | 01 |
| Anexo 5 | Ventas a Sujeto Excluido | FSE | 14 |

## Endpoints

### GET /facturacion/libros-iva
Obtiene los datos del libro de IVA con paginación.

**Parámetros:**
- `tipo_libro` (requerido): `ANEXO_1` | `ANEXO_2` | `ANEXO_5`
- `fecha_inicio` (requerido): Fecha inicio del período (YYYY-MM-DD)
- `fecha_fin` (requerido): Fecha fin del período (YYYY-MM-DD)
- `id_sucursal` (opcional): Filtrar por sucursal
- `solo_procesados` (opcional, default: true): Solo DTEs procesados por MH
- `page` (opcional, default: 1): Página
- `limit` (opcional, default: 50): Registros por página

**Ejemplo:**
```bash
curl "http://localhost:4000/facturacion/libros-iva?tipo_libro=ANEXO_1&fecha_inicio=2024-01-01&fecha_fin=2024-01-31"
```

### GET /facturacion/libros-iva/resumen
Obtiene el resumen consolidado (totales) del período.

### GET /facturacion/libros-iva/excel
Descarga el libro de IVA en formato Excel (.xlsx).

### GET /facturacion/libros-iva/pdf
Descarga el libro de IVA en formato PDF.

## Estructura de Columnas

### Anexo 1 - Ventas a Contribuyentes (CCF)

| Columna | Campo | Descripción |
|---------|-------|-------------|
| A | Fecha Emisión | DD/MM/AAAA |
| B | Clase Documento | "4" (DTE) |
| C | Tipo Documento | "03" (CCF) |
| D | No. Resolución | numero_control |
| E | No. Serie | sello_recepcion |
| F | No. Documento | codigo_generacion |
| G | Control Interno | Vacío para DTEs |
| H | NIT/NRC | cliente_nit o cliente_nrc |
| I | Nombre | cliente_nombre (mayúsculas) |
| J | Ventas Exentas | totalExenta |
| K | Ventas No Sujetas | totalNoSuj |
| L | Ventas Gravadas | totalGravada |
| M | Débito Fiscal | iva |
| N | Ventas Terceros | 0 |
| O | Débito Terceros | 0 |
| P | Total Ventas | total |
| Q | DUI Cliente | Vacío para CCF |
| R | Tipo Operación | 1-4 (calculado) |
| S | Tipo Ingreso | 2 (servicios) |
| T | No. Anexo | "1" |

### Anexo 2 - Ventas a Consumidor Final (Factura)

| Columna | Campo | Descripción |
|---------|-------|-------------|
| A | Fecha | fecha_creacion |
| B | Clase Doc | "4" |
| C | Tipo Doc | "01" |
| D | Resolución | numero_control |
| E/F | Serie DEL/AL | sello_recepcion |
| G/H | No. Doc DEL/AL | codigo_generacion |
| I | Máquina | Vacío |
| J | Exentas | totalExenta |
| K | No Sujetas | totalNoSuj |
| L | Gravadas | totalGravada |
| M-O | Exportaciones | 0 |
| P | Zonas Francas | 0 |
| Q | Total | total |
| R | No. Anexo | "2" |

### Anexo 5 - Ventas a Sujeto Excluido (FSE)

| Columna | Campo | Descripción |
|---------|-------|-------------|
| A | Fecha | fecha_creacion |
| B | Clase Doc | "4" |
| C | Tipo Doc | "14" |
| D | Resolución | numero_control |
| E | Serie | sello_recepcion |
| F | No. Documento | codigo_generacion |
| G | Control Interno | Vacío |
| H | DUI/NIT | cliente_nit |
| I | Nombre | cliente_nombre |
| J | Monto Compra | totalGravada |
| K | IVA Retenido | iva_retenido |
| L | Total | total |
| M | No. Anexo | "5" |

## Tipo de Operación (Columna R - Anexo 1)

| Valor | Descripción | Condición |
|-------|-------------|-----------|
| 1 | Gravadas | Solo totalGravada > 0 |
| 2 | Exentas | Solo totalExenta > 0 |
| 3 | No Sujetas | Solo totalNoSuj > 0 |
| 4 | Mixtas | Combinación de tipos |

## Permisos Requeridos

- `facturacion.libros_iva:ver` - Ver y consultar libros
- `facturacion.libros_iva:exportar` - Exportar a Excel/PDF

## Dependencias

- **ExcelJS**: Generación de archivos Excel
- **jsReport**: Generación de PDFs (API externa)
- **Prisma**: ORM para consultas a BD

## Archivos

```
libros-iva/
├── index.ts
├── libros-iva.module.ts
├── libros-iva.controller.ts
├── libros-iva.service.ts
├── libros-iva-excel.service.ts
├── libros-iva-pdf.service.ts
├── dto/
│   ├── index.ts
│   ├── query-libro-iva.dto.ts
│   ├── libro-iva-anexo1.dto.ts
│   ├── libro-iva-anexo2.dto.ts
│   └── libro-iva-anexo5.dto.ts
├── constants/
│   └── libro-iva.constants.ts
└── README.md

templates/libros-iva/
├── libro-iva-anexo1.html
├── libro-iva-anexo2.html
└── libro-iva-anexo5.html
```

## Notas Importantes

1. Los montos nunca quedan vacíos, siempre se muestra "0.00"
2. Solo se incluyen DTEs en estado PROCESADO por defecto
3. Se excluyen facturas con estado ANULADO
4. Las fechas se formatean DD/MM/AAAA para visualización
5. El Total Ventas (columna P en Anexo 1) INCLUYE el IVA
6. Para exportación se obtienen TODOS los registros (sin paginación)
