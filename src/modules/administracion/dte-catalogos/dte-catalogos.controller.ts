// src/modules/administracion/dte-catalogos/dte-catalogos.controller.ts
import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { DteCatalogosService } from './dte-catalogos.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Auth } from 'src/modules/auth/decorators';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';

@ApiTags('DTE Catálogos')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('administracion/dte')
@Auth()
export class DteCatalogosController {
  constructor(private readonly dteCatalogosService: DteCatalogosService) {}

  // ==================== TIPOS DE DOCUMENTO ====================

  @Get('tipos-documento')
  @ApiOperation({ summary: 'Obtener todos los tipos de documento activos' })
  @ApiResponse({
    status: 200,
    description: 'Retorna todos los tipos de documento de identificación.',
  })
  findAllTiposDocumento() {
    return this.dteCatalogosService.findAllTiposDocumento();
  }

  @Get('tipos-documento/:id')
  @ApiOperation({ summary: 'Obtener un tipo de documento por su ID' })
  @ApiParam({ name: 'id', description: 'ID del tipo de documento', type: Number })
  @ApiResponse({ status: 200, description: 'Retorna el tipo de documento.' })
  @ApiResponse({ status: 404, description: 'Tipo de documento no encontrado.' })
  findOneTipoDocumento(@Param('id', ParseIntPipe) id: number) {
    return this.dteCatalogosService.findOneTipoDocumento(id);
  }

  // ==================== ACTIVIDADES ECONÓMICAS ====================

  @Get('actividades-economicas')
  @ApiOperation({ summary: 'Obtener todas las actividades económicas activas' })
  @ApiResponse({
    status: 200,
    description: 'Retorna todas las actividades económicas.',
  })
  findAllActividadesEconomicas() {
    return this.dteCatalogosService.findAllActividadesEconomicas();
  }

  @Get('actividades-economicas/:id')
  @ApiOperation({ summary: 'Obtener una actividad económica por su ID' })
  @ApiParam({
    name: 'id',
    description: 'ID de la actividad económica',
    type: Number,
  })
  @ApiResponse({ status: 200, description: 'Retorna la actividad económica.' })
  @ApiResponse({ status: 404, description: 'Actividad económica no encontrada.' })
  findOneActividadEconomica(@Param('id', ParseIntPipe) id: number) {
    return this.dteCatalogosService.findOneActividadEconomica(id);
  }

  // ==================== TIPOS DE ESTABLECIMIENTO ====================

  @Get('tipos-establecimiento')
  @ApiOperation({ summary: 'Obtener todos los tipos de establecimiento activos' })
  @ApiResponse({
    status: 200,
    description: 'Retorna todos los tipos de establecimiento.',
  })
  findAllTiposEstablecimiento() {
    return this.dteCatalogosService.findAllTiposEstablecimiento();
  }

  @Get('tipos-establecimiento/:id')
  @ApiOperation({ summary: 'Obtener un tipo de establecimiento por su ID' })
  @ApiParam({
    name: 'id',
    description: 'ID del tipo de establecimiento',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Retorna el tipo de establecimiento.',
  })
  @ApiResponse({
    status: 404,
    description: 'Tipo de establecimiento no encontrado.',
  })
  findOneTipoEstablecimiento(@Param('id', ParseIntPipe) id: number) {
    return this.dteCatalogosService.findOneTipoEstablecimiento(id);
  }
}
