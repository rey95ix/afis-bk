import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ItemsInventarioService } from './items-inventario.service';
import {
  QueryInventarioDto,
  QueryMovimientosDto,
  QuerySeriesDto,
} from './dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Auth } from 'src/modules/auth/decorators';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';

@ApiTags('Inventario - Visualización')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('inventario/items')
@Auth()
export class ItemsInventarioController {
  constructor(
    private readonly itemsInventarioService: ItemsInventarioService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Obtener lista de items del inventario con filtros',
    description:
      'Retorna una lista paginada de items del inventario con información de ubicación, categoría y disponibilidad. Permite filtrar por bodega, estante, categoría, estado y stock bajo.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Lista de items del inventario con paginación y datos relacionados.',
  })
  findAll(@Query() queryDto: QueryInventarioDto) {
    return this.itemsInventarioService.findAll(queryDto);
  }

  @Get('distribucion')
  @ApiOperation({
    summary: 'Obtener distribución del inventario',
    description:
      'Retorna la distribución del inventario agrupada por bodega y por categoría, con estadísticas generales de disponibilidad.',
  })
  @ApiResponse({
    status: 200,
    description: 'Distribución del inventario por bodega y categoría.',
  })
  getDistribucion() {
    return this.itemsInventarioService.getDistribucion();
  }

  @Get('alertas')
  @ApiOperation({
    summary: 'Obtener alertas de stock bajo',
    description:
      'Retorna los items del inventario que están por debajo de su cantidad mínima establecida, ordenados por nivel de criticidad.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de items con stock bajo ordenados por criticidad.',
  })
  getAlertas() {
    return this.itemsInventarioService.getAlertas();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalle de un item del inventario',
    description:
      'Retorna información detallada de un item del inventario incluyendo ubicación, categoría, series y estadísticas de disponibilidad.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del item en el inventario',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Detalle del item del inventario.',
  })
  @ApiResponse({
    status: 404,
    description: 'Item del inventario no encontrado.',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.itemsInventarioService.findOne(id);
  }

  @Get(':id/series')
  @ApiOperation({
    summary: 'Obtener series de un item del inventario',
    description:
      'Retorna una lista paginada de todas las series (números de serie) asociadas a un item del inventario, con información de su estado y asignación.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del item en el inventario',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de series del item.',
  })
  @ApiResponse({
    status: 404,
    description: 'Item del inventario no encontrado.',
  })
  findSeries(
    @Param('id', ParseIntPipe) id: number,
    @Query() queryDto: QuerySeriesDto,
  ) {
    return this.itemsInventarioService.findSeries(id, queryDto);
  }

  @Get('catalogo/:id_catalogo/movimientos')
  @ApiOperation({
    summary: 'Obtener movimientos de un item del catálogo',
    description:
      'Retorna el historial de movimientos (entradas, salidas, transferencias) de un item del catálogo en el inventario.',
  })
  @ApiParam({
    name: 'id_catalogo',
    description: 'ID del item en el catálogo',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Historial de movimientos del item.',
  })
  findMovimientos(
    @Param('id_catalogo', ParseIntPipe) id_catalogo: number,
    @Query() queryDto: QueryMovimientosDto,
  ) {
    return this.itemsInventarioService.findMovimientos(id_catalogo, queryDto);
  }
}
