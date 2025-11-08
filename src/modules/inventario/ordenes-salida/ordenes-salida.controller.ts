import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { OrdenesSalidaService } from './ordenes-salida.service';
import { CreateOrdenSalidaDto } from './dto/create-orden-salida.dto';
import { UpdateOrdenSalidaDto } from './dto/update-orden-salida.dto';
import {
  AutorizarOrdenSalidaDto,
  RechazarOrdenSalidaDto,
} from './dto/autorizar-orden-salida.dto';
import {
  ProcesarOrdenSalidaDto,
  CancelarOrdenSalidaDto,
} from './dto/procesar-orden-salida.dto';
import { FilterOrdenSalidaDto } from './dto/filter-orden-salida.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { Auth, GetUser } from 'src/modules/auth/decorators';
import type  { usuarios } from '@prisma/client';

@ApiTags('Órdenes de Salida')
@Controller('inventario/ordenes-salida')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Auth()
export class OrdenesSalidaController {
  constructor(private readonly ordenesSalidaService: OrdenesSalidaService) { }

  @Post()
  @ApiOperation({ summary: 'Crear una nueva orden de salida' })
  @ApiResponse({
    status: 201,
    description: 'Orden de salida creada exitosamente',
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Bodega o producto no encontrado' })
  create(
    @Body() createOrdenSalidaDto: CreateOrdenSalidaDto,
    @GetUser() user: usuarios,
  ) {
    return this.ordenesSalidaService.create(createOrdenSalidaDto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas las órdenes de salida con filtros' })
  @ApiResponse({
    status: 200,
    description: 'Lista de órdenes de salida obtenida',
  })
  @ApiQuery({ type: FilterOrdenSalidaDto })
  findAll(@Query() filters: FilterOrdenSalidaDto) {
    return this.ordenesSalidaService.findAll(filters);
  }

  @Get('estadisticas')
  @ApiOperation({ summary: 'Obtener estadísticas de órdenes de salida' })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas obtenidas exitosamente',
  })
  @ApiQuery({
    name: 'id_bodega',
    required: false,
    description: 'Filtrar por bodega',
    type: Number,
  })
  obtenerEstadisticas(@Query('id_bodega', ParseIntPipe) idBodega?: number) {
    return this.ordenesSalidaService.obtenerEstadisticas(idBodega);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una orden de salida por ID' })
  @ApiResponse({ status: 200, description: 'Orden de salida encontrada' })
  @ApiResponse({ status: 404, description: 'Orden de salida no encontrada' })
  @ApiParam({ name: 'id', description: 'ID de la orden de salida' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ordenesSalidaService.findOne(id);
  }

  @Get(':id/pdf')
  @ApiOperation({
    summary: 'Generar PDF de la orden de salida',
    description: 'Genera un documento PDF con los detalles de la orden de salida.',
  })
  @ApiResponse({
    status: 200,
    description: 'PDF generado exitosamente.',
    content: {
      'application/pdf': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Orden de salida no encontrada.' })
  @ApiResponse({ status: 400, description: 'Error al generar el PDF.' })
  @ApiParam({ name: 'id', description: 'ID de la orden de salida' })
  async generatePdf(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.ordenesSalidaService.generatePdf(id);

    // inline = abrir en navegador, attachment = descargar
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="OrdenSalida_${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Actualizar una orden de salida (solo en estado BORRADOR)',
  })
  @ApiResponse({
    status: 200,
    description: 'Orden de salida actualizada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Solo se pueden modificar órdenes en estado BORRADOR',
  })
  @ApiResponse({ status: 404, description: 'Orden de salida no encontrada' })
  @ApiParam({ name: 'id', description: 'ID de la orden de salida' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateOrdenSalidaDto: UpdateOrdenSalidaDto,
  ) {
    return this.ordenesSalidaService.update(id, updateOrdenSalidaDto);
  }

  @Post(':id/enviar-autorizacion')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enviar orden de salida a autorización' })
  @ApiResponse({
    status: 200,
    description: 'Orden enviada a autorización exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Solo se pueden enviar órdenes en estado BORRADOR',
  })
  @ApiResponse({ status: 404, description: 'Orden de salida no encontrada' })
  @ApiParam({ name: 'id', description: 'ID de la orden de salida' })
  enviarAutorizacion(
    @Param('id', ParseIntPipe) id: number, 
    @GetUser() user: usuarios,
  ) {
    return this.ordenesSalidaService.enviarAutorizacion(id, user.id_usuario);
  }

  @Post(':id/autorizar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autorizar una orden de salida' })
  @ApiResponse({
    status: 200,
    description: 'Orden de salida autorizada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description:
      'Solo se pueden autorizar órdenes en estado PENDIENTE_AUTORIZACION o stock insuficiente',
  })
  @ApiResponse({ status: 404, description: 'Orden de salida no encontrada' })
  @ApiParam({ name: 'id', description: 'ID de la orden de salida' })
  autorizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() autorizarDto: AutorizarOrdenSalidaDto,
    @GetUser() user: usuarios,
  ) {
    return this.ordenesSalidaService.autorizar(id, autorizarDto, user);
  }

  @Post(':id/rechazar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rechazar una orden de salida' })
  @ApiResponse({
    status: 200,
    description: 'Orden de salida rechazada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Solo se pueden rechazar órdenes en estado PENDIENTE_AUTORIZACION',
  })
  @ApiResponse({ status: 404, description: 'Orden de salida no encontrada' })
  @ApiParam({ name: 'id', description: 'ID de la orden de salida' })
  rechazar(
    @Param('id', ParseIntPipe) id: number,
    @Body() rechazarDto: RechazarOrdenSalidaDto,
    @GetUser() user: usuarios,
  ) {
    return this.ordenesSalidaService.rechazar(id, rechazarDto, user);
  }

  @Post(':id/procesar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Procesar una orden de salida (ejecutar salida física del inventario)',
  })
  @ApiResponse({
    status: 200,
    description: 'Orden de salida procesada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description:
      'Solo se pueden procesar órdenes en estado AUTORIZADA o stock insuficiente',
  })
  @ApiResponse({ status: 404, description: 'Orden de salida no encontrada' })
  @ApiParam({ name: 'id', description: 'ID de la orden de salida' })
  procesar(
    @Param('id', ParseIntPipe) id: number,
    @Body() procesarDto: ProcesarOrdenSalidaDto,
    @GetUser() user: usuarios,
  ) {
    return this.ordenesSalidaService.procesar(id, procesarDto, user);
  }

  @Post(':id/cancelar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar una orden de salida' })
  @ApiResponse({
    status: 200,
    description: 'Orden de salida cancelada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'No se pueden cancelar órdenes ya procesadas',
  })
  @ApiResponse({ status: 404, description: 'Orden de salida no encontrada' })
  @ApiParam({ name: 'id', description: 'ID de la orden de salida' })
  cancelar(
    @Param('id', ParseIntPipe) id: number,
    @Body() cancelarDto: CancelarOrdenSalidaDto,
    @GetUser() user: usuarios,
  ) {
    return this.ordenesSalidaService.cancelar(id, cancelarDto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Eliminar una orden de salida (solo en estado BORRADOR o CANCELADA)',
  })
  @ApiResponse({
    status: 200,
    description: 'Orden de salida eliminada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description:
      'Solo se pueden eliminar órdenes en estado BORRADOR o CANCELADA',
  })
  @ApiResponse({ status: 404, description: 'Orden de salida no encontrada' })
  @ApiParam({ name: 'id', description: 'ID de la orden de salida' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: usuarios,
  ) {
    return this.ordenesSalidaService.remove(id, user.id_usuario);
  }
}
