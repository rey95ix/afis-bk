import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ClienteAutenticado } from '../interfaces';

/**
 * Decorador para obtener el cliente autenticado del request
 *
 * Uso básico (obtener todo el cliente):
 * @Get('profile')
 * getProfile(@GetCliente() cliente: ClienteAutenticado) {
 *   return cliente;
 * }
 *
 * Uso con propiedad específica:
 * @Get('id')
 * getId(@GetCliente('id_cliente') id: number) {
 *   return id;
 * }
 */
export const GetCliente = createParamDecorator(
  (data: keyof ClienteAutenticado | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const cliente = request.user as ClienteAutenticado;

    // Si se especifica una propiedad, retornar solo esa propiedad
    if (data) {
      return cliente?.[data];
    }

    // Si no se especifica, retornar todo el cliente
    return cliente;
  },
);
