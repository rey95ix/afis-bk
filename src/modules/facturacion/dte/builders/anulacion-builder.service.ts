import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  EventoAnulacion,
  AnulacionIdentificacion,
  AnulacionEmisor,
  AnulacionDocumento,
  AnulacionMotivo,
  TipoAnulacion,
} from '../../interfaces';
import { EmisorData } from './dte-builder.interface';
import { Ambiente, TipoDte } from '../../interfaces';

/**
 * Datos del DTE original que se va a anular
 */
export interface DteOriginalData {
  tipoDte: TipoDte;
  codigoGeneracion: string;
  selloRecibido: string;
  numeroControl: string;
  fechaEmision: string; // YYYY-MM-DD
  montoIva: number;
  // Datos del receptor original
  tipoDocumentoReceptor: string | null;
  numDocumentoReceptor: string | null;
  nombreReceptor: string | null;
  telefonoReceptor: string | null;
  correoReceptor: string | null;
}

/**
 * Datos del motivo de anulación
 */
export interface MotivoAnulacionData {
  tipoAnulacion: TipoAnulacion;
  motivoAnulacion: string | null;
  nombreResponsable: string;
  tipoDocResponsable: string;
  numDocResponsable: string;
  nombreSolicita: string;
  tipoDocSolicita: string;
  numDocSolicita: string;
  codigoGeneracionReemplazo?: string | null;
}

/**
 * Parámetros para construir un evento de anulación
 */
export interface BuildAnulacionParams {
  ambiente: Ambiente;
  emisor: EmisorData;
  dteOriginal: DteOriginalData;
  motivo: MotivoAnulacionData;
}

/**
 * Resultado de la construcción del evento de anulación
 */
export interface BuildAnulacionResult {
  evento: EventoAnulacion;
  codigoGeneracion: string;
}

/**
 * Builder para Eventos de Invalidación/Anulación de DTE
 *
 * Basado en anulacion-schema-v2 del Ministerio de Hacienda
 */
@Injectable()
export class AnulacionBuilderService {
  private readonly VERSION = 2;

  /**
   * Construye un evento de anulación completo
   */
  build(params: BuildAnulacionParams): BuildAnulacionResult { //d
    const codigoGeneracion = uuidv4().toUpperCase();

    const identificacion = this.buildIdentificacion(params.ambiente, codigoGeneracion);
    const emisor = this.buildEmisor(params.emisor);
    const documento = this.buildDocumento(params.dteOriginal, params.motivo);
    console.log('Documento a anular:', documento);  
    const motivo = this.buildMotivo(params.motivo);

    const evento: EventoAnulacion = {
      identificacion,
      emisor,
      documento,
      motivo,
    };

    return {
      evento,
      codigoGeneracion,
    };
  }

  private buildIdentificacion(
    ambiente: Ambiente,
    codigoGeneracion: string,
  ): AnulacionIdentificacion {
    const now = new Date();

    return {
      version: this.VERSION,
      ambiente,
      codigoGeneracion,
      fecAnula: this.formatDate(now),
      horAnula: this.formatTime(now),
    };
  }

  private buildEmisor(emisor: EmisorData): AnulacionEmisor {
    return {
      nit: emisor.nit,
      nombre: emisor.nombre,
      tipoEstablecimiento: emisor.tipoEstablecimiento,
      nomEstablecimiento: emisor.nombreComercial,
      codEstableMH: emisor.codEstableMH,
      codEstable: emisor.codEstable,
      codPuntoVentaMH: emisor.codPuntoVentaMH,
      codPuntoVenta: emisor.codPuntoVenta,
      telefono: emisor.telefono,
      correo: emisor.correo,
    };
  }

  private buildDocumento(
    dteOriginal: DteOriginalData,
    motivo: MotivoAnulacionData,
  ): AnulacionDocumento {
    return {
      tipoDte: dteOriginal.tipoDte,
      codigoGeneracion: dteOriginal.codigoGeneracion,
      selloRecibido: dteOriginal.selloRecibido,
      numeroControl: dteOriginal.numeroControl,
      fecEmi: dteOriginal.fechaEmision,
      montoIva: dteOriginal.montoIva,
      // DTE de reemplazo (solo si tipoAnulacion = 1)
      codigoGeneracionR: motivo.codigoGeneracionReemplazo || null,
      // Datos del receptor original
      tipoDocumento: dteOriginal.tipoDocumentoReceptor,
      numDocumento: dteOriginal.numDocumentoReceptor,
      nombre: dteOriginal.nombreReceptor,
      telefono: dteOriginal.telefonoReceptor,
      correo: dteOriginal.correoReceptor,
    };
  }

  private buildMotivo(motivo: MotivoAnulacionData): AnulacionMotivo {
    return {
      tipoAnulacion: motivo.tipoAnulacion,
      motivoAnulacion: motivo.motivoAnulacion,
      nombreResponsable: motivo.nombreResponsable,
      tipDocResponsable: motivo.tipoDocResponsable,
      numDocResponsable: motivo.numDocResponsable,
      nombreSolicita: motivo.nombreSolicita,
      tipDocSolicita: motivo.tipoDocSolicita,
      numDocSolicita: motivo.numDocSolicita,
    };
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatTime(date: Date): string {
    return date.toTimeString().split(' ')[0]; // HH:MM:SS
  }
}
