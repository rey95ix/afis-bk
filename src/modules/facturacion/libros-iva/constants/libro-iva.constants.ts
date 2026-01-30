/**
 * Constantes para los Libros de IVA - Ministerio de Hacienda El Salvador
 */

/**
 * Columnas para el Excel del Anexo 1 (Ventas a Contribuyentes - CCF)
 */
export const COLUMNAS_ANEXO_1 = [
  { key: 'fila', header: '#', width: 6 },
  { key: 'fechaEmision', header: 'A - Fecha Emisión', width: 14 },
  { key: 'claseDocumento', header: 'B - Clase Doc', width: 10 },
  { key: 'tipoDocumento', header: 'C - Tipo Doc', width: 10 },
  { key: 'numeroResolucion', header: 'D - No. Resolución', width: 40 },
  { key: 'numeroSerie', header: 'E - No. Serie', width: 20 },
  { key: 'numeroDocumento', header: 'F - No. Documento', width: 38 },
  { key: 'controlInterno', header: 'G - Control Interno', width: 15 },
  { key: 'nitNrc', header: 'H - NIT/NRC', width: 18 },
  { key: 'nombreCliente', header: 'I - Nombre Cliente', width: 35 },
  { key: 'ventasExentas', header: 'J - Exentas', width: 12 },
  { key: 'ventasNoSujetas', header: 'K - No Sujetas', width: 12 },
  { key: 'ventasGravadas', header: 'L - Gravadas', width: 12 },
  { key: 'debitoFiscal', header: 'M - Débito Fiscal', width: 14 },
  { key: 'ventasTerceros', header: 'N - Ventas Terceros', width: 14 },
  { key: 'debitoTerceros', header: 'O - Débito Terceros', width: 14 },
  { key: 'totalVentas', header: 'P - Total Ventas', width: 14 },
  { key: 'duiCliente', header: 'Q - DUI', width: 12 },
  { key: 'tipoOperacion', header: 'R - Tipo Op.', width: 10 },
  { key: 'tipoIngreso', header: 'S - Tipo Ingreso', width: 12 },
  { key: 'numeroAnexo', header: 'T - No. Anexo', width: 10 },
];

/**
 * Columnas para el Excel del Anexo 2 (Ventas a Consumidor Final - Factura)
 */
export const COLUMNAS_ANEXO_2 = [
  { key: 'fila', header: '#', width: 6 },
  { key: 'fechaEmision', header: 'A - Fecha Emisión', width: 14 },
  { key: 'claseDocumento', header: 'B - Clase Doc', width: 10 },
  { key: 'tipoDocumento', header: 'C - Tipo Doc', width: 10 },
  { key: 'numeroResolucion', header: 'D - No. Resolución', width: 40 },
  { key: 'serieDel', header: 'E - Serie DEL', width: 20 },
  { key: 'serieAl', header: 'F - Serie AL', width: 20 },
  { key: 'numeroDocumentoDel', header: 'G - No. Doc DEL', width: 38 },
  { key: 'numeroDocumentoAl', header: 'H - No. Doc AL', width: 38 },
  { key: 'numeroMaquina', header: 'I - No. Máquina', width: 12 },
  { key: 'ventasExentas', header: 'J - Exentas', width: 12 },
  { key: 'ventasNoSujetas', header: 'K - No Sujetas', width: 12 },
  { key: 'ventasGravadas', header: 'L - Gravadas', width: 12 },
  { key: 'exportacionesCa', header: 'M - Export. CA', width: 12 },
  { key: 'exportacionesFueraCa', header: 'N - Export. Fuera CA', width: 14 },
  { key: 'exportacionesServicios', header: 'O - Export. Servicios', width: 14 },
  { key: 'ventasZonasFrancas', header: 'P - Zonas Francas', width: 14 },
  { key: 'totalVentas', header: 'Q - Total Ventas', width: 14 },
  { key: 'numeroAnexo', header: 'R - No. Anexo', width: 10 },
];

/**
 * Columnas para el Excel del Anexo 5 (Ventas a Sujeto Excluido - FSE)
 */
export const COLUMNAS_ANEXO_5 = [
  { key: 'fila', header: '#', width: 6 },
  { key: 'fechaEmision', header: 'A - Fecha Emisión', width: 14 },
  { key: 'claseDocumento', header: 'B - Clase Doc', width: 10 },
  { key: 'tipoDocumento', header: 'C - Tipo Doc', width: 10 },
  { key: 'numeroResolucion', header: 'D - No. Resolución', width: 40 },
  { key: 'numeroSerie', header: 'E - No. Serie', width: 20 },
  { key: 'numeroDocumento', header: 'F - No. Documento', width: 38 },
  { key: 'controlInterno', header: 'G - Control Interno', width: 15 },
  { key: 'duiNit', header: 'H - DUI/NIT', width: 15 },
  { key: 'nombreSujeto', header: 'I - Nombre Sujeto', width: 35 },
  { key: 'montoCompra', header: 'J - Monto Compra', width: 14 },
  { key: 'ivaRetenido', header: 'K - IVA Retenido', width: 14 },
  { key: 'total', header: 'L - Total', width: 14 },
  { key: 'numeroAnexo', header: 'M - No. Anexo', width: 10 },
];

/**
 * Tipos de operación según Ministerio de Hacienda
 * Se usa en Anexo 1 (columna R)
 */
export const TIPOS_OPERACION = {
  GRAVADAS: 1,      // Solo ventas gravadas
  EXENTAS: 2,       // Solo ventas exentas
  NO_SUJETAS: 3,    // Solo ventas no sujetas
  MIXTAS: 4,        // Combinación de tipos
};

/**
 * Tipos de ingreso según Ministerio de Hacienda
 * Se usa en Anexo 1 (columna S)
 */
export const TIPOS_INGRESO = {
  PRODUCTOS: 1,     // Venta de productos/bienes
  SERVICIOS: 2,     // Prestación de servicios
  ARRENDAMIENTO: 3, // Arrendamiento
  EXPORTACIONES: 4, // Exportaciones
  OTROS: 5,         // Otros ingresos
};

/**
 * Clase de documento - siempre "4" para DTE
 */
export const CLASE_DOCUMENTO_DTE = '4';

/**
 * Nombre de los anexos para títulos y encabezados
 */
export const NOMBRES_ANEXOS = {
  ANEXO_1: 'Anexo 1 - Libro de Ventas a Contribuyentes',
  ANEXO_2: 'Anexo 2 - Libro de Ventas a Consumidor Final',
  ANEXO_5: 'Anexo 5 - Libro de Compras a Sujetos Excluidos',
};

/**
 * Estilos para encabezados de Excel
 */
export const EXCEL_HEADER_STYLE = {
  font: { bold: true, color: { argb: 'FFFFFFFF' } },
  fill: {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: 'FF2E7D32' }, // Verde oscuro
  },
  alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
  border: {
    top: { style: 'thin' as const },
    left: { style: 'thin' as const },
    bottom: { style: 'thin' as const },
    right: { style: 'thin' as const },
  },
};

/**
 * Estilos para celdas numéricas de Excel
 */
export const EXCEL_NUMBER_STYLE = {
  alignment: { horizontal: 'right' as const },
  numFmt: '#,##0.00',
};

/**
 * Estilos para fila de totales de Excel
 */
export const EXCEL_TOTALS_STYLE = {
  font: { bold: true },
  fill: {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: 'FFE8F5E9' }, // Verde claro
  },
  border: {
    top: { style: 'double' as const },
    left: { style: 'thin' as const },
    bottom: { style: 'thin' as const },
    right: { style: 'thin' as const },
  },
};
