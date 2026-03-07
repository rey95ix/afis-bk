import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { ClienteSessionResponse, ClienteLogAccion } from '../interfaces';

/**
 * Servicio para gestión de sesiones de clientes
 * Maneja la creación, validación y revocación de sesiones
 */
@Injectable()
export class ClienteSessionService {
  private readonly REFRESH_TOKEN_DAYS = 7;

  constructor(private prisma: PrismaService) {}

  /**
   * Crea una nueva sesión para el cliente
   */
  async crearSesion(
    clienteId: number,
    refreshToken: string,
    ip: string | null,
    userAgent: string | null,
  ) {
    const tokenHash = this.hashToken(refreshToken);
    const dispositivo = this.parseDispositivo(userAgent);
    const fechaExpiracion = new Date(
      Date.now() + this.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
    );

    return this.prisma.cliente_sesiones.create({
      data: {
        id_cliente: clienteId,
        token_hash: tokenHash,
        ip_address: ip,
        user_agent: userAgent,
        dispositivo,
        fecha_expiracion: fechaExpiracion,
      },
    });
  }

  /**
   * Valida una sesión por su refresh token
   */
  async validarSesion(refreshToken: string, clienteId: number) {
    const tokenHash = this.hashToken(refreshToken);

    const sesion = await this.prisma.cliente_sesiones.findFirst({
      where: {
        token_hash: tokenHash,
        id_cliente: clienteId,
        revocada: false,
        fecha_expiracion: { gte: new Date() },
      },
    });

    return sesion;
  }

  /**
   * Actualiza el token de una sesión (rotación de refresh token)
   */
  async actualizarToken(
    sessionId: number,
    nuevoRefreshToken: string,
  ) {
    const tokenHash = this.hashToken(nuevoRefreshToken);
    const fechaExpiracion = new Date(
      Date.now() + this.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
    );

    return this.prisma.cliente_sesiones.update({
      where: { id_sesion: sessionId },
      data: {
        token_hash: tokenHash,
        fecha_expiracion: fechaExpiracion,
        ultima_actividad: new Date(),
      },
    });
  }

  /**
   * Revoca una sesión específica
   */
  async revocarSesion(sessionId: number, clienteId: number) {
    return this.prisma.cliente_sesiones.updateMany({
      where: {
        id_sesion: sessionId,
        id_cliente: clienteId,
        revocada: false,
      },
      data: {
        revocada: true,
        fecha_revocacion: new Date(),
      },
    });
  }

  /**
   * Revoca todas las sesiones de un cliente
   */
  async revocarTodasLasSesiones(clienteId: number) {
    return this.prisma.cliente_sesiones.updateMany({
      where: {
        id_cliente: clienteId,
        revocada: false,
      },
      data: {
        revocada: true,
        fecha_revocacion: new Date(),
      },
    });
  }

  /**
   * Obtiene todas las sesiones activas de un cliente
   */
  async obtenerSesionesActivas(
    clienteId: number,
    sessionIdActual?: number,
  ): Promise<ClienteSessionResponse[]> {
    const sesiones = await this.prisma.cliente_sesiones.findMany({
      where: {
        id_cliente: clienteId,
        revocada: false,
        fecha_expiracion: { gte: new Date() },
      },
      orderBy: { ultima_actividad: 'desc' },
    });

    return sesiones.map((s) => ({
      id_sesion: s.id_sesion,
      dispositivo: s.dispositivo,
      ip_address: s.ip_address,
      ultima_actividad: s.ultima_actividad,
      fecha_creacion: s.fecha_creacion,
      es_sesion_actual: s.id_sesion === sessionIdActual,
    }));
  }

  /**
   * Limpia sesiones expiradas (puede ejecutarse como cron job)
   */
  async limpiarSesionesExpiradas() {
    return this.prisma.cliente_sesiones.deleteMany({
      where: {
        OR: [
          { fecha_expiracion: { lt: new Date() } },
          {
            revocada: true,
            fecha_revocacion: {
              lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 días
            },
          },
        ],
      },
    });
  }

  /**
   * Registra una acción en el log del cliente
   */
  async registrarLog(
    clienteId: number | null,
    accion: ClienteLogAccion,
    ip: string | null,
    userAgent: string | null,
    detalles?: Record<string, any>,
  ) {
    return this.prisma.cliente_log.create({
      data: {
        id_cliente: clienteId,
        accion,
        ip_address: ip,
        user_agent: userAgent,
        detalles: detalles ? JSON.stringify(detalles) : null,
      },
    });
  }

  /**
   * Hash de token usando SHA256
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Parsea el User-Agent para extraer información del dispositivo
   */
  private parseDispositivo(userAgent: string | null): string {
    if (!userAgent) return 'Desconocido';

    // Detectar navegador
    let browser = 'Navegador desconocido';
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
      browser = 'Chrome';
    } else if (userAgent.includes('Firefox')) {
      browser = 'Firefox';
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      browser = 'Safari';
    } else if (userAgent.includes('Edg')) {
      browser = 'Edge';
    } else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
      browser = 'Opera';
    }

    // Detectar sistema operativo
    let os = 'Sistema desconocido';
    if (userAgent.includes('Windows')) {
      os = 'Windows';
    } else if (userAgent.includes('Mac OS')) {
      os = 'macOS';
    } else if (userAgent.includes('Linux')) {
      os = 'Linux';
    } else if (userAgent.includes('Android')) {
      os = 'Android';
    } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      os = 'iOS';
    }

    return `${browser} en ${os}`;
  }
}
