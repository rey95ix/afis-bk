import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse, ApiForbiddenResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

/**
 * Decorador compuesto para proteger endpoints del portal de clientes
 *
 * Incluye:
 * - AuthGuard con estrategia 'jwt-cliente'
 * - Documentación Swagger automática
 *
 * Uso:
 * @ClienteAuth()
 * @Get('profile')
 * getProfile(@GetCliente() cliente: ClienteAutenticado) {
 *   return cliente;
 * }
 */
export function ClienteAuth() {
  return applyDecorators(
    UseGuards(AuthGuard('jwt-cliente')),
    ApiBearerAuth('cliente-auth'),
    ApiUnauthorizedResponse({
      description: 'No autenticado - Token inválido, expirado o no proporcionado',
    }),
    ApiForbiddenResponse({
      description: 'Cuenta bloqueada, desactivada o sesión revocada',
    }),
  );
}
