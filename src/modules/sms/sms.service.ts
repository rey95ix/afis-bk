import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import twilio from 'twilio';
import { EnviarSmsDto, TipoMensajeSms } from './dto/enviar-sms.dto';
import { QuerySmsDto, EstadoEnvioSms } from './dto/query-sms.dto';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private twilioClient: twilio.Twilio;
  private twilioPhoneNumber: string | undefined;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    // Inicializar cliente de Twilio
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.twilioPhoneNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !this.twilioPhoneNumber) {
      this.logger.warn('⚠️  Credenciales de Twilio no configuradas. El servicio SMS no estará disponible.');
    } else {
      this.twilioClient = twilio(accountSid, authToken);
      this.logger.log('✅ Cliente Twilio inicializado correctamente');
    }
  }

  /**
   * Enviar un SMS genérico
   */
  async enviarSms(enviarSmsDto: EnviarSmsDto, userId?: number) {
    // Validar que Twilio esté configurado
    if (!this.twilioClient) {
      throw new BadRequestException('Servicio SMS no disponible. Configure las credenciales de Twilio.');
    }

    // Validar y normalizar número de teléfono
    const telefonoNormalizado = this.normalizarTelefono(enviarSmsDto.telefono_destino);

    // Validar referencias si se proporcionan
    await this.validarReferencias(enviarSmsDto);

    // Crear registro en BD con estado PENDIENTE
    const smsRecord = await this.prisma.sms_historial.create({
      data: {
        telefono_destino: telefonoNormalizado,
        tipo_mensaje: enviarSmsDto.tipo_mensaje,
        mensaje: enviarSmsDto.mensaje,
        id_cliente: enviarSmsDto.id_cliente,
        id_orden_trabajo: enviarSmsDto.id_orden_trabajo,
        id_ticket: enviarSmsDto.id_ticket,
        referencia_adicional: enviarSmsDto.referencia_adicional,
        estado: 'PENDIENTE',
        enviado_por: userId,
      },
    });

    try {
      // Enviar SMS con Twilio
      const message = await this.twilioClient.messages.create({
        body: enviarSmsDto.mensaje,
        from: this.twilioPhoneNumber,
        to: telefonoNormalizado,
      });

      // Actualizar registro con información de Twilio
      const smsActualizado = await this.prisma.sms_historial.update({
        where: { id_sms: smsRecord.id_sms },
        data: {
          estado: 'ENVIADO',
          twilio_sid: message.sid,
          twilio_status: message.status,
          fecha_envio: new Date(),
          fecha_ultimo_intento: new Date(),
          costo: message.price ? parseFloat(message.price) : null,
          moneda: message.priceUnit || 'USD',
        },
      });

      // Registrar en audit log
      await this.prisma.logAction(
        'ENVIAR_SMS',
        userId,
        `SMS enviado a ${telefonoNormalizado} - Tipo: ${enviarSmsDto.tipo_mensaje}`,
      );

      this.logger.log(`✅ SMS enviado exitosamente. SID: ${message.sid}, Destino: ${telefonoNormalizado}`);

      return {
        success: true,
        id_sms: smsActualizado.id_sms,
        twilio_sid: message.sid,
        estado: smsActualizado.estado,
        mensaje: 'SMS enviado exitosamente',
      };

    } catch (error) {
      this.logger.error(`❌ Error al enviar SMS: ${error.message}`, error.stack);

      // Actualizar registro con error
      await this.prisma.sms_historial.update({
        where: { id_sms: smsRecord.id_sms },
        data: {
          estado: 'FALLIDO',
          twilio_error_code: error.code?.toString(),
          twilio_error_message: error.message,
          fecha_ultimo_intento: new Date(),
        },
      });

      throw new BadRequestException(`Error al enviar SMS: ${error.message}`);
    }
  }

  /**
   * Enviar notificación de factura generada
   */
  async enviarNotificacionFactura(
    telefono: string,
    numeroFactura: string,
    total: number,
    nombreCliente: string,
    idCliente?: number,
    userId?: number,
  ) {
    const mensaje = `Factura ${numeroFactura} generada. Total: $${total.toFixed(2)}. Gracias!`;

    return this.enviarSms({
      telefono_destino: telefono,
      tipo_mensaje: TipoMensajeSms.NOTIFICACION_FACTURA,
      mensaje,
      id_cliente: idCliente,
      referencia_adicional: numeroFactura,
    }, userId);
  }

  /**
   * Enviar notificación de técnico en camino
   */
  async enviarNotificacionTecnicoEnCamino(
    telefono: string,
    nombreTecnico: string,
    numeroOrden: string,
    eta: string,
    idCliente?: number,
    idOrdenTrabajo?: number,
    userId?: number,
  ) {
    const mensaje = `Tecnico ${nombreTecnico} en camino a ${numeroOrden}. Llega en ${eta}.`;

    return this.enviarSms({
      telefono_destino: telefono,
      tipo_mensaje: TipoMensajeSms.TECNICO_EN_CAMINO,
      mensaje,
      id_cliente: idCliente,
      id_orden_trabajo: idOrdenTrabajo,
      referencia_adicional: numeroOrden,
    }, userId);
  }

  /**
   * Enviar notificación de orden de trabajo asignada
   */
  async enviarNotificacionOrdenAsignada(
    telefono: string,
    nombreCliente: string,
    numeroOrden: string,
    nombreTecnico: string,
    idCliente?: number,
    idOrdenTrabajo?: number,
    userId?: number,
  ) {
    const mensaje = `Orden ${numeroOrden} asignada a tecnico ${nombreTecnico}.`;

    return this.enviarSms({
      telefono_destino: telefono,
      tipo_mensaje: TipoMensajeSms.ORDEN_TRABAJO_ASIGNADA,
      mensaje,
      id_cliente: idCliente,
      id_orden_trabajo: idOrdenTrabajo,
      referencia_adicional: numeroOrden,
    }, userId);
  }

  /**
   * Enviar notificación de orden de trabajo agendada
   */
  async enviarNotificacionOrdenAgendada(
    telefono: string,
    nombreCliente: string,
    numeroOrden: string,
    fechaAgendada: string,
    horario: string,
    horaFin: string, // Parámetro mantenido por compatibilidad pero no se usa
    idCliente?: number,
    idOrdenTrabajo?: number,
    userId?: number,
  ) {
    const mensaje = `Orden ${numeroOrden} agendada para ${fechaAgendada} en horario ${horario}.`;

    return this.enviarSms({
      telefono_destino: telefono,
      tipo_mensaje: TipoMensajeSms.ORDEN_TRABAJO_AGENDADA,
      mensaje,
      id_cliente: idCliente,
      id_orden_trabajo: idOrdenTrabajo,
      referencia_adicional: numeroOrden,
    }, userId);
  }

  /**
   * Enviar notificación de orden de trabajo completada
   */
  async enviarNotificacionOrdenCompletada(
    telefono: string,
    nombreCliente: string,
    numeroOrden: string,
    idCliente?: number,
    idOrdenTrabajo?: number,
    userId?: number,
  ) {
    const mensaje = `Orden ${numeroOrden} completada exitosamente.`;

    return this.enviarSms({
      telefono_destino: telefono,
      tipo_mensaje: TipoMensajeSms.ORDEN_TRABAJO_COMPLETADA,
      mensaje,
      id_cliente: idCliente,
      id_orden_trabajo: idOrdenTrabajo,
      referencia_adicional: numeroOrden,
    }, userId);
  }

  /**
   * Enviar notificación de ticket creado
   */
  async enviarNotificacionTicketCreado(
    telefono: string,
    nombreCliente: string,
    numeroTicket: number,
    idCliente?: number,
    idTicket?: number,
    userId?: number,
  ) {
    const mensaje = `Ticket #${numeroTicket} creado. En seguimiento.`;

    return this.enviarSms({
      telefono_destino: telefono,
      tipo_mensaje: TipoMensajeSms.TICKET_CREADO,
      mensaje,
      id_cliente: idCliente,
      id_ticket: idTicket,
      referencia_adicional: `TICKET-${numeroTicket}`,
    }, userId);
  }

  /**
   * Consultar historial de SMS con filtros
   */
  async consultarHistorial(queryDto: QuerySmsDto) {
    const { page = 1, limit = 10, ...filters } = queryDto;
    const skip = (page - 1) * limit;

    // Construir condiciones de filtrado
    const where: any = {};

    if (filters.id_cliente) {
      where.id_cliente = filters.id_cliente;
    }

    if (filters.estado) {
      where.estado = filters.estado;
    }

    if (filters.tipo_mensaje) {
      where.tipo_mensaje = filters.tipo_mensaje;
    }

    if (filters.telefono_destino) {
      where.telefono_destino = filters.telefono_destino;
    }

    if (filters.fecha_desde || filters.fecha_hasta) {
      where.fecha_creacion = {};
      if (filters.fecha_desde) {
        where.fecha_creacion.gte = new Date(filters.fecha_desde);
      }
      if (filters.fecha_hasta) {
        where.fecha_creacion.lte = new Date(filters.fecha_hasta);
      }
    }

    // Consultar con paginación
    const [data, total] = await Promise.all([
      this.prisma.sms_historial.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fecha_creacion: 'desc' },
        include: {
          cliente: {
            select: {
              id_cliente: true,
              titular: true,
              correo_electronico: true,
            },
          },
          orden_trabajo: {
            select: {
              id_orden: true,
              codigo: true,
              estado: true,
            },
          },
          ticket: {
            select: {
              id_ticket: true,
              estado: true,
            },
          },
          usuario: {
            select: {
              id_usuario: true,
              nombres: true,
              apellidos: true,
            },
          },
        },
      }),
      this.prisma.sms_historial.count({ where }),
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
   * Obtener detalles de un SMS específico
   */
  async obtenerDetalleSms(idSms: number) {
    const sms = await this.prisma.sms_historial.findUnique({
      where: { id_sms: idSms },
      include: {
        cliente: true,
        orden_trabajo: true,
        ticket: true,
        usuario: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
    });

    if (!sms) {
      throw new BadRequestException('SMS no encontrado');
    }

    return sms;
  }

  /**
   * Consultar estado de mensaje en Twilio
   */
  async consultarEstadoTwilio(twilioSid: string) {
    if (!this.twilioClient) {
      throw new BadRequestException('Servicio SMS no disponible');
    }

    try {
      const message = await this.twilioClient.messages(twilioSid).fetch();

      // Actualizar registro en BD
      await this.prisma.sms_historial.update({
        where: { twilio_sid: twilioSid },
        data: {
          twilio_status: message.status,
          estado: this.mapearEstadoTwilio(message.status),
          fecha_entrega: message.status === 'delivered' ? new Date() : undefined,
        },
      });

      return {
        sid: message.sid,
        status: message.status,
        to: message.to,
        from: message.from,
        dateCreated: message.dateCreated,
        dateSent: message.dateSent,
        dateUpdated: message.dateUpdated,
        price: message.price,
        priceUnit: message.priceUnit,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
      };
    } catch (error) {
      this.logger.error(`Error al consultar estado en Twilio: ${error.message}`);
      throw new BadRequestException(`Error al consultar estado: ${error.message}`);
    }
  }

  /**
   * Reenviar SMS fallido
   */
  async reenviarSms(idSms: number, userId?: number) {
    const smsOriginal = await this.prisma.sms_historial.findUnique({
      where: { id_sms: idSms },
    });

    if (!smsOriginal) {
      throw new BadRequestException('SMS no encontrado');
    }

    if (smsOriginal.estado === 'ENVIADO' || smsOriginal.estado === 'ENTREGADO') {
      throw new BadRequestException('Este SMS ya fue enviado exitosamente');
    }

    // Actualizar contador de intentos
    await this.prisma.sms_historial.update({
      where: { id_sms: idSms },
      data: {
        intentos_envio: { increment: 1 },
        estado: 'PENDIENTE',
      },
    });

    // Reenviar
    return this.enviarSms({
      telefono_destino: smsOriginal.telefono_destino,
      tipo_mensaje: smsOriginal.tipo_mensaje as TipoMensajeSms,
      mensaje: smsOriginal.mensaje,
      id_cliente: smsOriginal.id_cliente ?? undefined,
      id_orden_trabajo: smsOriginal.id_orden_trabajo ?? undefined,
      id_ticket: smsOriginal.id_ticket ?? undefined,
      referencia_adicional: smsOriginal.referencia_adicional ?? undefined,
    }, userId);
  }

  /**
   * Normalizar número de teléfono a formato +503XXXXXXXX
   */
  private normalizarTelefono(telefono: string): string {
    // Remover espacios y caracteres no numéricos excepto +
    let normalizado = telefono.replace(/[^\d+]/g, '');

    // Si no tiene código de país, asumir El Salvador (+503)
    if (!normalizado.startsWith('+')) {
      if (normalizado.startsWith('503')) {
        normalizado = '+' + normalizado;
      } else {
        normalizado = '+503' + normalizado;
      }
    }

    // Validar formato de El Salvador (+503 + 8 dígitos)
    if (!/^\+503\d{8}$/.test(normalizado)) {
      throw new BadRequestException(
        'Número de teléfono inválido. Debe ser formato +503XXXXXXXX (8 dígitos después de +503)',
      );
    }

    return normalizado;
  }

  /**
   * Validar que las referencias existan en la BD
   */
  private async validarReferencias(dto: EnviarSmsDto) {
    if (dto.id_cliente) {
      const cliente = await this.prisma.cliente.findUnique({
        where: { id_cliente: dto.id_cliente },
      });
      if (!cliente) {
        throw new BadRequestException(`Cliente con ID ${dto.id_cliente} no encontrado`);
      }
    }

    if (dto.id_orden_trabajo) {
      const orden = await this.prisma.orden_trabajo.findUnique({
        where: { id_orden: dto.id_orden_trabajo },
      });
      if (!orden) {
        throw new BadRequestException(`Orden de trabajo con ID ${dto.id_orden_trabajo} no encontrada`);
      }
    }

    if (dto.id_ticket) {
      const ticket = await this.prisma.ticket_soporte.findUnique({
        where: { id_ticket: dto.id_ticket },
      });
      if (!ticket) {
        throw new BadRequestException(`Ticket con ID ${dto.id_ticket} no encontrado`);
      }
    }
  }

  /**
   * Mapear estado de Twilio a nuestro enum
   */
  private mapearEstadoTwilio(twilioStatus: string): EstadoEnvioSms {
    const mapeo = {
      'queued': EstadoEnvioSms.EN_COLA,
      'sending': EstadoEnvioSms.EN_COLA,
      'sent': EstadoEnvioSms.ENVIADO,
      'delivered': EstadoEnvioSms.ENTREGADO,
      'failed': EstadoEnvioSms.FALLIDO,
      'undelivered': EstadoEnvioSms.FALLIDO,
    };

    return mapeo[twilioStatus] || EstadoEnvioSms.PENDIENTE;
  }
}
