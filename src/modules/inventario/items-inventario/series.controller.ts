import { Controller, Get, Post, Patch, Param, Query, Body, ParseIntPipe, Request } from '@nestjs/common';
import { ItemsInventarioService } from './items-inventario.service';
import { QuerySeriesDisponiblesDto, RealizarInspeccionDto, CambiarEstadoSerieDto, CompletarReparacionDto } from './dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Auth } from 'src/modules/auth/decorators';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';

@ApiTags('Inventario - Series')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('inventario/series')
@Auth()
export class SeriesController {
  constructor(
    private readonly itemsInventarioService: ItemsInventarioService,
  ) {}

  @RequirePermissions('inventario.series:ver')
  @Get()
  @ApiOperation({
    summary: 'Obtener series disponibles con filtros',
    description:
      'Retorna una lista paginada de series disponibles filtradas por catálogo, bodega, estante y estado. Usado principalmente para requisiciones y transferencias de productos serializados.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de series disponibles.',
  })
  @ApiResponse({
    status: 400,
    description: 'Parámetros de consulta inválidos.',
  })
  findSeriesDisponibles(@Query() queryDto: QuerySeriesDisponiblesDto) {
    // Si se solicita estado EN_INSPECCION, usar el método específico
    if (queryDto.estado === 'EN_INSPECCION') {
      return this.itemsInventarioService.findSeriesEnInspeccion(queryDto);
    }
    return this.itemsInventarioService.findSeriesDisponibles(queryDto);
  }

  // ============================================
  // ENDPOINTS DE INSPECCIÓN
  // ============================================

  @RequirePermissions('inventario.inspecciones:ver')
  @Get('conteos')
  @ApiOperation({
    summary: 'Obtener conteo de series por estado',
    description: 'Retorna el conteo de series agrupadas por estado.',
  })
  @ApiResponse({
    status: 200,
    description: 'Conteo de series por estado.',
  })
  getConteosPorEstado() {
    return this.itemsInventarioService.getConteosPorEstado();
  }

  @RequirePermissions('inventario.series:ver')
  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalle de una serie',
    description: 'Retorna el detalle completo de una serie específica.',
  })
  @ApiParam({ name: 'id', description: 'ID de la serie' })
  @ApiResponse({
    status: 200,
    description: 'Detalle de la serie.',
  })
  @ApiResponse({
    status: 404,
    description: 'Serie no encontrada.',
  })
  findSerieById(@Param('id', ParseIntPipe) id: number) {
    return this.itemsInventarioService.findSerieById(id);
  }

  @RequirePermissions('inventario.series:ver')
  @Get(':id/historial')
  @ApiOperation({
    summary: 'Obtener historial de movimientos de una serie',
    description: 'Retorna el historial de movimientos de una serie específica.',
  })
  @ApiParam({ name: 'id', description: 'ID de la serie' })
  @ApiResponse({
    status: 200,
    description: 'Historial de movimientos.',
  })
  @ApiResponse({
    status: 404,
    description: 'Serie no encontrada.',
  })
  findHistorialSerie(@Param('id', ParseIntPipe) id: number) {
    return this.itemsInventarioService.findHistorialSerie(id);
  }

  @RequirePermissions('inventario.inspecciones:crear')
  @Post('inspeccion')
  @ApiOperation({
    summary: 'Realizar inspección de una serie',
    description:
      'Registra el resultado de la inspección de un equipo devuelto y actualiza su estado.',
  })
  @ApiResponse({
    status: 201,
    description: 'Inspección registrada exitosamente.',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o serie no está en estado EN_INSPECCION.',
  })
  @ApiResponse({
    status: 404,
    description: 'Serie no encontrada.',
  })
  realizarInspeccion(
    @Body() dto: RealizarInspeccionDto,
    @Request() req: any,
  ) {
    const userId = req.user?.id_usuario || req.user?.sub;
    return this.itemsInventarioService.realizarInspeccion(dto, userId);
  }

  // ============================================
  // ENDPOINTS DE REPARACIÓN
  // ============================================

  @RequirePermissions('inventario.reparaciones:crear')
  @Post('reparacion/completar')
  @ApiOperation({
    summary: 'Completar reparación de una serie',
    description:
      'Registra el resultado de la reparación de un equipo y actualiza su estado a DISPONIBLE o DEFECTUOSO.',
  })
  @ApiResponse({
    status: 201,
    description: 'Reparación completada exitosamente.',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o serie no está en estado EN_REPARACION.',
  })
  @ApiResponse({
    status: 404,
    description: 'Serie no encontrada.',
  })
  completarReparacion(
    @Body() dto: CompletarReparacionDto,
    @Request() req: any,
  ) {
    const userId = req.user?.id_usuario || req.user?.sub;
    return this.itemsInventarioService.completarReparacion(dto, userId);
  }

  @RequirePermissions('inventario.series:editar')
  @Patch(':id/estado')
  @ApiOperation({
    summary: 'Cambiar estado de una serie',
    description: 'Cambia el estado de una serie directamente.',
  })
  @ApiParam({ name: 'id', description: 'ID de la serie' })
  @ApiResponse({
    status: 200,
    description: 'Estado actualizado.',
  })
  @ApiResponse({
    status: 400,
    description: 'Estado no válido.',
  })
  @ApiResponse({
    status: 404,
    description: 'Serie no encontrada.',
  })
  cambiarEstadoSerie(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoSerieDto,
  ) {
    return this.itemsInventarioService.cambiarEstadoSerie(
      id,
      dto.estado,
      dto.observaciones,
    );
  }
}
