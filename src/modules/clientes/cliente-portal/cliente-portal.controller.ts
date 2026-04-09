import { Controller, Get, Post, Param, ParseIntPipe, Body, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ClienteAuth } from '../cliente-auth/decorators/cliente-auth.decorator';
import { GetCliente } from '../cliente-auth/decorators/get-cliente.decorator';
import type { ClienteAutenticado } from '../cliente-auth/interfaces';
import { ClientePortalService } from './cliente-portal.service';
import { PagoTarjetaPortalDto } from './dto/pago-tarjeta-portal.dto';
import { CrearPagoIntentDto } from './dto/crear-pago-intent.dto';
import type { Request } from 'express';

@ApiTags('Portal de Clientes - Contratos')
@ClienteAuth()
@Controller('cliente-portal')
export class ClientePortalController {
  constructor(private readonly portalService: ClientePortalService) {}

  @Get('contratos')
  @ApiOperation({ summary: 'Listar contratos del cliente autenticado' })
  async getContratos(@GetCliente() cliente: ClienteAutenticado) {
    const data = await this.portalService.obtenerContratos(cliente.id_cliente);
    return { data };
  }

  @Get('contratos/:id')
  @ApiOperation({ summary: 'Detalle de un contrato' })
  @ApiParam({ name: 'id', type: Number })
  async getContratoDetalle(
    @GetCliente() cliente: ClienteAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const data = await this.portalService.obtenerContratoDetalle(
      cliente.id_cliente,
      id,
    ); 
    return { data };
  }

  @Get('contratos/:id/facturas')
  @ApiOperation({ summary: 'Facturas de un contrato' })
  @ApiParam({ name: 'id', type: Number })
  async getFacturasContrato(
    @GetCliente() cliente: ClienteAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const data = await this.portalService.obtenerFacturasContrato(
      cliente.id_cliente,
      id,
    );
    return { data };
  }

  @Get('contratos/:id/facturas/:idFactura')
  @ApiOperation({ summary: 'Detalle de una factura del contrato' })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'idFactura', type: Number })
  async getFacturaDetalle(
    @GetCliente() cliente: ClienteAutenticado,
    @Param('id', ParseIntPipe) idContrato: number,
    @Param('idFactura', ParseIntPipe) idFactura: number,
  ) {
    const data = await this.portalService.obtenerFacturaDetalle(
      cliente.id_cliente,
      idContrato,
      idFactura,
    );
    return { data };
  }

  @Get('contratos/:id/facturas/:idFactura/pdf')
  @ApiOperation({ summary: 'Descargar PDF del DTE de una factura del contrato' })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'idFactura', type: Number })
  async descargarFacturaPdf(
    @GetCliente() cliente: ClienteAutenticado,
    @Param('id', ParseIntPipe) idContrato: number,
    @Param('idFactura', ParseIntPipe) idFactura: number,
    @Res() res: Response,
  ) {
    const { pdf, numeroFactura } = await this.portalService.generarFacturaPdf(
      cliente.id_cliente,
      idContrato,
      idFactura,
    );

    const filename = `DTE_${numeroFactura || idFactura}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  }

  @Post('contratos/:id/pago-intent')
  @ApiOperation({ summary: 'Crear intención de pago para validar el flujo' })
  @ApiParam({ name: 'id', type: Number })
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  @UseGuards(ThrottlerGuard)
  async crearPagoIntent(
    @GetCliente() cliente: ClienteAutenticado,
    @Param('id', ParseIntPipe) idContrato: number,
    @Body() dto: CrearPagoIntentDto,
    @Req() req: Request,
  ) {
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket?.remoteAddress
      || undefined;

    const data = await this.portalService.crearPagoIntent(
      cliente.id_cliente,
      idContrato,
      dto,
      ipAddress,
    );
    return { data };
  }

  @Post('contratos/:id/pago-tarjeta')
  @ApiOperation({ summary: 'Pagar facturas seleccionadas con tarjeta de credito/debito' })
  @ApiParam({ name: 'id', type: Number })
  @Throttle({ default: { limit: 3, ttl: 300000 } })
  @UseGuards(ThrottlerGuard)
  async pagoTarjeta(
    @GetCliente() cliente: ClienteAutenticado,
    @Param('id', ParseIntPipe) idContrato: number,
    @Body() dto: PagoTarjetaPortalDto,
    @Req() req: Request,
  ) {
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket?.remoteAddress
      || undefined;

    const data = await this.portalService.procesarPagoTarjeta(
      cliente.id_cliente,
      idContrato,
      dto,
      ipAddress,
    );
    return { data };
  }
}
