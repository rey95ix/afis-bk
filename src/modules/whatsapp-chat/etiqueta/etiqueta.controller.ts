import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Request,
  ParseIntPipe,
  Put,
} from '@nestjs/common';
import { EtiquetaService } from './etiqueta.service';
import {
  CreateEtiquetaDto,
  UpdateEtiquetaDto,
  QueryEtiquetaDto,
  AsignarEtiquetaDto,
  DesasignarEtiquetaDto,
  ReemplazarEtiquetasDto,
} from './dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { Auth } from 'src/modules/auth/decorators';
import { RequirePermissions } from 'src/modules/auth/decorators/require-permissions.decorator';

@ApiTags('WhatsApp Chat - Etiquetas')
@Controller('api/atencion-al-cliente/whatsapp-chat')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Auth()
export class EtiquetaController {
  constructor(private readonly etiquetaService: EtiquetaService) {}

  // ===================== CRUD DE ETIQUETAS =====================

  @RequirePermissions('atencion_cliente.whatsapp_chat:gestionar_etiquetas')
  @Post('etiquetas')
  @ApiOperation({
    summary: 'Crear una nueva etiqueta',
    description: 'Crea una nueva etiqueta para categorizar chats. Requiere permisos de administrador.',
  })
  @ApiResponse({ status: 201, description: 'Etiqueta creada exitosamente' })
  @ApiResponse({ status: 409, description: 'Ya existe una etiqueta con ese nombre' })
  create(@Body() dto: CreateEtiquetaDto, @Request() req) {
    return this.etiquetaService.create(dto, req.user.id_usuario);
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:ver')
  @Get('etiquetas')
  @ApiOperation({
    summary: 'Listar todas las etiquetas',
    description: 'Obtiene todas las etiquetas disponibles con conteo de chats.',
  })
  @ApiResponse({ status: 200, description: 'Lista de etiquetas obtenida exitosamente' })
  findAll(@Query() query: QueryEtiquetaDto) {
    return this.etiquetaService.findAll(query);
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:ver')
  @Get('etiquetas/stats')
  @ApiOperation({
    summary: 'Obtener estadísticas de etiquetas',
    description: 'Obtiene estadísticas de uso de cada etiqueta.',
  })
  @ApiResponse({ status: 200, description: 'Estadísticas obtenidas exitosamente' })
  getStats() {
    return this.etiquetaService.getEtiquetaStats();
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:ver')
  @Get('etiquetas/:id')
  @ApiOperation({
    summary: 'Obtener una etiqueta por ID',
    description: 'Obtiene los detalles de una etiqueta específica.',
  })
  @ApiParam({ name: 'id', description: 'ID de la etiqueta' })
  @ApiResponse({ status: 200, description: 'Etiqueta obtenida exitosamente' })
  @ApiResponse({ status: 404, description: 'Etiqueta no encontrada' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.etiquetaService.findOne(id);
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:gestionar_etiquetas')
  @Patch('etiquetas/:id')
  @ApiOperation({
    summary: 'Actualizar una etiqueta',
    description: 'Actualiza los datos de una etiqueta existente. Requiere permisos de administrador.',
  })
  @ApiParam({ name: 'id', description: 'ID de la etiqueta' })
  @ApiResponse({ status: 200, description: 'Etiqueta actualizada exitosamente' })
  @ApiResponse({ status: 404, description: 'Etiqueta no encontrada' })
  @ApiResponse({ status: 409, description: 'Ya existe una etiqueta con ese nombre' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEtiquetaDto,
    @Request() req,
  ) {
    return this.etiquetaService.update(id, dto, req.user.id_usuario);
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:gestionar_etiquetas')
  @Delete('etiquetas/:id')
  @ApiOperation({
    summary: 'Eliminar una etiqueta',
    description:
      'Elimina una etiqueta. Las asignaciones a chats se eliminan automáticamente. Requiere permisos de administrador.',
  })
  @ApiParam({ name: 'id', description: 'ID de la etiqueta' })
  @ApiResponse({ status: 200, description: 'Etiqueta eliminada exitosamente' })
  @ApiResponse({ status: 404, description: 'Etiqueta no encontrada' })
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.etiquetaService.remove(id, req.user.id_usuario);
  }

  // ===================== ASIGNACIÓN A CHATS =====================

  @RequirePermissions('atencion_cliente.whatsapp_chat:ver')
  @Get('chats/:chatId/etiquetas')
  @ApiOperation({
    summary: 'Obtener etiquetas de un chat',
    description: 'Obtiene todas las etiquetas asignadas a un chat específico.',
  })
  @ApiParam({ name: 'chatId', description: 'ID del chat' })
  @ApiResponse({ status: 200, description: 'Etiquetas obtenidas exitosamente' })
  @ApiResponse({ status: 404, description: 'Chat no encontrado' })
  getEtiquetasDeChat(@Param('chatId', ParseIntPipe) chatId: number) {
    return this.etiquetaService.getEtiquetasDeChat(chatId);
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:editar')
  @Post('chats/:chatId/etiquetas')
  @ApiOperation({
    summary: 'Asignar etiquetas a un chat',
    description: 'Asigna una o más etiquetas a un chat. Las etiquetas existentes se mantienen.',
  })
  @ApiParam({ name: 'chatId', description: 'ID del chat' })
  @ApiResponse({ status: 200, description: 'Etiquetas asignadas exitosamente' })
  @ApiResponse({ status: 404, description: 'Chat o etiqueta no encontrada' })
  @ApiResponse({ status: 400, description: 'Una o más etiquetas no existen o no están activas' })
  asignarEtiquetas(
    @Param('chatId', ParseIntPipe) chatId: number,
    @Body() dto: AsignarEtiquetaDto,
    @Request() req,
  ) {
    return this.etiquetaService.asignarEtiquetas(chatId, dto, req.user.id_usuario);
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:editar')
  @Delete('chats/:chatId/etiquetas')
  @ApiOperation({
    summary: 'Desasignar etiquetas de un chat',
    description: 'Remueve una o más etiquetas de un chat.',
  })
  @ApiParam({ name: 'chatId', description: 'ID del chat' })
  @ApiResponse({ status: 200, description: 'Etiquetas desasignadas exitosamente' })
  @ApiResponse({ status: 404, description: 'Chat no encontrado' })
  desasignarEtiquetas(
    @Param('chatId', ParseIntPipe) chatId: number,
    @Body() dto: DesasignarEtiquetaDto,
    @Request() req,
  ) {
    return this.etiquetaService.desasignarEtiquetas(chatId, dto, req.user.id_usuario);
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:editar')
  @Put('chats/:chatId/etiquetas')
  @ApiOperation({
    summary: 'Reemplazar etiquetas de un chat',
    description: 'Reemplaza todas las etiquetas de un chat con las nuevas especificadas. Enviar array vacío para eliminar todas las etiquetas.',
  })
  @ApiParam({ name: 'chatId', description: 'ID del chat' })
  @ApiResponse({ status: 200, description: 'Etiquetas reemplazadas exitosamente' })
  @ApiResponse({ status: 404, description: 'Chat o etiqueta no encontrada' })
  @ApiResponse({ status: 400, description: 'Una o más etiquetas no existen o no están activas' })
  reemplazarEtiquetas(
    @Param('chatId', ParseIntPipe) chatId: number,
    @Body() dto: ReemplazarEtiquetasDto,
    @Request() req,
  ) {
    return this.etiquetaService.reemplazarEtiquetas(chatId, dto, req.user.id_usuario);
  }
}
