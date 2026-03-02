import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MinioService } from '../../minio/minio.service';
import { ComprobanteAnalyzerService } from './comprobante-analyzer.service';
import { QueryValidacionDto, RechazarValidacionDto } from './dto';
import { WhatsAppChatGateway } from '../whatsapp-chat.gateway';

@Injectable()
export class ValidacionComprobanteService {
  private readonly logger = new Logger(ValidacionComprobanteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
    private readonly comprobanteAnalyzer: ComprobanteAnalyzerService,
    @Inject(forwardRef(() => WhatsAppChatGateway))
    private readonly chatGateway: WhatsAppChatGateway,
  ) { }

  /**
   * Enviar una imagen de mensaje a validación
   * @param messageId ID del mensaje con la imagen
   * @param userId ID del usuario que envía a validación
   */
  async enviarAValidacion(messageId: number, userId: number) {
    // 1. Obtener el mensaje
    const message = await this.prisma.whatsapp_message.findUnique({
      where: { id_message: messageId },
      include: { chat: true },
    });

    if (!message) {
      throw new NotFoundException('Mensaje no encontrado');
    }

    if (message.tipo !== 'IMAGEN') {
      throw new BadRequestException('Solo se pueden validar imágenes');
    }

    if (!message.url_media) {
      throw new BadRequestException('El mensaje no tiene imagen adjunta');
    }

    // 2. Verificar que no exista ya una validación para este mensaje
    const existingValidation = await this.prisma.whatsapp_validacion_comprobante.findFirst({
      where: { id_message: messageId },
    });

    if (existingValidation) {
      throw new BadRequestException('Este mensaje ya fue enviado a validación');
    }

    // 3. Descargar imagen de MinIO
    let imageBuffer: Buffer;
    try {
      let url = message.url_media.replace('https://docs.edal.group/clientes-documentos/', '');
      url = url.split('?')[0];
      url = decodeURIComponent(url);
      console.log(url)
      imageBuffer = await this.minioService.getFile(url);
    } catch (error) {
      this.logger.error(`Error al descargar imagen de MinIO: ${error.message}`);
      throw new BadRequestException('No se pudo acceder a la imagen del mensaje');
    }

    const mimeType = message.tipo_media || 'image/jpeg';

    // 4. Analizar con IA
    const extractionResult = await this.comprobanteAnalyzer.extractComprobanteData(
      imageBuffer,
      mimeType,
    );

    // 5. Crear registro de validación
    const validacion = await this.prisma.whatsapp_validacion_comprobante.create({
      data: {
        id_message: messageId,
        id_chat: message.id_chat,
        monto: extractionResult.monto,
        fecha_transaccion: extractionResult.fecha_transaccion
          ? new Date(extractionResult.fecha_transaccion)
          : null,
        numero_referencia: extractionResult.numero_referencia,
        banco: extractionResult.banco,
        cuenta_origen: extractionResult.cuenta_origen,
        cuenta_destino: extractionResult.cuenta_destino,
        nombre_titular: extractionResult.nombre_titular,
        confianza: extractionResult.confianza,
        estado: 'PENDIENTE',
        id_usuario_envia: userId,
      },
      include: {
        message: true,
        chat: {
          select: {
            id_chat: true,
            telefono_cliente: true,
            nombre_cliente: true,
          },
        },
        usuario_envia: {
          select: { id_usuario: true, nombres: true, apellidos: true },
        },
      },
    });

    this.logger.log(`Validación creada: ${validacion.id_validacion} para mensaje ${messageId}`);

    // Emitir evento WebSocket para notificar nueva validación pendiente
    this.chatGateway.server.emit('validacion:nueva', {
      id_validacion: validacion.id_validacion,
      id_chat: validacion.id_chat,
      monto: validacion.monto,
      banco: validacion.banco,
    });

    return validacion;
  }

