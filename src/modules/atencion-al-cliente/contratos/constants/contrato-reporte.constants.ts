/**
 * Columnas para el Reporte de Ventas (contratos nuevos)
 */
export const COLUMNAS_REPORTE_VENTAS = [
  { key: 'estado', header: 'Estado', width: 22 },
  { key: 'cliente', header: 'Cliente', width: 30 },
  { key: 'colonia', header: 'Colonia', width: 25 },
  { key: 'plan', header: 'Plan', width: 20 },
  { key: 'mesesContrato', header: 'Meses contrato', width: 16 },
  { key: 'precio', header: 'Precio $', width: 12 },
  { key: 'bajadaMbps', header: 'Bajada Mbps', width: 14 },
  { key: 'subidaMbps', header: 'Subida Mbps', width: 14 },
  { key: 'venta', header: 'Venta', width: 14 },
  { key: 'instalacion', header: 'Instalación', width: 14 },
  { key: 'agente', header: 'Agente', width: 25 },
  { key: 'activo', header: 'Activo', width: 10 },
];

/**
 * Columnas para el Reporte de Renovaciones
 */
export const COLUMNAS_REPORTE_RENOVACIONES = [
  { key: 'estado', header: 'Estado', width: 22 },
  { key: 'cliente', header: 'Cliente', width: 30 },
  { key: 'colonia', header: 'Colonia', width: 25 },
  { key: 'planAntiguo', header: 'Plan antiguo', width: 20 },
  { key: 'precioAntiguo', header: 'Precio antiguo $', width: 16 },
  { key: 'planNuevo', header: 'Plan nuevo', width: 20 },
  { key: 'precioNuevo', header: 'Precio nuevo $', width: 16 },
  { key: 'finContAntiguo', header: 'Finalización contrato antiguo', width: 28 },
  { key: 'fecha', header: 'Fecha', width: 14 },
  { key: 'agente', header: 'Agente', width: 25 },
  { key: 'activo', header: 'Activo', width: 10 },
];

/**
 * Estilos para encabezados de Excel
 */
export const EXCEL_HEADER_STYLE = {
  font: { bold: true, color: { argb: 'FFFFFFFF' } },
  fill: {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: 'FF2E7D32' },
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
 * Estilos para celdas numéricas
 */
export const EXCEL_NUMBER_STYLE = {
  alignment: { horizontal: 'right' as const },
  numFmt: '#,##0.00',
};
