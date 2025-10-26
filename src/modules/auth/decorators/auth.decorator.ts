import { UseGuards, applyDecorators } from '@nestjs/common';
import { ValidRoles } from '../interfaces';
import { RoleProtected } from './role-protected.decorator';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../guards/user-role.guard';

export function Auth(...args: ValidRoles[]) {
    return applyDecorators(
        RoleProtected(...args),//ValidRoles.admin
        UseGuards(AuthGuard(), UserRoleGuard),
    );
}