  /**
   * Enviar múltiples mensajes (imágenes + textos) como una sola validación
   * @param messageIds IDs de los mensajes seleccionados
   * @param userId ID del usuario que envía a validación
   */
  async enviarAValidacionMulti(messageIds: number[], userId: number) {
    // 1. Fetch todos los mensajes
    const messages = await this.prisma.whatsapp_message.findMany({
      where: { id_message: { in: messageIds } },
      include: { chat: true },
      orderBy: { fecha_creacion: 'asc' },
    });

    if (messages.length !== messageIds.length) {
      throw new NotFoundException('Uno o más mensajes no fueron encontrados');
    }

    // 2. Validar que todos pertenezcan al mismo chat
    const chatIds = new Set(messages.map(m => m.id_chat));
    if (chatIds.size > 1) {
      throw new BadRequestException('Todos los mensajes deben pertenecer al mismo chat');
    }
    const idChat = messages[0].id_chat;

    // 3. Validar que al menos uno sea IMAGEN con url_media
    const imageMessages = messages.filter(m => m.tipo === 'IMAGEN' && m.url_media);
    if (imageMessages.length === 0) {
      throw new BadRequestException('Debe seleccionar al menos una imagen');
    }

    // 4. Validar tipos permitidos
    const invalidMessages = messages.filter(m => m.tipo !== 'IMAGEN' && m.tipo !== 'TEXTO');
    if (invalidMessages.length > 0) {
      throw new BadRequestException('Solo se permiten mensajes de tipo IMAGEN o TEXTO');
    }

    // 5. Verificar que ninguno tenga validación existente (legacy id_message o junction table)
    const existingValidations = await this.prisma.whatsapp_validacion_comprobante.findMany({
      where: { id_message: { in: messageIds } },
    });
    if (existingValidations.length > 0) {
      throw new BadRequestException('Uno o más mensajes ya fueron enviados a validación');
    }

    const existingJunction = await this.prisma.whatsapp_validacion_mensaje.findMany({
      where: { id_message: { in: messageIds } },
    });
    if (existingJunction.length > 0) {
      throw new BadRequestException('Uno o más mensajes ya están asociados a una validación existente');
    }

    // 6. Descargar imágenes de MinIO
    const images: Array<{ buffer: Buffer; mimeType: string }> = [];
    for (const msg of imageMessages) {
      try {
        let url = msg.url_media!.replace('https://docs.edal.group:443/clientes-documentos/', '');
        url = url!.replace('https://docs.edal.group/clientes-documentos/', '');
        url = url.split('?')[0];
        url = decodeURIComponent(url);
        const buffer = await this.minioService.getFile(url);
        images.push({ buffer, mimeType: msg.tipo_media || 'image/jpeg' });
      } catch (error) {
        this.logger.error(`Error al descargar imagen ${msg.id_message} de MinIO: ${error.message}`);
        throw new BadRequestException(`No se pudo acceder a la imagen del mensaje ${msg.id_message}`);
      }
    }

    // 7. Recopilar texto de mensajes TEXTO y captions reales
    const placeholders = ['[Imagen]', '[Video]', '[Audio]', '[Documento]'];
    const textParts: string[] = [];
    for (const msg of messages) {
      if (msg.tipo === 'TEXTO' && msg.contenido) {
        textParts.push(msg.contenido);
      } else if (msg.tipo === 'IMAGEN' && msg.contenido && !placeholders.includes(msg.contenido)) {
        textParts.push(msg.contenido);
      }
    }
    const textContext = textParts.length > 0 ? textParts.join('\n') : null;

    // 8. Llamar al analyzer
    let extractionResult;
    if (images.length === 1 && !textContext) {
      extractionResult = await this.comprobanteAnalyzer.extractComprobanteData(
        images[0].buffer,
        images[0].mimeType,
      );
    } else {
      extractionResult = await this.comprobanteAnalyzer.extractComprobanteDataMulti(
        images,
        textContext,
      );
    }

    // 9. Crear validación + junction records en transacción
    const firstImageId = imageMessages[0].id_message;
    const validacion = await this.prisma.$transaction(async (tx) => {
      const val = await tx.whatsapp_validacion_comprobante.create({
        data: {
          id_message: firstImageId,
          id_chat: idChat,
          monto: extractionResult.monto,
          fecha_transaccion: extractionResult.fecha_transaccion
            ? new Date(extractionResult.fecha_transaccion)
            : null,
          numero_referencia: extractionResult.numero_referencia,
          banco: extractionResult.banco,
          cuenta_origen: extractionResult.cuenta_origen,
          cuenta_destino: extractionResult.cuenta_destino,
          nombre_titular: extractionResult.nombre_titular,
          confianza: extractionResult.confianza,
          estado: 'PENDIENTE',
          id_usuario_envia: userId,
        },
      });

      // Crear registros en la tabla de unión
      const junctionData = messages.map((msg, index) => ({
        id_validacion: val.id_validacion,
        id_message: msg.id_message,
        tipo: msg.tipo as any,
        orden: index,
      }));

      await tx.whatsapp_validacion_mensaje.createMany({ data: junctionData });

      const result = await tx.whatsapp_validacion_comprobante.findUnique({
        where: { id_validacion: val.id_validacion },
        include: {
          message: true,
          mensajes_validacion: {
            include: {
              message: {
                select: {
                  id_message: true,
                  url_media: true,
                  contenido: true,
                  tipo: true,
                  fecha_creacion: true,
                },
              },
            },
            orderBy: { orden: 'asc' },
          },
          chat: {
            select: {
              id_chat: true,
              telefono_cliente: true,
              nombre_cliente: true,
            },
          },
          usuario_envia: {
            select: { id_usuario: true, nombres: true, apellidos: true },
          },
        },
      });

      return result!;
    });

    this.logger.log(`Validación multi-mensaje creada: ${validacion.id_validacion} con ${messages.length} mensajes`);

    // Emitir evento WebSocket
    this.chatGateway.server.emit('validacion:nueva', {
      id_validacion: validacion.id_validacion,
      id_chat: validacion.id_chat,
      monto: validacion.monto,
      banco: validacion.banco,
    });

    return validacion;
  }

