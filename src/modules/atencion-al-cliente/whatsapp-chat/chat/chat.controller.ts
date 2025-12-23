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
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateChatDto, UpdateChatDto, QueryChatDto } from './dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { Auth } from 'src/modules/auth/decorators';
import { RequirePermissions } from 'src/modules/auth/decorators/require-permissions.decorator';

@ApiTags('WhatsApp Chat')
@Controller('api/atencion-al-cliente/whatsapp-chat/chats')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Auth()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @RequirePermissions('atencion_cliente.whatsapp_chat:crear')
  @Post()
  @ApiOperation({
    summary: 'Iniciar un nuevo chat',
    description:
      'Crea una nueva conversación de WhatsApp con un cliente. Si ya existe un chat activo con el mismo número, retorna error.',
  })
  @ApiResponse({
    status: 201,
    description: 'Chat creado exitosamente',
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un chat activo con este número',
  })
  @ApiResponse({
    status: 404,
    description: 'Cliente o usuario no encontrado',
  })
  create(@Body() createChatDto: CreateChatDto, @Request() req) {
    return this.chatService.create(createChatDto, req.user.id_usuario);
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:ver')
  @Get()
  @ApiOperation({
    summary: 'Listar chats con filtros',
    description:
      'Obtiene una lista paginada de chats con opciones de filtrado por estado, usuario asignado, cliente, tags y rango de fechas.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de chats obtenida exitosamente',
  })
  findAll(@Query() queryDto: QueryChatDto) {
    return this.chatService.findAll(queryDto);
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:ver')
  @Get('stats')
  @ApiOperation({
    summary: 'Obtener estadísticas de chats',
    description:
      'Obtiene estadísticas generales de chats o filtradas por usuario.',
  })
  @ApiQuery({
    name: 'id_usuario',
    required: false,
    description: 'ID del usuario para filtrar estadísticas',
  })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas obtenidas exitosamente',
  })
  getStats(@Query('id_usuario') userId?: string) {
    return this.chatService.getStats(userId ? parseInt(userId) : undefined);
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:ver')
  @Get(':id/window-status')
  @ApiOperation({
    summary: 'Verificar estado de ventana de 24 horas',
    description:
      'Verifica si se puede enviar un mensaje de forma libre o si se requiere usar una plantilla. La ventana de 24 horas se calcula desde el último mensaje del cliente.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del chat',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Estado de la ventana obtenido',
    schema: {
      type: 'object',
      properties: {
        canSend: { type: 'boolean', description: 'Si se puede enviar mensaje de forma libre' },
        hoursRemaining: { type: 'number', nullable: true, description: 'Horas restantes de la ventana' },
        expiresAt: { type: 'string', nullable: true, description: 'Fecha/hora de expiración' },
        requiresTemplate: { type: 'boolean', description: 'Si requiere usar plantilla' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Chat no encontrado',
  })
  getWindowStatus(@Param('id', ParseIntPipe) id: number) {
    return this.chatService.canSendFreeformMessage(id);
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:ver')
  @Get(':id')
  @ApiOperation({
    summary: 'Obtener un chat por ID',
    description:
      'Obtiene los detalles completos de un chat incluyendo mensajes recientes, información del cliente y usuario asignado.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del chat',
    example: 1,
  })
  @ApiQuery({
    name: 'include_messages',
    required: false,
    description: 'Incluir mensajes (default: true)',
  })
  @ApiQuery({
    name: 'messages_limit',
    required: false,
    description: 'Límite de mensajes a incluir (default: 50)',
  })
  @ApiResponse({
    status: 200,
    description: 'Chat encontrado',
  })
  @ApiResponse({
    status: 404,
    description: 'Chat no encontrado',
  })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('include_messages') includeMessages?: string,
    @Query('messages_limit') messagesLimit?: string,
  ) {
    return this.chatService.findOne(
      id,
      includeMessages !== 'false',
      messagesLimit ? parseInt(messagesLimit) : 50,
    );
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:editar')
  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar un chat',
    description:
      'Permite actualizar el estado, usuario asignado, tags y otras propiedades del chat.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del chat',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Chat actualizado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Chat no encontrado',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateChatDto: UpdateChatDto,
    @Request() req,
  ) {
    return this.chatService.update(id, updateChatDto, req.user.id_usuario);
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:editar')
  @Post(':id/close')
  @ApiOperation({
    summary: 'Cerrar un chat',
    description:
      'Cierra un chat de WhatsApp. Calcula métricas finales y desactiva asignaciones.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del chat',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Chat cerrado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'El chat ya está cerrado',
  })
  @ApiResponse({
    status: 404,
    description: 'Chat no encontrado',
  })
  close(
    @Param('id', ParseIntPipe) id: number,
    @Body('razon') razon: string,
    @Request() req,
  ) {
    return this.chatService.close(id, req.user.id_usuario, razon);
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:editar')
  @Post(':id/read')
  @ApiOperation({
    summary: 'Marcar chat como leído',
    description: 'Resetea el contador de mensajes no leídos a cero.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del chat',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Chat marcado como leído',
  })
  markAsRead(@Param('id', ParseIntPipe) id: number) {
    return this.chatService.markAsRead(id);
  }
}
