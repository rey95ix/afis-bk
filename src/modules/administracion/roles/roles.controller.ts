import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Auth } from '../../auth/decorators/auth.decorator';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator'; 
import { RolesService } from './roles.service';
import { CreateRolDto } from './dto/create-rol.dto';
import { UpdateRolDto } from './dto/update-rol.dto';
import { AssignPermissionsToRoleDto } from '../../auth/dto/assign-permissions-to-role.dto';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { PermissionsService } from 'src/modules/auth/services/permissions.service';
import { GetUser } from 'src/modules/auth/decorators';

@ApiTags('Roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(
    private readonly rolesService: RolesService,
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get()
  @Auth()
  @RequirePermissions('administracion.roles:ver')
  @ApiOperation({ summary: 'Obtener todos los roles activos' })
  @ApiResponse({ status: 200, description: 'Lista de roles obtenida exitosamente' })
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @Auth()
  @RequirePermissions('administracion.roles:ver')
  @ApiOperation({ summary: 'Obtener un rol por ID' })
  @ApiResponse({ status: 200, description: 'Rol encontrado exitosamente' })
  @ApiResponse({ status: 404, description: 'Rol no encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.findOne(id);
  }

  @Post()
  @Auth()
  @RequirePermissions('administracion.roles:crear')
  @ApiOperation({ summary: 'Crear un nuevo rol' })
  @ApiResponse({ status: 201, description: 'Rol creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o rol duplicado' })
  create(
    @Body() createRolDto: CreateRolDto,
    @GetUser('id_usuario') userId: number,
  ) {
    return this.rolesService.create(createRolDto, userId);
  }

  @Put(':id')
  @Auth()
  @RequirePermissions('administracion.roles:editar')
  @ApiOperation({ summary: 'Actualizar un rol existente' })
  @ApiResponse({ status: 200, description: 'Rol actualizado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o rol duplicado' })
  @ApiResponse({ status: 404, description: 'Rol no encontrado' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRolDto: UpdateRolDto,
    @GetUser('id_usuario') userId: number,
  ) {
    return this.rolesService.update(id, updateRolDto, userId);
  }

  @Delete(':id')
  @Auth()
  @RequirePermissions('administracion.roles:eliminar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar (desactivar) un rol' })
  @ApiResponse({ status: 200, description: 'Rol eliminado exitosamente' })
  @ApiResponse({ status: 400, description: 'No se puede eliminar el rol porque tiene usuarios asignados' })
  @ApiResponse({ status: 404, description: 'Rol no encontrado' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @GetUser('id_usuario') userId: number,
  ) {
    return this.rolesService.remove(id, userId);
  }

  @Get(':id/permissions')
  @Auth()
  @RequirePermissions('administracion.roles:ver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener todos los permisos asignados a un rol' })
  @ApiResponse({ status: 200, description: 'Lista de permisos del rol obtenida exitosamente' })
  @ApiResponse({ status: 404, description: 'Rol no encontrado' })
  async getRolePermissions(@Param('id', ParseIntPipe) id: number) {
    const rol = await this.prisma.roles.findUnique({
      where: { id_rol: id },
      include: {
        rol_permisos: {
          include: {
            permisos: true,
          },
        },
      },
    });

    if (!rol) {
      throw new Error('Rol no encontrado');
    }

    const permisos = rol.rol_permisos.map((rp: any) => rp.permisos);

    // Agrupar por módulo
    const permisosPorModulo = permisos.reduce((acc, permiso) => {
      if (!acc[permiso.modulo]) {
        acc[permiso.modulo] = [];
      }
      acc[permiso.modulo].push(permiso);
      return acc;
    }, {} as Record<string, any[]>);

    return {
      rol: {
        id_rol: rol.id_rol,
        nombre: rol.nombre,
        descripcion: rol.descripcion,
      },
      permisos,
      permisos_por_modulo: permisosPorModulo,
      total_permisos: permisos.length,
    };
  }

  @Post(':id/permissions')
  @Auth()
  @RequirePermissions('administracion.roles:asignar_permisos')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Asignar permisos a un rol',
    description: 'Reemplaza todos los permisos actuales del rol con los nuevos permisos especificados'
  })
  @ApiResponse({ status: 201, description: 'Permisos asignados exitosamente' })
  @ApiResponse({ status: 404, description: 'Rol no encontrado' })
  async assignPermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() assignPermissionsDto: AssignPermissionsToRoleDto,
  ) {
    // Verificar que el rol existe
    const rol = await this.prisma.roles.findUnique({
      where: { id_rol: id },
    });

    if (!rol) {
      throw new Error('Rol no encontrado');
    }

    // Eliminar permisos actuales del rol
    await this.prisma.rol_permisos.deleteMany({
      where: { id_rol: id },
    });

    // Asignar nuevos permisos
    await this.prisma.rol_permisos.createMany({
      data: assignPermissionsDto.id_permisos.map((id_permiso) => ({
        id_rol: id,
        id_permiso,
      })),
    });

    // Invalidar caché de permisos de todos los usuarios con este rol
    this.permissionsService.clearCache();

    const permisosAsignados = await this.prisma.permisos.findMany({
      where: {
        id_permiso: {
          in: assignPermissionsDto.id_permisos,
        },
      },
    });

    return {
      rol,
      permisos_asignados: permisosAsignados.length,
      permisos: permisosAsignados,
      message: 'Permisos asignados al rol exitosamente',
    };
  }

  @Delete(':id/permissions/:id_permiso')
  @Auth()
  @RequirePermissions('administracion.roles:asignar_permisos')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remover un permiso específico de un rol' })
  @ApiResponse({ status: 200, description: 'Permiso removido exitosamente' })
  @ApiResponse({ status: 404, description: 'Rol o permiso no encontrado' })
  async removePermission(
    @Param('id', ParseIntPipe) id: number,
    @Param('id_permiso', ParseIntPipe) id_permiso: number,
  ) {
    const rolPermiso = await this.prisma.rol_permisos.findFirst({
      where: {
        id_rol: id,
        id_permiso: id_permiso,
      },
    });

    if (!rolPermiso) {
      throw new Error('Permiso no asignado a este rol');
    }

    await this.prisma.rol_permisos.delete({
      where: {
        id_rol_permiso: rolPermiso.id_rol_permiso,
      },
    });

    // Invalidar caché de permisos
    this.permissionsService.clearCache();

    return {
      message: 'Permiso removido del rol exitosamente',
    };
  }
}
