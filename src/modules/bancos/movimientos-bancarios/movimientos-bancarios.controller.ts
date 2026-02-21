import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { MovimientosBancariosService } from './movimientos-bancarios.service';
import { CreateMovimientoBancarioDto } from './dto/create-movimiento-bancario.dto';
import { CreateAjusteDto } from './dto/create-ajuste.dto';
import { AnularMovimientoDto } from './dto/anular-movimiento.dto';
import { FilterMovimientoBancarioDto } from './dto/filter-movimiento-bancario.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Auth } from 'src/modules/auth/decorators';
import { GetUser } from 'src/modules/auth/decorators';
import { RequirePermissions } from 'src/modules/auth/decorators/require-permissions.decorator';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';

@ApiTags('Bancos - Movimientos Bancarios')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('bancos/movimientos')
@Auth()
export class MovimientosBancariosController {
  constructor(
    private readonly movimientosBancariosService: MovimientosBancariosService,
  ) {}

  @RequirePermissions('bancos.movimientos:crear')
  @Post()
  @ApiOperation({ summary: 'Crear un movimiento bancario (entrada, salida o ajuste)' })
  @ApiResponse({ status: 201, description: 'El movimiento ha sido creado.' })
  @ApiResponse({ status: 400, description: 'Petición inválida o saldo insuficiente.' })
  @ApiResponse({ status: 404, description: 'Cuenta bancaria no encontrada.' })
  @ApiResponse({ status: 409, description: 'Conflicto de concurrencia.' })
  create(
    @Body() createMovimientoDto: CreateMovimientoBancarioDto,
    @GetUser() user: any,
  ) {
    return this.movimientosBancariosService.crearMovimiento(createMovimientoDto, user.id_usuario);
  }

  @RequirePermissions('bancos.movimientos:ver')
  @Get()
  @ApiOperation({ summary: 'Listar movimientos bancarios con paginación y filtros' })
  @ApiResponse({
    status: 200,
    description: 'Retorna los movimientos bancarios paginados.',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object' } },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  })
  findAll(@Query() filterDto: FilterMovimientoBancarioDto) {
    return this.movimientosBancariosService.findAll(filterDto);
  }

  @RequirePermissions('bancos.movimientos:ver')
  @Get('resumen-cuenta/:id')
  @ApiOperation({ summary: 'Obtener resumen consolidado de movimientos de una cuenta' })
  @ApiResponse({ status: 200, description: 'Retorna el resumen de entradas y salidas.' })
  @ApiResponse({ status: 404, description: 'Cuenta bancaria no encontrada.' })
  getResumenCuenta(
    @Param('id', ParseIntPipe) id: number,
    @Query('fecha_desde') fechaDesde?: string,
    @Query('fecha_hasta') fechaHasta?: string,
  ) {
    return this.movimientosBancariosService.getResumenCuenta(id, fechaDesde, fechaHasta);
  }

  @RequirePermissions('bancos.movimientos:ver')
  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de un movimiento bancario' })
  @ApiResponse({ status: 200, description: 'Retorna el movimiento bancario.' })
  @ApiResponse({ status: 404, description: 'Movimiento no encontrado.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.movimientosBancariosService.findOne(id);
  }

  @RequirePermissions('bancos.movimientos:anular')
  @Put(':id/anular')
  @ApiOperation({ summary: 'Anular un movimiento bancario (crea movimiento de reversa)' })
  @ApiResponse({ status: 200, description: 'El movimiento ha sido anulado.' })
  @ApiResponse({ status: 400, description: 'El movimiento ya está anulado.' })
  @ApiResponse({ status: 404, description: 'Movimiento no encontrado.' })
  @ApiResponse({ status: 409, description: 'Conflicto de concurrencia.' })
  anular(
    @Param('id', ParseIntPipe) id: number,
    @Body() anularMovimientoDto: AnularMovimientoDto,
    @GetUser() user: any,
  ) {
    return this.movimientosBancariosService.anularMovimiento(id, anularMovimientoDto, user.id_usuario);
  }

  @RequirePermissions('bancos.movimientos:ajustar')
  @Post('cuentas/:id/ajuste')
  @ApiOperation({ summary: 'Crear un ajuste manual de saldo en una cuenta bancaria' })
  @ApiResponse({ status: 201, description: 'El ajuste ha sido creado.' })
  @ApiResponse({ status: 400, description: 'Petición inválida o saldo insuficiente.' })
  @ApiResponse({ status: 404, description: 'Cuenta bancaria no encontrada.' })
  @ApiResponse({ status: 409, description: 'Conflicto de concurrencia.' })
  ajuste(
    @Param('id', ParseIntPipe) id: number,
    @Body() createAjusteDto: CreateAjusteDto,
    @GetUser() user: any,
  ) {
    return this.movimientosBancariosService.crearAjuste(id, createAjusteDto, user.id_usuario);
  }
}
