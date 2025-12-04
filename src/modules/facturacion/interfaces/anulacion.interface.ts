/**
 * Interfaces para Eventos de Invalidación/Anulación de DTE
 * Basado en anulacion-schema-v2 del Ministerio de Hacienda
 */

import { TipoDte, Ambiente } from './dte.interface';

// ============= TIPOS =============

export type TipoAnulacion = 1 | 2 | 3; // 1=Error, 2=Rescindir, 3=Otro

// ============= IDENTIFICACIÓN ANULACIÓN =============

export interface AnulacionIdentificacion {
  version: number; // Siempre 2
  ambiente: Ambiente;
  codigoGeneracion: string; // UUID v4 del evento de anulación
  fecAnula: string; // YYYY-MM-DD
  horAnula: string; // HH:MM:SS
}

// ============= EMISOR ANULACIÓN =============

export interface AnulacionEmisor {
  nit: string;
  nombre: string;
  tipoEstablecimiento: string;
  nomEstablecimiento: string | null;
  codEstableMH: string | null;
  codEstable: string | null;
  codPuntoVentaMH: string | null;
  codPuntoVenta: string | null;
  telefono: string;
  correo: string;
}

// ============= DOCUMENTO A ANULAR =============

export interface AnulacionDocumento {
  tipoDte: TipoDte;
  codigoGeneracion: string; // UUID del DTE original
  selloRecibido: string; // Sello de MH del DTE original
  numeroControl: string;
  fecEmi: string; // Fecha emisión original
  montoIva: number;
  codigoGeneracionR: string | null; // UUID del DTE de reemplazo (si tipo=1)
  tipoDocumento: string | null; // Tipo doc del receptor
  numDocumento: string | null; // Número doc del receptor
  nombre: string | null; // Nombre del receptor
  telefono: string | null;
  correo: string | null;
}

// ============= MOTIVO DE ANULACIÓN =============

export interface AnulacionMotivo {
  tipoAnulacion: TipoAnulacion;
  motivoAnulacion: string | null;
  nombreResponsable: string; // Quien autoriza la anulación
  tipDocResponsable: string;
  numDocResponsable: string;
  nombreSolicita: string; // Quien solicita la anulación
  tipDocSolicita: string;
  numDocSolicita: string;
}

// ============= EVENTO DE ANULACIÓN COMPLETO =============

export interface EventoAnulacion {
  identificacion: AnulacionIdentificacion;
  emisor: AnulacionEmisor;
  documento: AnulacionDocumento;
  motivo: AnulacionMotivo;
}
