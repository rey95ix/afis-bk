/**
 * Interfaces base para Documentos Tributarios Electrónicos (DTE)
 * Basado en los JSON Schemas del Ministerio de Hacienda de El Salvador
 */

// ============= ENUMS Y TIPOS =============

export type TipoDte = '01' | '03' | '05' | '06' | '07' | '11' | '14';
export type Ambiente = '00' | '01'; // 00=Pruebas, 01=Producción
export type TipoModelo = 1 | 2; // 1=Previo, 2=Diferido
export type TipoOperacion = 1 | 2; // 1=Normal, 2=Contingencia
export type CondicionOperacion = 1 | 2 | 3; // 1=Contado, 2=Crédito, 3=Otro
export type TipoItem = 1 | 2 | 3 | 4; // 1=Bienes, 2=Servicios, 3=Ambos, 4=Tributo

// ============= ESTRUCTURAS COMUNES =============

export interface Direccion {
  departamento: string; // Código 2 dígitos
  municipio: string; // Código 2 dígitos
  complemento: string; // Dirección completa
}

export interface Pago {
  codigo: string; // Código forma de pago (CAT-017)
  montoPago: number;
  referencia?: string;
  plazo?: string; // Código plazo (CAT-018)
  periodo?: number; // Cantidad de períodos
}

export interface Tributo {
  codigo: string; // Código tributo (CAT-015)
  descripcion: string;
  valor: number;
}

// ============= IDENTIFICACIÓN =============

export interface DteIdentificacion {
  version: number;
  ambiente: Ambiente;
  tipoDte: TipoDte;
  numeroControl: string; // DTE-XX-YYYYYYYY-ZZZZZZZZZZZZZZZ
  codigoGeneracion: string; // UUID v4
  tipoModelo: TipoModelo;
  tipoOperacion: TipoOperacion;
  tipoContingencia: number | null;
  motivoContin: string | null;
  fecEmi: string; // YYYY-MM-DD
  horEmi: string; // HH:MM:SS
  tipoMoneda: string; // USD
}

// ============= EMISOR =============

export interface DteEmisor {
  nit: string;
  nrc: string;
  nombre: string;
  codActividad: string;
  descActividad: string;
  nombreComercial: string | null;
  tipoEstablecimiento: string;
  direccion: Direccion;
  telefono: string;
  codPuntoVentaMH: string | null;
  codPuntoVenta: string | null;
  codEstableMH: string | null;
  codEstable: string | null;
  correo: string;
}

// ============= RECEPTOR =============

// Receptor para Factura Consumidor (01)
export interface DteReceptorFC {
  tipoDocumento: string | null; // Código tipo documento
  numDocumento: string | null;
  nrc: string | null;
  nombre: string | null;
  codActividad: string | null;
  descActividad: string | null;
  direccion: Direccion | null;
  telefono: string | null;
  correo: string | null;
}

// Receptor para CCF (03) - campos obligatorios
export interface DteReceptorCCF {
  nit: string;
  nrc: string;
  nombre: string;
  codActividad: string;
  descActividad: string;
  nombreComercial: string | null;
  direccion: Direccion;
  telefono: string;
  correo: string;
}

// ============= CUERPO DOCUMENTO =============

// Item base común
interface DteItemBase {
  numItem: number;
  tipoItem: TipoItem;
  numeroDocumento: string | null;
  codigo: string | null;
  codTributo: string | null;
  descripcion: string;
  cantidad: number;
  uniMedida: number; // Código unidad medida
  precioUni: number;
  montoDescu: number;
  ventaNoSuj: number;
  ventaExenta: number;
  ventaGravada: number;
  tributos: string[] | null; // Códigos de tributos
  psv: number; // Precio sugerido venta
  noGravado: number;
}

// Item para Factura Consumidor (incluye ivaItem)
export interface DteItemFC extends DteItemBase {
  ivaItem: number;
}

// Item para CCF (sin ivaItem)
export interface DteItemCCF extends DteItemBase {}

// ============= RESUMEN =============

