import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { PrismaService } from 'src/modules/prisma/prisma.service';

/**
 * Request para el API Firmador
 */
export interface FirmadorRequest {
  nit: string;
  activo: boolean;
  passwordPri: string;
  dteJson: object;
}

/**
 * Response del API Firmador
 */
export interface FirmadorResponse {
  status: 'OK' | 'ERROR';
  body: string; // JWS firmado si OK, mensaje de error si ERROR
}

/**
 * Resultado de la firma
 */
export interface SignResult {
  success: boolean;
  documentoFirmado?: string; // JWS
  error?: string;
}

/**
 * Servicio para firmar DTEs usando el API Firmador local
 *
 * El API Firmador es un servicio Java que corre localmente (puerto 8113 por defecto)
 * y utiliza el certificado digital del contribuyente para firmar documentos.
 *
 * Variables de entorno requeridas:
 * - API_FIRMADOR: URL del servicio (ej: http://localhost:8113)
 * - FIRMADOR_PASSWORD: Contraseña del certificado digital
 */
@Injectable()
export class DteSignerService {
  private readonly logger = new Logger(DteSignerService.name);
  private readonly apiUrl: string;
  private readonly password: string;
  private readonly timeout = 30000; // 30 segundos

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {
    this.apiUrl = this.configService.get<string>('API_FIRMADOR', 'http://localhost:8113');  
    if (!this.password) {
      this.logger.warn('FIRMADOR_PASSWORD no está configurado en las variables de entorno');
    }
  } 

  /**
   * Firma un documento DTE o evento de anulación
   *
   * @param nit NIT del emisor (debe coincidir con el certificado)
   * @param documento JSON del DTE o evento a firmar
   * @returns Documento firmado en formato JWS
   */
  async firmar(nit: string, documento: object): Promise<SignResult> {
    const endpoint = `${this.apiUrl}/firmardocumento/`;

    this.logger.log(`Firmando documento para NIT: ${nit}`);
    this.logger.debug(`Endpoint: ${endpoint}`);

    const generalData = await this.prisma.generalData.findFirst();
    const request: FirmadorRequest = {
      nit: nit.replace(/-/g, ''), // Remover guiones del NIT
      activo: true,
      passwordPri: generalData?.private_key || '',
      dteJson: documento,
    };

    try {
      // const response = await axios.post<FirmadorResponse>(endpoint, request, {
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   timeout: this.timeout,
      // }); 
      const config: AxiosRequestConfig = {
        method: 'post', // Especifica el método HTTP
        url: endpoint,       // URL a la que se realizará la solicitud
        headers: {
          'Content-Type': 'application/json', // Especifica el tipo de contenido esperado 
        },
        data: request, // Los datos que se enviarán en el cuerpo de la solicitud
      };
      const response: AxiosResponse = await axios.request(config);
      if (response.data.status === 'OK') {
        this.logger.log('Documento firmado exitosamente');
        return {
          success: true,
          documentoFirmado: response.data.body,
        };
      } else {
        console.log('Error al firmar documento:', response.data.body);
        console.log('Error al firmar documento:', request);
        this.logger.error(`Error del firmador: ${response.data.toString()}`);
        return {
          success: false,
          error: response.data.body.toString() || 'Error desconocido del firmador',
        };
      }
    } catch (error) {
      console.log('Error al firmar documento:', error.toString());
      return this.handleError(error);
    }
  }

  /**
   * Verifica que el servicio de firma esté disponible
   */
  async verificarConexion(): Promise<boolean> {
    try {
      // Intentar conectar al endpoint base
      await axios.get(this.apiUrl, { timeout: 5000 });
      return true;
    } catch (error) {
      if (error instanceof AxiosError && error.code === 'ECONNREFUSED') {
        this.logger.error(`Servicio de firma no disponible en ${this.apiUrl}`);
        return false;
      }
      // Si responde con error HTTP pero responde, está disponible
      return true;
    }
  }

  /**
   * Obtiene la URL del API Firmador configurada
   */
  getApiUrl(): string {
    return this.apiUrl;
  }

  private handleError(error: unknown): SignResult {
    if (error instanceof AxiosError) {
      if (error.code === 'ECONNREFUSED') {
        const message = `No se puede conectar al servicio de firma en ${this.apiUrl}. Verifique que el API Firmador esté ejecutándose.`;
        this.logger.error(message);
        return {
          success: false,
          error: message,
        };
      }

      if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        const message = 'Timeout al conectar con el servicio de firma';
        this.logger.error(message);
        return {
          success: false,
          error: message,
        };
      }

      if (error.response) {
        const message = `Error HTTP ${error.response.status}: ${error.response.statusText}`;
        this.logger.error(message);
        return {
          success: false,
          error: message,
        };
      }
    }

    const message = error instanceof Error ? error.message : 'Error desconocido al firmar';
    this.logger.error(`Error al firmar: ${message}`);
    return {
      success: false,
      error: message,
    };
  }
}
