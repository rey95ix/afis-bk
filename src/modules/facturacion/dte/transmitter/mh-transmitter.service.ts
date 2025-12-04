import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { MhAuthService } from './mh-auth.service';
import { TipoDte, Ambiente } from '../../interfaces';

/**
 * Request para enviar DTE a MH
 */
export interface TransmitirDteRequest {
  ambiente: Ambiente;
  idEnvio: number;
  version: number;
  tipoDte: TipoDte;
  documento: string; // DTE firmado (JWS)
  codigoGeneracion: string;
}

/**
 * Request para enviar anulación a MH
 */
export interface TransmitirAnulacionRequest {
  ambiente: Ambiente;
  idEnvio: number;
  version: number;
  documento: string; // Evento de anulación firmado (JWS)
}

/**
 * Response de MH para recepción de DTE
 */
export interface MhRecepcionResponse {
  version: number;
  ambiente: string;
  versionApp: number;
  estado: 'PROCESADO' | 'RECHAZADO';
  codigoGeneracion: string;
  selloRecibido: string | null;
  fhProcesamiento: string;
  clasificaMsg: string;
  codigoMsg: string;
  descripcionMsg: string;
  observaciones?: string[];
}

/**
 * Resultado de transmisión
 */
export interface TransmisionResult {
  success: boolean;
  estado?: 'PROCESADO' | 'RECHAZADO';
  selloRecibido?: string;
  fechaProcesamiento?: Date;
  codigoMsg?: string;
  descripcionMsg?: string;
  observaciones?: string[];
  error?: string;
}

/**
 * Servicio para transmitir DTEs y anulaciones al Ministerio de Hacienda
 *
 * Endpoints:
 * - Recepción DTE: /fesv/recepciondte
 * - Anulación: /fesv/anulardte
 * - Consulta DTE: /fesv/recepcion/consultadte/
 *
 * Política de reintentos:
 * - Timeout: 8 segundos
 * - Máximo 2 reintentos adicionales
 */
@Injectable()
export class MhTransmitterService {
  private readonly logger = new Logger(MhTransmitterService.name);
  private readonly timeout = 8000; // 8 segundos según manual MH
  private readonly maxRetries = 2;

  constructor(private readonly mhAuthService: MhAuthService) {}

  /**
   * Transmite un DTE firmado al Ministerio de Hacienda
   *
   * @param request Datos del DTE a transmitir
   * @param nit NIT del emisor (para autenticación)
   * @returns Resultado de la transmisión
   */
  async transmitirDte(
    request: TransmitirDteRequest,
    nit: string,
  ): Promise<TransmisionResult> {
    const baseUrl = this.mhAuthService.getApiUrl(request.ambiente);
    const endpoint = `${baseUrl}/fesv/recepciondte`;

    this.logger.log(
      `Transmitiendo DTE ${request.codigoGeneracion} a ${request.ambiente === '00' ? 'pruebas' : 'producción'}`,
    );

    return this.ejecutarConReintentos(
      () => this.enviarDte(endpoint, request, nit),
      request.ambiente,
      nit,
    );
  }

  /**
   * Transmite un evento de anulación al Ministerio de Hacienda
   *
   * @param request Datos de la anulación a transmitir
   * @param nit NIT del emisor (para autenticación)
   * @returns Resultado de la transmisión
   */
  async transmitirAnulacion(
    request: TransmitirAnulacionRequest,
    nit: string,
  ): Promise<TransmisionResult> {
    const baseUrl = this.mhAuthService.getApiUrl(request.ambiente);
    const endpoint = `${baseUrl}/fesv/anulardte`;

    this.logger.log(`Transmitiendo anulación a ${request.ambiente === '00' ? 'pruebas' : 'producción'}`);

    return this.ejecutarConReintentos(
      () => this.enviarAnulacion(endpoint, request, nit),
      request.ambiente,
      nit,
    );
  }