// Resumen base común
interface DteResumenBase {
  totalNoSuj: number;
  totalExenta: number;
  totalGravada: number;
  subTotalVentas: number;
  descuNoSuj: number;
  descuExenta: number;
  descuGravada: number;
  porcentajeDescuento: number;
  totalDescu: number;
  tributos: Tributo[] | null;
  subTotal: number;
  ivaRete1: number;
  reteRenta: number;
  montoTotalOperacion: number;
  totalNoGravado: number;
  totalPagar: number;
  totalLetras: string;
  saldoFavor: number;
  condicionOperacion: CondicionOperacion;
  pagos: Pago[] | null;
  numPagoElectronico: string | null;
}

// Resumen para Factura Consumidor (incluye totalIva)
export interface DteResumenFC extends DteResumenBase {
  totalIva: number;
}

// Resumen para CCF (incluye ivaPerci1)
export interface DteResumenCCF extends DteResumenBase {
  ivaPerci1: number;
}

// ============= EXTENSIÓN =============

export interface DteExtension {
  nombEntrega: string | null;
  docuEntrega: string | null;
  nombRecibe: string | null;
  docuRecibe: string | null;
  observaciones: string | null;
  placaVehiculo: string | null;
}

// ============= APÉNDICE =============

export interface DteApendiceItem {
  campo: string;
  etiqueta: string;
  valor: string;
}

// ============= DOCUMENTO RELACIONADO =============

export interface DocumentoRelacionado {
  tipoDocumento: string;
  tipoGeneracion: 1 | 2; // 1=Físico, 2=Electrónico
  numeroDocumento: string;
  fechaEmision: string;
}

// ============= VENTA A TERCEROS =============

export interface VentaTercero {
  nit: string;
  nombre: string;
}

// ============= DTE COMPLETOS =============

// Factura Consumidor Final (tipo 01)
export interface DteFacturaConsumidor {
  identificacion: DteIdentificacion;
  documentoRelacionado: DocumentoRelacionado[] | null;
  emisor: DteEmisor;
  receptor: DteReceptorFC;
  otrosDocumentos: any | null;
  ventaTercero: VentaTercero | null;
  cuerpoDocumento: DteItemFC[];
  resumen: DteResumenFC;
  extension: DteExtension | null;
  apendice: DteApendiceItem[] | null;
}

// Comprobante de Crédito Fiscal (tipo 03)
export interface DteCreditoFiscal {
  identificacion: DteIdentificacion;
  documentoRelacionado: DocumentoRelacionado[] | null;
  emisor: DteEmisor;
  receptor: DteReceptorCCF;
  otrosDocumentos: any | null;
  ventaTercero: VentaTercero | null;
  cuerpoDocumento: DteItemCCF[];
  resumen: DteResumenCCF;
  extension: DteExtension | null;
  apendice: DteApendiceItem[] | null;
}

// ============= NOTA DE CRÉDITO (tipo 05) =============

// Receptor para NC (similar a CCF)
export interface DteReceptorNC {
  nit: string;
  nrc: string;
  nombre: string;
  codActividad: string;
  descActividad: string;
  nombreComercial: string | null;
  direccion: Direccion;
  telefono: string;
  correo: string;
}

// Item para NC (similar a CCF) - versión original con campos extra
export interface DteItemNC extends DteItemBase {}

// Resumen para NC - versión original con campos extra
export interface DteResumenNC extends DteResumenBase {
  ivaPerci1: number;
}

// Nota de Crédito (tipo 05) - versión original
export interface DteNotaCredito {
  identificacion: DteIdentificacion;
  documentoRelacionado: DocumentoRelacionado[]; // Obligatorio en NC
  emisor: DteEmisor;
  receptor: DteReceptorNC;
  otrosDocumentos: any | null;
  ventaTercero: VentaTercero | null;
  cuerpoDocumento: DteItemNC[];
  resumen: DteResumenNC;
  extension: DteExtension | null;
  apendice: DteApendiceItem[] | null;
}

// ============= NC ESPECÍFICO (conforme al esquema fe-nc-v3.json) =============

