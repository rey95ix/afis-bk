// src/modules/administracion/atc-plan/atc-plan.controller.ts
import { Controller, Get, Post, Body, Put, Param, Delete, ParseIntPipe, Query } from '@nestjs/common';
import { AtcPlanService } from './atc-plan.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Auth, GetUser } from 'src/modules/auth/decorators';
import { RequirePermissions } from 'src/modules/auth/decorators/require-permissions.decorator';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { PaginationDto } from 'src/common/dto';

@ApiTags('Planes de Servicio')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('administracion/planes')
@Auth()
export class AtcPlanController {
  constructor(private readonly atcPlanService: AtcPlanService) {}

  @Post()
  @RequirePermissions('administracion.planes:crear')
  @ApiOperation({ summary: 'Crear un nuevo plan de servicio' })
  @ApiResponse({ status: 201, description: 'El plan ha sido creado exitosamente.' })
  @ApiResponse({ status: 400, description: 'Datos inválidos.' })
  @ApiResponse({ status: 404, description: 'Tipo de plan no encontrado.' })
  create(@Body() createPlanDto: CreatePlanDto, @GetUser('id_usuario') id_usuario: number) {
    return this.atcPlanService.create(createPlanDto, id_usuario);
  }

  @Get()
  @RequirePermissions('administracion.planes:ver')
  @ApiOperation({ summary: 'Obtener todos los planes con paginación y búsqueda' })
  @ApiResponse({
    status: 200,
    description: 'Lista de planes paginada.',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object' } },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.atcPlanService.findAll(paginationDto);
  }

  @Get('all')
  @RequirePermissions('administracion.planes:ver')
  @ApiOperation({ summary: 'Obtener todos los planes activos (para selects)' })
  @ApiResponse({ status: 200, description: 'Lista de todos los planes activos.' })
  findAllActive() {
    return this.atcPlanService.findAllActive();
  }

  @Get('tipos-plan')
  @RequirePermissions('administracion.planes:ver')
  @ApiOperation({ summary: 'Obtener tipos de plan para selects' })
  @ApiResponse({ status: 200, description: 'Lista de tipos de plan.' })
  getTiposPlan() {
    return this.atcPlanService.getTiposPlan();
  }

  @Get(':id')
  @RequirePermissions('administracion.planes:ver')
  @ApiOperation({ summary: 'Obtener un plan por ID' })
  @ApiResponse({ status: 200, description: 'Plan encontrado.' })
  @ApiResponse({ status: 404, description: 'Plan no encontrado.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.atcPlanService.findOne(id);
  }

  @Put(':id')
  @RequirePermissions('administracion.planes:editar')
  @ApiOperation({ summary: 'Actualizar un plan' })
  @ApiResponse({ status: 200, description: 'El plan ha sido actualizado.' })
  @ApiResponse({ status: 404, description: 'Plan o tipo de plan no encontrado.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePlanDto: UpdatePlanDto,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.atcPlanService.update(id, updatePlanDto, id_usuario);
  }

  @Delete(':id')
  @RequirePermissions('administracion.planes:eliminar')
  @ApiOperation({ summary: 'Eliminar un plan (soft delete)' })
  @ApiResponse({ status: 200, description: 'El plan ha sido eliminado.' })
  @ApiResponse({ status: 400, description: 'No se puede eliminar, tiene contratos asociados.' })
  @ApiResponse({ status: 404, description: 'Plan no encontrado.' })
  remove(@Param('id', ParseIntPipe) id: number, @GetUser('id_usuario') id_usuario: number) {
    return this.atcPlanService.remove(id, id_usuario);
  }
}
