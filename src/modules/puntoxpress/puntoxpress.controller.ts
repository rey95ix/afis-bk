import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { SkipTransform } from 'src/common/intersectors';
import { PuntoXpressService } from './puntoxpress.service';
import { PuntoXpressAuthService } from './puntoxpress-auth.service';
import { PuntoXpressAuth } from './decorators/puntoxpress-auth.decorator';
import { GetIntegrador } from './decorators/get-integrador.decorator';
import {
  AuthPuntoXpressDto,
  AplicarPagoDto,
  AnularPagoPuntoXpressDto,
  BusquedaNombreDto,
} from './dto';

@SkipTransform()
@ApiTags('PuntoXpress')
@Controller('puntoxpress')
export class PuntoXpressController {
  constructor(
    private readonly service: PuntoXpressService,
    private readonly authService: PuntoXpressAuthService,
  ) {}

  // ============= AUTH =============

  @Post('auth')
  @ApiOperation({ summary: 'Autenticación de integrador PuntoXpress' })
  @ApiResponse({ status: 200, description: 'Token JWT generado exitosamente' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(@Body() dto: AuthPuntoXpressDto) {
    return this.authService.login(dto.usuario, dto.contrasena);
  }

  // ============= BÚSQUEDAS =============

  @Get('facturas/correlativo/:correlativo')
  @PuntoXpressAuth()
  @ApiOperation({ summary: 'Buscar facturas pendientes por número de correlativo' })
  @ApiParam({ name: 'correlativo', description: 'Número de factura/correlativo' })
  @ApiResponse({ status: 200, description: 'Lista de facturas encontradas' })
  async buscarPorCorrelativo(@Param('correlativo') correlativo: string) {
    return this.service.buscarPorCorrelativo(correlativo);
  }

  @Get('facturas/cliente/:codigo')
  @PuntoXpressAuth()
  @ApiOperation({ summary: 'Buscar facturas pendientes por código de cliente' })
  @ApiParam({ name: 'codigo', description: 'Código del cliente (ej: 000123)', type: String })
  @ApiResponse({ status: 200, description: 'Lista de facturas encontradas' })
  async buscarPorCodigoCliente(@Param('codigo') codigo: string) {
    const idCliente = Number(codigo);
    return this.service.buscarPorCodigoCliente(idCliente);
  }

  @Get('facturas/dui/:dui')
  @PuntoXpressAuth()
  @ApiOperation({ summary: 'Buscar facturas pendientes por DUI del cliente' })
  @ApiParam({ name: 'dui', description: 'DUI del cliente (ej: 00000000-0)' })
  @ApiResponse({ status: 200, description: 'Lista de facturas encontradas' })
  async buscarPorDui(@Param('dui') dui: string) {
    return this.service.buscarPorDui(dui);
  }

  @Get('facturas/nombre')
  @PuntoXpressAuth()
  @ApiOperation({ summary: 'Buscar facturas pendientes por nombre del cliente' })
  @ApiResponse({ status: 200, description: 'Lista de facturas encontradas' })
  async buscarPorNombre(@Query() dto: BusquedaNombreDto) {
    return this.service.buscarPorNombre(dto.nombre);
  }

  // ============= PAGOS =============

  @Post('pagos')
  @PuntoXpressAuth()
  @ApiOperation({ summary: 'Aplicar pago a una factura' })
  @ApiResponse({ status: 201, description: 'Pago aplicado exitosamente' })
  @ApiResponse({ status: 400, description: 'Error de validación o regla de negocio' })
  @ApiResponse({ status: 404, description: 'CXC no encontrada' })
  async aplicarPago(
    @Body() dto: AplicarPagoDto,
    @GetIntegrador('id_integrador') idIntegrador: number,
  ) {
    return this.service.aplicarPago(dto, idIntegrador);
  }

  @Delete('pagos/:idPago/anular')
  @PuntoXpressAuth()
  @ApiOperation({ summary: 'Anular un pago previamente aplicado' })
  @ApiParam({ name: 'idPago', description: 'ID del pago (abono) a anular' })
  @ApiResponse({ status: 200, description: 'Pago anulado exitosamente' })
  @ApiResponse({ status: 400, description: 'Error de validación' })
  @ApiResponse({ status: 404, description: 'Pago no encontrado' })
  async anularPago(
    @Param('idPago', ParseIntPipe) idPago: number,
    @Body() dto: AnularPagoPuntoXpressDto,
    @GetIntegrador('id_integrador') idIntegrador: number,
  ) {
    return this.service.anularPago(idPago, dto, idIntegrador);
  }
}