  /**
   * Consulta el estado de un DTE en MH
   *
   * @param ambiente Ambiente de MH
   * @param nitEmisor NIT del emisor
   * @param tipoDte Tipo de documento
   * @param codigoGeneracion UUID del DTE
   * @returns Estado del DTE
   */
  async consultarDte(
    ambiente: Ambiente,
    nitEmisor: string,
    tipoDte: TipoDte,
    codigoGeneracion: string,
  ): Promise<TransmisionResult> {
    const baseUrl = this.mhAuthService.getApiUrl(ambiente);
    const endpoint = `${baseUrl}/fesv/recepcion/consultadte/`;

    try {
      const token = await this.mhAuthService.obtenerToken(ambiente, nitEmisor);

      const response = await axios.post<MhRecepcionResponse>(
        endpoint,
        {
          nitEmisor: nitEmisor.replace(/-/g, ''),
          tdte: tipoDte,
          codigoGeneracion,
        },
        {
          headers: {
            Authorization: token,
            'Content-Type': 'application/json',
          },
          timeout: this.timeout,
        },
      );

      return this.procesarRespuesta(response.data);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Ejecuta una operación con reintentos
   */
  private async ejecutarConReintentos(
    operacion: () => Promise<TransmisionResult>,
    ambiente: Ambiente,
    nit: string,
    intentoActual: number = 0,
  ): Promise<TransmisionResult> {
    const resultado = await operacion();

    // Si fue exitoso o es un rechazo de MH (no error de conexión), no reintentar
    if (resultado.success || resultado.estado === 'RECHAZADO') {
      return resultado;
    }

    // Si es error de conexión y quedan reintentos, intentar de nuevo
    if (intentoActual < this.maxRetries) {
      this.logger.warn(
        `Intento ${intentoActual + 1} fallido, reintentando... (${this.maxRetries - intentoActual} restantes)`,
      );

      // Esperar un poco antes de reintentar
      await this.sleep(1000 * (intentoActual + 1));

      // Invalidar token por si expiró
      this.mhAuthService.invalidarToken(ambiente, nit);

      return this.ejecutarConReintentos(operacion, ambiente, nit, intentoActual + 1);
    }

    return resultado;
  }

  /**
   * Envía el DTE a MH
   */
  private async enviarDte(
    endpoint: string,
    request: TransmitirDteRequest,
    nit: string,
  ): Promise<TransmisionResult> {
    try {
      const token = await this.mhAuthService.obtenerToken(request.ambiente, nit);

      const response = await axios.post<MhRecepcionResponse>(
        endpoint,
        {
          ambiente: request.ambiente,
          idEnvio: request.idEnvio,
          version: request.version,
          tipoDte: request.tipoDte,
          documento: request.documento,
          codigoGeneracion: request.codigoGeneracion,
        },
        {
          headers: {
            Authorization: token,
            'Content-Type': 'application/json',
            'User-Agent': 'AFIS-DTE/1.0',
          },
          timeout: this.timeout,
        },
      );

      return this.procesarRespuesta(response.data);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Envía la anulación a MH
   */
  private async enviarAnulacion(
    endpoint: string,
    request: TransmitirAnulacionRequest,
    nit: string,
  ): Promise<TransmisionResult> {
    try {
      const token = await this.mhAuthService.obtenerToken(request.ambiente, nit);

      const response = await axios.post<MhRecepcionResponse>(
        endpoint,
        {
          ambiente: request.ambiente,
          idEnvio: request.idEnvio,
          version: request.version,
          documento: request.documento,
        },
        {
          headers: {
            Authorization: token,
            'Content-Type': 'application/json',
            'User-Agent': 'AFIS-DTE/1.0',
          },
          timeout: this.timeout,
        },
      );

      return this.procesarRespuesta(response.data);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Procesa la respuesta de MH
   */
  private procesarRespuesta(data: MhRecepcionResponse): TransmisionResult {
    const fechaProcesamiento = this.parseFechaMh(data.fhProcesamiento);

    if (data.estado === 'PROCESADO') {
      this.logger.log(`DTE procesado exitosamente. Sello: ${data.selloRecibido}`);
      return {
        success: true,
        estado: 'PROCESADO',
        selloRecibido: data.selloRecibido || undefined,
        fechaProcesamiento,
        codigoMsg: data.codigoMsg,
        descripcionMsg: data.descripcionMsg,
      };
    } else {
      this.logger.warn(`DTE rechazado: ${data.descripcionMsg}`);
      return {
        success: false,
        estado: 'RECHAZADO',
        fechaProcesamiento,
        codigoMsg: data.codigoMsg,
        descripcionMsg: data.descripcionMsg,
        observaciones: data.observaciones,
        error: data.descripcionMsg,
      };
    }
  }

  /**
   * Maneja errores de comunicación
   */
  private handleError(error: unknown): TransmisionResult {
    if (error instanceof AxiosError) {
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return {
          success: false,
          error: 'Timeout al comunicarse con MH. Verifique el estado del DTE antes de reenviar.',
        };
      }

      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;

        if (status === 401) {
          return {
            success: false,
            error: 'Token inválido o expirado',
            codigoMsg: '107',
          };
        }

        return {
          success: false,
          error: `Error HTTP ${status}: ${JSON.stringify(data)}`,
          codigoMsg: data?.codigoMsg,
          descripcionMsg: data?.descripcionMsg,
        };
      }

      return {
        success: false,
        error: `Error de conexión: ${error.message}`,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }

  /**
   * Parsea la fecha de MH (formato: DD/MM/YYYY HH:MM:SS)
   */
  private parseFechaMh(fechaStr: string): Date | undefined {
    if (!fechaStr) return undefined;

    try {
      // Formato MH: "31/01/2025 15:30:00"
      const [datePart, timePart] = fechaStr.split(' ');
      const [day, month, year] = datePart.split('/');
      const [hour, minute, second] = timePart.split(':');

      return new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second),
      );
    } catch {
      return undefined;
    }
  }

  /**
   * Helper para esperar
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
