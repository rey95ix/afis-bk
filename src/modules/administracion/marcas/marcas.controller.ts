// src/modules/administracion/marcas/marcas.controller.ts
import { Controller, Get, Post, Body, Param, Delete, ParseIntPipe, Query, Put } from '@nestjs/common';
import { MarcasService } from './marcas.service';
import { CreateMarcaDto } from './dto/create-marca.dto';
import { UpdateMarcaDto } from './dto/update-marca.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Auth } from 'src/modules/auth/decorators';
import { RequirePermissions } from 'src/modules/auth/decorators/require-permissions.decorator';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { PaginationDto } from 'src/common/dto';

@ApiTags('Marcas')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('marcas')
@Auth()
export class MarcasController {
  constructor(private readonly marcasService: MarcasService) {}

  @Post()
  @RequirePermissions('administracion.marcas:crear')
  @ApiOperation({ summary: 'Crear una nueva marca' })
  @ApiResponse({ status: 201, description: 'La marca ha sido creada.' })
  @ApiResponse({ status: 400, description: 'Petición inválida.' })
  create(@Body() createMarcaDto: CreateMarcaDto) {
    return this.marcasService.create(createMarcaDto);
  }

  @Get()
  @RequirePermissions('administracion.marcas:ver')
  @ApiOperation({ summary: 'Obtener todas las marcas activas con paginación y búsqueda' })
  @ApiResponse({ status: 200, description: 'Retorna las marcas paginadas.' })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.marcasService.findAll(paginationDto);
  }

  @Get('all')
  @RequirePermissions('administracion.catalogo:ver')
  @ApiOperation({ summary: 'Obtener todas las marcas activas (para selectores)' })
  @ApiResponse({ status: 200, description: 'Retorna todas las marcas activas.' })
  findAllActive() {
    return this.marcasService.findAllActive();
  }

  @Get(':id')
  @RequirePermissions('administracion.marcas:ver')
  @ApiOperation({ summary: 'Obtener una marca por su ID' })
  @ApiResponse({ status: 200, description: 'Retorna la marca.' })
  @ApiResponse({ status: 404, description: 'Marca no encontrada.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.marcasService.findOne(id);
  }

  @Put(':id')
  @RequirePermissions('administracion.marcas:editar')
  @ApiOperation({ summary: 'Actualizar una marca' })
  @ApiResponse({ status: 200, description: 'La marca ha sido actualizada.' })
  @ApiResponse({ status: 404, description: 'Marca no encontrada.' })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateMarcaDto: UpdateMarcaDto) {
    return this.marcasService.update(id, updateMarcaDto);
  }

  @Delete(':id')
  @RequirePermissions('administracion.marcas:eliminar')
  @ApiOperation({ summary: 'Eliminar una marca (cambia estado a INACTIVO)' })
  @ApiResponse({ status: 200, description: 'La marca ha sido inactivada.' })
  @ApiResponse({ status: 404, description: 'Marca no encontrada.' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.marcasService.remove(id);
  }
}
