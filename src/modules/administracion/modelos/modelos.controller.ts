// src/modules/administracion/modelos/modelos.controller.ts
import { Controller, Get, Post, Body, Param, Delete, ParseIntPipe, Query, Put } from '@nestjs/common';
import { ModelosService } from './modelos.service';
import { CreateModeloDto } from './dto/create-modelo.dto';
import { UpdateModeloDto } from './dto/update-modelo.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Auth } from 'src/modules/auth/decorators';
import { RequirePermissions } from 'src/modules/auth/decorators/require-permissions.decorator';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { PaginationDto } from 'src/common/dto';

@ApiTags('Modelos')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('modelos')
@Auth()
export class ModelosController {
  constructor(private readonly modelosService: ModelosService) {}

  @Post()
  @RequirePermissions('administracion.modelos:crear')
  @ApiOperation({ summary: 'Crear un nuevo modelo' })
  @ApiResponse({ status: 201, description: 'El modelo ha sido creado.' })
  @ApiResponse({ status: 400, description: 'Petición inválida.' })
  create(@Body() createModeloDto: CreateModeloDto) {
    return this.modelosService.create(createModeloDto);
  }

  @Get()
  @RequirePermissions('administracion.modelos:ver')
  @ApiOperation({ summary: 'Obtener todos los modelos activos con paginación y búsqueda' })
  @ApiResponse({ status: 200, description: 'Retorna los modelos paginados.' })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.modelosService.findAll(paginationDto);
  }

  @Get('all')
  @RequirePermissions('administracion.catalogo:ver')
  @ApiOperation({ summary: 'Obtener todos los modelos activos (para selectores)' })
  @ApiResponse({ status: 200, description: 'Retorna todos los modelos activos.' })
  findAllActive() {
    return this.modelosService.findAllActive();
  }

  @Get('by-marca/:idMarca')
  @RequirePermissions('administracion.catalogo:ver')
  @ApiOperation({ summary: 'Obtener modelos por marca' })
  @ApiResponse({ status: 200, description: 'Retorna los modelos de la marca especificada.' })
  findByMarca(@Param('idMarca', ParseIntPipe) idMarca: number) {
    return this.modelosService.findByMarca(idMarca);
  }

  @Get(':id')
  @RequirePermissions('administracion.modelos:ver')
  @ApiOperation({ summary: 'Obtener un modelo por su ID' })
  @ApiResponse({ status: 200, description: 'Retorna el modelo.' })
  @ApiResponse({ status: 404, description: 'Modelo no encontrado.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.modelosService.findOne(id);
  }

  @Put(':id')
  @RequirePermissions('administracion.modelos:editar')
  @ApiOperation({ summary: 'Actualizar un modelo' })
  @ApiResponse({ status: 200, description: 'El modelo ha sido actualizado.' })
  @ApiResponse({ status: 404, description: 'Modelo no encontrado.' })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateModeloDto: UpdateModeloDto) {
    return this.modelosService.update(id, updateModeloDto);
  }

  @Delete(':id')
  @RequirePermissions('administracion.modelos:eliminar')
  @ApiOperation({ summary: 'Eliminar un modelo (cambia estado a INACTIVO)' })
  @ApiResponse({ status: 200, description: 'El modelo ha sido inactivado.' })
  @ApiResponse({ status: 404, description: 'Modelo no encontrado.' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.modelosService.remove(id);
  }
}
