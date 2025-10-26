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

    if (!validRoles) return true;
    if (validRoles.length === 0) return true;
    const req = context.switchToHttp().getRequest();
    const user = req.user;// as MarcaUsrUsuario;
    if (!user) throw new BadRequestException('Usuario no encontrado') 

    throw new ForbiddenException('Usuario autorizado para esta accion');
  }
}
