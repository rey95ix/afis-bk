import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PermissionsService } from '../services/permissions.service';
import { CreatePermissionDto } from '../dto/create-permission.dto';
import { UpdatePermissionDto } from '../dto/update-permission.dto';
import { AssignPolicyToPermissionDto } from '../dto/assign-policy-to-permission.dto';
import { Auth } from '../decorators/auth.decorator';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { PrismaService } from 'src/modules/prisma/prisma.service';

@ApiTags('Permissions')
@ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
  constructor(
    private readonly permissionsService: PermissionsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Auth()
  @RequirePermissions('auth.permissions:crear')
  @ApiOperation({ summary: 'Crear un nuevo permiso' })
  @ApiResponse({ status: 201, description: 'Permiso creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 409, description: 'El código del permiso ya existe' })
  async create(@Body() createPermissionDto: CreatePermissionDto) {
    const permiso = await this.prisma.permisos.create({
      data: {
        codigo: createPermissionDto.codigo,
        nombre: createPermissionDto.nombre,
        descripcion: createPermissionDto.descripcion,
        modulo: createPermissionDto.modulo,
        recurso: createPermissionDto.recurso,
        accion: createPermissionDto.accion as any,
        tipo: (createPermissionDto.tipo || 'RECURSO') as any,
        es_critico: createPermissionDto.es_critico || false,
        requiere_auditoria: createPermissionDto.requiere_auditoria || false,
      },
    });

    return {
      permiso,
      message: 'Permiso creado exitosamente',
    };
  }

  @Get()
  @Auth()
  @RequirePermissions('auth.permissions:ver')
  @ApiOperation({ summary: 'Obtener lista de permisos con paginación y filtros' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'modulo', required: false, example: 'inventario' })
  @ApiQuery({ name: 'recurso', required: false, example: 'compras' })
  @ApiQuery({ name: 'accion', required: false, example: 'VER' })
  @ApiQuery({ name: 'estado', required: false, example: 'ACTIVO' })
  @ApiQuery({ name: 'search', required: false, description: 'Buscar por código o nombre' })
  @ApiResponse({ status: 200, description: 'Lista de permisos obtenida exitosamente' })
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('modulo') modulo?: string,
    @Query('recurso') recurso?: string,
    @Query('accion') accion?: string,
    @Query('estado') estado?: string,
    @Query('search') search?: string,
  ) {
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const where: any = {};

    if (modulo) where.modulo = modulo;
    if (recurso) where.recurso = recurso;
    if (accion) where.accion = accion;
    if (estado) where.estado = estado;
    if (search) {
      where.OR = [
        { codigo: { contains: search, mode: 'insensitive' } },
        { nombre: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [permisos, total] = await Promise.all([
      this.prisma.permisos.findMany({
        where,
        skip,
        take: limitNumber,
        orderBy: { fecha_creacion: 'desc' },
      }),
      this.prisma.permisos.count({ where }),
    ]);

    return {
      permisos,
      meta: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
    };
  }

  @Get('grouped-by-module')
  @Auth()
  @RequirePermissions('auth.permissions:ver')
  @ApiOperation({ summary: 'Obtener permisos agrupados por módulo' })
  @ApiResponse({ status: 200, description: 'Permisos agrupados obtenidos exitosamente' })
  async getGroupedByModule() {
    const permisos = await this.prisma.permisos.findMany({
      where: { estado: 'ACTIVO' },
      orderBy: [{ modulo: 'asc' }, { recurso: 'asc' }, { accion: 'asc' }],
    });

    const grouped = permisos.reduce((acc, permiso) => {
      if (!acc[permiso.modulo]) {
        acc[permiso.modulo] = [];
      }
      acc[permiso.modulo].push(permiso);
      return acc;
    }, {} as Record<string, any[]>);

    return {
      modulos: Object.keys(grouped).map((modulo) => ({
        nombre: modulo,
        permisos: grouped[modulo],
        total: grouped[modulo].length,
      })),
      total: permisos.length,
    };
  }

  @Get(':id')
  @Auth()
  @RequirePermissions('auth.permissions:ver')
  @ApiOperation({ summary: 'Obtener un permiso por ID' })
  @ApiResponse({ status: 200, description: 'Permiso encontrado' })
  @ApiResponse({ status: 404, description: 'Permiso no encontrado' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const permiso = await this.prisma.permisos.findUnique({
      where: { id_permiso: id },
      include: {
        rol_permisos: {
          include: {
            roles: {
              select: {
                id_rol: true,
                nombre: true,
              },
            },
          },
        },
        usuario_permisos: {
          include: {
            usuarios: {
              select: {
                id_usuario: true,
                nombres: true,
                usuario: true,
              },
            },
          },
        },
        permiso_politicas: {
          include: {
            politicas: true,
          },
        },
      },
    });

    if (!permiso) {
      throw new Error('Permiso no encontrado');
    }

    return {
      permiso,
      estadisticas: {
        roles_asignados: (permiso as any).rol_permisos?.length || 0,
        usuarios_asignados: (permiso as any).usuario_permisos?.length || 0,
        politicas_asignadas: (permiso as any).permiso_politicas?.length || 0,
      },
    };
  }

  @Patch(':id')
  @Auth()
  @RequirePermissions('auth.permissions:editar')
  @ApiOperation({ summary: 'Actualizar un permiso' })
  @ApiResponse({ status: 200, description: 'Permiso actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Permiso no encontrado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePermissionDto: UpdatePermissionDto,
  ) {
    const permiso = await this.prisma.permisos.update({
      where: { id_permiso: id },
      data: {
        ...(updatePermissionDto.nombre && { nombre: updatePermissionDto.nombre }),
        ...(updatePermissionDto.descripcion !== undefined && {
          descripcion: updatePermissionDto.descripcion,
        }),
        ...(updatePermissionDto.es_critico !== undefined && {
          es_critico: updatePermissionDto.es_critico,
        }),
        ...(updatePermissionDto.requiere_auditoria !== undefined && {
          requiere_auditoria: updatePermissionDto.requiere_auditoria,
        }),
        ...(updatePermissionDto.estado && { estado: updatePermissionDto.estado as any }),
        fecha_ultima_actualizacion: new Date(),
      },
    });

    // Invalidar caché de permisos
    this.permissionsService.clearCache();

    return {
      permiso,
      message: 'Permiso actualizado exitosamente',
    };
  }

  @Delete(':id')
  @Auth()
  @RequirePermissions('auth.permissions:eliminar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar un permiso (soft delete)' })
  @ApiResponse({ status: 200, description: 'Permiso eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Permiso no encontrado' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    const permiso = await this.prisma.permisos.update({
      where: { id_permiso: id },
      data: {
        estado: 'INACTIVO',
        fecha_ultima_actualizacion: new Date(),
      },
    });

    // Invalidar caché de permisos
    this.permissionsService.clearCache();

    return {
      permiso,
      message: 'Permiso desactivado exitosamente',
    };
  }

  @Post(':id/policies')
  @Auth()
  @RequirePermissions('auth.permissions:asignar_politica')
  @ApiOperation({ summary: 'Asignar una política a un permiso' })
  @ApiResponse({ status: 201, description: 'Política asignada exitosamente' })
  @ApiResponse({ status: 409, description: 'La política ya está asignada al permiso' })
  async assignPolicy(
    @Param('id', ParseIntPipe) id: number,
    @Body() assignPolicyDto: AssignPolicyToPermissionDto,
  ) {
    const permisoPolitica = await this.prisma.permiso_politicas.create({
      data: {
        id_permiso: id,
        id_politica: assignPolicyDto.id_politica,
      },
      include: {
        permisos: true,
        politicas: true,
      },
    });

    return {
      permiso_politica: permisoPolitica,
      message: 'Política asignada al permiso exitosamente',
    };
  }

  @Delete(':id/policies/:id_politica')
  @Auth()
  @RequirePermissions('auth.permissions:asignar_politica')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remover una política de un permiso' })
  @ApiResponse({ status: 200, description: 'Política removida exitosamente' })
  @ApiResponse({ status: 404, description: 'Asignación no encontrada' })
  async removePolicy(
    @Param('id', ParseIntPipe) id: number,
    @Param('id_politica', ParseIntPipe) id_politica: number,
  ) {
    const permisoPolitica = await this.prisma.permiso_politicas.findFirst({
      where: {
        id_permiso: id,
        id_politica: id_politica,
      },
    });

    if (!permisoPolitica) {
      throw new Error('Asignación de política no encontrada');
    }

    await this.prisma.permiso_politicas.delete({
      where: {
        id_permiso_politica: permisoPolitica.id_permiso_politica,
      },
    });

    return {
      message: 'Política removida del permiso exitosamente',
    };
  }
}
