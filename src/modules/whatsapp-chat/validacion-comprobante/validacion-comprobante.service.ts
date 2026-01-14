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
  ) {}

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
      console.log(message.url_media)
      let url = message.url_media.replace('https://docs.edal.group/clientes-documentos/', '');
      url = url.split('?')[0]; // Eliminar parámetros de consulta si existen
      message.url_media = url;
      console.log(message.url_media)
      imageBuffer = await this.minioService.getFile(message.url_media);
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
