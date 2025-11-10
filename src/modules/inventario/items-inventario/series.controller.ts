import { Controller, Get, Query } from '@nestjs/common';
import { ItemsInventarioService } from './items-inventario.service';
import { QuerySeriesDisponiblesDto } from './dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Auth } from 'src/modules/auth/decorators';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';

@ApiTags('Inventario - Series')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('inventario/series')
@Auth()
export class SeriesController {
  constructor(
    private readonly itemsInventarioService: ItemsInventarioService,
  ) {}

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
    return this.itemsInventarioService.findSeriesDisponibles(queryDto);
  }
}
