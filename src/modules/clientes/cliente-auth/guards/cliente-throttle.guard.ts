import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Guard de rate limiting específico para el portal de clientes
 *
 * Extiende ThrottlerGuard para aplicar límites de tasa
 * a los endpoints del portal de clientes
 *
 * Configuración por endpoint usando @Throttle():
 * - Login: 5 intentos por minuto
 * - Forgot password: 3 intentos cada 5 minutos
 * - Activación: 3 intentos cada 5 minutos
 */
@Injectable()
export class ClienteThrottleGuard extends ThrottlerGuard {
  /**
   * Obtiene el tracker (identificador) para el rate limiting
   * Usa la IP del cliente como identificador
   */
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Obtener IP real considerando proxies
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded
      ? (forwarded as string).split(',')[0].trim()
      : req.ip || req.connection?.remoteAddress || 'unknown';

    return ip;
  }

  /**
   * Genera la clave de almacenamiento para el rate limit
   * Incluye el tracker (IP) y el nombre del throttler
   */
  protected generateKey(context: any, tracker: string, throttlerName: string): string {
    const request = context.switchToHttp().getRequest();
    const path = request.route?.path || request.url;

    // Combinar IP + ruta para límites más granulares
    return `cliente-auth:${throttlerName}:${tracker}:${path}`;
  }
}