// Dirección para DTE (alias para mayor claridad)
export type DteDireccion = Direccion;

// Tributo para resumen NC
export interface DteTributoResumen {
  codigo: string;
  descripcion: string;
  valor: number;
}

// Emisor específico para NC (sin campos de punto de venta)
export interface DteEmisorNC {
  nit: string;
  nrc: string;
  nombre: string;
  codActividad: string;
  descActividad: string;
  nombreComercial: string | null;
  tipoEstablecimiento: string;
  direccion: DteDireccion;
  telefono: string;
  correo: string;
  // NO incluir: codPuntoVentaMH, codPuntoVenta, codEstableMH, codEstable
}

// Item específico para NC (sin psv ni noGravado)
export interface DteItemNCv3 {
  numItem: number;
  tipoItem: 1 | 2 | 3 | 4;
  numeroDocumento: string; // Requerido, no null - código de generación del documento original
  codigo: string | null;
  codTributo: string | null;
  descripcion: string;
  cantidad: number;
  uniMedida: number;
  precioUni: number;
  montoDescu: number;
  ventaNoSuj: number;
  ventaExenta: number;
  ventaGravada: number;
  tributos: string[] | null;
  // NO incluir: psv, noGravado
}

// Resumen específico para NC (sin campos extra)
export interface DteResumenNCv3 {
  totalNoSuj: number;
  totalExenta: number;
  totalGravada: number;
  subTotalVentas: number;
  descuNoSuj: number;
  descuExenta: number;
  descuGravada: number;
  totalDescu: number;
  tributos: DteTributoResumen[] | null;
  subTotal: number;
  ivaPerci1: number;
  ivaRete1: number;
  reteRenta: number;
  montoTotalOperacion: number;
  totalLetras: string;
  condicionOperacion: 1 | 2 | 3;
  // NO incluir: porcentajeDescuento, totalNoGravado, totalPagar, saldoFavor, pagos, numPagoElectronico
}

// Extension específica para NC (sin placaVehiculo)
export interface DteExtensionNC {
  nombEntrega: string | null;
  docuEntrega: string | null;
  nombRecibe: string | null;
  docuRecibe: string | null;
  observaciones: string | null;
  // NO incluir: placaVehiculo
}

// Documento NC v3 (conforme al esquema fe-nc-v3.json)
export interface DteNotaCreditoV3 {
  identificacion: DteIdentificacion;
  documentoRelacionado: DocumentoRelacionado[];
  emisor: DteEmisorNC;
  receptor: DteReceptorNC;
  ventaTercero: VentaTercero | null;
  cuerpoDocumento: DteItemNCv3[];
  resumen: DteResumenNCv3;
  extension: DteExtensionNC | null;
  apendice: DteApendiceItem[] | null;
  // NO incluir: otrosDocumentos
}

// ============= NOTA DE DÉBITO (tipo 06) =============

// Receptor para ND (similar a CCF)
export interface DteReceptorND {
  nit: string;
  nrc: string;
  nombre: string;
  codActividad: string;
  descActividad: string;
  nombreComercial: string | null;
  direccion: Direccion;
  telefono: string;
  correo: string;
}

// Item para ND (similar a CCF)
export interface DteItemND extends DteItemBase {}

// Resumen para ND
export interface DteResumenND extends DteResumenBase {
  ivaPerci1: number;
}

// Nota de Débito (tipo 06)
export interface DteNotaDebito {
  identificacion: DteIdentificacion;
  documentoRelacionado: DocumentoRelacionado[]; // Obligatorio en ND
  emisor: DteEmisor;
  receptor: DteReceptorND;
  otrosDocumentos: any | null;
  ventaTercero: VentaTercero | null;
  cuerpoDocumento: DteItemND[];
  resumen: DteResumenND;
  extension: DteExtension | null;
  apendice: DteApendiceItem[] | null;
}

// ============= FACTURA DE EXPORTACIÓN (tipo 11) =============

