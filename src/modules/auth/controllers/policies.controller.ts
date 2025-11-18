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
import { CreatePolicyDto } from '../dto/create-policy.dto';
import { UpdatePolicyDto } from '../dto/update-policy.dto';
import { Auth } from '../decorators/auth.decorator';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { PoliciesService } from '../services/policies.service';

@ApiTags('Policies')
@ApiBearerAuth()
@Controller('policies')
export class PoliciesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policiesService: PoliciesService,
  ) {}

  @Post()
  @Auth()
  @ApiOperation({ summary: 'Crear una nueva política' })
  @ApiResponse({ status: 201, description: 'Política creada exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 409, description: 'El código de la política ya existe' })
  async create(@Body() createPolicyDto: CreatePolicyDto) {
    const politica = await this.prisma.politicas.create({
      data: {
        codigo: createPolicyDto.codigo,
        nombre: createPolicyDto.nombre,
        descripcion: createPolicyDto.descripcion,
        tipo: createPolicyDto.tipo as any,
        handler: createPolicyDto.handler,
        configuracion: createPolicyDto.configuracion,
      },
    });

    return {
      politica,
      message: 'Política creada exitosamente',
    };
  }

  @Get()
  @Auth()
  @ApiOperation({ summary: 'Obtener lista de políticas con paginación y filtros' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'tipo', required: false, example: 'SUCURSAL' })
  @ApiQuery({ name: 'estado', required: false, example: 'ACTIVO' })
  @ApiQuery({ name: 'search', required: false, description: 'Buscar por código o nombre' })
  @ApiResponse({ status: 200, description: 'Lista de políticas obtenida exitosamente' })
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('tipo') tipo?: string,
    @Query('estado') estado?: string,
    @Query('search') search?: string,
  ) {
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const where: any = {};

    if (tipo) where.tipo = tipo;
    if (estado) where.estado = estado;
    if (search) {
      where.OR = [
        { codigo: { contains: search, mode: 'insensitive' } },
        { nombre: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [politicas, total] = await Promise.all([
      this.prisma.politicas.findMany({
        where,
        skip,
        take: limitNumber,
        orderBy: { fecha_creacion: 'desc' },
        include: {
          permiso_politicas: {
            include: {
              permisos: {
                select: {
                  id_permiso: true,
                  codigo: true,
                  nombre: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.politicas.count({ where }),
    ]);

    return {
      politicas: politicas.map((p) => ({
        ...p,
        total_permisos: p.permiso_politicas.length,
      })),
      meta: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
    };
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: 'Obtener una política por ID' })
  @ApiResponse({ status: 200, description: 'Política encontrada' })
  @ApiResponse({ status: 404, description: 'Política no encontrada' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const politica = await this.prisma.politicas.findUnique({
      where: { id_politica: id },
      include: {
        permiso_politicas: {
          include: {
            permisos: {
              select: {
                id_permiso: true,
                codigo: true,
                nombre: true,
                modulo: true,
                recurso: true,
                accion: true,
              },
            },
          },
        },
      },
    });

    if (!politica) {
      throw new Error('Política no encontrada');
    }

    return {
      politica,
      estadisticas: {
        permisos_asignados: politica.permiso_politicas.length,
      },
    };
  }

  @Patch(':id')
  @Auth()
  @ApiOperation({ summary: 'Actualizar una política' })
  @ApiResponse({ status: 200, description: 'Política actualizada exitosamente' })
  @ApiResponse({ status: 404, description: 'Política no encontrada' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePolicyDto: UpdatePolicyDto,
  ) {
    const politica = await this.prisma.politicas.update({
      where: { id_politica: id },
      data: {
        ...(updatePolicyDto.nombre && { nombre: updatePolicyDto.nombre }),
        ...(updatePolicyDto.descripcion !== undefined && {
          descripcion: updatePolicyDto.descripcion,
        }),
        ...(updatePolicyDto.tipo && { tipo: updatePolicyDto.tipo as any }),
        ...(updatePolicyDto.handler && { handler: updatePolicyDto.handler }),
        ...(updatePolicyDto.configuracion !== undefined && {
          configuracion: updatePolicyDto.configuracion,
        }),
        ...(updatePolicyDto.estado && { estado: updatePolicyDto.estado as any }),
      },
    });

    return {
      politica,
      message: 'Política actualizada exitosamente',
    };
  }

  @Delete(':id')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar una política (soft delete)' })
  @ApiResponse({ status: 200, description: 'Política eliminada exitosamente' })
  @ApiResponse({ status: 404, description: 'Política no encontrada' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    const politica = await this.prisma.politicas.update({
      where: { id_politica: id },
      data: {
        estado: 'INACTIVO',
      },
    });

    return {
      politica,
      message: 'Política desactivada exitosamente',
    };
  }

  @Get(':codigo/test')
  @Auth()
  @ApiOperation({
    summary: 'Probar evaluación de una política con contexto simulado',
    description:
      'Endpoint para testing que permite evaluar una política con datos de prueba sin afectar datos reales',
  })
  @ApiResponse({ status: 200, description: 'Resultado de la evaluación de la política' })
  async testPolicy(@Param('codigo') codigo: string, @Body() testContext: any) {
    const result = await this.policiesService.evaluatePolicy(codigo, testContext);

    return {
      codigo,
      resultado: result,
      contexto_usado: testContext,
      message: result
        ? 'La política se cumple con el contexto proporcionado'
        : 'La política NO se cumple con el contexto proporcionado',
    };
  }
}
