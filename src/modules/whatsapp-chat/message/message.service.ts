import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SendMessageDto, QueryMessageDto, QueryFailedTemplatesDto, ResendTemplateDto } from './dto';
import { direccion_mensaje, estado_mensaje_whatsapp } from '@prisma/client';
import { ChatService } from '../chat/chat.service';
import { WhatsAppApiService } from '../whatsapp-api/whatsapp-api.service';
import { MinioService } from '../../minio/minio.service';
import { WhatsAppChatGateway } from '../whatsapp-chat.gateway';
import { AssignmentService } from '../assignment/assignment.service';
import { TemplateService } from '../template/template.service';
import { SendTemplateDto } from '../template/dto/send-template.dto';

/**
 * Información de error de WhatsApp para mensajes fallidos
 */
export interface WhatsAppErrorInfo {
  code: number;
  title: string;
  message: string;
}

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatService: ChatService,
    private readonly whatsAppApiService: WhatsAppApiService,
    private readonly minioService: MinioService,
    private readonly chatGateway: WhatsAppChatGateway,
    private readonly assignmentService: AssignmentService,
    private readonly templateService: TemplateService,
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
      include: {
        usuario_asignado: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
    });
    const usuarioActivo = await this.prisma.usuarios.findUnique({
      where: { id_usuario: userId, estado: 'ACTIVO' },
    });
    if (!chat) {
      throw new NotFoundException(`Chat con ID ${chatId} no encontrado`);
    }

    if (chat.estado === 'CERRADO') {
      throw new BadRequestException('No se puede enviar mensajes a un chat cerrado');
    }

    // Validar ventana de 24 horas para mensajes que no son plantilla
    const tipoMensaje = sendMessageDto.tipo || 'TEXTO';
    if (tipoMensaje !== 'PLANTILLA') {
      const windowStatus = await this.chatService.canSendFreeformMessage(chatId);
      if (!windowStatus.canSend) {
        throw new ForbiddenException({
          message: 'La ventana de 24 horas ha expirado. Debe usar una plantilla aprobada para iniciar la conversación.',
          code: 'WHATSAPP_WINDOW_CLOSED',
          requiresTemplate: true,
          expiresAt: windowStatus.expiresAt,
        });
      }
    }

    // Reasignación automática: Si el usuario que responde no es el asignado, reasignar
    if (chat.id_usuario_asignado && chat.id_usuario_asignado !== userId) {
      this.logger.log(
        `Chat #${chatId}: Reasignando de usuario ${chat.usuario_asignado?.nombres} ${chat.usuario_asignado?.apellidos} a ${usuarioActivo?.nombres} ${usuarioActivo?.apellidos} por respuesta`,
      );

      // Reasignar automáticamente
      await this.assignmentService.assignChat(
        chatId,
        { id_usuario: userId, razon: 'Reasignación automática por respuesta' },
        userId,
      );

      // Emitir evento de reasignación
      this.chatGateway.emitChatUpdated({
        ...chat,
        id_usuario_asignado: userId,
        _reassigned: true,
        _previous_user: chat.usuario_asignado,
      });
    } else if (!chat.id_usuario_asignado) {
      // Si el chat no tiene asignado, asignar al que responde
      await this.assignmentService.assignChat(
        chatId,
        { id_usuario: userId, razon: 'Asignación automática por primera respuesta' },
        userId,
      );
    }

    // Enviar mensaje a WhatsApp segun el tipo
    let whatsappMessageId: string | null = null;

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
   * Enviar un mensaje de plantilla en un chat (para reabrir ventana de 24h)
   */
  async sendTemplateMessage(
    chatId: number,
    sendTemplateDto: SendTemplateDto,
    userId: number,
  ) {
    // Verificar que el chat existe
    const chat = await this.prisma.whatsapp_chat.findUnique({
      where: { id_chat: chatId },
      include: {
        usuario_asignado: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
    });

    if (!chat) {
      throw new NotFoundException(`Chat con ID ${chatId} no encontrado`);
    }

    if (chat.estado === 'CERRADO') {
      throw new BadRequestException('No se puede enviar mensajes a un chat cerrado');
    }

    // Obtener la plantilla
    const template = await this.templateService.findOne(sendTemplateDto.id_template);

    // Reasignación automática si es necesario
    if (chat.id_usuario_asignado && chat.id_usuario_asignado !== userId) {
      this.logger.log(
        `Chat #${chatId}: Reasignando de usuario ${chat.id_usuario_asignado} a ${userId} por envío de plantilla`,
      );

      await this.assignmentService.assignChat(
        chatId,
        { id_usuario: userId, razon: 'Reasignación automática por envío de plantilla' },
        userId,
      );

      this.chatGateway.emitChatUpdated({
        ...chat,
        id_usuario_asignado: userId,
        _reassigned: true,
        _previous_user: chat.usuario_asignado,
      });
    } else if (!chat.id_usuario_asignado) {
      await this.assignmentService.assignChat(
        chatId,
        { id_usuario: userId, razon: 'Asignación automática por envío de plantilla' },
        userId,
      );
    }

    // Enviar plantilla a WhatsApp
    const result = await this.templateService.sendTemplate(
      chat.telefono_cliente,
      sendTemplateDto,
    );

    if (!result.success) {
      // Crear mensaje fallido
      await this.prisma.whatsapp_message.create({
        data: {
          id_chat: chatId,
          whatsapp_message_id: `msg_template_failed_${Date.now()}`,
          direccion: 'SALIENTE',
          tipo: 'PLANTILLA',
          contenido: `[Plantilla: ${template.nombre}]`,
          id_usuario_envia: userId,
          es_de_ia: false,
          estado: 'FALLIDO',
          metadata: {
            template_id: template.id_template,
            template_nombre: template.nombre,
            parametros: sendTemplateDto.parametros,
            error: result.error,
          },
        },
      });

      throw new BadRequestException(`Error al enviar plantilla: ${result.error}`);
    }

    // Generar preview del contenido de la plantilla
    const preview = this.templateService.previewTemplate(
      template,
      sendTemplateDto.parametros || {},
    );
    const contenidoPreview = preview.body || `[Plantilla: ${template.nombre}]`;

    // Crear el mensaje de plantilla
    const message = await this.prisma.whatsapp_message.create({
      data: {
        id_chat: chatId,
        whatsapp_message_id: result.messageId || `msg_template_${Date.now()}`,
        direccion: 'SALIENTE',
        tipo: 'PLANTILLA',
        contenido: contenidoPreview,
        id_usuario_envia: userId,
        es_de_ia: false,
        estado: 'ENVIADO',
        metadata: {
          template_id: template.id_template,
          template_nombre: template.nombre,
          parametros: sendTemplateDto.parametros,
          componentes: template.componentes,
        },
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
    await this.chatService.updateLastMessage(chatId, contenidoPreview, false);

    // Actualizar métricas
    await this.updateMetrics(chatId, false);

    await this.prisma.logAction(
      'ENVIAR_WHATSAPP_PLANTILLA',
      userId,
      `Plantilla "${template.nombre}" enviada en chat #${chatId}`,
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
          validaciones_comprobante: {
            select: {
              id_validacion: true,
              estado: true,
              monto: true,
              confianza: true,
              fecha_creacion: true,
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
   * Actualizar estado del mensaje (entregado, leído, fallido)
   */
  async updateStatus(
    whatsappMessageId: string,
    status: 'ENTREGADO' | 'LEIDO' | 'FALLIDO',
    errorInfo?: WhatsAppErrorInfo,
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
    } else if (status === 'FALLIDO' && errorInfo) {
      // Guardar información del error en metadata
      const currentMetadata = (message.metadata as Record<string, any>) || {};
      updateData.metadata = {
        ...currentMetadata,
        error_code: errorInfo.code,
        error_title: errorInfo.title,
        error_message: errorInfo.message,
      };
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

  // ==================== TEMPLATES FALLIDOS ====================

  /**
   * Obtener templates fallidos con paginación y filtros
   */
  async getFailedTemplates(queryDto: QueryFailedTemplatesDto) {
    const {
      page = 1,
      limit = 20,
      error_code,
      search,
      fecha_desde,
      fecha_hasta,
    } = queryDto;

    const where: any = {
      tipo: 'PLANTILLA',
      estado: 'FALLIDO',
      direccion: 'SALIENTE',
    };

    // Filtrar por código de error en metadata
    if (error_code !== undefined) {
      where.metadata = {
        path: ['error_code'],
        equals: error_code,
      };
    }

    // Filtrar por fechas
    if (fecha_desde || fecha_hasta) {
      where.fecha_creacion = {};
      if (fecha_desde) {
        where.fecha_creacion.gte = new Date(fecha_desde);
      }
      if (fecha_hasta) {
        where.fecha_creacion.lte = new Date(fecha_hasta);
      }
    }

    const skip = (page - 1) * limit;

    // Si hay búsqueda, necesitamos filtrar después de obtener los resultados
    // porque el search es por teléfono/nombre del chat relacionado
    let messages: any[];
    let total: number;

    if (search) {
      // Obtener con filtro de chat
      const [data, count] = await Promise.all([
        this.prisma.whatsapp_message.findMany({
          where: {
            ...where,
            chat: {
              OR: [
                { telefono_cliente: { contains: search, mode: 'insensitive' } },
                { nombre_cliente: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
          skip,
          take: limit,
          include: {
            chat: {
              select: {
                id_chat: true,
                telefono_cliente: true,
                nombre_cliente: true,
                estado: true,
              },
            },
            usuario_envia: {
              select: {
                id_usuario: true,
                nombres: true,
                apellidos: true,
              },
            },
          },
          orderBy: {
            fecha_creacion: 'desc',
          },
        }),
        this.prisma.whatsapp_message.count({
          where: {
            ...where,
            chat: {
              OR: [
                { telefono_cliente: { contains: search, mode: 'insensitive' } },
                { nombre_cliente: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        }),
      ]);
      messages = data;
      total = count;
    } else {
      const [data, count] = await Promise.all([
        this.prisma.whatsapp_message.findMany({
          where,
          skip,
          take: limit,
          include: {
            chat: {
              select: {
                id_chat: true,
                telefono_cliente: true,
                nombre_cliente: true,
                estado: true,
              },
            },
            usuario_envia: {
              select: {
                id_usuario: true,
                nombres: true,
                apellidos: true,
              },
            },
          },
          orderBy: {
            fecha_creacion: 'desc',
          },
        }),
        this.prisma.whatsapp_message.count({ where }),
      ]);
      messages = data;
      total = count;
    }

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
   * Obtener estadísticas de templates fallidos
   */
  async getFailedTemplatesStats() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Total de templates fallidos
    const total = await this.prisma.whatsapp_message.count({
      where: {
        tipo: 'PLANTILLA',
        estado: 'FALLIDO',
        direccion: 'SALIENTE',
      },
    });

    // Fallidos últimos 7 días
    const ultimos7Dias = await this.prisma.whatsapp_message.count({
      where: {
        tipo: 'PLANTILLA',
        estado: 'FALLIDO',
        direccion: 'SALIENTE',
        fecha_creacion: {
          gte: sevenDaysAgo,
        },
      },
    });

    // Reenviados exitosamente (que tienen metadata.reenviado = true)
    const reenviados = await this.prisma.whatsapp_message.count({
      where: {
        tipo: 'PLANTILLA',
        estado: 'FALLIDO',
        direccion: 'SALIENTE',
        metadata: {
          path: ['reenviado'],
          equals: true,
        },
      },
    });

    // Pendientes (no reenviados)
    const pendientes = total - reenviados;

    // Agrupación por código de error usando raw query
    const errorGroups = await this.prisma.$queryRaw<Array<{ error_code: number; count: bigint }>>`
      SELECT
        (metadata->>'error_code')::int as error_code,
        COUNT(*) as count
      FROM whatsapp_message
      WHERE tipo = 'PLANTILLA'
        AND estado = 'FALLIDO'
        AND direccion = 'SALIENTE'
        AND metadata->>'error_code' IS NOT NULL
      GROUP BY (metadata->>'error_code')::int
      ORDER BY count DESC
      LIMIT 10
    `;

    return {
      total,
      ultimos_7_dias: ultimos7Dias,
      reenviados,
      pendientes,
      por_error: errorGroups.map(g => ({
        error_code: g.error_code,
        count: Number(g.count),
      })),
    };
  }

  /**
   * Reenviar un template fallido
   */
  async resendFailedTemplate(
    messageId: number,
    dto: ResendTemplateDto,
    userId: number,
  ) {
    // Obtener el mensaje original
    const message = await this.prisma.whatsapp_message.findUnique({
      where: { id_message: messageId },
      include: {
        chat: true,
      },
    });

    if (!message) {
      throw new NotFoundException(`Mensaje con ID ${messageId} no encontrado`);
    }

    // Validar que sea un template fallido
    if (message.tipo !== 'PLANTILLA') {
      throw new BadRequestException('El mensaje no es una plantilla');
    }

    if (message.estado !== 'FALLIDO') {
      throw new BadRequestException('El mensaje no está en estado fallido');
    }

    if (message.direccion !== 'SALIENTE') {
      throw new BadRequestException('El mensaje no es saliente');
    }

    // Verificar que no haya sido reenviado
    const metadata = (message.metadata as Record<string, any>) || {};
    if (metadata.reenviado === true) {
      throw new BadRequestException('Este template ya fue reenviado');
    }

    // Extraer información del template original
    const templateId = metadata.template_id;
    if (!templateId) {
      throw new BadRequestException('No se encontró el ID del template en la metadata');
    }

    // Usar los parámetros proporcionados o los originales
    const parametros = dto.parametros || metadata.parametros || {};

    // Reenviar el template usando el método existente
    const newMessage = await this.sendTemplateMessage(
      message.id_chat,
      {
        id_template: templateId,
        parametros,
      },
      userId,
    );

    // Actualizar metadata del mensaje original para marcar como reenviado
    await this.prisma.whatsapp_message.update({
      where: { id_message: messageId },
      data: {
        metadata: {
          ...metadata,
          reenviado: true,
          reenviado_at: new Date().toISOString(),
          reenviado_por: userId,
          nuevo_mensaje_id: newMessage.id_message,
        },
      },
    });

    await this.prisma.logAction(
      'REENVIAR_WHATSAPP_TEMPLATE',
      userId,
      `Template reenviado: mensaje original #${messageId}, nuevo mensaje #${newMessage.id_message}`,
    );

    return {
      success: true,
      original_message_id: messageId,
      new_message: newMessage,
    };
  }
}
