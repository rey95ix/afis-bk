import {
  Controller,
  Get,
  Query,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Auth } from 'src/modules/auth/decorators';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { MovimientosInventarioService } from './movimientos-inventario.service';
import { FilterMovimientoInventarioDto } from './dto/filter-movimiento-inventario.dto';

@ApiTags('Movimientos de Inventario')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('inventario/movimientos-inventario')
@Auth()
export class MovimientosInventarioController {
  constructor(
    private readonly movimientosInventarioService: MovimientosInventarioService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar movimientos de inventario',
    description:
      'Obtiene un listado paginado de movimientos de inventario con filtros por tipo de movimiento, bodega origen/destino, producto, usuario y rango de fechas. Incluye información detallada de las relaciones como catálogo, bodegas, usuario y documentos origen (compras, importaciones, órdenes de trabajo, órdenes de salida).',
  })
  @ApiResponse({
    status: 200,
    description:
      'Movimientos obtenidos exitosamente con datos de paginación (data, meta)',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Token JWT inválido o no proporcionado',
  })
  findAll(@Query() filterDto: FilterMovimientoInventarioDto) {
    return this.movimientosInventarioService.findAll(filterDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener un movimiento de inventario por ID',
    description:
      'Retorna los detalles completos de un movimiento de inventario específico, incluyendo todas las relaciones (catálogo, bodegas, usuario, documentos origen).',
  })
  @ApiResponse({
    status: 200,
    description: 'Movimiento encontrado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Movimiento de inventario no encontrado',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Token JWT inválido o no proporcionado',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.movimientosInventarioService.findOne(id);
  }
}
