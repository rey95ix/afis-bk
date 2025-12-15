import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateChatDto, UpdateChatDto, QueryChatDto } from './dto';
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
      id_cliente,
      tags,
      fecha_desde,
      fecha_hasta,
      sort_by = 'ultimo_mensaje_at',
      sort_order = 'desc',
    } = queryDto;

    const where: any = {};

    // Filtro por estado
    if (estado) {
      where.estado = estado;
    }

    // Filtro por usuario asignado
    if (sin_asignar) {
      where.id_usuario_asignado = null;
    } else if (id_usuario_asignado) {
      where.id_usuario_asignado = id_usuario_asignado;
    }

    // Filtro por cliente
    if (id_cliente) {
      where.id_cliente = id_cliente;
    }

    // Búsqueda por nombre o teléfono
    if (search) {
      where.OR = [
        { telefono_cliente: { contains: search, mode: 'insensitive' } },
        { nombre_cliente: { contains: search, mode: 'insensitive' } },
        {
          cliente: {
            titular: { contains: search, mode: 'insensitive' },
          },
        },
      ];
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
   */
  async findOrCreateByPhone(
    telefono: string,
    whatsappChatId: string,
    nombre?: string,
  ) {
    // Buscar chat existente activo
    let chat = await this.prisma.whatsapp_chat.findFirst({
      where: {
        telefono_cliente: telefono,
        estado: { in: ['ABIERTO', 'PENDIENTE', 'IA_MANEJANDO'] },
      },
    });

    if (!chat) {
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
        },
      });

      // Crear métricas
      await this.prisma.whatsapp_chat_metrics.create({
        data: { id_chat: chat.id_chat },
      });
    }

    return chat;
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
    }

    return this.prisma.whatsapp_chat.update({
      where: { id_chat: chatId },
      data: updateData,
    });
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
   * Obtener estadísticas de chats
   */
  async getStats(userId?: number) {
    const where: any = {};
    if (userId) {
      where.id_usuario_asignado = userId;
    }

    const [total, abiertos, pendientes, iaManejando, cerradosHoy] =
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
      ]);

    return {
      total,
      abiertos,
      pendientes,
      ia_manejando: iaManejando,
      cerrados_hoy: cerradosHoy,
    };
  }
}
