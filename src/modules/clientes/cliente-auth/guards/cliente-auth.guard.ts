import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Guard de autenticación para el portal de clientes
 *
 * Extiende AuthGuard con la estrategia 'jwt-cliente' y agrega
 * soporte para endpoints públicos marcados con @Public()
 */
@Injectable()
export class ClienteAuthGuard extends AuthGuard('jwt-cliente') {
  constructor(private reflector: Reflector) {
    super();
  }

  /**
   * Determina si el request puede proceder
   * Endpoints marcados con @Public() son permitidos sin autenticación
   */
  canActivate(context: ExecutionContext) {
    // Verificar si el endpoint está marcado como público
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si es público, permitir sin autenticación
    if (isPublic) {
      return true;
    }

    // Si no es público, usar la validación normal de JWT
    return super.canActivate(context);
  }
}
