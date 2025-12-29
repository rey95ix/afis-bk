import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { JwtClientePayload, ClienteAutenticado } from '../interfaces';

/**
 * Estrategia JWT separada para autenticación de clientes del portal
 * Usa un secret diferente al de usuarios internos para mayor seguridad
 *
 * Nombre de la estrategia: 'jwt-cliente'
 * Uso: @UseGuards(AuthGuard('jwt-cliente'))
 */
@Injectable()
export class JwtClienteStrategy extends PassportStrategy(Strategy, 'jwt-cliente') {
  constructor(
    private prisma: PrismaService,
    configService: ConfigService,
  ) {
    super({
      // Extraer token del header Authorization: Bearer <token>
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // Usar secret separado para clientes (diferente al de usuarios internos)
      // Si no está configurado, usa el mismo secret pero esto NO es recomendado
      secretOrKey: configService.get('JWT_SECRET_CLIENTES') || configService.get('JWT_SECRET'),

      // No ignorar expiración - dejar que JWT maneje esto
      ignoreExpiration: false,
    });
  }

  /**
   * Valida el payload del JWT y retorna los datos del cliente autenticado
   * Este método es llamado automáticamente por Passport después de verificar la firma
   *
   * @param payload - Payload decodificado del JWT
   * @returns ClienteAutenticado - Datos del cliente para adjuntar al request
   * @throws UnauthorizedException - Si el cliente no existe, está inactivo o la sesión fue revocada
   */
  async validate(payload: JwtClientePayload): Promise<ClienteAutenticado> {
    const { id_cliente, session_id, type } = payload;

    // Solo aceptar access tokens (no refresh tokens)
    if (type !== 'access') {
      throw new UnauthorizedException('Token inválido');
    }

    // Verificar que el cliente exista y esté activo
    const cliente = await this.prisma.cliente.findFirst({
      where: {
        id_cliente,
        estado: 'ACTIVO',
        cuenta_activada: true,
        cuenta_bloqueada: false,
      },
      select: {
        id_cliente: true,
        titular: true,
        dui: true,
        correo_electronico: true,
        telefono1: true,
        estado: true,
        cuenta_activada: true,
        cuenta_bloqueada: true,
      },
    });

    if (!cliente) {
      throw new UnauthorizedException('Sesión inválida o cuenta desactivada');
    }

    // Verificar que la sesión sea válida (no revocada y no expirada)
    if (session_id) {
      const sesion = await this.prisma.cliente_sesiones.findFirst({
        where: {
          id_sesion: session_id,
          id_cliente,
          revocada: false,
          fecha_expiracion: { gte: new Date() },
        },
      });

      if (!sesion) {
        throw new UnauthorizedException('Sesión expirada o revocada');
      }

      // Actualizar última actividad de la sesión (async, no esperamos)
      this.prisma.cliente_sesiones
        .update({
          where: { id_sesion: session_id },
          data: { ultima_actividad: new Date() },
        })
        .catch(() => {
          // Ignorar errores de actualización de actividad
        });
    }

    // Retornar datos del cliente autenticado
    // Estos datos estarán disponibles en req.user (o req.cliente con el decorador)
    return {
      id_cliente: cliente.id_cliente,
      titular: cliente.titular,
      dui: cliente.dui,
      correo_electronico: cliente.correo_electronico,
      telefono1: cliente.telefono1,
      estado: cliente.estado,
      cuenta_activada: cliente.cuenta_activada,
      cuenta_bloqueada: cliente.cuenta_bloqueada,
      session_id,
    };
  }
}
