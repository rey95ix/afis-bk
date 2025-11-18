import { BadRequestException, CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { META_ROL } from 'src/modules/auth/decorators/role-protected.decorator'; 

@Injectable()
export class UserRoleGuard implements CanActivate {

  constructor(
    private readonly reflector: Reflector
  ) {

  }
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {

    const validRoles: string[] = this.reflector.get(META_ROL, context.getHandler())

    // Si no hay roles definidos, permitir acceso (solo autenticación requerida)
    if (!validRoles) return true;
    if (validRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user) throw new BadRequestException('Usuario no encontrado')

    // Verificar si el usuario tiene el rol requerido
    // El usuario viene con la relación 'roles' cargada por JwtStrategy
    const userRoleName = user.roles?.nombre;

    if (!userRoleName) {
      throw new ForbiddenException('Usuario no tiene rol asignado');
    }

    // Validar si el rol del usuario está en la lista de roles permitidos
    const hasValidRole = validRoles.some(role => role === userRoleName);

    if (!hasValidRole) {
      throw new ForbiddenException(
        `Usuario con rol '${userRoleName}' no está autorizado para esta acción. Roles permitidos: ${validRoles.join(', ')}`
      );
    }

    // Usuario tiene un rol válido, permitir acceso
    return true;
  }
}
