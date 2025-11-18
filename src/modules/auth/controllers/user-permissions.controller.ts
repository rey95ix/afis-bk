import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AssignPermissionToUserDto } from '../dto/assign-permission-to-user.dto';
import { Auth } from '../decorators/auth.decorator';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { GetUser } from '../decorators/get-user.decorators';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { PermissionsService } from '../services/permissions.service';

@ApiTags('User Permissions')
@ApiBearerAuth()
@Controller('users/:id_usuario/permissions')
export class UserPermissionsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get()
  @Auth()
  @RequirePermissions('auth.user_permissions:ver')
  @ApiOperation({
    summary: 'Obtener todos los permisos de un usuario (rol + individuales)',
  })
  @ApiResponse({ status: 200, description: 'Permisos del usuario obtenidos exitosamente' })
  async getUserPermissions(@Param('id_usuario', ParseIntPipe) id_usuario: number) {
    const usuario = await this.prisma.usuarios.findUnique({
      where: { id_usuario },
      select: {
        id_usuario: true,
        nombres: true,
        usuario: true,
        id_rol: true,
      },
    });

    if (!usuario) {
      throw new Error('Usuario no encontrado');
    }

    // Obtener rol del usuario
    const rol = await this.prisma.roles.findUnique({
      where: { id_rol: usuario.id_rol },
      select: {
        id_rol: true,
        nombre: true,
      },
    });

    // Obtener permisos del rol
    const permisosRol = await this.prisma.rol_permisos.findMany({
      where: {
        id_rol: usuario.id_rol,
      },
      include: {
        permisos: true,
      },
    });

    // Obtener permisos individuales
    const permisosIndividuales = await this.prisma.usuario_permisos.findMany({
      where: {
        id_usuario,
        OR: [
          { fecha_expiracion: null },
          { fecha_expiracion: { gte: new Date() } },
        ],
      },
      include: {
        permisos: true,
      },
    });

    // Obtener todos los permisos únicos
    const todosLosPermisos = await this.permissionsService.getUserPermissions(id_usuario);

    return {
      usuario: {
        id_usuario: usuario.id_usuario,
        nombre: usuario.nombres,
        usuario: usuario.usuario,
        rol: rol,
      },
      permisos_rol: permisosRol.map((rp: any) => rp.permisos),
      permisos_individuales: permisosIndividuales.map((up) => ({
        ...up.permisos,
        asignado_por: up.asignado_por,
        motivo: up.motivo,
        fecha_expiracion: up.fecha_expiracion,
        fecha_creacion: up.fecha_creacion,
      })),
      todos_los_permisos: todosLosPermisos,
      estadisticas: {
        permisos_del_rol: permisosRol.length,
        permisos_individuales: permisosIndividuales.length,
        total_permisos: todosLosPermisos.length,
      },
    };
  }

  @Post()
  @Auth()
  @RequirePermissions('auth.user_permissions:asignar')
  @ApiOperation({
    summary: 'Asignar un permiso individual a un usuario',
    description:
      'Asigna un permiso adicional más allá de los permisos del rol del usuario',
  })
  @ApiResponse({ status: 201, description: 'Permiso asignado exitosamente' })
  @ApiResponse({ status: 409, description: 'El usuario ya tiene este permiso' })
  async assignPermission(
    @Param('id_usuario', ParseIntPipe) id_usuario: number,
    @Body() assignPermissionDto: AssignPermissionToUserDto,
    @GetUser('id_usuario') asignadoPor: number,
  ) {
    // Verificar que el usuario existe
    const usuario = await this.prisma.usuarios.findUnique({
      where: { id_usuario },
    });

    if (!usuario) {
      throw new Error('Usuario no encontrado');
    }

    // Verificar que el permiso existe
    const permiso = await this.prisma.permisos.findUnique({
      where: { id_permiso: assignPermissionDto.id_permiso },
    });

    if (!permiso) {
      throw new Error('Permiso no encontrado');
    }

    // Crear asignación de permiso
    const usuarioPermiso = await this.prisma.usuario_permisos.create({
      data: {
        id_usuario,
        id_permiso: assignPermissionDto.id_permiso,
        asignado_por: asignadoPor,
        motivo: assignPermissionDto.motivo,
        fecha_expiracion: assignPermissionDto.fecha_expiracion
          ? new Date(assignPermissionDto.fecha_expiracion)
          : null,
      },
      include: {
        permisos: true,
      },
    });

    // Invalidar caché de permisos del usuario
    this.permissionsService.clearCache(id_usuario);

    return {
      usuario_permiso: usuarioPermiso,
      message: 'Permiso asignado al usuario exitosamente',
    };
  }

  @Delete(':id_permiso')
  @Auth()
  @RequirePermissions('auth.user_permissions:revocar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remover un permiso individual de un usuario',
    description: 'Solo remueve permisos individuales, no afecta permisos del rol',
  })
  @ApiResponse({ status: 200, description: 'Permiso removido exitosamente' })
  @ApiResponse({ status: 404, description: 'Permiso no asignado al usuario' })
  async removePermission(
    @Param('id_usuario', ParseIntPipe) id_usuario: number,
    @Param('id_permiso', ParseIntPipe) id_permiso: number,
  ) {
    const usuarioPermiso = await this.prisma.usuario_permisos.findFirst({
      where: {
        id_usuario,
        id_permiso,
      },
    });

    if (!usuarioPermiso) {
      throw new Error('Permiso individual no asignado a este usuario');
    }

    await this.prisma.usuario_permisos.delete({
      where: {
        id_usuario_permiso: usuarioPermiso.id_usuario_permiso,
      },
    });

    // Invalidar caché de permisos del usuario
    this.permissionsService.clearCache(id_usuario);

    return {
      message: 'Permiso individual removido del usuario exitosamente',
    };
  }

  @Get('grouped-by-module')
  @Auth()
  @RequirePermissions('auth.user_permissions:ver')
  @ApiOperation({
    summary: 'Obtener permisos del usuario agrupados por módulo',
  })
  @ApiResponse({ status: 200, description: 'Permisos agrupados obtenidos exitosamente' })
  async getPermissionsGroupedByModule(@Param('id_usuario', ParseIntPipe) id_usuario: number) {
    const permisosPorModulo = await this.permissionsService.getUserPermissionsByModule(
      id_usuario,
    );

    return {
      id_usuario,
      permisos_por_modulo: permisosPorModulo,
      total_modulos: Object.keys(permisosPorModulo).length,
    };
  }
}
