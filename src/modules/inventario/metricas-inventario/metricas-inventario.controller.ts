import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Auth } from '../../auth/decorators';
import { MetricasInventarioService } from './metricas-inventario.service';
import {
  QueryMetricasKPIDto,
  QueryMetricasHistoricasDto,
  QueryTasaRotacionDto,
  QueryStockOutRateDto,
  QueryItemsBajoMinimoDto,
  CalcularMetricasDto,
} from './dto';
import { HEADER_API_BEARER_AUTH } from '../../../common/const';

@ApiTags('Métricas de Inventario')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('inventario/metricas')
@Auth()
export class MetricasInventarioController {
  constructor(private readonly metricasService: MetricasInventarioService) {}

  // ============================================================
  // DASHBOARD Y RESUMEN DE KPIs
  // ============================================================

  @Get('dashboard')
  @ApiOperation({
    summary: 'Obtener dashboard de KPIs de inventario',
    description:
      'Retorna todos los KPIs principales en un solo endpoint: ' +
      'Precisión de Inventario, Tasa de Rotación, Stock-Out Rate y Items Bajo Mínimo',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard de KPIs obtenido exitosamente',
  })
  async getDashboard(@Query() query: QueryMetricasKPIDto) {
    return this.metricasService.getDashboardKPIs(query);
  }

  // ============================================================
  // PRECISIÓN DE INVENTARIO
  // ============================================================

  @Get('precision')
  @ApiOperation({
    summary: 'Calcular Precisión de Inventario',
    description:
      'Calcula la precisión basada en la última auditoría completada. ' +
      'Objetivo según política: > 98%',
  })
  @ApiResponse({
    status: 200,
    description: 'Precisión de inventario calculada',
  })
  async getPrecisionInventario(@Query() query: QueryMetricasKPIDto) {
    return this.metricasService.calcularPrecisionInventario(query);
  }

  @Get('precision/bodega/:id')
  @ApiOperation({
    summary: 'Calcular Precisión por Bodega',
    description: 'Calcula la precisión de inventario para una bodega específica',
  })
  @ApiResponse({
    status: 200,
    description: 'Precisión de bodega calculada',
  })
  async getPrecisionPorBodega(@Param('id', ParseIntPipe) id: number) {
    return this.metricasService.calcularPrecisionPorBodega(id);
  }

  // ============================================================
  // TASA DE ROTACIÓN
  // ============================================================

  @Get('rotacion')
  @ApiOperation({
    summary: 'Calcular Tasa de Rotación',
    description:
      'Calcula la tasa de rotación del inventario. ' +
      'Fórmula: Costo de Bienes Vendidos / Inventario Promedio',
  })
  @ApiResponse({
    status: 200,
    description: 'Tasa de rotación calculada',
  })
  async getTasaRotacion(@Query() query: QueryTasaRotacionDto) {
    return this.metricasService.calcularTasaRotacion(query);
  }

  // ============================================================
  // STOCK-OUT RATE
  // ============================================================

  @Get('stock-out')
  @ApiOperation({
    summary: 'Calcular Stock-Out Rate',
    description:
      'Calcula la tasa de desabasto (órdenes no completadas por falta de stock). ' +
      'Objetivo: 0%',
  })
  @ApiResponse({
    status: 200,
    description: 'Stock-Out Rate calculado',
  })
  async getStockOutRate(@Query() query: QueryStockOutRateDto) {
    return this.metricasService.calcularStockOutRate(query);
  }

  // ============================================================
  // ITEMS BAJO MÍNIMO
  // ============================================================

  @Get('items-bajo-minimo')
  @ApiOperation({
    summary: 'Listar Items Bajo Mínimo',
    description:
      'Retorna la lista de items por debajo del punto de reorden o stock mínimo',
  })
  @ApiQuery({ name: 'solo_criticos', required: false, type: Boolean })
  @ApiResponse({
    status: 200,
    description: 'Lista de items bajo mínimo',
  })
  async getItemsBajoMinimo(@Query() query: QueryItemsBajoMinimoDto) {
    return this.metricasService.contarItemsBajoMinimo(query);
  }

  // ============================================================
  // MÉTRICAS HISTÓRICAS
  // ============================================================

  @Get('historicas')
  @ApiOperation({
    summary: 'Obtener métricas históricas',
    description: 'Retorna el historial de métricas almacenadas con filtros',
  })
  @ApiResponse({
    status: 200,
    description: 'Métricas históricas obtenidas',
  })
  async getMetricasHistoricas(@Query() query: QueryMetricasHistoricasDto) {
    return this.metricasService.getMetricasHistoricas(query);
  }

  // ============================================================
  // CÁLCULO MANUAL
  // ============================================================

  @Post('calcular')
  @ApiOperation({
    summary: 'Calcular métricas manualmente',
    description:
      'Fuerza el cálculo y almacenamiento de métricas para un período específico. ' +
      'Útil para recalcular o generar históricos',
  })
  @ApiResponse({
    status: 201,
    description: 'Métricas calculadas y almacenadas',
  })
  async calcularMetricas(@Body() dto: CalcularMetricasDto) {
    return this.metricasService.calcularMetricasManual(dto);
  }

  @Post('calcular/diarias')
  @ApiOperation({
    summary: 'Ejecutar cálculo diario manualmente',
    description:
      'Ejecuta el proceso de cálculo diario de métricas manualmente. ' +
      'Normalmente se ejecuta automáticamente a medianoche.',
  })
  @ApiResponse({
    status: 201,
    description: 'Cálculo diario ejecutado',
  })
  async ejecutarCalculoDiario() {
    await this.metricasService.calcularMetricasDiarias();
    return { message: 'Cálculo diario ejecutado exitosamente' };
  }
}
