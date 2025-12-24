// src/modules/administracion/diagnosticos-catalogo/diagnosticos-catalogo.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { DiagnosticosCatalogoService } from './diagnosticos-catalogo.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { Auth, GetUser, RequirePermissions } from 'src/modules/auth/decorators';
import { CreateDiagnosticoDto } from './dto/create-diagnostico.dto';
import { UpdateDiagnosticoDto } from './dto/update-diagnostico.dto';
import { PaginationDto } from 'src/common/dto';

@ApiTags('Administración - Diagnósticos Catálogo')
@Controller('api/administracion/diagnosticos-catalogo')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Auth()
export class DiagnosticosCatalogoController {
  constructor(private readonly diagnosticosCatalogoService: DiagnosticosCatalogoService) {}

  @Post()
  @RequirePermissions('administracion.diagnosticos:crear')
  @ApiOperation({
    summary: 'Crear un nuevo diagnóstico',
    description: 'Crea un nuevo diagnóstico en el catálogo de diagnósticos técnicos.',
  })
  @ApiBody({ type: CreateDiagnosticoDto })
  @ApiResponse({
    status: 201,
    description: 'Diagnóstico creado exitosamente',
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un diagnóstico con el mismo código',
  })
  create(
    @Body() createDiagnosticoDto: CreateDiagnosticoDto,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.diagnosticosCatalogoService.create(createDiagnosticoDto, id_usuario);
  }

  @Get()
  @RequirePermissions('administracion.diagnosticos:ver')
  @ApiOperation({
    summary: 'Listar todos los diagnósticos con paginación',
    description: 'Obtiene la lista paginada de diagnósticos con opción de búsqueda.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de diagnósticos obtenida exitosamente',
  })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.diagnosticosCatalogoService.findAll(paginationDto);
  }

  @Get(':id')
  @RequirePermissions('administracion.diagnosticos:ver')
  @ApiOperation({
    summary: 'Obtener un diagnóstico por ID',
    description: 'Obtiene los detalles de un diagnóstico específico.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del diagnóstico',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Diagnóstico encontrado',
  })
  @ApiResponse({
    status: 404,
    description: 'Diagnóstico no encontrado',
  })
  findOne(@Param('id') id: string) {
    return this.diagnosticosCatalogoService.findOne(+id);
  }

  @Put(':id')
  @RequirePermissions('administracion.diagnosticos:editar')
  @ApiOperation({
    summary: 'Actualizar un diagnóstico',
    description: 'Actualiza los datos de un diagnóstico existente.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del diagnóstico',
    type: Number,
  })
  @ApiBody({ type: UpdateDiagnosticoDto })
  @ApiResponse({
    status: 200,
    description: 'Diagnóstico actualizado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Diagnóstico no encontrado',
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe otro diagnóstico con el mismo código',
  })
  update(
    @Param('id') id: string,
    @Body() updateDiagnosticoDto: UpdateDiagnosticoDto,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.diagnosticosCatalogoService.update(+id, updateDiagnosticoDto, id_usuario);
  }

  @Delete(':id')
  @RequirePermissions('administracion.diagnosticos:eliminar')
  @ApiOperation({
    summary: 'Eliminar un diagnóstico',
    description: 'Elimina (desactiva) un diagnóstico del catálogo.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del diagnóstico',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Diagnóstico eliminado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Diagnóstico no encontrado',
  })
  remove(
    @Param('id') id: string,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.diagnosticosCatalogoService.remove(+id, id_usuario);
  }
}
