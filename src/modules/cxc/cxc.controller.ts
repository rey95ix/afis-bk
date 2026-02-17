import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Auth, GetUser } from 'src/modules/auth/decorators';
import { RequirePermissions } from 'src/modules/auth/decorators/require-permissions.decorator';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { CxcService } from './cxc.service';
import { ConsultarCxcDto, CrearAbonoDto, AnularAbonoDto } from './dto';

@ApiTags('Cuentas por Cobrar')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('cxc/cuentas-por-cobrar')
@Auth()
export class CxcController {
  constructor(private readonly cxcService: CxcService) {}

  @RequirePermissions('cxc.cuentas:ver')
  @Get()
  @ApiOperation({ summary: 'Listar cuentas por cobrar con filtros y paginación' })
  @ApiResponse({ status: 200, description: 'Lista de cuentas por cobrar' })
  findAll(@Query() dto: ConsultarCxcDto) {
    return this.cxcService.findAll(dto);
  }

  @RequirePermissions('cxc.cuentas:ver')
  @Get('vencidas')
  @ApiOperation({ summary: 'Obtener cuentas por cobrar vencidas agrupadas por antigüedad' })
  @ApiResponse({ status: 200, description: 'CxC vencidas con buckets de antigüedad' })
  obtenerVencidas(@Query('id_sucursal', new ParseIntPipe({ optional: true })) id_sucursal?: number) {
    return this.cxcService.obtenerCxcVencidas(id_sucursal);
  }

  @RequirePermissions('cxc.cuentas:ver')
  @Get('resumen')
  @ApiOperation({ summary: 'Obtener resumen general de cuentas por cobrar' })
  @ApiResponse({ status: 200, description: 'Resumen general de CxC' })
  obtenerResumen(@Query('id_sucursal', new ParseIntPipe({ optional: true })) id_sucursal?: number) {
    return this.cxcService.obtenerResumenGeneral(id_sucursal);
  }

  @RequirePermissions('cxc.cuentas:ver')
  @Get('cliente/:id')
  @ApiOperation({ summary: 'Obtener estado de cuenta de un cliente' })
  @ApiResponse({ status: 200, description: 'CxC del cliente con resumen' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  obtenerCxcPorCliente(@Param('id', ParseIntPipe) id: number) {
    return this.cxcService.obtenerCxcPorCliente(id);
  }

  @RequirePermissions('cxc.cuentas:ver')
  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de una cuenta por cobrar' })
  @ApiResponse({ status: 200, description: 'Detalle de la CxC con abonos' })
  @ApiResponse({ status: 404, description: 'CxC no encontrada' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.cxcService.findOne(id);
  }

  @RequirePermissions('cxc.abonos:crear')
  @Post(':id/abonos')
  @ApiOperation({ summary: 'Registrar un abono a una cuenta por cobrar' })
  @ApiResponse({ status: 201, description: 'Abono registrado exitosamente' })
  @ApiResponse({ status: 400, description: 'Monto excede saldo o CxC no permite abonos' })
  @ApiResponse({ status: 404, description: 'CxC no encontrada' })
  registrarAbono(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CrearAbonoDto,
    @GetUser() user: any,
  ) {
    return this.cxcService.registrarAbono(id, dto, user.id_usuario);
  }

  @RequirePermissions('cxc.abonos:anular')
  @Patch('abonos/:id/anular')
  @ApiOperation({ summary: 'Anular un abono' })
  @ApiResponse({ status: 200, description: 'Abono anulado exitosamente' })
  @ApiResponse({ status: 400, description: 'Abono ya fue anulado' })
  @ApiResponse({ status: 404, description: 'Abono no encontrado' })
  anularAbono(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AnularAbonoDto,
    @GetUser() user: any,
  ) {
    return this.cxcService.anularAbono(id, dto, user.id_usuario);
  }

  @RequirePermissions('cxc.cuentas:editar')
  @Post('actualizar-vencidos')
  @ApiOperation({ summary: 'Actualizar estado de cuentas vencidas (batch)' })
  @ApiResponse({ status: 200, description: 'Cuentas actualizadas' })
  actualizarVencidos() {
    return this.cxcService.actualizarEstadosVencidos();
  }
}
