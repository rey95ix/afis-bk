import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { MinioService } from '../../minio/minio.service';
import { ComprobanteAnalyzerService } from './comprobante-analyzer.service';
import { QueryValidacionDto, RechazarValidacionDto, AplicarValidacionDto } from './dto';
import { WhatsAppChatGateway } from '../whatsapp-chat.gateway';
import { MovimientosBancariosService } from '../../bancos/movimientos-bancarios/movimientos-bancarios.service';
import { ContratoPagosService } from '../../facturacion/services/contrato-pagos.service';

@Injectable()
export class ValidacionComprobanteService {
  private readonly logger = new Logger(ValidacionComprobanteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
    private readonly comprobanteAnalyzer: ComprobanteAnalyzerService,
    @Inject(forwardRef(() => WhatsAppChatGateway))
    private readonly chatGateway: WhatsAppChatGateway,
    private readonly movimientosBancarios: MovimientosBancariosService,
    private readonly contratoPagosService: ContratoPagosService,
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

    // 4.1 Verificar que sea un comprobante de transferencia
    if (!extractionResult.es_comprobante) {
      throw new BadRequestException('La imagen no es un comprobante de transferencia bancaria');
    }

    // 4.5 Verificar duplicado por numero_referencia + banco_origen
    if (extractionResult.numero_referencia) {
      const duplicateWhere: any = {
        numero_referencia: extractionResult.numero_referencia,
        estado: { notIn: ['RECHAZADO'] },
      };
      if (extractionResult.banco_origen) {
        duplicateWhere.banco_origen = extractionResult.banco_origen;
      }
      const duplicate = await this.prisma.whatsapp_validacion_comprobante.findFirst({
        where: duplicateWhere,
      });
      if (duplicate) {
        throw new BadRequestException(
          `Ya existe una validación (#${duplicate.id_validacion}) con referencia ${extractionResult.numero_referencia}`,
        );
      }
    }

    // 5. Resolver cuenta bancaria destino
    const cuentaMatch = await this.resolverCuentaBancaria(extractionResult.cuenta_destino);
    const enrichedBanco = extractionResult.banco || cuentaMatch?.banco_nombre || null;

    // 6. Crear registro de validación
    const validacion = await this.prisma.whatsapp_validacion_comprobante.create({
      data: {
        id_message: messageId,
        id_chat: message.id_chat,
        monto: extractionResult.monto,
        fecha_transaccion: extractionResult.fecha_transaccion
          ? new Date(extractionResult.fecha_transaccion)
          : null,
        numero_referencia: extractionResult.numero_referencia,
        banco: enrichedBanco,
        cuenta_origen: extractionResult.cuenta_origen,
        cuenta_destino: extractionResult.cuenta_destino,
        nombre_titular: extractionResult.nombre_titular,
        nombre_cliente: extractionResult.nombre_cliente,
        confianza: extractionResult.confianza,
        es_transferencia_365: extractionResult.es_transferencia_365,
        banco_origen: extractionResult.banco_origen,
        id_cuenta_bancaria: cuentaMatch?.id_cuenta_bancaria ?? null,
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
        cuenta_bancaria_destino: {
          select: {
            id_cuenta_bancaria: true,
            numero_cuenta: true,
            alias: true,
            banco: { select: { id_banco: true, nombre: true } },
          },
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

    // 8.1 Verificar que sea un comprobante de transferencia
    if (!extractionResult.es_comprobante) {
      throw new BadRequestException('La imagen no es un comprobante de transferencia bancaria');
    }

    // 8.5 Verificar duplicado por numero_referencia + banco_origen
    if (extractionResult.numero_referencia) {
      const duplicateWhere: any = {
        numero_referencia: extractionResult.numero_referencia,
        estado: { notIn: ['RECHAZADO'] },
      };
      if (extractionResult.banco_origen) {
        duplicateWhere.banco_origen = extractionResult.banco_origen;
      }
      const duplicate = await this.prisma.whatsapp_validacion_comprobante.findFirst({
        where: duplicateWhere,
      });
      if (duplicate) {
        throw new BadRequestException(
          `Ya existe una validación (#${duplicate.id_validacion}) con referencia ${extractionResult.numero_referencia}`,
        );
      }
    }

    // 9. Resolver cuenta bancaria destino
    const cuentaMatch = await this.resolverCuentaBancaria(extractionResult.cuenta_destino);
    const enrichedBanco = extractionResult.banco || cuentaMatch?.banco_nombre || null;

    // 10. Crear validación + junction records en transacción
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
          banco: enrichedBanco,
          cuenta_origen: extractionResult.cuenta_origen,
          cuenta_destino: extractionResult.cuenta_destino,
          nombre_titular: extractionResult.nombre_titular,
          nombre_cliente: extractionResult.nombre_cliente,
          confianza: extractionResult.confianza,
          es_transferencia_365: extractionResult.es_transferencia_365,
          banco_origen: extractionResult.banco_origen,
          id_cuenta_bancaria: cuentaMatch?.id_cuenta_bancaria ?? null,
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
          cuenta_bancaria_destino: {
            select: {
              id_cuenta_bancaria: true,
              numero_cuenta: true,
              alias: true,
              banco: { select: { id_banco: true, nombre: true } },
            },
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
   * Enviar comprobantes directamente (sin WhatsApp) subiendo imágenes
   * @param files Archivos de imagen subidos
   * @param userId ID del usuario que envía
   */
  async enviarDirecto(files: Express.Multer.File[], userId: number) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Debe subir al menos una imagen');
    }

    // 1. Validar que todos sean imágenes
    for (const file of files) {
      if (!file.mimetype.startsWith('image/')) {
        throw new BadRequestException(`El archivo "${file.originalname}" no es una imagen`);
      }
    }

    // 2. Preparar buffers para el analyzer
    const images = files.map(f => ({ buffer: f.buffer, mimeType: f.mimetype }));

    // 3. Llamar al analyzer
    let extractionResult;
    if (images.length === 1) {
      extractionResult = await this.comprobanteAnalyzer.extractComprobanteData(
        images[0].buffer,
        images[0].mimeType,
      );
    } else {
      extractionResult = await this.comprobanteAnalyzer.extractComprobanteDataMulti(
        images,
        null,
      );
    }

    // 4. Verificar que sea un comprobante
    if (!extractionResult.es_comprobante) {
      throw new BadRequestException('La imagen no es un comprobante de transferencia bancaria');
    }

    // 5. Verificar duplicado por numero_referencia + banco_origen
    if (extractionResult.numero_referencia) {
      const duplicateWhere: any = {
        numero_referencia: extractionResult.numero_referencia,
        estado: { notIn: ['RECHAZADO'] },
      };
      if (extractionResult.banco_origen) {
        duplicateWhere.banco_origen = extractionResult.banco_origen;
      }
      const duplicate = await this.prisma.whatsapp_validacion_comprobante.findFirst({
        where: duplicateWhere,
      });
      if (duplicate) {
        throw new BadRequestException(
          `Ya existe una validación (#${duplicate.id_validacion}) con referencia ${extractionResult.numero_referencia}`,
        );
      }
    }

    // 6. Resolver cuenta bancaria destino
    const cuentaMatch = await this.resolverCuentaBancaria(extractionResult.cuenta_destino);
    const enrichedBanco = extractionResult.banco || cuentaMatch?.banco_nombre || null;

    // 7. Subir imágenes a MinIO
    const urls: string[] = [];
    const objectNames: string[] = [];
    try {
      for (const file of files) {
        const timestamp = Date.now();
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        const objectName = `validaciones-directas/${timestamp}-${safeName}`;
        const result = await this.minioService.uploadFile(file, objectName);
        urls.push(result.url);
        objectNames.push(objectName);
      }
    } catch (error) {
      // Limpiar archivos ya subidos si falla alguno
      for (const name of objectNames) {
        try { await this.minioService.deleteFile(name); } catch {}
      }
      this.logger.error(`Error al subir imágenes a MinIO: ${error.message}`);
      throw new BadRequestException('Error al subir las imágenes');
    }

    // 8. Parsear fecha segura
    const parsedFecha = extractionResult.fecha_transaccion
      ? new Date(extractionResult.fecha_transaccion)
      : null;
    const fechaTransaccion = parsedFecha && !isNaN(parsedFecha.getTime()) ? parsedFecha : null;

    // 9. Crear registro sin id_message/id_chat
    const validacion = await this.prisma.whatsapp_validacion_comprobante.create({
      data: {
        id_message: null,
        id_chat: null,
        imagenes_directas: JSON.stringify(urls),
        monto: extractionResult.monto,
        fecha_transaccion: fechaTransaccion,
        numero_referencia: extractionResult.numero_referencia,
        banco: enrichedBanco,
        cuenta_origen: extractionResult.cuenta_origen,
        cuenta_destino: extractionResult.cuenta_destino,
        nombre_titular: extractionResult.nombre_titular,
        nombre_cliente: extractionResult.nombre_cliente,
        confianza: extractionResult.confianza,
        es_transferencia_365: extractionResult.es_transferencia_365,
        banco_origen: extractionResult.banco_origen,
        id_cuenta_bancaria: cuentaMatch?.id_cuenta_bancaria ?? null,
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
        cuenta_bancaria_destino: {
          select: {
            id_cuenta_bancaria: true,
            numero_cuenta: true,
            alias: true,
            banco: { select: { id_banco: true, nombre: true } },
          },
        },
      },
    });

    this.logger.log(`Validación directa creada: ${validacion.id_validacion} con ${files.length} imagen(es)`);

    // Emitir evento WebSocket
    this.chatGateway.server.emit('validacion:nueva', {
      id_validacion: validacion.id_validacion,
      id_chat: null,
      monto: validacion.monto,
      banco: validacion.banco,
    });

    return validacion;
  }

  /**
   * Resolver cuenta bancaria destino a partir del número extraído por IA
   * Estrategia en 3 niveles: exacto → sufijo → parcial (últimos 4 dígitos)
   */
  private async resolverCuentaBancaria(
    cuentaDestino: string | null,
  ): Promise<{ id_cuenta_bancaria: number; banco_nombre: string | null } | null> {
    if (!cuentaDestino) return null;

    // Limpiar asteriscos y espacios
    const cleaned = cuentaDestino.replace(/[\s-]/g, '');
    const digitsOnly = cleaned.replace(/\*/g, '');

    if (!digitsOnly || digitsOnly.length === 0) return null;

    // Nivel 1: Match exacto
    const exactMatch = await this.prisma.cuenta_bancaria.findUnique({
      where: { numero_cuenta: cleaned },
      include: { banco: { select: { nombre: true } } },
    });
    if (exactMatch) {
      this.logger.log(`Cuenta bancaria encontrada (match exacto): ${exactMatch.id_cuenta_bancaria} - ${exactMatch.alias || exactMatch.numero_cuenta}`);
      return {
        id_cuenta_bancaria: exactMatch.id_cuenta_bancaria,
        banco_nombre: exactMatch.banco?.nombre || null,
      };
    }

    // Nivel 2: Match por sufijo (6+ dígitos sin asteriscos)
    if (digitsOnly.length >= 6 && !cleaned.includes('*')) {
      const suffixMatches = await this.prisma.cuenta_bancaria.findMany({
        where: {
          numero_cuenta: { endsWith: digitsOnly },
          estado: 'ACTIVO',
        },
        include: { banco: { select: { nombre: true } } },
      });
      if (suffixMatches.length === 1) {
        this.logger.log(`Cuenta bancaria encontrada (match sufijo): ${suffixMatches[0].id_cuenta_bancaria} - ${suffixMatches[0].alias || suffixMatches[0].numero_cuenta}`);
        return {
          id_cuenta_bancaria: suffixMatches[0].id_cuenta_bancaria,
          banco_nombre: suffixMatches[0].banco?.nombre || null,
        };
      }
      if (suffixMatches.length > 1) {
        this.logger.warn(`Match ambiguo por sufijo "${digitsOnly}": ${suffixMatches.length} cuentas encontradas`);
        return null;
      }
    }

    // Nivel 3: Match parcial (últimos 4 dígitos)
    const last4 = digitsOnly.slice(-4);
    if (last4.length === 4) {
      const partialMatches = await this.prisma.cuenta_bancaria.findMany({
        where: {
          numero_cuenta: { endsWith: last4 },
          estado: 'ACTIVO',
        },
        include: { banco: { select: { nombre: true } } },
      });
      if (partialMatches.length === 1) {
        this.logger.log(`Cuenta bancaria encontrada (match parcial últimos 4): ${partialMatches[0].id_cuenta_bancaria} - ${partialMatches[0].alias || partialMatches[0].numero_cuenta}`);
        return {
          id_cuenta_bancaria: partialMatches[0].id_cuenta_bancaria,
          banco_nombre: partialMatches[0].banco?.nombre || null,
        };
      }
      if (partialMatches.length > 1) {
        this.logger.warn(`Match ambiguo por últimos 4 dígitos "${last4}": ${partialMatches.length} cuentas encontradas`);
      }
    }

    this.logger.warn(`No se encontró cuenta bancaria para cuenta destino: ${cuentaDestino}`);
    return null;
  }

  /**
   * Actualizar el banco destino de una validación pendiente
   * @param id ID de la validación
   * @param banco Nombre del banco destino
   */
  async actualizarBanco(id: number, banco: string) {
    const validacion = await this.prisma.whatsapp_validacion_comprobante.findUnique({
      where: { id_validacion: id },
    });

    if (!validacion) {
      throw new NotFoundException('Validación no encontrada');
    }

    if (validacion.estado !== 'PENDIENTE' && validacion.estado !== 'APROBADO') {
      throw new BadRequestException('Solo se puede actualizar el banco de validaciones pendientes o aprobadas');
    }

    return this.prisma.whatsapp_validacion_comprobante.update({
      where: { id_validacion: id },
      data: { banco },
    });
  }

  /**
   * Obtener lista de bancos activos para filtros
   */
  async getBancos() {
    return this.prisma.cat_banco.findMany({
      where: { activo: true },
      select: { id_banco: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
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
          cuenta_bancaria_destino: {
            select: {
              id_cuenta_bancaria: true,
              numero_cuenta: true,
              alias: true,
              banco: { select: { id_banco: true, nombre: true } },
            },
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
        cuenta_bancaria_destino: {
          select: {
            id_cuenta_bancaria: true,
            numero_cuenta: true,
            alias: true,
            banco: { select: { id_banco: true, nombre: true } },
          },
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
        cuenta_bancaria_destino: {
          select: {
            id_cuenta_bancaria: true,
            numero_cuenta: true,
            alias: true,
            banco: { select: { id_banco: true, nombre: true } },
          },
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
        cuenta_bancaria_destino: {
          select: {
            id_cuenta_bancaria: true,
            numero_cuenta: true,
            alias: true,
            banco: { select: { id_banco: true, nombre: true } },
          },
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
   * @param dto Datos opcionales (idContrato para registrar pago)
   */
  async aplicar(id: number, userId: number, dto?: AplicarValidacionDto) {
    const validacion = await this.prisma.whatsapp_validacion_comprobante.findUnique({
      where: { id_validacion: id },
    });

    if (!validacion) {
      throw new NotFoundException('Validación no encontrada');
    }

    if (validacion.estado !== 'APROBADO') {
      throw new BadRequestException('Solo se pueden aplicar validaciones aprobadas');
    }

    // Validar que tenga cuenta bancaria destino y monto
    if (!validacion.id_cuenta_bancaria) {
      throw new BadRequestException('No se puede aplicar: la validación no tiene cuenta bancaria destino asignada');
    }

    if (!validacion.monto) {
      throw new BadRequestException('No se puede aplicar: la validación no tiene monto');
    }

    const monto = Number(validacion.monto);

    // 1. Marcar como APLICADO primero para evitar doble-aplicación
    const result = await this.prisma.whatsapp_validacion_comprobante.update({
      where: { id_validacion: id },
      data: {
        estado: 'APLICADO',
        id_usuario_aplica: userId,
        fecha_aplicacion: new Date(),
        ...(dto?.idContrato ? { id_contrato: dto.idContrato } : {}),
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
        cuenta_bancaria_destino: {
          select: {
            id_cuenta_bancaria: true,
            numero_cuenta: true,
            alias: true,
            banco: { select: { id_banco: true, nombre: true } },
          },
        },
      },
    });

    // 2. Operaciones financieras — compensar si fallan
    let distribucionPago: any = null;
    try {
      // Registrar pago en contrato si se proporcionó idContrato
      if (dto?.idContrato) {
        try {
          distribucionPago = await this.contratoPagosService.registrarPagoContrato(
            dto.idContrato,
            {
              monto,
              metodoPago: 'TRANSFERENCIA' as any,
              referencia: validacion.numero_referencia || undefined,
              idCuentaBancaria: validacion.id_cuenta_bancaria,
              observaciones: `Pago desde comprobante WhatsApp #${validacion.id_validacion}`,
            },
            userId,
          );
          this.logger.log(`Pago registrado para contrato ${dto.idContrato} desde validación ${id} - Monto: ${monto}`);
        } catch (err) {
          throw new BadRequestException(
            `No se pudo registrar el pago en el contrato: ${err.message}`,
          );
        }
      }

      // Registrar movimiento bancario de ENTRADA
      const movimiento = await this.movimientosBancarios.crearMovimiento(
        {
          id_cuenta_bancaria: validacion.id_cuenta_bancaria,
          tipo_movimiento: 'ENTRADA',
          metodo: 'TRANSFERENCIA',
          monto,
          referencia_bancaria: validacion.numero_referencia || undefined,
          documento_origen_id: validacion.id_validacion,
          modulo_origen: 'COBRANZA',
          descripcion: `Comprobante WhatsApp #${validacion.numero_referencia} - ${validacion.banco_origen || 'N/A'} → cuenta destino`,
          fecha_movimiento: validacion.fecha_transaccion
            ? validacion.fecha_transaccion.toISOString().split('T')[0]
            : undefined,
          transferencia: {
            banco_contraparte: validacion.banco_origen || undefined,
            cuenta_contraparte: validacion.cuenta_origen || undefined,
            codigo_autorizacion: validacion.numero_referencia || undefined,
            fecha_transferencia: validacion.fecha_transaccion
              ? validacion.fecha_transaccion.toISOString().split('T')[0]
              : new Date().toISOString().split('T')[0],
          },
        } as any,
        userId,
      );

      this.logger.log(`Validación ${id} aplicada por usuario ${userId} - Movimiento bancario #${movimiento!.id_movimiento} creado${dto?.idContrato ? ` - Pago en contrato ${dto.idContrato}` : ''}`);
    } catch (err) {
      // Compensar: revertir estado a APROBADO
      await this.prisma.whatsapp_validacion_comprobante.update({
        where: { id_validacion: id },
        data: {
          estado: 'APROBADO',
          id_usuario_aplica: null,
          fecha_aplicacion: null,
          id_contrato: null,
        },
      });
      this.logger.error(`Validación ${id}: operación financiera falló, estado revertido a APROBADO - ${err.message}`);
      throw err;
    }

    // Emitir evento WebSocket
    this.chatGateway.server.emit('validacion:actualizada', {
      id_validacion: id,
      estado: 'APLICADO',
    });

    return { ...result, distribucionPago };
  }

  /**
   * Generar reporte Excel de validaciones con filtros
   */
  async generateExcel(query: QueryValidacionDto): Promise<Buffer> {
    const { estado, fecha_desde, fecha_hasta, banco } = query;

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
        const endDate = new Date(fecha_hasta);
        endDate.setDate(endDate.getDate() + 1);
        where.fecha_creacion.lt = endDate;
      }
    }

    if (banco) {
      where.banco = { contains: banco, mode: 'insensitive' };
    }

    const data = await this.prisma.whatsapp_validacion_comprobante.findMany({
      where,
      include: {
        chat: {
          select: { nombre_cliente: true },
        },
        usuario_envia: {
          select: { nombres: true, apellidos: true },
        },
        usuario_aplica: {
          select: { nombres: true, apellidos: true },
        },
      },
      orderBy: { fecha_creacion: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AFIS - Sistema ERP';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Validaciones');

    // Title
    sheet.mergeCells('A1:M1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'REPORTE DE VALIDACIÓN DE COMPROBANTES';
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 30;

    // Subtitle
    sheet.mergeCells('A2:M2');
    const subtitleCell = sheet.getCell('A2');
    subtitleCell.value = `Generado: ${new Date().toLocaleString('es-SV')}`;
    subtitleCell.font = { size: 10, italic: true, color: { argb: 'FF666666' } };
    subtitleCell.alignment = { horizontal: 'center' };

    // Column definitions
    const columns = [
      { header: 'Nombre del Cliente', key: 'nombre_cliente', width: 25 },
      { header: 'Nombre del Titular', key: 'nombre_titular', width: 25 },
      { header: 'No Referencia', key: 'numero_referencia', width: 20 },
      { header: 'Banco', key: 'banco', width: 20 },
      { header: 'Monto', key: 'monto', width: 15 },
      { header: 'Hora', key: 'hora', width: 10 },
      { header: 'Fecha', key: 'fecha', width: 15 },
      { header: 'Año', key: 'anio', width: 8 },
      { header: 'Reportado por', key: 'reportado_por', width: 25 },
      { header: 'Comentario', key: 'comentario', width: 30 },
      { header: 'Estado', key: 'estado', width: 15 },
      { header: 'Gestor que Aplicó', key: 'gestor_aplico', width: 25 },
      { header: 'Fecha de Aplicación', key: 'fecha_aplicacion', width: 20 },
    ];

    sheet.columns = columns.map((col) => ({ key: col.key, width: col.width }));

    // Header row (row 4, after title and subtitle + blank row)
    const headerRow = sheet.getRow(4);
    columns.forEach((col, i) => {
      headerRow.getCell(i + 1).value = col.header;
    });
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2E7D32' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
    headerRow.height = 25;

    // Data rows
    let rowIndex = 5;
    for (const record of data) {
      const fechaTx = record.fecha_transaccion ? new Date(record.fecha_transaccion) : null;
      const fechaApp = record.fecha_aplicacion ? new Date(record.fecha_aplicacion) : null;

      const row = sheet.getRow(rowIndex);
      row.getCell(1).value = record.nombre_cliente || '';
      row.getCell(2).value = record.nombre_titular || '';
      row.getCell(3).value = record.numero_referencia || '';
      row.getCell(4).value = record.banco || '';
      row.getCell(5).value = record.monto ? Number(record.monto) : 0;
      row.getCell(5).numFmt = '$#,##0.00';
      row.getCell(6).value = fechaTx
        ? fechaTx.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit', hour12: false })
        : '';
      row.getCell(7).value = fechaTx
        ? fechaTx.toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '';
      row.getCell(8).value = fechaTx ? fechaTx.getFullYear() : '';
      row.getCell(9).value = record.usuario_envia
        ? `${record.usuario_envia.nombres} ${record.usuario_envia.apellidos}`.trim()
        : '';
      row.getCell(10).value = record.comentario_rechazo || '';
      row.getCell(11).value = record.estado || '';
      row.getCell(12).value = record.usuario_aplica
        ? `${record.usuario_aplica.nombres} ${record.usuario_aplica.apellidos}`.trim()
        : '';
      row.getCell(13).value = fechaApp
        ? fechaApp.toLocaleString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '';

      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });

      rowIndex++;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
