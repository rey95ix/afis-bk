import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Request,
  Res,
  ParseIntPipe,
  HttpStatus,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
} from '@nestjs/swagger';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { Auth } from 'src/modules/auth/decorators';
import { RequirePermissions } from 'src/modules/auth/decorators/require-permissions.decorator';
import { ValidacionComprobanteService } from './validacion-comprobante.service';
import { AplicarValidacionDto, EnviarValidacionMultiDto, QueryValidacionDto, RechazarValidacionDto, UpdateBancoDto } from './dto';

@ApiTags('WhatsApp Chat - Validación Comprobantes')
@Controller('api/atencion-al-cliente/whatsapp-chat/validaciones')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Auth()
export class ValidacionComprobanteController {
  constructor(private readonly service: ValidacionComprobanteService) {}

  @RequirePermissions('atencion_cliente.whatsapp_validaciones:ver')
  @Post('enviar-directo')
  @UseInterceptors(FilesInterceptor('files', 10, {
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) {
        cb(new BadRequestException('Solo se permiten imagenes'), false);
      } else {
        cb(null, true);
      }
    },
  }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Subir comprobantes directamente',
    description: 'Sube imágenes de comprobantes bancarios directamente sin depender de un chat de WhatsApp.',
  })
  @ApiResponse({ status: 201, description: 'Comprobante enviado a validación exitosamente' })
  @ApiResponse({ status: 400, description: 'Archivos inválidos o no es un comprobante' })
  enviarDirecto(
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req,
  ) {
    return this.service.enviarDirecto(files, req.user.id_usuario);
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:ver')
  @Post('enviar-multi')
  @ApiOperation({
    summary: 'Enviar múltiples mensajes a validación',
    description: 'Envía múltiples mensajes (imágenes + textos) como una sola validación de comprobante. Combina la información de todos los mensajes para extraer datos con IA.',
  })
  @ApiResponse({ status: 201, description: 'Mensajes enviados a validación exitosamente' })
  @ApiResponse({ status: 400, description: 'Mensajes inválidos o ya enviados a validación' })
  @ApiResponse({ status: 404, description: 'Uno o más mensajes no encontrados' })
  enviarAValidacionMulti(
    @Body() dto: EnviarValidacionMultiDto,
    @Request() req,
  ) {
    return this.service.enviarAValidacionMulti(dto.messageIds, req.user.id_usuario);
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:ver')
  @Post('enviar/:messageId')
  @ApiOperation({
    summary: 'Enviar imagen a validación',
    description: 'Envía una imagen de comprobante bancario para ser validada. Extrae datos automáticamente con IA.',
  })
  @ApiParam({ name: 'messageId', description: 'ID del mensaje con la imagen' })
  @ApiResponse({ status: 201, description: 'Imagen enviada a validación exitosamente' })
  @ApiResponse({ status: 400, description: 'El mensaje no es una imagen o ya fue enviado a validación' })
  @ApiResponse({ status: 404, description: 'Mensaje no encontrado' })
  enviarAValidacion(
    @Param('messageId', ParseIntPipe) messageId: number,
    @Request() req,
  ) {
    return this.service.enviarAValidacion(messageId, req.user.id_usuario);
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:ver')
  @Patch(':id/banco')
  @ApiOperation({
    summary: 'Actualizar banco destino',
    description: 'Actualiza el banco destino de una validación pendiente. Útil cuando la IA no pudo detectar el banco destino en transferencias 365.',
  })
  @ApiParam({ name: 'id', description: 'ID de la validación' })
  @ApiResponse({ status: 200, description: 'Banco actualizado exitosamente' })
  @ApiResponse({ status: 400, description: 'La validación no está pendiente' })
  @ApiResponse({ status: 404, description: 'Validación no encontrada' })
  actualizarBanco(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBancoDto,
  ) {
    return this.service.actualizarBanco(id, dto.banco);
  }

  @RequirePermissions('atencion_cliente.whatsapp_validaciones:ver')
  @Get()
  @ApiOperation({
    summary: 'Listar validaciones',
    description: 'Lista todas las validaciones de comprobantes con filtros opcionales y paginación.',
  })
  @ApiResponse({ status: 200, description: 'Lista de validaciones obtenida exitosamente' })
  findAll(@Query() query: QueryValidacionDto) {
    return this.service.findAll(query);
  }

  @RequirePermissions('atencion_cliente.whatsapp_validaciones:ver')
  @Get('stats')
  @ApiOperation({
    summary: 'Obtener estadísticas',
    description: 'Obtiene estadísticas de validaciones (pendientes, aprobadas, rechazadas).',
  })
  @ApiResponse({ status: 200, description: 'Estadísticas obtenidas exitosamente' })
  getStats() {
    return this.service.getStats();
  }

  @RequirePermissions('atencion_cliente.whatsapp_validaciones:ver')
  @Get('excel')
  @ApiOperation({
    summary: 'Descargar reporte Excel',
    description: 'Genera y descarga un reporte Excel de validaciones de comprobantes con los filtros aplicados.',
  })
  @ApiResponse({
    status: 200,
    description: 'Archivo Excel de validaciones',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {},
    },
  })
  async downloadExcel(
    @Query() query: QueryValidacionDto,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.service.generateExcel(query);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `validaciones_comprobantes_${timestamp}.xlsx`;

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });

    res.status(HttpStatus.OK).send(buffer);
  }

  @RequirePermissions('atencion_cliente.whatsapp_validaciones:ver')
  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalle de validación',
    description: 'Obtiene el detalle completo de una validación específica.',
  })
  @ApiParam({ name: 'id', description: 'ID de la validación' })
  @ApiResponse({ status: 200, description: 'Validación obtenida exitosamente' })
  @ApiResponse({ status: 404, description: 'Validación no encontrada' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @RequirePermissions('atencion_cliente.whatsapp_validaciones:aprobar')
  @Patch(':id/aprobar')
  @ApiOperation({
    summary: 'Aprobar validación',
    description: 'Marca una validación de comprobante como aprobada.',
  })
  @ApiParam({ name: 'id', description: 'ID de la validación' })
  @ApiResponse({ status: 200, description: 'Validación aprobada exitosamente' })
  @ApiResponse({ status: 400, description: 'La validación ya fue procesada' })
  @ApiResponse({ status: 404, description: 'Validación no encontrada' })
  aprobar(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.service.aprobar(id, req.user.id_usuario);
  }

  @RequirePermissions('atencion_cliente.whatsapp_validaciones:aprobar')
  @Patch(':id/rechazar')
  @ApiOperation({
    summary: 'Rechazar validación',
    description: 'Marca una validación de comprobante como rechazada con un comentario.',
  })
  @ApiParam({ name: 'id', description: 'ID de la validación' })
  @ApiResponse({ status: 200, description: 'Validación rechazada exitosamente' })
  @ApiResponse({ status: 400, description: 'La validación ya fue procesada o falta el comentario' })
  @ApiResponse({ status: 404, description: 'Validación no encontrada' })
  rechazar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RechazarValidacionDto,
    @Request() req,
  ) {
    return this.service.rechazar(id, req.user.id_usuario, dto);
  }

  @RequirePermissions('atencion_cliente.whatsapp_validaciones:aprobar')
  @Patch(':id/aplicar')
  @ApiOperation({
    summary: 'Aplicar validación',
    description: 'Marca una validación de comprobante aprobada como aplicada (estado final). Opcionalmente registra el pago en un contrato.',
  })
  @ApiParam({ name: 'id', description: 'ID de la validación' })
  @ApiResponse({ status: 200, description: 'Validación aplicada exitosamente' })
  @ApiResponse({ status: 400, description: 'La validación no está aprobada' })
  @ApiResponse({ status: 404, description: 'Validación no encontrada' })
  aplicar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AplicarValidacionDto,
    @Request() req,
  ) {
    return this.service.aplicar(id, req.user.id_usuario, dto);
  }
}
