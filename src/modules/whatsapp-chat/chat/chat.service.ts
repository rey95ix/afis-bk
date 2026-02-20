import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateChatDto, UpdateChatDto, QueryChatDto, ClaimChatResponseDto } from './dto';
import { WhatsAppChatGateway } from '../whatsapp-chat.gateway';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => WhatsAppChatGateway))
    private readonly chatGateway: WhatsAppChatGateway,
  ) {}

  /**
   * Crear un nuevo chat o retornar existente por teléfono
   */
  async create(createChatDto: CreateChatDto, userId: number) {
    // Verificar si ya existe un chat abierto con este teléfono
    const existingChat = await this.prisma.whatsapp_chat.findFirst({
      where: {
        telefono_cliente: createChatDto.telefono_cliente,
        estado: { in: ['ABIERTO', 'PENDIENTE', 'IA_MANEJANDO'] },
      },
    });

    if (existingChat) {
      throw new ConflictException(
        `Ya existe un chat activo con el número ${createChatDto.telefono_cliente}`,
      );
    }

    // Si se proporciona id_cliente, verificar que existe
    if (createChatDto.id_cliente) {
      const cliente = await this.prisma.cliente.findUnique({
        where: { id_cliente: createChatDto.id_cliente },
      });

      if (!cliente) {
        throw new NotFoundException(
          `Cliente con ID ${createChatDto.id_cliente} no encontrado`,
        );
      }
    }

    // Si se proporciona usuario asignado, verificar que existe
    if (createChatDto.id_usuario_asignado) {
      const usuario = await this.prisma.usuarios.findUnique({
        where: { id_usuario: createChatDto.id_usuario_asignado },
      });

      if (!usuario) {
        throw new NotFoundException(
          `Usuario con ID ${createChatDto.id_usuario_asignado} no encontrado`,
        );
      }
    }

    // Generar ID único para WhatsApp
    const whatsappChatId = `chat_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const chat = await this.prisma.whatsapp_chat.create({
      data: {
        whatsapp_chat_id: whatsappChatId,
        telefono_cliente: createChatDto.telefono_cliente,
        nombre_cliente: createChatDto.nombre_cliente,
        id_cliente: createChatDto.id_cliente,
        id_usuario_asignado: createChatDto.id_usuario_asignado,
        ia_habilitada: createChatDto.ia_habilitada ?? true,
        tags: createChatDto.tags || [],
        estado: createChatDto.id_usuario_asignado ? 'ABIERTO' : 'PENDIENTE',
      },
      include: {
        cliente: {
          select: {
            id_cliente: true,
            titular: true,
            correo_electronico: true,
            telefono1: true,
          },
        },
        usuario_asignado: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
    });

    // Crear métricas iniciales
    await this.prisma.whatsapp_chat_metrics.create({
      data: {
        id_chat: chat.id_chat,
      },
    });

    // Si hay usuario asignado, crear registro de asignación
    if (createChatDto.id_usuario_asignado) {
      await this.prisma.whatsapp_chat_assignment.create({
        data: {
          id_chat: chat.id_chat,
          id_usuario: createChatDto.id_usuario_asignado,
          id_asignado_por: userId,
          razon: 'Asignación inicial al crear chat',
        },
      });
    }

    await this.prisma.logAction(
      'CREAR_WHATSAPP_CHAT',
      userId,
      `Chat WhatsApp #${chat.id_chat} creado con ${createChatDto.telefono_cliente}`,
    );

    // Emitir nuevo chat y estadísticas via WebSocket
    this.chatGateway.emitChatUpdated(chat);
    const stats = await this.getStats();
    this.chatGateway.emitStatsUpdated(stats);

    return chat;
  }

  /**
   * Obtener lista de chats con filtros y paginación
   */
  async findAll(queryDto: QueryChatDto) {
    const {
      page = 1,
      limit = 20,
      search,
      estado,
      id_usuario_asignado,
      sin_asignar,
      incluir_sin_asignar,
      id_cliente,
      tags,
      id_etiquetas,
      fecha_desde,
      fecha_hasta,
      sort_by = 'ultimo_mensaje_at',
      sort_order = 'desc',
      incluir_archivados = false,
    } = queryDto;

    const where: any = {};
    const andConditions: any[] = [];

    // Excluir archivados por defecto
    if (!incluir_archivados) {
      where.archivado = false;
    }

    // Filtro por estado
    if (estado) {
      where.estado = estado;
    }

    // Filtro por usuario asignado
    if (sin_asignar) {
      where.id_usuario_asignado = null;
    } else if (id_usuario_asignado && incluir_sin_asignar) {
      // Mostrar chats del usuario O sin asignar
      andConditions.push({
        OR: [
          { id_usuario_asignado: id_usuario_asignado },
          { id_usuario_asignado: null },
        ],
      });
    } else if (id_usuario_asignado) {
      where.id_usuario_asignado = id_usuario_asignado;
    }

    // Filtro por cliente
    if (id_cliente) {
      where.id_cliente = id_cliente;
    }

    // Búsqueda por nombre o teléfono
    if (search) {
      andConditions.push({
        OR: [
          { telefono_cliente: { contains: search, mode: 'insensitive' } },
          { nombre_cliente: { contains: search, mode: 'insensitive' } },
          {
            cliente: {
              titular: { contains: search, mode: 'insensitive' },
            },
          },
        ],
      });
    }

    // Filtro por etiquetas (many-to-many)
    if (id_etiquetas && id_etiquetas.length > 0) {
      andConditions.push({
        etiquetas: {
          some: {
            id_etiqueta: { in: id_etiquetas },
          },
        },
      });
    }

    // Agregar condiciones AND si existen
    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    // Filtro por tags
    if (tags && tags.length > 0) {
      where.tags = { hasSome: tags };
    }

    // Filtro por fechas
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

    const [chats, total] = await Promise.all([
      this.prisma.whatsapp_chat.findMany({
        where,
        skip,
        take: limit,
        include: {
          cliente: {
            select: {
              id_cliente: true,
              titular: true,
              telefono1: true,
            },
          },
          usuario_asignado: {
            select: {
              id_usuario: true,
              nombres: true,
              apellidos: true,
            },
          },
          _count: {
            select: {
              mensajes: true,
            },
          },
          etiquetas: {
            include: {
              etiqueta: {
                select: {
                  id_etiqueta: true,
                  nombre: true,
                  color: true,
                },
              },
            },
          },
        },
        orderBy: {
          [sort_by]: sort_order,
        },
      }),
      this.prisma.whatsapp_chat.count({ where }),
    ]);

    return {
      data: chats,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Obtener un chat por ID con mensajes recientes
   */
  async findOne(id: number, includeMessages = true, messagesLimit = 50) {
    const chat = await this.prisma.whatsapp_chat.findUnique({
      where: { id_chat: id },
      include: {
        cliente: {
          select: {
            id_cliente: true,
            titular: true,
            correo_electronico: true,
            telefono1: true,
            telefono2: true,
            dui: true,
          },
        },
        usuario_asignado: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
            foto: true,
          },
        },
        metricas: true,
        mensajes: includeMessages
          ? {
              take: messagesLimit,
              orderBy: { fecha_creacion: 'desc' },
              include: {
                usuario_envia: {
                  select: {
                    id_usuario: true,
                    nombres: true,
                    apellidos: true,
                  },
                },
              },
            }
          : false,
        asignaciones: {
          where: { activo: true },
          include: {
            usuario: {
              select: {
                id_usuario: true,
                nombres: true,
                apellidos: true,
              },
            },
          },
        },
      },
    });

    if (!chat) {
      throw new NotFoundException(`Chat con ID ${id} no encontrado`);
    }

    // Revertir el orden de los mensajes para que estén cronológicamente
    if (chat.mensajes) {
      chat.mensajes = chat.mensajes.reverse();
    }

    return chat;
  }

  /**
   * Actualizar un chat
   */
  async update(id: number, updateChatDto: UpdateChatDto, userId: number) {
    const chat = await this.prisma.whatsapp_chat.findUnique({
      where: { id_chat: id },
    });

    if (!chat) {
      throw new NotFoundException(`Chat con ID ${id} no encontrado`);
    }

    // Si se está vinculando a un cliente, verificar que existe
    if (updateChatDto.id_cliente) {
      const cliente = await this.prisma.cliente.findUnique({
        where: { id_cliente: updateChatDto.id_cliente },
      });

      if (!cliente) {
        throw new NotFoundException(
          `Cliente con ID ${updateChatDto.id_cliente} no encontrado`,
        );
      }
    }

    const updateData: any = { ...updateChatDto };

    // Si se cierra el chat, registrar fecha de cierre
    if (updateChatDto.estado === 'CERRADO' && chat.estado !== 'CERRADO') {
      updateData.fecha_cierre = new Date();

      // Actualizar métricas con duración
      const duracion = Math.floor(
        (new Date().getTime() - chat.fecha_creacion.getTime()) / 1000,
      );
      await this.prisma.whatsapp_chat_metrics.update({
        where: { id_chat: id },
        data: { duracion },
      });
    }

    const updatedChat = await this.prisma.whatsapp_chat.update({
      where: { id_chat: id },
      data: updateData,
      include: {
        cliente: {
          select: {
            id_cliente: true,
            titular: true,
            correo_electronico: true,
            telefono1: true,
          },
        },
        usuario_asignado: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
    });

    await this.prisma.logAction(
      'ACTUALIZAR_WHATSAPP_CHAT',
      userId,
      `Chat WhatsApp #${id} actualizado`,
    );

    // Emitir actualización via WebSocket
    this.chatGateway.emitChatUpdated(updatedChat);

    return updatedChat;
  }

  /**
   * Reclamar un chat sin asignar para el usuario actual.
   * Usa bloqueo pesimista para evitar race conditions cuando
   * múltiples agentes intentan reclamar el mismo chat.
   */
  async claimChat(chatId: number, userId: number): Promise<ClaimChatResponseDto> {
    // Ejecutar en transacción con aislamiento serializable
    const result = await this.prisma.$transaction(
      async (tx) => {
        // Bloqueo pesimista con FOR UPDATE NOWAIT
        // Si otro proceso tiene el bloqueo, falla inmediatamente
        const chatRows = await tx.$queryRaw<
          Array<{
            id_chat: number;
            id_usuario_asignado: number | null;
            estado: string;
          }>
        >`
          SELECT id_chat, id_usuario_asignado, estado
          FROM whatsapp_chat
          WHERE id_chat = ${chatId}
          FOR UPDATE NOWAIT
        `.catch(() => {
          // Si no puede obtener el bloqueo, otro proceso lo está modificando
          throw new ConflictException({
            errorCode: 'ALREADY_ASSIGNED',
            message: 'El chat está siendo reclamado por otro agente',
          });
        });

        if (!chatRows || chatRows.length === 0) {
          throw new NotFoundException({
            errorCode: 'CHAT_NOT_FOUND',
            message: `Chat con ID ${chatId} no encontrado`,
          });
        }

        const chat = chatRows[0];

        // Si el chat está cerrado, no se puede reclamar
        if (chat.estado === 'CERRADO') {
          throw new ConflictException({
            errorCode: 'CHAT_CLOSED',
            message: 'No se puede reclamar un chat cerrado',
          });
        }

        // Obtener información del usuario actual
        const currentUser = await tx.usuarios.findUnique({
          where: { id_usuario: userId },
          select: { id_usuario: true, nombres: true, apellidos: true },
        });

        if (!currentUser) {
          throw new NotFoundException('Usuario no encontrado');
        }

        const currentUserName = `${currentUser.nombres} ${currentUser.apellidos}`;

        // Si ya está asignado al mismo usuario, retornar éxito (idempotente)
        if (chat.id_usuario_asignado === userId) {
          return {
            success: true,
            chatId,
            assignedToUserId: userId,
            assignedToUserName: currentUserName,
            wasAlreadyAssigned: true,
            chat: undefined as any,
          };
        }

        // Si está asignado a otro usuario, rechazar
        if (chat.id_usuario_asignado !== null) {
          const assignedUser = await tx.usuarios.findUnique({
            where: { id_usuario: chat.id_usuario_asignado },
            select: { nombres: true, apellidos: true },
          });

          throw new ConflictException({
            errorCode: 'ALREADY_ASSIGNED',
            message: `Chat ya asignado a ${assignedUser?.nombres} ${assignedUser?.apellidos}`,
            currentAssigneeId: chat.id_usuario_asignado,
            currentAssigneeName: assignedUser
              ? `${assignedUser.nombres} ${assignedUser.apellidos}`
              : 'Usuario desconocido',
          });
        }

        // Asignar el chat al usuario
        await tx.whatsapp_chat.update({
          where: { id_chat: chatId },
          data: {
            id_usuario_asignado: userId,
            estado: 'ABIERTO', // Cambiar de PENDIENTE/IA_MANEJANDO a ABIERTO
            ia_habilitada: false, // Desactivar IA al reclamar
          },
        });

        // Desactivar asignaciones previas (si existieran)
        await tx.whatsapp_chat_assignment.updateMany({
          where: { id_chat: chatId, activo: true },
          data: {
            activo: false,
            fecha_desasignacion: new Date(),
            razon: 'Reasignado por claim',
          },
        });

        // Crear nuevo registro de asignación
        await tx.whatsapp_chat_assignment.create({
          data: {
            id_chat: chatId,
            id_usuario: userId,
            id_asignado_por: userId, // Auto-asignación
            razon: 'Auto-asignación por apertura de chat',
            activo: true,
          },
        });

        return {
          success: true,
          chatId,
          assignedToUserId: userId,
          assignedToUserName: currentUserName,
          wasAlreadyAssigned: false,
          chat: undefined as any,
        };
      },
      {
        isolationLevel: 'Serializable',
        timeout: 5000, // 5 segundos máximo
      },
    );

    // Fuera de la transacción: emitir eventos WebSocket
    if (!result.wasAlreadyAssigned) {
      // Obtener chat actualizado con toda la información para el evento
      const updatedChat = await this.prisma.whatsapp_chat.findUnique({
        where: { id_chat: chatId },
        include: {
          cliente: {
            select: {
              id_cliente: true,
              titular: true,
              telefono1: true,
            },
          },
          usuario_asignado: {
            select: {
              id_usuario: true,
              nombres: true,
              apellidos: true,
            },
          },
          etiquetas: {
            include: {
              etiqueta: {
                select: {
                  id_etiqueta: true,
                  nombre: true,
                  color: true,
                },
              },
            },
          },
        },
      });

      // Log de la acción
      await this.prisma.logAction(
        'CLAIM_WHATSAPP_CHAT',
        userId,
        `Chat WhatsApp #${chatId} reclamado por auto-asignación`,
      );

      // Emitir actualización a todos los agentes conectados
      this.chatGateway.emitChatUpdated(updatedChat);

      // Emitir estadísticas actualizadas
      const stats = await this.getStats();
      this.chatGateway.emitStatsUpdated(stats);

      result.chat = updatedChat;
    }

    return result;
  }

  /**
   * Cerrar un chat
   */
  async close(id: number, userId: number, razon?: string) {
    const chat = await this.findOne(id, false);

    if (chat.estado === 'CERRADO') {
      throw new BadRequestException('El chat ya está cerrado');
    }

    // Calcular duración
    const duracion = Math.floor(
      (new Date().getTime() - chat.fecha_creacion.getTime()) / 1000,
    );

    const [updatedChat] = await this.prisma.$transaction([
      this.prisma.whatsapp_chat.update({
        where: { id_chat: id },
        data: {
          estado: 'CERRADO',
          fecha_cierre: new Date(),
        },
      }),
      this.prisma.whatsapp_chat_metrics.update({
        where: { id_chat: id },
        data: { duracion },
      }),
      // Desactivar asignaciones activas
      this.prisma.whatsapp_chat_assignment.updateMany({
        where: { id_chat: id, activo: true },
        data: {
          activo: false,
          fecha_desasignacion: new Date(),
          razon: razon || 'Chat cerrado',
        },
      }),
    ]);

    await this.prisma.logAction(
      'CERRAR_WHATSAPP_CHAT',
      userId,
      `Chat WhatsApp #${id} cerrado${razon ? `: ${razon}` : ''}`,
    );

    // Emitir actualización y estadísticas via WebSocket
    this.chatGateway.emitChatUpdated({ ...updatedChat, estado: 'CERRADO' });
    const stats = await this.getStats();
    this.chatGateway.emitStatsUpdated(stats);

    return updatedChat;
  }

  /**
   * Buscar o crear chat por teléfono (para webhook)
   * Retorna el chat y un indicador si fue recién creado o reabierto
   */
  async findOrCreateByPhone(
    telefono: string,
    whatsappChatId: string,
    nombre?: string,
  ): Promise<{ chat: any; isNew: boolean; wasReopened: boolean }> {
    // Buscar chat existente activo
    let chat = await this.prisma.whatsapp_chat.findFirst({
      where: {
        telefono_cliente: telefono,
        estado: { in: ['ABIERTO', 'PENDIENTE', 'IA_MANEJANDO'] },
      },
    });

    if (chat) {
      return { chat, isNew: false, wasReopened: false };
    }

    // Buscar chat CERRADO de los últimos 30 días para reabrir
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const closedChat = await this.prisma.whatsapp_chat.findFirst({
      where: {
        telefono_cliente: telefono,
        estado: 'CERRADO',
        fecha_cierre: { gte: thirtyDaysAgo },
      },
      orderBy: { fecha_cierre: 'desc' },
    });

    // Si existe un chat cerrado reciente, reabrirlo
    if (closedChat) {
      const reopenedChat = await this.reopenChat(closedChat.id_chat);
      return { chat: reopenedChat, isNew: false, wasReopened: true };
    }

    // Buscar cliente por teléfono
    const cliente = await this.prisma.cliente.findFirst({
      where: {
        OR: [
          { telefono1: { contains: telefono.replace('+', '') } },
          { telefono2: { contains: telefono.replace('+', '') } },
        ],
      },
    });

    // Crear nuevo chat
    chat = await this.prisma.whatsapp_chat.create({
      data: {
        whatsapp_chat_id: whatsappChatId,
        telefono_cliente: telefono,
        nombre_cliente: nombre,
        id_cliente: cliente?.id_cliente,
        estado: 'IA_MANEJANDO', // Iniciar con IA
        ia_habilitada: true,
        ultima_interaccion_cliente: new Date(), // Iniciar ventana de 24h
      },
    });

    // Crear métricas
    await this.prisma.whatsapp_chat_metrics.create({
      data: { id_chat: chat.id_chat },
    });

    // Emitir nuevo chat via WebSocket
    this.chatGateway.emitChatUpdated(chat);

    return { chat, isNew: true, wasReopened: false };
  }

  /**
   * Reabrir un chat CERRADO por mensaje entrante del cliente.
   * Cambia el estado a IA_MANEJANDO para respuesta automática.
   */
  async reopenChat(chatId: number): Promise<any> {
    const chat = await this.prisma.whatsapp_chat.findUnique({
      where: { id_chat: chatId },
    });

    if (!chat) {
      throw new NotFoundException(`Chat con ID ${chatId} no encontrado`);
    }

    if (chat.estado !== 'CERRADO') {
      // Si no está cerrado, no hacer nada
      return chat;
    }

    // Reabrir el chat
    const reopenedChat = await this.prisma.whatsapp_chat.update({
      where: { id_chat: chatId },
      data: {
        estado: 'IA_MANEJANDO', // Para respuesta automática de IA
        ia_habilitada: true,
        fecha_cierre: null, // Limpiar fecha de cierre
        ultima_interaccion_cliente: new Date(), // Reiniciar ventana de 24h
        archivado: false, // Desarchivar si estaba archivado
        fecha_archivado: null,
      },
      include: {
        cliente: {
          select: {
            id_cliente: true,
            titular: true,
            telefono1: true,
          },
        },
        usuario_asignado: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
        etiquetas: {
          include: {
            etiqueta: {
              select: {
                id_etiqueta: true,
                nombre: true,
                color: true,
              },
            },
          },
        },
      },
    });

    // Registrar en log (sin userId porque es automático por mensaje entrante)
    await this.prisma.log.create({
      data: {
        accion: 'REABRIR_WHATSAPP_CHAT',
        descripcion: `Chat WhatsApp #${chatId} reabierto automáticamente por mensaje del cliente`,
      },
    });

    // Emitir actualización del chat via WebSocket
    this.chatGateway.emitChatUpdated(reopenedChat);

    // Emitir estadísticas actualizadas
    const stats = await this.getStats();
    this.chatGateway.emitStatsUpdated(stats);

    return reopenedChat;
  }

  /**
   * Actualizar último mensaje del chat
   */
  async updateLastMessage(chatId: number, preview: string, isInbound: boolean) {
    const updateData: any = {
      ultimo_mensaje_at: new Date(),
      preview_ultimo_mensaje: preview.substring(0, 200),
    };

    if (isInbound) {
      updateData.mensajes_no_leidos = { increment: 1 };
      // Actualizar última interacción del cliente para validación de ventana 24h
      updateData.ultima_interaccion_cliente = new Date();
    }

    return this.prisma.whatsapp_chat.update({
      where: { id_chat: chatId },
      data: updateData,
    });
  }

  /**
   * Verificar si se puede enviar mensaje de texto libre (ventana de 24h)
   * @returns { canSend: boolean, hoursRemaining: number | null, expiresAt: Date | null }
   */
  async canSendFreeformMessage(chatId: number): Promise<{
    canSend: boolean;
    hoursRemaining: number | null;
    expiresAt: Date | null;
    requiresTemplate: boolean;
  }> {
    const chat = await this.prisma.whatsapp_chat.findUnique({
      where: { id_chat: chatId },
      select: { ultima_interaccion_cliente: true },
    });

    if (!chat) {
      throw new NotFoundException(`Chat con ID ${chatId} no encontrado`);
    }

    // Si nunca hubo interacción del cliente, requiere plantilla
    // NO usar fecha_creacion como fallback - solo cuenta cuando el CLIENTE envía mensaje
    if (!chat.ultima_interaccion_cliente) {
      return {
        canSend: false,
        hoursRemaining: null,
        expiresAt: null,
        requiresTemplate: true,
      };
    }

    const now = new Date();
    const windowEnd = new Date(chat.ultima_interaccion_cliente.getTime() + 24 * 60 * 60 * 1000);
    const hoursRemaining = (windowEnd.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursRemaining <= 0) {
      return {
        canSend: false,
        hoursRemaining: 0,
        expiresAt: windowEnd,
        requiresTemplate: true,
      };
    }

    return {
      canSend: true,
      hoursRemaining: Math.round(hoursRemaining * 10) / 10, // Redondear a 1 decimal
      expiresAt: windowEnd,
      requiresTemplate: false,
    };
  }

  /**
   * Registrar un número como inválido (sin cuenta de WhatsApp)
   */
  async registerInvalidNumber(
    telefono: string,
    codigoError: number,
    mensajeError: string,
    idChatOrigen?: number,
  ): Promise<void> {
    await this.prisma.whatsapp_numero_invalido.upsert({
      where: { telefono },
      update: {
        codigo_error: codigoError,
        mensaje_error: mensajeError,
        id_chat_origen: idChatOrigen,
        activo: true,
      },
      create: {
        telefono,
        codigo_error: codigoError,
        mensaje_error: mensajeError,
        id_chat_origen: idChatOrigen,
      },
    });

    await this.prisma.logAction(
      'REGISTRAR_NUMERO_INVALIDO',
      undefined,
      `Numero ${telefono} registrado como invalido (error ${codigoError})`,
    );
  }

  /**
   * Verificar si un número está marcado como inválido
   */
  async isNumberInvalid(telefono: string): Promise<{
    isInvalid: boolean;
    reason?: string;
    errorCode?: number;
    detectedAt?: Date;
  }> {
    const record = await this.prisma.whatsapp_numero_invalido.findUnique({
      where: { telefono },
    });

    if (record && record.activo) {
      return {
        isInvalid: true,
        reason: record.mensaje_error || 'El numero no tiene cuenta de WhatsApp activa',
        errorCode: record.codigo_error,
        detectedAt: record.fecha_deteccion,
      };
    }

    return { isInvalid: false };
  }

  /**
   * Archivar un chat automáticamente por el sistema (número inválido)
   */
  async archiveChatBySystem(chatId: number): Promise<void> {
    const chat = await this.prisma.whatsapp_chat.findUnique({
      where: { id_chat: chatId },
    });

    if (!chat || chat.archivado) return;

    const updatedChat = await this.prisma.whatsapp_chat.update({
      where: { id_chat: chatId },
      data: {
        archivado: true,
        fecha_archivado: new Date(),
      },
      include: {
        cliente: { select: { id_cliente: true, titular: true, telefono1: true } },
        usuario_asignado: { select: { id_usuario: true, nombres: true, apellidos: true } },
      },
    });

    await this.prisma.logAction(
      'ARCHIVAR_WHATSAPP_CHAT_SISTEMA',
      undefined,
      `Chat WhatsApp #${chatId} archivado automaticamente por numero invalido`,
    );

    this.chatGateway.emitChatUpdated(updatedChat);
    const stats = await this.getStats();
    this.chatGateway.emitStatsUpdated(stats);
  }

  /**
   * Obtener un chat por ID con datos mínimos (sin mensajes ni métricas)
   */
  async findOneLight(id: number) {
    return this.prisma.whatsapp_chat.findUnique({
      where: { id_chat: id },
      select: {
        id_chat: true,
        telefono_cliente: true,
        nombre_cliente: true,
        estado: true,
        archivado: true,
      },
    });
  }

  /**
   * Verificar si existe un chat activo con un número de teléfono
   * Retorna información del chat y estado de la ventana 24h si existe
   */
  async checkPhoneNumber(telefono: string): Promise<{
    exists: boolean;
    isInvalidNumber?: boolean;
    invalidNumberInfo?: {
      reason: string;
      errorCode: number;
      detectedAt: Date;
    };
    chat?: {
      id_chat: number;
      estado: string;
      nombre_cliente: string | null;
      windowStatus: {
        canSend: boolean;
        hoursRemaining: number | null;
        requiresTemplate: boolean;
      };
    };
  }> {
    // Verificar si el número está marcado como inválido
    const invalidCheck = await this.isNumberInvalid(telefono);
    if (invalidCheck.isInvalid) {
      return {
        exists: false,
        isInvalidNumber: true,
        invalidNumberInfo: {
          reason: invalidCheck.reason!,
          errorCode: invalidCheck.errorCode!,
          detectedAt: invalidCheck.detectedAt!,
        },
      };
    }

    // Buscar chat activo (no CERRADO) con este teléfono
    const chat = await this.prisma.whatsapp_chat.findFirst({
      where: {
        telefono_cliente: telefono,
        estado: { not: 'CERRADO' },
      },
      select: {
        id_chat: true,
        estado: true,
        nombre_cliente: true,
      },
    });

    if (!chat) {
      return { exists: false };
    }

    // Obtener estado de la ventana 24h
    const windowStatus = await this.canSendFreeformMessage(chat.id_chat);

    return {
      exists: true,
      chat: {
        id_chat: chat.id_chat,
        estado: chat.estado,
        nombre_cliente: chat.nombre_cliente,
        windowStatus: {
          canSend: windowStatus.canSend,
          hoursRemaining: windowStatus.hoursRemaining,
          requiresTemplate: windowStatus.requiresTemplate,
        },
      },
    };
  }

  /**
   * Marcar mensajes como leídos
   */
  async markAsRead(chatId: number) {
    return this.prisma.whatsapp_chat.update({
      where: { id_chat: chatId },
      data: { mensajes_no_leidos: 0 },
    });
  }

  /**
   * Marcar chat como no leído (pone contador en 1)
   */
  async markAsUnread(chatId: number) {
    const chat = await this.prisma.whatsapp_chat.findUnique({
      where: { id_chat: chatId },
    });

    if (!chat) {
      throw new NotFoundException(`Chat con ID ${chatId} no encontrado`);
    }

    const updatedChat = await this.prisma.whatsapp_chat.update({
      where: { id_chat: chatId },
      data: { mensajes_no_leidos: 1 },
      include: {
        cliente: { select: { id_cliente: true, titular: true, telefono1: true } },
        usuario_asignado: { select: { id_usuario: true, nombres: true, apellidos: true } },
        etiquetas: { include: { etiqueta: { select: { id_etiqueta: true, nombre: true, color: true } } } },
      },
    });

    // Emitir actualización via WebSocket
    this.chatGateway.emitChatUpdated(updatedChat);

    return updatedChat;
  }

  /**
   * Archivar un chat
   */
  async archive(id: number, userId: number) {
    const chat = await this.prisma.whatsapp_chat.findUnique({
      where: { id_chat: id },
    });

    if (!chat) {
      throw new NotFoundException(`Chat con ID ${id} no encontrado`);
    }

    if (chat.archivado) {
      throw new BadRequestException('El chat ya está archivado');
    }

    const updatedChat = await this.prisma.whatsapp_chat.update({
      where: { id_chat: id },
      data: {
        archivado: true,
        fecha_archivado: new Date(),
      },
      include: {
        cliente: {
          select: {
            id_cliente: true,
            titular: true,
            telefono1: true,
          },
        },
        usuario_asignado: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
    });

    await this.prisma.logAction(
      'ARCHIVAR_WHATSAPP_CHAT',
      userId,
      `Chat WhatsApp #${id} archivado`,
    );

    // Emitir actualización via WebSocket
    this.chatGateway.emitChatUpdated(updatedChat);
    const stats = await this.getStats();
    this.chatGateway.emitStatsUpdated(stats);

    return updatedChat;
  }

  /**
   * Desarchivar un chat
   */
  async unarchive(id: number, userId: number) {
    const chat = await this.prisma.whatsapp_chat.findUnique({
      where: { id_chat: id },
    });

    if (!chat) {
      throw new NotFoundException(`Chat con ID ${id} no encontrado`);
    }

    if (!chat.archivado) {
      throw new BadRequestException('El chat no está archivado');
    }

    const updatedChat = await this.prisma.whatsapp_chat.update({
      where: { id_chat: id },
      data: {
        archivado: false,
        fecha_archivado: null,
      },
      include: {
        cliente: {
          select: {
            id_cliente: true,
            titular: true,
            telefono1: true,
          },
        },
        usuario_asignado: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
    });

    await this.prisma.logAction(
      'DESARCHIVAR_WHATSAPP_CHAT',
      userId,
      `Chat WhatsApp #${id} desarchivado`,
    );

    // Emitir actualización via WebSocket
    this.chatGateway.emitChatUpdated(updatedChat);
    const stats = await this.getStats();
    this.chatGateway.emitStatsUpdated(stats);

    return updatedChat;
  }

  /**
   * Obtener estadísticas de chats
   */
  async getStats(userId?: number) {
    const where: any = { archivado: false };
    if (userId) {
      where.id_usuario_asignado = userId;
    }

    const [total, abiertos, pendientes, iaManejando, cerradosHoy, archivados] =
      await Promise.all([
        this.prisma.whatsapp_chat.count({ where }),
        this.prisma.whatsapp_chat.count({
          where: { ...where, estado: 'ABIERTO' },
        }),
        this.prisma.whatsapp_chat.count({
          where: { ...where, estado: 'PENDIENTE' },
        }),
        this.prisma.whatsapp_chat.count({
          where: { ...where, estado: 'IA_MANEJANDO' },
        }),
        this.prisma.whatsapp_chat.count({
          where: {
            ...where,
            estado: 'CERRADO',
            fecha_cierre: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        }),
        this.prisma.whatsapp_chat.count({
          where: userId
            ? { archivado: true, id_usuario_asignado: userId }
            : { archivado: true },
        }),
      ]);

    return {
      total,
      abiertos,
      pendientes,
      ia_manejando: iaManejando,
      cerrados_hoy: cerradosHoy,
      archivados,
    };
  }
}
