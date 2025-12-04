import { DteDocument, TipoDte } from '../../interfaces';

/**
 * Datos del emisor extraídos de GeneralData y Sucursal
 */
export interface EmisorData {
  nit: string;
  nrc: string;
  nombre: string;
  codActividad: string;
  descActividad: string;
  nombreComercial: string | null;
  tipoEstablecimiento: string;
  telefono: string;
  correo: string;
  // Dirección
  departamento: string;
  municipio: string;
  complemento: string;
  // Punto de venta
  codEstableMH: string | null;
  codEstable: string | null;
  codPuntoVentaMH: string | null;
  codPuntoVenta: string | null;
}

/**
 * Datos del receptor extraídos de clienteDatosFacturacion
 */
export interface ReceptorData {
  tipoDocumento: string | null;
  numDocumento: string | null;
  nit?: string | null;
  nrc?: string | null;
  nombre: string;
  codActividad: string | null;
  descActividad: string | null;
  nombreComercial?: string | null;
  telefono: string | null;
  correo: string | null;
  // Dirección
  departamento: string | null;
  municipio: string | null;
  complemento: string | null;
}

/**
 * Item/línea para construir el DTE
 */
export interface ItemData {
  tipoItem: number;
  codigo: string | null;
  descripcion: string;
  cantidad: number;
  uniMedida: number;
  precioUnitario: number;
  descuento: number;
  esGravado: boolean;
  esExento: boolean;
  esNoSujeto: boolean;
  idCatalogo?: number;
}

/**
 * Datos de pago
 */
export interface PagoData {
  codigo: string;
  monto: number;
  referencia?: string;
  plazo?: string;
  periodo?: number;
}

/**
 * Parámetros para construir un DTE
 */
export interface BuildDteParams {
  // Identificación
  ambiente: '00' | '01';
  numeroControl: string;
  codigoGeneracion: string;
  tipoModelo?: number;
  tipoOperacion?: number;
  tipoContingencia?: number | null;
  motivoContin?: string | null;

  // Partes
  emisor: EmisorData;
  receptor: ReceptorData;

  // Contenido
  items: ItemData[];

  // Pago
  condicionOperacion: number;
  pagos?: PagoData[];
  numPagoElectronico?: string;

  // Extensión
  observaciones?: string;

  // Documentos relacionados (para NC, ND)
  documentosRelacionados?: Array<{
    tipoDocumento: string;
    tipoGeneracion: 1 | 2;
    numeroDocumento: string;
    fechaEmision: string;
  }>;
}

/**
 * Resultado de la construcción del DTE
 */
export interface BuildDteResult {
  documento: DteDocument;
  tipoDte: TipoDte;
  totales: {
    totalNoSuj: number;
    totalExenta: number;
    totalGravada: number;
    totalIva: number;
    totalPagar: number;
  };
}

/**
 * Interface que deben implementar los builders de DTE
 */
export interface IDteBuilder {
  /**
   * Construye el documento DTE completo
   */
  build(params: BuildDteParams): BuildDteResult;

  /**
   * Obtiene el tipo de DTE que construye este builder
   */
  getTipoDte(): TipoDte;

  /**
   * Obtiene la versión del schema que usa este builder
   */
  getVersion(): number;
}
