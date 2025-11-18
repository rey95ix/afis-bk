import { SetMetadata } from '@nestjs/common';
import { PERMISSIONS_KEY } from '../guards/permissions.guard';

/**
 * Decorador para proteger rutas con permisos granulares
 *
 * @param permissions Array de códigos de permisos requeridos (se requiere AL MENOS UNO)
 *
 * @example
 * // Requiere permiso para ver compras
 * @RequirePermissions('inventario.compras:ver')
 * @Get()
 * findAll() { ... }
 *
 * @example
 * // Requiere crear O editar compras (al menos uno)
 * @RequirePermissions('inventario.compras:crear', 'inventario.compras:editar')
 * @Post()
 * create() { ... }
 *
 * @example
 * // Requiere permiso para aprobar requisiciones (acción crítica)
 * @RequirePermissions('inventario.requisiciones:aprobar')
 * @Patch(':id/aprobar')
 * aprobar() { ... }
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
