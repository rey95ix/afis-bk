// src/modules/facturacion/factura-directa/factura-directa.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { FacturaDirectaService } from './factura-directa.service';
import {
  CrearFacturaDirectaDto,
  CrearNotaCreditoDto,
  BuscarFacturaDirectaDto,
  BuscarErroresDteDto,
  AnularFacturaDirectaDto,
} from './dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Auth, GetUser } from 'src/modules/auth/decorators';
import { RequirePermissions } from 'src/modules/auth/decorators/require-permissions.decorator';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';

@ApiTags('Facturación - Factura Directa')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('facturacion/factura-directa')
@Auth()
export class FacturaDirectaController {
  constructor(private readonly facturaDirectaService: FacturaDirectaService) {}

  @Post()
  @RequirePermissions('facturacion.factura_directa:crear')
  @ApiOperation({ summary: 'Crear una nueva factura directa con DTE' })
  @ApiResponse({
    status: 201,
    description: 'Factura creada exitosamente.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        idFactura: { type: 'number' },
        codigoGeneracion: { type: 'string' },
        numeroControl: { type: 'string' },
        numeroFactura: { type: 'string' },
        estado: { type: 'string', enum: ['BORRADOR', 'FIRMADO', 'PROCESADO', 'RECHAZADO'] },
        selloRecibido: { type: 'string' },
        totalPagar: { type: 'number' },
        error: { type: 'string' },
        errores: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos.' })
  create(
    @Body() createDto: CrearFacturaDirectaDto,
    @GetUser('id_usuario') id_usuario: number,
    @GetUser('id_sucursal') id_sucursal: number | null,
  ) {
    return this.facturaDirectaService.crearFactura(createDto, id_usuario, id_sucursal);
  }

  @Post('nota-credito')
  @RequirePermissions('facturacion.nota_credito:crear')
  @ApiOperation({
    summary: 'Crear una Nota de Crédito a partir de un CCF',
    description:
      'Crea una Nota de Crédito (NC - tipo 05) a partir de un Comprobante de Crédito Fiscal (CCF) ' +
      'o Comprobante de Retención (CR) ya procesado. Permite seleccionar items específicos y cantidades parciales.',
  })
  @ApiResponse({
    status: 201,
    description: 'Nota de Crédito creada exitosamente.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        idFactura: { type: 'number', description: 'ID de la NC creada' },
        codigoGeneracion: { type: 'string' },
        numeroControl: { type: 'string' },
        numeroFactura: { type: 'string' },
        estado: { type: 'string', enum: ['BORRADOR', 'FIRMADO', 'PROCESADO', 'RECHAZADO'] },
        selloRecibido: { type: 'string' },
        totalPagar: { type: 'number' },
        error: { type: 'string' },
        errores: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos o factura original no cumple requisitos.' })
  @ApiResponse({ status: 404, description: 'Factura original no encontrada.' })
  crearNotaCredito(
    @Body() createDto: CrearNotaCreditoDto,
    @GetUser('id_usuario') id_usuario: number,
    @GetUser('id_sucursal') id_sucursal: number | null,
  ) {
    return this.facturaDirectaService.crearNotaCredito(createDto, id_usuario, id_sucursal);
  }

  @Get()
  @RequirePermissions('facturacion.factura_directa:ver')
  @ApiOperation({ summary: 'Listar facturas directas con paginación y filtros' })
  @ApiResponse({
    status: 200,
    description: 'Lista de facturas paginada.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id_factura_directa: { type: 'number' },
              numero_factura: { type: 'string' },
              cliente_nombre: { type: 'string' },
              total: { type: 'number' },
              estado_dte: { type: 'string' },
              fecha_creacion: { type: 'string' },
            },
          },
        },
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
  findAll(@Query() queryDto: BuscarFacturaDirectaDto) {
    return this.facturaDirectaService.findAll(queryDto);
  }

  @Get('metodos-pago')
  @RequirePermissions('facturacion.factura_directa:ver')
  @ApiOperation({ summary: 'Obtener métodos de pago disponibles' })
  @ApiResponse({
    status: 200,
    description: 'Lista de métodos de pago.',
  })
  getMetodosPago() {
    return this.facturaDirectaService.getMetodosPago();
  }

  @Get('catalogo/buscar')
  @RequirePermissions('facturacion.factura_directa:ver')
  @ApiOperation({ summary: 'Buscar productos del catálogo' })
  @ApiResponse({
    status: 200,
    description: 'Lista de productos encontrados.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id_catalogo: { type: 'number' },
              codigo: { type: 'string' },
              nombre: { type: 'string' },
              descripcion: { type: 'string', nullable: true },
            },
          },
        },
      },
    },
  })
  buscarCatalogo(@Query('q') q: string, @Query('limit') limit?: number) {
    return this.facturaDirectaService.buscarCatalogo(q, limit);
  }

  @Get('datos-extras')
  @RequirePermissions('facturacion.factura_directa:ver')
  @ApiOperation({ summary: 'Obtener datos extras (departamentos, tipos de documento, etc.)' })
  @ApiResponse({
    status: 200,
    description: 'Datos extras para formularios.',
    schema: {
      type: 'object',
      properties: {
        departamentos: { type: 'array', items: { type: 'object' } },
        tiposDocumento: { type: 'array', items: { type: 'object' } },
        actividadesEconomicas: { type: 'array', items: { type: 'object' } },
        tiposFactura: { type: 'array', items: { type: 'object' } },
        sucursales: { type: 'array', items: { type: 'object' } },
      },
    },
  })
  getDatosExtras() {
    return this.facturaDirectaService.getDatosExtras();
  }

  @Get('errores-dte')
  @RequirePermissions('facturacion.factura_directa:ver')
  @ApiOperation({ summary: 'Listar facturas con errores de DTE' })
  @ApiResponse({
    status: 200,
    description: 'Lista de facturas con errores.',
  })
  findErroresDte(@Query() queryDto: BuscarErroresDteDto) {
    return this.facturaDirectaService.findErroresDte(queryDto);
  }

  @Get(':id')
  @RequirePermissions('facturacion.factura_directa:ver')
  @ApiOperation({ summary: 'Obtener una factura por ID' })
  @ApiResponse({ status: 200, description: 'Factura encontrada.' })
  @ApiResponse({ status: 404, description: 'Factura no encontrada.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.facturaDirectaService.findOne(id);
  }

  @Get(':id/pdf')
  @RequirePermissions('facturacion.factura_directa:ver')
  @ApiOperation({
    summary: 'Generar PDF de documento tributario',
    description:
      'Genera un documento PDF del DTE. Soporta: FC (01), CCF (03), NC (05), ND (06), FEX (11), FSE (14).',
  })
  @ApiResponse({
    status: 200,
    description: 'PDF generado exitosamente.',
    content: {
      'application/pdf': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Documento no encontrado.' })
  @ApiResponse({ status: 400, description: 'Error al generar el PDF.' })
  async generatePdf(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.facturaDirectaService.generatePdf(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="DTE_${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Post(':id/reenviar-dte')
  @RequirePermissions('facturacion.factura_directa:editar')
  @ApiOperation({ summary: 'Reenviar DTE a Ministerio de Hacienda' })
  @ApiResponse({
    status: 200,
    description: 'Resultado del reenvío.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        idFactura: { type: 'number' },
        codigoGeneracion: { type: 'string' },
        estado: { type: 'string' },
        selloRecibido: { type: 'string' },
        error: { type: 'string' },
        errores: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'No se puede reenviar.' })
  @ApiResponse({ status: 404, description: 'Factura no encontrada.' })
  reenviarDte(
    @Param('id', ParseIntPipe) id: number,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.facturaDirectaService.reenviarDte(id, id_usuario);
  }

  @Post(':id/reenviar-correo')
  @RequirePermissions('facturacion.factura_directa:ver')
  @ApiOperation({
    summary: 'Reenviar factura por correo electrónico',
    description: 'Reenvía el PDF y JSON del DTE al correo del cliente registrado en la factura.',
  })
  @ApiResponse({
    status: 200,
    description: 'Resultado del reenvío de correo.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        error: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Factura no encontrada.' })
  reenviarCorreo(@Param('id', ParseIntPipe) id: number) {
    return this.facturaDirectaService.reenviarCorreo(id);
  }

  @Post(':id/anular')
  @RequirePermissions('facturacion.factura_directa:anular')
  @ApiOperation({
    summary: 'Anular una factura directa',
    description: 'Anula un DTE procesado enviando el evento de invalidación al Ministerio de Hacienda. Los datos del responsable se obtienen de la empresa y los del solicitante del usuario logueado.',
  })
  @ApiResponse({
    status: 200,
    description: 'Resultado de la anulación.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        idFactura: { type: 'number' },
        codigoGeneracionAnulacion: { type: 'string' },
        estado: { type: 'string', enum: ['PROCESADA', 'RECHAZADA'] },
        selloRecibido: { type: 'string' },
        error: { type: 'string' },
        errores: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'No se puede anular (fuera de plazo, estado inválido, etc.).' })
  @ApiResponse({ status: 404, description: 'Factura no encontrada.' })
  @ApiResponse({ status: 409, description: 'La factura ya fue anulada.' })
  anularFactura(
    @Param('id', ParseIntPipe) id: number,
    @Body() anularDto: AnularFacturaDirectaDto,
    @GetUser() usuario: { id_usuario: number; nombres: string; apellidos: string; dui?: string | null },
  ) {
    return this.facturaDirectaService.anularFacturaDirecta(id, anularDto, usuario);
  }
}
