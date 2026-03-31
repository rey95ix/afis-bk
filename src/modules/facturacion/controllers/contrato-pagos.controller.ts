import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Res,
  ParseIntPipe,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Auth } from 'src/modules/auth/decorators';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { ContratoPagosService } from '../services/contrato-pagos.service';
import { ContratoPagosPdfService } from '../services/contrato-pagos-pdf.service';
import {
  RegistrarPagoContratoDto,
  RegistrarAcuerdoPagoDto,
  AplicarDescuentoFacturaDto,
} from '../dto/contrato-pagos.dto';
import { AbonosListadoDto } from '../dto/abonos-listado.dto';
import { FixDuplicatedInvoicesDto } from '../dto/fix-duplicated-invoices.dto';

@ApiTags('Facturación - Contrato Pagos')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Auth()
@Controller('facturacion/contrato-pagos')
export class ContratoPagosController {
  constructor(
    private readonly contratoPagosService: ContratoPagosService,
    private readonly contratoPagosPdfService: ContratoPagosPdfService,
  ) {}

  @Get('abonos')
  @ApiOperation({ summary: 'Listar todos los abonos con filtros y paginación' })
  async listarAbonos(@Query() dto: AbonosListadoDto) {
    const result = await this.contratoPagosService.listarAbonos(dto);
    return { data: result };
  }

  @Get('facturas-duplicadas/detectar')
  @ApiOperation({ summary: 'Detectar contratos con primera factura duplicada' })
  async detectarFacturasDuplicadas() {
    const data = await this.contratoPagosService.detectarFacturasDuplicadas();
    return { data };
  }

  @Post('facturas-duplicadas/corregir')
  @ApiOperation({ summary: 'Corregir facturas duplicadas retrocediendo la original un mes' })
  async corregirFacturasDuplicadas(
    @Body() dto: FixDuplicatedInvoicesDto,
    @Request() req: any,
  ) {
    const resultado = await this.contratoPagosService.corregirFacturasDuplicadas(
      dto.idsContratos,
      req.user.id_usuario,
    );
    return { data: resultado };
  }

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

  @Post('facturas/:idFactura/descuento')
  @ApiOperation({ summary: 'Aplicar descuento a una factura antes de firmar por MH' })
  async aplicarDescuento(
    @Param('idFactura', ParseIntPipe) idFactura: number,
    @Body() dto: AplicarDescuentoFacturaDto,
    @Request() req: any,
  ) {
    const resultado = await this.contratoPagosService.aplicarDescuentoFactura(
      idFactura,
      dto,
      req.user.id_usuario,
    );
    return { data: resultado };
  }

  @Delete('facturas/:idFactura/descuento')
  @ApiOperation({ summary: 'Eliminar descuento de una factura' })
  async eliminarDescuento(
    @Param('idFactura', ParseIntPipe) idFactura: number,
    @Request() req: any,
  ) {
    const resultado = await this.contratoPagosService.eliminarDescuentoFactura(
      idFactura,
      req.user.id_usuario,
    );
    return { data: resultado };
  }

  @Delete('facturas/:idFactura/mora')
  @ApiOperation({ summary: 'Eliminar mora de una factura' })
  async eliminarMora(
    @Param('idFactura', ParseIntPipe) idFactura: number,
    @Request() req: any,
  ) {
    const resultado = await this.contratoPagosService.eliminarMoraFactura(
      idFactura,
      req.user.id_usuario,
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

  @Post('facturas/:idFactura/enviar-mh')
  @ApiOperation({ summary: 'Enviar factura a MH manualmente (sin requerir pago completo)' })
  async enviarFacturaMh(
    @Param('idFactura', ParseIntPipe) idFactura: number,
    @Request() req: any,
  ) {
    const resultado = await this.contratoPagosService.enviarFacturaMh(
      idFactura,
      req.user.id_usuario,
    );
    return { data: resultado };
  }

  @Get(':idContrato/estado-cuenta/pdf')
  @ApiOperation({ summary: 'Descargar PDF del estado de cuenta de un contrato' })
  async descargarEstadoCuentaPdf(
    @Param('idContrato', ParseIntPipe) idContrato: number,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.contratoPagosPdfService.generateEstadoCuentaPdf(idContrato);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
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
