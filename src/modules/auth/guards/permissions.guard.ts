import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsService } from '../services/permissions.service';
import { PoliciesService } from '../services/policies.service';

/**
 * Metadatos para decorador @RequirePermissions
 */
export const PERMISSIONS_KEY = 'permissions';

/**
 * Metadatos para decorador @Policy
 */
export const POLICY_KEY = 'policy';

/**
 * Guard para validar permisos granulares de usuarios
 * Soporta permisos a nivel de recurso:acción y políticas condicionales
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
    private readonly policiesService: PoliciesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Obtener permisos requeridos del decorador @RequirePermissions
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si no hay permisos requeridos, permitir acceso
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // Obtener usuario autenticado
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new BadRequestException('Usuario no encontrado en request');
    }

    const id_usuario = user.id_usuario;
    const id_rol = user.id_rol;

    if (!id_usuario) {
      throw new BadRequestException('ID de usuario no válido');
    }

    // ✅ SUPER ADMIN BYPASS: Rol 1 tiene acceso total sin restricciones
    if (id_rol === 1) {
      // Super Administrador puede hacer TODO
      // No verificar permisos ni políticas
      return true;
    }

    // Verificar permisos (para usuarios que NO son Super Admin)
    const hasPermission = await this.permissionsService.hasAnyPermission(
      id_usuario,
      requiredPermissions,
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `No tiene permisos para esta acción. Se requiere al menos uno de: ${requiredPermissions.join(', ')}`,
      );
    }

    // Obtener políticas asociadas del decorador @Policy
    const policyCode = this.reflector.get<string>(POLICY_KEY, context.getHandler());

    // Si hay política, evaluarla
    if (policyCode) {
      // Construir contexto de política
      // NOTA: Si la política necesita el recurso, debe ser cargado por el controlador
      // y estar disponible en request (ej: request.resource)
      const policyContext = this.policiesService.buildContextFromExecution(
        context,
        request.resource, // Recurso cargado previamente (opcional)
      );

      const policyResult = await this.policiesService.evaluatePolicy(
        policyCode,
        policyContext,
      );

      if (!policyResult) {
        throw new ForbiddenException(
          `No cumple con la política de autorización '${policyCode}'`,
        );
      }
    }

    // Usuario tiene permisos y cumple políticas
    return true;
  }
}
