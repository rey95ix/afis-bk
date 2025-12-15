import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Res,
  HttpStatus,
  Logger,
  Headers,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Response, Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
import { WhatsAppApiService } from './whatsapp-api.service';
import { WebhookPayloadDto } from './dto';
import { ChatService } from '../chat/chat.service';
import { MessageService } from '../message/message.service';
import { RuleEngineService } from '../ia/rule-engine.service';
import { OpenAIChatService } from '../ia/openai-chat.service';
import { WhatsAppChatGateway } from '../whatsapp-chat.gateway';

@ApiTags('WhatsApp Webhook')
@Controller('api/atencion-al-cliente/whatsapp-chat/webhook')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(
    private readonly whatsappApiService: WhatsAppApiService,
    private readonly chatService: ChatService,
    private readonly messageService: MessageService,
    private readonly ruleEngineService: RuleEngineService,
    private readonly openaiChatService: OpenAIChatService,
    private readonly chatGateway: WhatsAppChatGateway,
  ) { }

  /**
   * Verificación del webhook (GET)
   * WhatsApp envía una solicitud GET para verificar el webhook
   */
  @Get()
  @ApiOperation({
    summary: 'Verificar webhook de WhatsApp',
    description: 'Endpoint para verificación del webhook por parte de WhatsApp.',
  })
  @ApiResponse({
    status: 200,
    description: 'Challenge devuelto si la verificación es exitosa',
  })
  @ApiResponse({
    status: 403,
    description: 'Verificación fallida',
  })
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    this.logger.log(`Webhook verification request: mode=${mode}`);

    const result = this.whatsappApiService.verifyWebhook(mode, token, challenge);

    if (result) {
      return res.status(HttpStatus.OK).send(result);
    }

    return res.status(HttpStatus.FORBIDDEN).send('Verification failed');
  }

  /**
   * Recibir eventos del webhook (POST)
   * WhatsApp envía mensajes y actualizaciones de estado aquí
   */
  @Post()
  @ApiExcludeEndpoint() // No mostrar en Swagger por seguridad
  async handleWebhook(
    @Body() payload: WebhookPayloadDto,
    @Headers('x-hub-signature-256') signature: string,
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
  ) {
    // Responder inmediatamente con 200 para evitar reintentos
    res.status(HttpStatus.OK).send('EVENT_RECEIVED');

    // Verificar firma (opcional en desarrollo)
    const rawBody = req.rawBody?.toString() || JSON.stringify(payload);
    if (!this.whatsappApiService.verifyWebhookSignature(rawBody, signature)) {
      this.logger.warn('Invalid webhook signature');
      return;
    }

    // Procesar en background
    this.processWebhookPayload(payload).catch((error) => {
      this.logger.error(`Error processing webhook: ${error.message}`);
    });
  }

  /**
   * Procesar el payload del webhook
   */
  private async processWebhookPayload(payload: WebhookPayloadDto) {
    if (payload.object !== 'whatsapp_business_account') {
      this.logger.warn(`Unknown webhook object: ${payload.object}`);
      return;
    }

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field !== 'messages') {
          continue;
        }

        const value = change.value;

        // Procesar mensajes entrantes
        if (value.messages) {
          for (const message of value.messages) {
            await this.handleIncomingMessage(message, value.contacts?.[0]);
          }
        }

        // Procesar actualizaciones de estado
        if (value.statuses) {
          for (const status of value.statuses) {
            await this.handleStatusUpdate(status);
          }
        }
      }
    }
  }

  /**
   * Manejar mensaje entrante
   */
  private async handleIncomingMessage(
    message: any,
    contact?: { wa_id: string; profile?: { name: string } },
  ) {
    const telefono = `+${message.from}`;
    const nombre = contact?.profile?.name;
    const whatsappMessageId = message.id;

    this.logger.log(`Incoming message from ${telefono}: ${message.type}`);

    try {
      // Buscar o crear chat
      const chat = await this.chatService.findOrCreateByPhone(
        telefono,
        `chat_${Date.now()}`,
        nombre,
      );

      // Extraer contenido según el tipo de mensaje
      let contenido = '';
      let tipo: 'TEXTO' | 'IMAGEN' | 'VIDEO' | 'AUDIO' | 'DOCUMENTO' | 'UBICACION' | 'CONTACTO' = 'TEXTO';
      let mediaUrl: string | undefined;
      let mediaType: string | undefined;
      let mediaSize: number | undefined;

      switch (message.type) {
        case 'text':
          contenido = message.text?.body || '';
          tipo = 'TEXTO';
          break;

        case 'image':
          contenido = message.image?.caption || '[Imagen]';
          tipo = 'IMAGEN';
          mediaType = message.image?.mime_type;
          mediaSize = message.image?.file_size;
          // Descargar URL de la imagen desde WhatsApp
          if (message.image?.id) {
            const mediaResult = await this.whatsappApiService.downloadMedia(message.image.id);
            if (mediaResult) {
              mediaUrl = mediaResult.url;
            }
          }
          break;

        case 'video':
          contenido = message.video?.caption || '[Video]';
          tipo = 'VIDEO';
          mediaType = message.video?.mime_type;
          mediaSize = message.video?.file_size;
          // Descargar URL del video desde WhatsApp
          if (message.video?.id) {
            const mediaResult = await this.whatsappApiService.downloadMedia(message.video.id);
            if (mediaResult) {
              mediaUrl = mediaResult.url;
            }
          }
          break;

        case 'audio':
          contenido = '[Audio]';
          tipo = 'AUDIO';
          mediaType = message.audio?.mime_type;
          mediaSize = message.audio?.file_size;
          // Descargar URL del audio desde WhatsApp
          if (message.audio?.id) {
            const mediaResult = await this.whatsappApiService.downloadMedia(message.audio.id);
            if (mediaResult) {
              mediaUrl = mediaResult.url;
            }
          }
          break;

        case 'document':
          contenido = message.document?.filename || message.document?.caption || '[Documento]';
          tipo = 'DOCUMENTO';
          mediaType = message.document?.mime_type;
          mediaSize = message.document?.file_size;
          // Descargar URL del documento desde WhatsApp
          if (message.document?.id) {
            const mediaResult = await this.whatsappApiService.downloadMedia(message.document.id);
            if (mediaResult) {
              mediaUrl = mediaResult.url;
            }
          }
          break;

        case 'location':
          contenido = `[Ubicación: ${message.location?.latitude}, ${message.location?.longitude}]`;
          tipo = 'UBICACION';
          break;

        case 'contacts':
          contenido = '[Contacto compartido]';
          tipo = 'CONTACTO';
          break;

        default:
          contenido = `[Mensaje tipo: ${message.type}]`;
      }

      // Guardar mensaje
      const savedMessage = await this.messageService.receiveMessage(
        chat.id_chat,
        whatsappMessageId,
        contenido,
        tipo,
        mediaUrl,
        mediaType,
      );

      // Emitir nuevo mensaje via WebSocket
      this.chatGateway.emitNewMessage(chat.id_chat, savedMessage);

      // Marcar como leído en WhatsApp
      await this.whatsappApiService.markAsRead(whatsappMessageId);

      // Procesar con IA si está habilitada 
      if (chat.ia_habilitada && chat.estado === 'ABIERTO') {
        await this.processWithIA(chat.id_chat, contenido, telefono, nombre);
      }

    } catch (error) {
      this.logger.error(`Error handling incoming message: ${error.message}`);
    }
  }

  /**
   * Manejar actualización de estado de mensaje
   */
  private async handleStatusUpdate(status: any) {
    const messageId = status.id;
    let estado: 'ENTREGADO' | 'LEIDO' | 'FALLIDO';

    switch (status.status) {
      case 'delivered':
        estado = 'ENTREGADO';
        break;
      case 'read':
        estado = 'LEIDO';
        break;
      case 'failed':
        estado = 'FALLIDO';
        this.logger.warn(
          `Message ${messageId} failed: ${JSON.stringify(status.errors)}`,
        );
        break;
      default:
        return; // Ignorar otros estados como 'sent'
    }

    try {
      const updatedMessage = await this.messageService.updateStatus(messageId, estado);
      // Emitir cambio de estado via WebSocket
      if (updatedMessage) {
        this.chatGateway.emitMessageStatus(
          updatedMessage.id_chat,
          messageId,
          estado,
        );
      }
    } catch (error) {
      this.logger.error(`Error updating message status: ${error.message}`);
    }
  }

  /**
   * Procesar mensaje entrante con IA
   */
  private async processWithIA(
    chatId: number,
    contenido: string,
    telefono: string,
    nombre?: string,
  ) {
    try {
      // Evaluar reglas primero
      const messageContext = {
        contenido,
        chatId,
        clienteTelefono: telefono,
        clienteNombre: nombre,
      };

      const ruleMatch = await this.ruleEngineService.evaluateMessage(messageContext);

      // Si hay regla con acciones, ejecutarlas
      if (ruleMatch) {
        const results = await this.ruleEngineService.executeActions(
          ruleMatch.actions,
          messageContext,
        );
        this.logger.log(`Rule "${ruleMatch.ruleName}" executed with ${results.length} actions`);
        return;
      }

      // Si no hay regla, procesar con IA directamente
      const iaResponse = await this.openaiChatService.generateResponse(
        chatId,
        contenido,
      );

      // Guardar y enviar respuesta de IA
      await this.messageService.saveIAMessage(
        chatId,
        iaResponse.content,
        undefined,
        iaResponse.confidence,
      );

      this.logger.log(`IA response sent to chat ${chatId}`);

      // Si debe escalar a humano
      if (iaResponse.shouldEscalate) {
        await this.ruleEngineService.executeActions(
          [{ type: 'ESCALATE', params: {} }],
          messageContext,
        );
        this.logger.log(`Chat ${chatId} escalated to human`);
      }
    } catch (error) {
      this.logger.error(`Error processing with IA: ${error.message}`);
    }
  }
}
