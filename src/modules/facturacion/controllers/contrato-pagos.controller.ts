import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Auth } from 'src/modules/auth/decorators';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { ContratoPagosService } from '../services/contrato-pagos.service';
import {
  RegistrarPagoContratoDto,
  RegistrarAcuerdoPagoDto,
} from '../dto/contrato-pagos.dto';

@ApiTags('Facturación - Contrato Pagos')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Auth()
@Controller('facturacion/contrato-pagos')
export class ContratoPagosController {
  constructor(private readonly contratoPagosService: ContratoPagosService) {}

  @Get(':idContrato/facturas')
  @ApiOperation({ summary: 'Obtener facturas de un contrato con estado de pago' })
  async obtenerFacturas(@Param('idContrato', ParseIntPipe) idContrato: number) {
    // Revertir acuerdos vencidos al cargar
    await this.contratoPagosService.revertirAcuerdosVencidos(idContrato);

    const facturas = await this.contratoPagosService.obtenerFacturasContrato(idContrato);
    return { data: facturas };
  }

  @Post(':idContrato/pago')
  @ApiOperation({ summary: 'Registrar pago distribuido en facturas del contrato' })
  async registrarPago(
    @Param('idContrato', ParseIntPipe) idContrato: number,
    @Body() dto: RegistrarPagoContratoDto,
    @Request() req: any,
  ) {
    const resultado = await this.contratoPagosService.registrarPagoContrato(
      idContrato,
      dto,
      req.user.id_usuario,
    );
    return { data: resultado };
  }

  @Post(':idContrato/aplicar-mora')
  @ApiOperation({ summary: 'Calcular y aplicar mora a facturas vencidas del contrato' })
  async aplicarMora(
    @Param('idContrato', ParseIntPipe) idContrato: number,
    @Request() req: any,
  ) {
    const resultado = await this.contratoPagosService.aplicarMoraContrato(
      idContrato,
      req.user.id_usuario,
    );
    return { data: resultado };
  }

  @Post('facturas/:idFactura/acuerdo-pago')
  @ApiOperation({ summary: 'Registrar acuerdo de pago para una factura' })
  async registrarAcuerdo(
    @Param('idFactura', ParseIntPipe) idFactura: number,
    @Body() dto: RegistrarAcuerdoPagoDto,
    @Request() req: any,
  ) {
    const resultado = await this.contratoPagosService.registrarAcuerdoPago(
      idFactura,
      new Date(dto.fechaAcuerdo),
      req.user.id_usuario,
      dto.observaciones,
    );
    return { data: resultado };
  }

  @Delete('facturas/:idFactura/acuerdo-pago')
  @ApiOperation({ summary: 'Cancelar acuerdo de pago de una factura' })
  async cancelarAcuerdo(
    @Param('idFactura', ParseIntPipe) idFactura: number,
    @Request() req: any,
  ) {
    const resultado = await this.contratoPagosService.cancelarAcuerdoPago(
      idFactura,
      req.user.id_usuario,
    );
    return { data: resultado };
  }

  @Get(':idContrato/estado-cuenta')
  @ApiOperation({ summary: 'Obtener estado de cuenta completo de un contrato' })
  async obtenerEstadoCuenta(@Param('idContrato', ParseIntPipe) idContrato: number) {
    const data = await this.contratoPagosService.obtenerEstadoCuentaContrato(idContrato);
    return { data };
  }

  @Get(':idContrato/abonos')
  @ApiOperation({ summary: 'Obtener historial de abonos de un contrato' })
  async obtenerAbonos(@Param('idContrato', ParseIntPipe) idContrato: number) {
    const data = await this.contratoPagosService.obtenerAbonosContrato(idContrato);
    return { data };
  }

  @Post('analizar-comprobante')
  @ApiOperation({ summary: 'Analizar imagen de comprobante de pago con IA' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async analizarComprobante(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Debe enviar una imagen del comprobante');
    }

    const resultado = await this.contratoPagosService.analizarComprobante(file);
    return { data: resultado };
  }
}