  /**
   * Listar validaciones con filtros y paginación
   */
  async findAll(query: QueryValidacionDto) {
    const { estado, fecha_desde, fecha_hasta, banco, page = 1, limit = 20 } = query;

    const where: any = {};

    if (estado) {
      where.estado = estado;
    }

    if (fecha_desde || fecha_hasta) {
      where.fecha_creacion = {};
      if (fecha_desde) {
        where.fecha_creacion.gte = new Date(fecha_desde);
      }
      if (fecha_hasta) {
        // Agregar un día para incluir todo el día final
        const endDate = new Date(fecha_hasta);
        endDate.setDate(endDate.getDate() + 1);
        where.fecha_creacion.lt = endDate;
      }
    }

    if (banco) {
      where.banco = { contains: banco, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.whatsapp_validacion_comprobante.findMany({
        where,
        include: {
          message: {
            select: {
              id_message: true,
              url_media: true,
              contenido: true,
              fecha_creacion: true,
            },
          },
          mensajes_validacion: {
            include: {
              message: {
                select: {
                  id_message: true,
                  url_media: true,
                  contenido: true,
                  tipo: true,
                  fecha_creacion: true,
                },
              },
            },
            orderBy: { orden: 'asc' },
          },
          chat: {
            select: {
              id_chat: true,
              telefono_cliente: true,
              nombre_cliente: true,
            },
          },
          usuario_envia: {
            select: { id_usuario: true, nombres: true, apellidos: true },
          },
          usuario_valida: {
            select: { id_usuario: true, nombres: true, apellidos: true },
          },
          usuario_aplica: {
            select: { id_usuario: true, nombres: true, apellidos: true },
          },
        },
        orderBy: { fecha_creacion: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.whatsapp_validacion_comprobante.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Obtener estadísticas de validaciones
   */
  async getStats() {
    const [pendientes, aprobados, aplicados, rechazados, total] = await Promise.all([
      this.prisma.whatsapp_validacion_comprobante.count({ where: { estado: 'PENDIENTE' } }),
      this.prisma.whatsapp_validacion_comprobante.count({ where: { estado: 'APROBADO' } }),
      this.prisma.whatsapp_validacion_comprobante.count({ where: { estado: 'APLICADO' } }),
      this.prisma.whatsapp_validacion_comprobante.count({ where: { estado: 'RECHAZADO' } }),
      this.prisma.whatsapp_validacion_comprobante.count(),
    ]);

    return { pendientes, aprobados, aplicados, rechazados, total };
  }

  /**
   * Obtener una validación por ID
   */
  async findOne(id: number) {
    const validacion = await this.prisma.whatsapp_validacion_comprobante.findUnique({
      where: { id_validacion: id },
      include: {
        message: {
          select: {
            id_message: true,
            url_media: true,
            contenido: true,
            fecha_creacion: true,
          },
        },
        mensajes_validacion: {
          include: {
            message: {
              select: {
                id_message: true,
                url_media: true,
                contenido: true,
                tipo: true,
                fecha_creacion: true,
              },
            },
          },
          orderBy: { orden: 'asc' },
        },
        chat: {
          select: {
            id_chat: true,
            telefono_cliente: true,
            nombre_cliente: true,
          },
        },
        usuario_envia: {
          select: { id_usuario: true, nombres: true, apellidos: true },
        },
        usuario_valida: {
          select: { id_usuario: true, nombres: true, apellidos: true },
        },
        usuario_aplica: {
          select: { id_usuario: true, nombres: true, apellidos: true },
        },
      },
    });

    if (!validacion) {
      throw new NotFoundException('Validación no encontrada');
    }

    return validacion;
  }

  /**
   * Aprobar una validación
   * @param id ID de la validación
   * @param userId ID del usuario que aprueba
   */
  async aprobar(id: number, userId: number) {
    const validacion = await this.prisma.whatsapp_validacion_comprobante.findUnique({
      where: { id_validacion: id },
    });

    if (!validacion) {
      throw new NotFoundException('Validación no encontrada');
    }

    if (validacion.estado !== 'PENDIENTE') {
      throw new BadRequestException('Esta validación ya fue procesada');
    }

    const result = await this.prisma.whatsapp_validacion_comprobante.update({
      where: { id_validacion: id },
      data: {
        estado: 'APROBADO',
        id_usuario_valida: userId,
        fecha_validacion: new Date(),
      },
      include: {
        message: {
          select: {
            id_message: true,
            url_media: true,
            contenido: true,
          },
        },
        chat: {
          select: {
            id_chat: true,
            telefono_cliente: true,
            nombre_cliente: true,
          },
        },
        usuario_envia: {
          select: { id_usuario: true, nombres: true, apellidos: true },
        },
        usuario_valida: {
          select: { id_usuario: true, nombres: true, apellidos: true },
        },
      },
    });

    this.logger.log(`Validación ${id} aprobada por usuario ${userId}`);

    // Emitir evento WebSocket
    this.chatGateway.server.emit('validacion:actualizada', {
      id_validacion: id,
      estado: 'APROBADO',
    });

    return result;
  }

  /**
   * Rechazar una validación
   * @param id ID de la validación
   * @param userId ID del usuario que rechaza
   * @param dto Datos del rechazo (comentario)
   */
  async rechazar(id: number, userId: number, dto: RechazarValidacionDto) {
    const validacion = await this.prisma.whatsapp_validacion_comprobante.findUnique({
      where: { id_validacion: id },
    });

    if (!validacion) {
      throw new NotFoundException('Validación no encontrada');
    }

    if (validacion.estado !== 'PENDIENTE') {
      throw new BadRequestException('Esta validación ya fue procesada');
    }

    const result = await this.prisma.whatsapp_validacion_comprobante.update({
      where: { id_validacion: id },
      data: {
        estado: 'RECHAZADO',
        comentario_rechazo: dto.comentario,
        id_usuario_valida: userId,
        fecha_validacion: new Date(),
      },
      include: {
        message: {
          select: {
            id_message: true,
            url_media: true,
            contenido: true,
          },
        },
        chat: {
          select: {
            id_chat: true,
            telefono_cliente: true,
            nombre_cliente: true,
          },
        },
        usuario_envia: {
          select: { id_usuario: true, nombres: true, apellidos: true },
        },
        usuario_valida: {
          select: { id_usuario: true, nombres: true, apellidos: true },
        },
      },
    });

    this.logger.log(`Validación ${id} rechazada por usuario ${userId}: ${dto.comentario}`);

    // Emitir evento WebSocket
    this.chatGateway.server.emit('validacion:actualizada', {
      id_validacion: id,
      estado: 'RECHAZADO',
    });

    return result;
  }

  /**
   * Aplicar una validación aprobada
   * @param id ID de la validación
   * @param userId ID del usuario que aplica
   */
  async aplicar(id: number, userId: number) {
    const validacion = await this.prisma.whatsapp_validacion_comprobante.findUnique({
      where: { id_validacion: id },
    });

    if (!validacion) {
      throw new NotFoundException('Validación no encontrada');
    }

    if (validacion.estado !== 'APROBADO') {
      throw new BadRequestException('Solo se pueden aplicar validaciones aprobadas');
    }

    const result = await this.prisma.whatsapp_validacion_comprobante.update({
      where: { id_validacion: id },
      data: {
        estado: 'APLICADO',
        id_usuario_aplica: userId,
        fecha_aplicacion: new Date(),
      },
      include: {
        message: {
          select: {
            id_message: true,
            url_media: true,
            contenido: true,
          },
        },
        chat: {
          select: {
            id_chat: true,
            telefono_cliente: true,
            nombre_cliente: true,
          },
        },
        usuario_envia: {
          select: { id_usuario: true, nombres: true, apellidos: true },
        },
        usuario_valida: {
          select: { id_usuario: true, nombres: true, apellidos: true },
        },
        usuario_aplica: {
          select: { id_usuario: true, nombres: true, apellidos: true },
        },
      },
    });

    this.logger.log(`Validación ${id} aplicada por usuario ${userId}`);

    // Emitir evento WebSocket
    this.chatGateway.server.emit('validacion:actualizada', {
      id_validacion: id,
      estado: 'APLICADO',
    });

    return result;
  }
}
