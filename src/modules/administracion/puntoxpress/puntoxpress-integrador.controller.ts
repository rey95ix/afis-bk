import { Controller, Get, Post, Body, Param, Delete, ParseIntPipe, Query, Put } from '@nestjs/common';
import { PuntoxpressIntegradorService } from './puntoxpress-integrador.service';
import { CreatePuntoxpressIntegradorDto } from './dto/create-puntoxpress-integrador.dto';
import { UpdatePuntoxpressIntegradorDto } from './dto/update-puntoxpress-integrador.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Auth } from 'src/modules/auth/decorators';
import { RequirePermissions } from 'src/modules/auth/decorators/require-permissions.decorator';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { PaginationDto } from 'src/common/dto';

@ApiTags('PuntoXpress Usuarios')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('administracion/puntoxpress-usuarios')
@Auth()
export class PuntoxpressIntegradorController {
  constructor(private readonly puntoxpressIntegradorService: PuntoxpressIntegradorService) {}

  @Post()
  @RequirePermissions('administracion.puntoxpress_integradores:crear')
  @ApiOperation({ summary: 'Crear un nuevo integrador PuntoXpress' })
  @ApiResponse({ status: 201, description: 'El integrador ha sido creado.' })
  @ApiResponse({ status: 400, description: 'Petición inválida.' })
  create(@Body() createDto: CreatePuntoxpressIntegradorDto) {
    return this.puntoxpressIntegradorService.create(createDto);
  }

  @Get()
  @RequirePermissions('administracion.puntoxpress_integradores:ver')
  @ApiOperation({ summary: 'Obtener integradores activos con paginación y búsqueda' })
  @ApiResponse({ status: 200, description: 'Retorna los integradores paginados.' })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.puntoxpressIntegradorService.findAll(paginationDto);
  }

  @Get('all')
  @RequirePermissions('administracion.puntoxpress_integradores:ver')
  @ApiOperation({ summary: 'Obtener todos los integradores activos (para selectores)' })
  @ApiResponse({ status: 200, description: 'Retorna todos los integradores activos.' })
  findAllActive() {
    return this.puntoxpressIntegradorService.findAllActive();
  }

  @Get(':id')
  @RequirePermissions('administracion.puntoxpress_integradores:ver')
  @ApiOperation({ summary: 'Obtener un integrador por su ID' })
  @ApiResponse({ status: 200, description: 'Retorna el integrador.' })
  @ApiResponse({ status: 404, description: 'Integrador no encontrado.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.puntoxpressIntegradorService.findOne(id);
  }

  @Put(':id')
  @RequirePermissions('administracion.puntoxpress_integradores:editar')
  @ApiOperation({ summary: 'Actualizar un integrador' })
  @ApiResponse({ status: 200, description: 'El integrador ha sido actualizado.' })
  @ApiResponse({ status: 404, description: 'Integrador no encontrado.' })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: UpdatePuntoxpressIntegradorDto) {
    return this.puntoxpressIntegradorService.update(id, updateDto);
  }

  @Delete(':id')
  @RequirePermissions('administracion.puntoxpress_integradores:eliminar')
  @ApiOperation({ summary: 'Desactivar un integrador (soft delete)' })
  @ApiResponse({ status: 200, description: 'El integrador ha sido desactivado.' })
  @ApiResponse({ status: 404, description: 'Integrador no encontrado.' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.puntoxpressIntegradorService.remove(id);
  }
}
