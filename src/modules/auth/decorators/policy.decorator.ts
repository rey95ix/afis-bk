import { SetMetadata } from '@nestjs/common';
import { POLICY_KEY } from '../guards/permissions.guard';

/**
 * Decorador para aplicar una política condicional a una ruta
 *
 * Las políticas validan condiciones adicionales más allá de solo tener el permiso.
 * Ejemplos: misma sucursal, propietario del recurso, estado del recurso, etc.
 *
 * NOTA: Este decorador debe usarse en conjunto con @RequirePermissions o @Auth
 *
 * @param policyCode Código de la política a aplicar
 *
 * @example
 * // Solo permitir editar tickets de la misma sucursal
 * @RequirePermissions('atencion_cliente.tickets:editar')
 * @Policy('same_sucursal')
 * @Patch(':id')
 * update(@Param('id') id: number) { ... }
 *
 * @example
 * // Solo permitir cerrar tickets que no estén cerrados
 * @RequirePermissions('atencion_cliente.tickets:custom')
 * @Policy('ticket_not_closed')
 * @Patch(':id/cerrar')
 * cerrarTicket(@Param('id') id: number) { ... }
 *
 * @example
 * // Solo permitir aprobar requisiciones pendientes
 * @RequirePermissions('inventario.requisiciones:aprobar')
 * @Policy('requisicion_pendiente')
 * @Patch(':id/aprobar')
 * aprobar(@Param('id') id: number) { ... }
 *
 * IMPORTANTE: Para que las políticas funcionen correctamente, el controlador
 * debe cargar el recurso y agregarlo a request.resource ANTES de que se ejecute el guard.
 *
 * @example
 * // En el controlador, usar un interceptor o hacerlo manualmente:
 * @Patch(':id')
 * async update(@Param('id') id: number, @Req() request: Request) {
 *   // Cargar recurso
 *   const ticket = await this.service.findOne(id);
 *   request.resource = ticket; // Agregar a request para que lo use la política
 *   // ... resto de la lógica
 * }
 */
export const Policy = (policyCode: string) =>
  SetMetadata(POLICY_KEY, policyCode);
