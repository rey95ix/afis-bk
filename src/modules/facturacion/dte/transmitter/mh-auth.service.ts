import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

/**
 * Response de autenticación de MH
 */
export interface MhAuthResponse {
  status: 'OK' | 'ERROR';
  body?: {
    user: string;
    token: string;
    tokenType: string;
    roles: string[];
  };
  error?: string;
}

/**
 * Token almacenado con su metadata
 */
interface StoredToken {
  token: string;
  expiresAt: Date;
  ambiente: '00' | '01';
}

/**
 * Servicio de autenticación con el Ministerio de Hacienda
 *
 * Maneja la obtención y renovación de tokens JWT para comunicarse con la API de MH.
 *
 * Endpoints:
 * - Pruebas: https://apitest.dtes.mh.gob.sv/seguridad/auth
 * - Producción: https://api.dtes.mh.gob.sv/seguridad/auth
 *
 * Vigencia del token:
 * - Producción: 24 horas
 * - Pruebas: 48 horas
 *
 * Variables de entorno requeridas:
 * - MH_NIT: NIT del contribuyente (sin guiones)
 * - MH_PASSWORD: Contraseña del portal de MH
 */
@Injectable()
export class MhAuthService {
  private readonly logger = new Logger(MhAuthService.name);
  private readonly apiTestUrl = 'https://apitest.dtes.mh.gob.sv';
  private readonly apiProdUrl = 'https://api.dtes.mh.gob.sv';
  private readonly timeout = 30000;

  // Cache de tokens por ambiente
  private tokenCache: Map<string, StoredToken> = new Map();

  // Margen de seguridad para renovación (30 minutos antes de expirar)
  private readonly TOKEN_REFRESH_MARGIN_MS = 30 * 60 * 1000;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Obtiene un token válido para el ambiente especificado
   * Usa cache para evitar llamadas innecesarias a MH
   *
   * @param ambiente '00' para pruebas, '01' para producción
   * @param nit NIT del contribuyente (opcional, usa el configurado si no se especifica)
   * @returns Token Bearer válido
   */
  async obtenerToken(ambiente: '00' | '01', nit?: string): Promise<string> {
    const cacheKey = `${ambiente}-${nit || 'default'}`;

    // Verificar si hay token en cache y es válido
    const cachedToken = this.tokenCache.get(cacheKey);
    if (cachedToken && this.isTokenValid(cachedToken)) {
      this.logger.debug('Usando token en cache');
      return cachedToken.token;
    }

    // Obtener nuevo token
    this.logger.log(`Obteniendo nuevo token de MH para ambiente ${ambiente}`);
    const newToken = await this.autenticar(ambiente, nit);

    // Guardar en cache
    const expiresAt = this.calculateExpiration(ambiente);
    this.tokenCache.set(cacheKey, {
      token: newToken,
      expiresAt,
      ambiente,
    });

    return newToken;
  }

  /**
   * Realiza la autenticación con MH
   */
  private async autenticar(ambiente: '00' | '01', nit?: string): Promise<string> {
    const baseUrl = ambiente === '00' ? this.apiTestUrl : this.apiProdUrl;
    const endpoint = `${baseUrl}/seguridad/auth`;

    const userNit = nit || this.configService.get<string>('MH_NIT', '');
    const password = this.configService.get<string>('MH_PASSWORD', '');

    if (!userNit || !password) {
      throw new Error('MH_NIT y MH_PASSWORD deben estar configurados en las variables de entorno');
    }

    try {
      const response = await axios.post<MhAuthResponse>(
        endpoint,
        new URLSearchParams({
          user: userNit.replace(/-/g, ''),
          pwd: password,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: this.timeout,
        },
      );

      if (response.data.status === 'OK' && response.data.body?.token) {
        this.logger.log('Autenticación exitosa con MH');
        return response.data.body.token;
      } else {
        throw new Error(response.data.error || 'Error de autenticación con MH');
      }
    } catch (error) {
      if (error instanceof AxiosError) {
        if (error.response?.status === 401) {
          throw new Error('Credenciales inválidas para MH. Verifique MH_NIT y MH_PASSWORD');
        }
        if (error.response?.status === 403) {
          throw new Error('Usuario bloqueado en MH. Contacte al Ministerio de Hacienda');
        }
        throw new Error(`Error de conexión con MH: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Invalida el token en cache para forzar renovación
   */
  invalidarToken(ambiente: '00' | '01', nit?: string): void {
    const cacheKey = `${ambiente}-${nit || 'default'}`;
    this.tokenCache.delete(cacheKey);
    this.logger.log(`Token invalidado para ambiente ${ambiente}`);
  }

  /**
   * Invalida todos los tokens en cache
   */
  invalidarTodosLosTokens(): void {
    this.tokenCache.clear();
    this.logger.log('Todos los tokens han sido invalidados');
  }

  /**
   * Verifica si un token almacenado sigue siendo válido
   */
  private isTokenValid(storedToken: StoredToken): boolean {
    const now = new Date();
    const refreshThreshold = new Date(
      storedToken.expiresAt.getTime() - this.TOKEN_REFRESH_MARGIN_MS,
    );
    return now < refreshThreshold;
  }

  /**
   * Calcula la fecha de expiración del token
   * - Producción: 24 horas
   * - Pruebas: 48 horas
   */
  private calculateExpiration(ambiente: '00' | '01'): Date {
    const hours = ambiente === '00' ? 48 : 24;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + hours);
    return expiresAt;
  }

  /**
   * Obtiene la URL base de la API según el ambiente
   */
  getApiUrl(ambiente: '00' | '01'): string {
    return ambiente === '00' ? this.apiTestUrl : this.apiProdUrl;
  }
}