// Receptor para FEX
export interface DteReceptorFEX {
  tipoDocumento: string | null;
  numDocumento: string | null;
  nombre: string;
  descActividad: string | null;
  codPais: string; // Código país destino (CAT-020)
  nombrePais: string;
  complemento: string;
  tipoPersona: number | null; // 1=Natural, 2=Jurídica
  telefono: string | null;
  correo: string | null;
}

// Item para FEX (similar a FC)
export interface DteItemFEX extends DteItemBase {
  ivaItem: number;
}

// Resumen para FEX
export interface DteResumenFEX {
  totalNoSuj: number;
  totalExenta: number;
  totalGravada: number;
  subTotalVentas: number;
  descuNoSuj: number;
  descuExenta: number;
  descuGravada: number;
  porcentajeDescuento: number;
  totalDescu: number;
  totalCompra: number | null;
  porcentComision: number | null;
  comision: number | null;
  flete: number;
  seguro: number;
  descIncoterms: string | null;
  codIncoterms: string | null;
  observaciones: string | null;
  montoTotalOperacion: number;
  totalPagar: number;
  totalLetras: string;
  condicionOperacion: CondicionOperacion;
  pagos: Pago[] | null;
  codExportacion: number; // 1=Nacional, 2=Centroamérica, 3=Fuera CA
  recinto: string | null;
  regimen: string | null;
  numPagoElectronico: string | null;
}

// Factura de Exportación (tipo 11)
export interface DteFacturaExportacion {
  identificacion: DteIdentificacion;
  emisor: DteEmisor;
  receptor: DteReceptorFEX;
  otrosDocumentos: any | null;
  ventaTercero: VentaTercero | null;
  cuerpoDocumento: DteItemFEX[];
  resumen: DteResumenFEX;
  apendice: DteApendiceItem[] | null;
}

// ============= FACTURA SUJETO EXCLUIDO (tipo 14) =============

// Emisor para FSE - NO incluye tipoEstablecimiento ni nombreComercial
export interface DteEmisorFSE {
  nit: string;
  nrc: string;
  nombre: string;
  codActividad: string;
  descActividad: string;
  direccion: Direccion;
  telefono: string;
  codPuntoVentaMH: string | null;
  codPuntoVenta: string | null;
  codEstableMH: string | null;
  codEstable: string | null;
  correo: string;
}

// Receptor (Sujeto Excluido) para FSE
// tipoDocumento: '36'(NIT), '13'(DUI), '02'(Pasaporte), '37'(Carnet Residente), '03'(Otro)
export interface DteReceptorFSE {
  tipoDocumento: string;
  numDocumento: string;
  nombre: string;
  codActividad: string;
  descActividad: string;
  direccion: Direccion;
  telefono: string | null;
  correo: string | null;
}

// Item para FSE - usa campo 'compra', NO campos de venta
export interface DteItemFSE {
  numItem: number;
  tipoItem: TipoItem;
  codigo: string | null;
  descripcion: string;
  cantidad: number;
  uniMedida: number;
  precioUni: number;
  montoDescu: number;
  compra: number;
}

// Resumen para FSE - requiere AMBOS: descu y totalDescu
export interface DteResumenFSE {
  totalCompra: number;
  descu: number;
  totalDescu: number;
  subTotal: number;
  ivaRete1: number;
  reteRenta: number;
  totalPagar: number;
  totalLetras: string;
  condicionOperacion: CondicionOperacion;
  pagos: Pago[] | null;
  observaciones: string | null;
}

// Factura Sujeto Excluido (tipo 14)
export interface DteFacturaSujetoExcluido {
  identificacion: DteIdentificacion;
  sujetoExcluido: DteReceptorFSE;
  emisor: DteEmisorFSE;
  cuerpoDocumento: DteItemFSE[];
  resumen: DteResumenFSE;
  apendice: DteApendiceItem[] | null;
}

// Tipo unión para cualquier DTE
export type DteDocument =
  | DteFacturaConsumidor
  | DteCreditoFiscal
  | DteNotaCredito
  | DteNotaCreditoV3
  | DteNotaDebito
  | DteFacturaExportacion
  | DteFacturaSujetoExcluido;
