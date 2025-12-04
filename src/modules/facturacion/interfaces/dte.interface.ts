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

// Tipo unión para cualquier DTE
export type DteDocument = DteFacturaConsumidor | DteCreditoFiscal;
