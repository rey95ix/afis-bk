import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SendMessageDto, QueryMessageDto } from './dto';
import { direccion_mensaje, estado_mensaje_whatsapp } from '@prisma/client';
import { ChatService } from '../chat/chat.service';
import { WhatsAppApiService } from '../whatsapp-api/whatsapp-api.service';
import { MinioService } from '../../../minio/minio.service';
import { WhatsAppChatGateway } from '../whatsapp-chat.gateway';

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatService: ChatService,
    private readonly whatsAppApiService: WhatsAppApiService,
    private readonly minioService: MinioService,
    private readonly chatGateway: WhatsAppChatGateway,
  ) {}

  /**
   * Subir archivo multimedia para enviar en un mensaje
   */
  async uploadMedia(
    chatId: number,
    file: Express.Multer.File,
  ): Promise<{ url: string; tipo_media: string; filename: string }> {
    // Verificar que el chat existe
    const chat = await this.prisma.whatsapp_chat.findUnique({
      where: { id_chat: chatId },
    });

    if (!chat) {
      throw new NotFoundException(`Chat con ID ${chatId} no encontrado`);
    }

    // Generar nombre unico para el archivo
    const timestamp = Date.now();
    const extension = file.originalname.split('.').pop() || '';
    const objectName = `whatsapp-chat/${chatId}/${timestamp}-${file.originalname}`;

    try {
      const result = await this.minioService.uploadFile(file, objectName);

      return {
        url: result.url,
        tipo_media: file.mimetype,
        filename: file.originalname,
      };
    } catch (error) {
      this.logger.error(`Error subiendo archivo: ${error.message}`);
      throw new BadRequestException('Error al subir el archivo');
    }
  }

  /**
   * Enviar un mensaje en un chat
   */
  async sendMessage(chatId: number, sendMessageDto: SendMessageDto, userId: number) {
    // Verificar que el chat existe y está activo
    const chat = await this.prisma.whatsapp_chat.findUnique({
      where: { id_chat: chatId },
    });

    if (!chat) {
      throw new NotFoundException(`Chat con ID ${chatId} no encontrado`);
    }

    if (chat.estado === 'CERRADO') {
      throw new BadRequestException('No se puede enviar mensajes a un chat cerrado');
    }

    // Enviar mensaje a WhatsApp segun el tipo
    let whatsappMessageId: string | null = null;
    const tipoMensaje = sendMessageDto.tipo || 'TEXTO';

    try {
      switch (tipoMensaje) {
        case 'TEXTO':
          whatsappMessageId = await this.whatsAppApiService.sendTextMessage(
            chat.telefono_cliente,
            sendMessageDto.contenido,
          );
          break;
        case 'IMAGEN':
          if (sendMessageDto.url_media) {
            whatsappMessageId = await this.whatsAppApiService.sendImageMessage(
              chat.telefono_cliente,
              sendMessageDto.url_media,
              sendMessageDto.contenido,
            );
          }
          break;
        case 'DOCUMENTO':
          if (sendMessageDto.url_media) {
            whatsappMessageId = await this.whatsAppApiService.sendDocumentMessage(
              chat.telefono_cliente,
              sendMessageDto.url_media,
              sendMessageDto.contenido,
            );
          }
          break;
        default:
          // Para otros tipos, generar ID local
          whatsappMessageId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      }
    } catch (error) {
      this.logger.error(`Error enviando mensaje a WhatsApp: ${error.message}`);

      // Crear mensaje con estado FALLIDO
      const failedMessage = await this.prisma.whatsapp_message.create({
        data: {
          id_chat: chatId,
          whatsapp_message_id: `msg_failed_${Date.now()}`,
          direccion: 'SALIENTE',
          tipo: tipoMensaje,
          contenido: sendMessageDto.contenido,
          url_media: sendMessageDto.url_media,
          tipo_media: sendMessageDto.tipo_media,
          id_usuario_envia: userId,
          es_de_ia: false,
          estado: 'FALLIDO',
        },
        include: {
          usuario_envia: {
            select: {
              id_usuario: true,
              nombres: true,
              apellidos: true,
            },
          },
        },
      });

      throw new BadRequestException(`Error al enviar mensaje a WhatsApp: ${error.message}`);
    }

    // Crear el mensaje con el ID real de WhatsApp
    const message = await this.prisma.whatsapp_message.create({
      data: {
        id_chat: chatId,
        whatsapp_message_id: whatsappMessageId || `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        direccion: 'SALIENTE',
        tipo: tipoMensaje,
        contenido: sendMessageDto.contenido,
        url_media: sendMessageDto.url_media,
        tipo_media: sendMessageDto.tipo_media,
        id_usuario_envia: userId,
        es_de_ia: false,
        estado: 'ENVIADO',
      },
      include: {
        usuario_envia: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
    });

    // Actualizar preview del último mensaje en el chat
    await this.chatService.updateLastMessage(chatId, sendMessageDto.contenido, false);

    // Actualizar métricas
    await this.updateMetrics(chatId, false);

    await this.prisma.logAction(
      'ENVIAR_WHATSAPP_MENSAJE',
      userId,
      `Mensaje enviado en chat #${chatId}`,
    );

    // Emitir nuevo mensaje via WebSocket
    this.chatGateway.emitNewMessage(chatId, message);

    return message;
  }

  /**
   * Recibir un mensaje entrante (desde webhook)
   */
  async receiveMessage(
    chatId: number,
    whatsappMessageId: string,
    contenido: string,
    tipo: 'TEXTO' | 'IMAGEN' | 'VIDEO' | 'AUDIO' | 'DOCUMENTO' | 'UBICACION' | 'CONTACTO' = 'TEXTO',
    mediaUrl?: string,
    mediaType?: string,
    mediaSize?: number,
  ) {
    const message = await this.prisma.whatsapp_message.create({
      data: {
        id_chat: chatId,
        whatsapp_message_id: whatsappMessageId,
        direccion: 'ENTRANTE',
        tipo: tipo,
        contenido: contenido,
        url_media: mediaUrl,
        tipo_media: mediaType,
        tamano_media: mediaSize,
      },
    });

    // Actualizar preview del último mensaje y contador de no leídos
    await this.chatService.updateLastMessage(chatId, contenido, true);

    // Actualizar métricas
    await this.updateMetrics(chatId, true);

    return message;
  }

  /**
   * Guardar mensaje generado por IA
   */
  async saveIAMessage(
    chatId: number,
    contenido: string,
    idReglaIa?: number,
    confianzaIa?: number,
  ) {
    // Obtener telefono del cliente
    const chat = await this.prisma.whatsapp_chat.findUnique({
      where: { id_chat: chatId },
    });

    if (!chat) {
      throw new NotFoundException(`Chat con ID ${chatId} no encontrado`);
    }

    // Enviar mensaje a WhatsApp
    let whatsappMessageId: string | null = null;
    let estado: 'ENVIADO' | 'FALLIDO' = 'ENVIADO';

    try {
      whatsappMessageId = await this.whatsAppApiService.sendTextMessage(
        chat.telefono_cliente,
        contenido,
      );
    } catch (error) {
      this.logger.error(`Error enviando mensaje IA a WhatsApp: ${error.message}`);
      whatsappMessageId = `msg_ia_failed_${Date.now()}`;
      estado = 'FALLIDO';
    }

    const message = await this.prisma.whatsapp_message.create({
      data: {
        id_chat: chatId,
        whatsapp_message_id: whatsappMessageId || `msg_ia_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        direccion: 'SALIENTE',
        tipo: 'TEXTO',
        contenido: contenido,
        es_de_ia: true,
        id_regla_ia: idReglaIa,
        confianza_ia: confianzaIa,
        estado: estado,
      },
    });

    // Actualizar preview y métricas
    await this.chatService.updateLastMessage(chatId, contenido, false);
    await this.updateMetrics(chatId, false, true);

    // Incrementar contador de mensajes IA en el chat
    await this.prisma.whatsapp_chat.update({
      where: { id_chat: chatId },
      data: { ia_mensajes_count: { increment: 1 } },
    });

    // Emitir nuevo mensaje via WebSocket
    this.chatGateway.emitNewMessage(chatId, message);

    return message;
  }

  /**
   * Obtener mensajes de un chat con paginación
   */
  async findAll(chatId: number, queryDto: QueryMessageDto) {
    const {
      page = 1,
      limit = 50,
      direccion,
      tipo,
      es_de_ia,
      search,
      since,
      sort_order = 'desc',
    } = queryDto;

    // Verificar que el chat existe
    const chat = await this.prisma.whatsapp_chat.findUnique({
      where: { id_chat: chatId },
    });

    if (!chat) {
      throw new NotFoundException(`Chat con ID ${chatId} no encontrado`);
    }

    const where: any = { id_chat: chatId };

    if (direccion) {
      where.direccion = direccion;
    }

    if (tipo) {
      where.tipo = tipo;
    }

    if (es_de_ia !== undefined) {
      where.es_de_ia = es_de_ia;
    }

    if (search) {
      where.contenido = { contains: search, mode: 'insensitive' };
    }

    if (since) {
      where.fecha_creacion = { gt: new Date(since) };
    }

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.prisma.whatsapp_message.findMany({
        where,
        skip,
        take: limit,
        include: {
          usuario_envia: {
            select: {
              id_usuario: true,
              nombres: true,
              apellidos: true,
            },
          },
          regla_ia: {
            select: {
              id_regla: true,
              nombre: true,
            },
          },
        },
        orderBy: {
          fecha_creacion: sort_order,
        },
      }),
      this.prisma.whatsapp_message.count({ where }),
    ]);

    return {
      data: messages,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Obtener un mensaje por ID
   */
  async findOne(id: number) {
    const message = await this.prisma.whatsapp_message.findUnique({
      where: { id_message: id },
      include: {
        chat: {
          select: {
            id_chat: true,
            telefono_cliente: true,
            nombre_cliente: true,
          },
        },
        usuario_envia: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
        regla_ia: true,
      },
    });

    if (!message) {
      throw new NotFoundException(`Mensaje con ID ${id} no encontrado`);
    }

    return message;
  }

  /**
   * Actualizar estado del mensaje (entregado, leído)
   */
  async updateStatus(
    whatsappMessageId: string,
    status: 'ENTREGADO' | 'LEIDO' | 'FALLIDO',
  ) {
    const message = await this.prisma.whatsapp_message.findUnique({
      where: { whatsapp_message_id: whatsappMessageId },
    });

    if (!message) {
      return null; // No lanzar error, puede ser mensaje de otro sistema
    }

    const updateData: any = {
      estado: status,
    };

    if (status === 'ENTREGADO') {
      updateData.fecha_entrega = new Date();
    } else if (status === 'LEIDO') {
      updateData.fecha_lectura = new Date();
    }

    return this.prisma.whatsapp_message.update({
      where: { whatsapp_message_id: whatsappMessageId },
      data: updateData,
    });
  }

  /**
   * Obtener mensajes nuevos desde un timestamp (para polling)
   */
  async getNewMessages(chatId: number, since: Date) {
    return this.prisma.whatsapp_message.findMany({
      where: {
        id_chat: chatId,
        fecha_creacion: { gt: since },
      },
      include: {
        usuario_envia: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
      orderBy: {
        fecha_creacion: 'asc',
      },
    });
  }

  /**
   * Marcar todos los mensajes entrantes de un chat como leídos
   */
  async markAllAsRead(chatId: number) {
    // Verificar que el chat existe
    const chat = await this.prisma.whatsapp_chat.findUnique({
      where: { id_chat: chatId },
    });

    if (!chat) {
      throw new NotFoundException(`Chat con ID ${chatId} no encontrado`);
    }

    // Actualizar todos los mensajes entrantes no leídos
    const result = await this.prisma.whatsapp_message.updateMany({
      where: {
        id_chat: chatId,
        direccion: 'ENTRANTE',
        fecha_lectura: null,
      },
      data: {
        estado: 'LEIDO',
        fecha_lectura: new Date(),
      },
    });

    // Resetear contador de mensajes no leídos en el chat
    await this.prisma.whatsapp_chat.update({
      where: { id_chat: chatId },
      data: { mensajes_no_leidos: 0 },
    });

    return { count: result.count };
  }

  /**
   * Actualizar métricas del chat
   */
  private async updateMetrics(chatId: number, isInbound: boolean, isIA = false) {
    const metrics = await this.prisma.whatsapp_chat_metrics.findUnique({
      where: { id_chat: chatId },
    });

    if (!metrics) {
      return; // Si no hay métricas, no hacer nada
    }

    const updateData: any = {
      total_mensajes: { increment: 1 },
    };

    if (isInbound) {
      updateData.mensajes_cliente = { increment: 1 };
    } else if (isIA) {
      updateData.mensajes_ia = { increment: 1 };
    } else {
      updateData.mensajes_agente = { increment: 1 };
    }

    // Calcular tiempo de primera respuesta si es el primer mensaje saliente
    if (!isInbound && !metrics.tiempo_primera_respuesta) {
      const chat = await this.prisma.whatsapp_chat.findUnique({
        where: { id_chat: chatId },
      });

      if (chat) {
        const firstResponse = Math.floor(
          (new Date().getTime() - chat.fecha_creacion.getTime()) / 1000,
        );
        updateData.tiempo_primera_respuesta = firstResponse;
      }
    }

    await this.prisma.whatsapp_chat_metrics.update({
      where: { id_chat: chatId },
      data: updateData,
    });
  }
}
