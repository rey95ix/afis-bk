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
import { CxpService } from './cxp.service';
import { ConsultarCxpDto, CrearPagoDto, AnularPagoDto } from './dto';

@ApiTags('Cuentas por Pagar')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('cxp/cuentas-por-pagar')
@Auth()
export class CxpController {
  constructor(private readonly cxpService: CxpService) {}

  @RequirePermissions('cxp.cuentas:ver')
  @Get()
  @ApiOperation({ summary: 'Listar cuentas por pagar con filtros y paginación' })
  @ApiResponse({ status: 200, description: 'Lista de cuentas por pagar' })
  findAll(@Query() dto: ConsultarCxpDto) {
    return this.cxpService.findAll(dto);
  }

  @RequirePermissions('cxp.cuentas:ver')
  @Get('vencidas')
  @ApiOperation({ summary: 'Obtener cuentas por pagar vencidas agrupadas por antigüedad' })
  @ApiResponse({ status: 200, description: 'CxP vencidas con buckets de antigüedad' })
  obtenerVencidas(@Query('id_sucursal', new ParseIntPipe({ optional: true })) id_sucursal?: number) {
    return this.cxpService.obtenerCxpVencidas(id_sucursal);
  }

  @RequirePermissions('cxp.cuentas:ver')
  @Get('resumen')
  @ApiOperation({ summary: 'Obtener resumen general de cuentas por pagar' })
  @ApiResponse({ status: 200, description: 'Resumen general de CxP' })
  obtenerResumen(@Query('id_sucursal', new ParseIntPipe({ optional: true })) id_sucursal?: number) {
    return this.cxpService.obtenerResumenGeneral(id_sucursal);
  }

  @RequirePermissions('cxp.cuentas:ver')
  @Get('proveedor/:id')
  @ApiOperation({ summary: 'Obtener estado de cuenta de un proveedor' })
  @ApiResponse({ status: 200, description: 'CxP del proveedor con resumen' })
  @ApiResponse({ status: 404, description: 'Proveedor no encontrado' })
  obtenerCxpPorProveedor(@Param('id', ParseIntPipe) id: number) {
    return this.cxpService.obtenerCxpPorProveedor(id);
  }

  @RequirePermissions('cxp.cuentas:ver')
  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de una cuenta por pagar' })
  @ApiResponse({ status: 200, description: 'Detalle de la CxP con pagos' })
  @ApiResponse({ status: 404, description: 'CxP no encontrada' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.cxpService.findOne(id);
  }

  @RequirePermissions('cxp.cuentas:editar')
  @Post('actualizar-vencidos')
  @ApiOperation({ summary: 'Actualizar estado de cuentas vencidas (batch)' })
  @ApiResponse({ status: 200, description: 'Cuentas actualizadas' })
  actualizarVencidos() {
    return this.cxpService.actualizarEstadosVencidos();
  }

  @RequirePermissions('cxp.pagos:crear')
  @Post(':id/pagos')
  @ApiOperation({ summary: 'Registrar un pago a una cuenta por pagar' })
  @ApiResponse({ status: 201, description: 'Pago registrado exitosamente' })
  @ApiResponse({ status: 400, description: 'Monto excede saldo o CxP no permite pagos' })
  @ApiResponse({ status: 404, description: 'CxP no encontrada' })
  registrarPago(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CrearPagoDto,
    @GetUser() user: any,
  ) {
    return this.cxpService.registrarPago(id, dto, user.id_usuario);
  }

  @RequirePermissions('cxp.pagos:anular')
  @Patch('pagos/:id/anular')
  @ApiOperation({ summary: 'Anular un pago' })
  @ApiResponse({ status: 200, description: 'Pago anulado exitosamente' })
  @ApiResponse({ status: 400, description: 'Pago ya fue anulado' })
  @ApiResponse({ status: 404, description: 'Pago no encontrado' })
  anularPago(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AnularPagoDto,
    @GetUser() user: any,
  ) {
    return this.cxpService.anularPago(id, dto, user.id_usuario);
  }
}
