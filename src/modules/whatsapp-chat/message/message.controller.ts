import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Request,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MessageService } from './message.service';
import { SendMessageDto, QueryMessageDto } from './dto';
import { SendTemplateDto } from '../template/dto/send-template.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { Auth } from 'src/modules/auth/decorators';
import { RequirePermissions } from 'src/modules/auth/decorators/require-permissions.decorator';

@ApiTags('WhatsApp Messages')
@Controller('api/atencion-al-cliente/whatsapp-chat/chats/:chatId/messages')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Auth()
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @RequirePermissions('atencion_cliente.whatsapp_chat:crear')
  @Post()
  @ApiOperation({
    summary: 'Enviar un mensaje',
    description: 'Envía un mensaje de texto o multimedia en un chat activo.',
  })
  @ApiParam({
    name: 'chatId',
    description: 'ID del chat',
    example: 1,
  })
  @ApiResponse({
    status: 201,
    description: 'Mensaje enviado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'El chat está cerrado',
  })
  @ApiResponse({
    status: 404,
    description: 'Chat no encontrado',
  })
  sendMessage(
    @Param('chatId', ParseIntPipe) chatId: number,
    @Body() sendMessageDto: SendMessageDto,
    @Request() req,
  ) {
    return this.messageService.sendMessage(chatId, sendMessageDto, req.user.id_usuario);
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:crear')
  @Post('template')
  @ApiOperation({
    summary: 'Enviar un mensaje con plantilla',
    description: 'Envía un mensaje usando una plantilla de WhatsApp aprobada. Útil para reabrir la ventana de 24 horas.',
  })
  @ApiParam({
    name: 'chatId',
    description: 'ID del chat',
    example: 1,
  })
  @ApiResponse({
    status: 201,
    description: 'Plantilla enviada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Error al enviar la plantilla',
  })
  @ApiResponse({
    status: 403,
    description: 'Plantilla no aprobada o desactivada',
  })
  @ApiResponse({
    status: 404,
    description: 'Chat o plantilla no encontrados',
  })
  sendTemplateMessage(
    @Param('chatId', ParseIntPipe) chatId: number,
    @Body() sendTemplateDto: SendTemplateDto,
    @Request() req,
  ) {
    return this.messageService.sendTemplateMessage(chatId, sendTemplateDto, req.user.id_usuario);
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:crear')
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Subir archivo multimedia',
    description: 'Sube un archivo (imagen, documento, etc.) para enviar en un mensaje.',
  })
  @ApiParam({
    name: 'chatId',
    description: 'ID del chat',
    example: 1,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Archivo a subir',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Archivo subido exitosamente',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL del archivo subido' },
        tipo_media: { type: 'string', description: 'Tipo MIME del archivo' },
        filename: { type: 'string', description: 'Nombre original del archivo' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Error al subir el archivo',
  })
  @ApiResponse({
    status: 404,
    description: 'Chat no encontrado',
  })
  uploadMedia(
    @Param('chatId', ParseIntPipe) chatId: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }
    return this.messageService.uploadMedia(chatId, file);
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:ver')
  @Get()
  @ApiOperation({
    summary: 'Listar mensajes de un chat',
    description:
      'Obtiene una lista paginada de mensajes con opciones de filtrado.',
  })
  @ApiParam({
    name: 'chatId',
    description: 'ID del chat',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de mensajes obtenida exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Chat no encontrado',
  })
  findAll(
    @Param('chatId', ParseIntPipe) chatId: number,
    @Query() queryDto: QueryMessageDto,
  ) {
    return this.messageService.findAll(chatId, queryDto);
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:ver')
  @Get('new')
  @ApiOperation({
    summary: 'Obtener mensajes nuevos (polling)',
    description:
      'Obtiene mensajes creados después de un timestamp. Usar para polling.',
  })
  @ApiParam({
    name: 'chatId',
    description: 'ID del chat',
    example: 1,
  })
  @ApiQuery({
    name: 'since',
    required: true,
    description: 'Timestamp ISO desde el cual obtener mensajes',
    example: '2024-01-15T10:30:00.000Z',
  })
  @ApiResponse({
    status: 200,
    description: 'Mensajes nuevos obtenidos',
  })
  getNewMessages(
    @Param('chatId', ParseIntPipe) chatId: number,
    @Query('since') since: string,
  ) {
    return this.messageService.getNewMessages(chatId, new Date(since));
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:editar')
  @Patch('read-all')
  @ApiOperation({
    summary: 'Marcar todos los mensajes como leídos',
    description: 'Marca todos los mensajes entrantes de un chat como leídos.',
  })
  @ApiParam({
    name: 'chatId',
    description: 'ID del chat',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Mensajes marcados como leídos',
  })
  @ApiResponse({
    status: 404,
    description: 'Chat no encontrado',
  })
  markAllAsRead(@Param('chatId', ParseIntPipe) chatId: number) {
    return this.messageService.markAllAsRead(chatId);
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:ver')
  @Get(':id')
  @ApiOperation({
    summary: 'Obtener un mensaje por ID',
    description: 'Obtiene los detalles completos de un mensaje.',
  })
  @ApiParam({
    name: 'chatId',
    description: 'ID del chat',
    example: 1,
  })
  @ApiParam({
    name: 'id',
    description: 'ID del mensaje',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Mensaje encontrado',
  })
  @ApiResponse({
    status: 404,
    description: 'Mensaje no encontrado',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.messageService.findOne(id);
  }
}
