import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportesService } from './reportes.service';
import { QueryReportesDto } from './dto/query-reportes.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger'; 
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { Auth } from 'src/modules/auth/decorators';

@ApiTags('Reportes')
@Controller('api/reportes')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Auth()
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('ordenes')
  @ApiOperation({
    summary: 'Reporte de órdenes de trabajo',
    description:
      'Genera un reporte detallado de órdenes de trabajo con filtros por fecha y estado. Incluye resumen con totales, materiales, actividades y tiempos promedio.',
  })
  @ApiResponse({
    status: 200,
    description: 'Reporte generado exitosamente',
  })
  getReporteOrdenes(@Query() queryDto: QueryReportesDto) {
    return this.reportesService.getReporteOrdenes(queryDto);
  }

  @Get('tecnicos/productividad')
  @ApiOperation({
    summary: 'Reporte de productividad de técnicos',
    description:
      'Genera un reporte de productividad por técnico con métricas como total de órdenes, tasa de completamiento, tiempo promedio de trabajo y total de actividades realizadas.',
  })
  @ApiResponse({
    status: 200,
    description: 'Reporte generado exitosamente',
  })
  getReporteProductividadTecnicos(@Query() queryDto: QueryReportesDto) {
    return this.reportesService.getReporteProductividadTecnicos(queryDto);
  }

  @Get('materiales/consumo')
  @ApiOperation({
    summary: 'Reporte de consumo de materiales',
    description:
      'Genera un reporte de consumo de materiales e insumos por SKU. Incluye cantidad total consumida, número de órdenes en las que se usó, costo total y últimos 10 usos.',
  })
  @ApiResponse({
    status: 200,
    description: 'Reporte generado exitosamente',
  })
  getReporteConsumoMateriales(@Query() queryDto: QueryReportesDto) {
    return this.reportesService.getReporteConsumoMateriales(queryDto);
  }
}
