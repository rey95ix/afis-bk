import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateEtiquetaDto,
  UpdateEtiquetaDto,
  QueryEtiquetaDto,
  AsignarEtiquetaDto,
  DesasignarEtiquetaDto,
  ReemplazarEtiquetasDto,
} from './dto';
import { WhatsAppChatGateway } from '../whatsapp-chat.gateway';

@Injectable()
export class EtiquetaService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => WhatsAppChatGateway))
    private readonly chatGateway: WhatsAppChatGateway,
  ) {}

  // ===================== CRUD DE ETIQUETAS =====================

  /**
   * Crear una nueva etiqueta
   */
  async create(dto: CreateEtiquetaDto, userId: number) {
    // Verificar si ya existe una etiqueta con el mismo nombre
    const existing = await this.prisma.whatsapp_chat_etiqueta.findUnique({
      where: { nombre: dto.nombre },
    });

    if (existing) {
      throw new ConflictException(
        `Ya existe una etiqueta con el nombre "${dto.nombre}"`,
      );
    }

    const etiqueta = await this.prisma.whatsapp_chat_etiqueta.create({
      data: {
        nombre: dto.nombre,
        color: dto.color,
        descripcion: dto.descripcion,
        orden: dto.orden ?? 0,
        id_usuario_creador: userId,
      },
    });

    // Emitir evento WebSocket
    this.chatGateway.emitEtiquetasUpdated();

    return etiqueta;
  }

  /**
   * Obtener todas las etiquetas
   */
  async findAll(query: QueryEtiquetaDto) {
    const where: any = {};

    if (query.solo_activas !== false) {
      where.activo = true;
    }

    const etiquetas = await this.prisma.whatsapp_chat_etiqueta.findMany({
      where,
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      include: {
        _count: {
          select: { chats: true },
        },
        usuario_creador: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
    });

    return etiquetas;
  }

  /**
   * Obtener una etiqueta por ID
   */
  async findOne(id: number) {
    const etiqueta = await this.prisma.whatsapp_chat_etiqueta.findUnique({
      where: { id_etiqueta: id },
      include: {
        _count: {
          select: { chats: true },
        },
        usuario_creador: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
    });

    if (!etiqueta) {
      throw new NotFoundException(`Etiqueta con ID ${id} no encontrada`);
    }

    return etiqueta;
  }

  /**
   * Actualizar una etiqueta
   */
  async update(id: number, dto: UpdateEtiquetaDto, userId: number) {
    // Verificar que existe
    const existing = await this.prisma.whatsapp_chat_etiqueta.findUnique({
      where: { id_etiqueta: id },
    });

    if (!existing) {
      throw new NotFoundException(`Etiqueta con ID ${id} no encontrada`);
    }

    // Si se está cambiando el nombre, verificar que no exista otro con ese nombre
    if (dto.nombre && dto.nombre !== existing.nombre) {
      const duplicado = await this.prisma.whatsapp_chat_etiqueta.findUnique({
        where: { nombre: dto.nombre },
      });

      if (duplicado) {
        throw new ConflictException(
          `Ya existe una etiqueta con el nombre "${dto.nombre}"`,
        );
      }
    }

    const etiqueta = await this.prisma.whatsapp_chat_etiqueta.update({
      where: { id_etiqueta: id },
      data: {
        nombre: dto.nombre,
        color: dto.color,
        descripcion: dto.descripcion,
        orden: dto.orden,
        activo: dto.activo,
      },
      include: {
        _count: {
          select: { chats: true },
        },
      },
    });

    // Emitir evento WebSocket
    this.chatGateway.emitEtiquetasUpdated();

    return etiqueta;
  }

  /**
   * Eliminar una etiqueta
   */
  async remove(id: number, userId: number) {
    // Verificar que existe
    const existing = await this.prisma.whatsapp_chat_etiqueta.findUnique({
      where: { id_etiqueta: id },
      include: {
        _count: {
          select: { chats: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Etiqueta con ID ${id} no encontrada`);
    }

    // Eliminar (las relaciones se eliminan en cascada)
    await this.prisma.whatsapp_chat_etiqueta.delete({
      where: { id_etiqueta: id },
    });

    // Emitir evento WebSocket
    this.chatGateway.emitEtiquetasUpdated();

    return {
      message: `Etiqueta "${existing.nombre}" eliminada correctamente`,
      chats_afectados: existing._count.chats,
    };
  }

  // ===================== ASIGNACIÓN A CHATS =====================

  /**
   * Obtener las etiquetas de un chat
   */
  async getEtiquetasDeChat(chatId: number) {
    // Verificar que el chat existe
    const chat = await this.prisma.whatsapp_chat.findUnique({
      where: { id_chat: chatId },
    });

    if (!chat) {
      throw new NotFoundException(`Chat con ID ${chatId} no encontrado`);
    }

    const relaciones = await this.prisma.whatsapp_chat_etiqueta_chat.findMany({
      where: { id_chat: chatId },
      include: {
        etiqueta: {
          select: {
            id_etiqueta: true,
            nombre: true,
            color: true,
            descripcion: true,
            orden: true,
          },
        },
      },
      orderBy: {
        etiqueta: { orden: 'asc' },
      },
    });

    return relaciones.map((r) => r.etiqueta);
  }

  /**
   * Asignar etiquetas a un chat (agrega a las existentes)
   */
  async asignarEtiquetas(chatId: number, dto: AsignarEtiquetaDto, userId: number) {
    // Verificar que el chat existe
    const chat = await this.prisma.whatsapp_chat.findUnique({
      where: { id_chat: chatId },
    });

    if (!chat) {
      throw new NotFoundException(`Chat con ID ${chatId} no encontrado`);
    }

    // Verificar que todas las etiquetas existen
    const etiquetas = await this.prisma.whatsapp_chat_etiqueta.findMany({
      where: {
        id_etiqueta: { in: dto.id_etiquetas },
        activo: true,
      },
    });

    if (etiquetas.length !== dto.id_etiquetas.length) {
      throw new BadRequestException(
        'Una o más etiquetas no existen o no están activas',
      );
    }

    // Crear las relaciones (ignorar si ya existen)
    await this.prisma.whatsapp_chat_etiqueta_chat.createMany({
      data: dto.id_etiquetas.map((id_etiqueta) => ({
        id_chat: chatId,
        id_etiqueta,
        id_usuario_asigno: userId,
      })),
      skipDuplicates: true,
    });

    // Obtener etiquetas actualizadas
    const etiquetasActuales = await this.getEtiquetasDeChat(chatId);

    // Emitir evento WebSocket
    this.chatGateway.emitChatEtiquetasUpdated(chatId, etiquetasActuales);

    return {
      message: 'Etiquetas asignadas correctamente',
      etiquetas: etiquetasActuales,
    };
  }

  /**
   * Desasignar etiquetas de un chat
   */
  async desasignarEtiquetas(
    chatId: number,
    dto: DesasignarEtiquetaDto,
    userId: number,
  ) {
    // Verificar que el chat existe
    const chat = await this.prisma.whatsapp_chat.findUnique({
      where: { id_chat: chatId },
    });

    if (!chat) {
      throw new NotFoundException(`Chat con ID ${chatId} no encontrado`);
    }

    // Eliminar las relaciones
    await this.prisma.whatsapp_chat_etiqueta_chat.deleteMany({
      where: {
        id_chat: chatId,
        id_etiqueta: { in: dto.id_etiquetas },
      },
    });

    // Obtener etiquetas actualizadas
    const etiquetasActuales = await this.getEtiquetasDeChat(chatId);

    // Emitir evento WebSocket
    this.chatGateway.emitChatEtiquetasUpdated(chatId, etiquetasActuales);

    return {
      message: 'Etiquetas desasignadas correctamente',
      etiquetas: etiquetasActuales,
    };
  }

  /**
   * Reemplazar todas las etiquetas de un chat
   * Permite array vacío para eliminar todas las etiquetas
   */
  async reemplazarEtiquetas(
    chatId: number,
    dto: ReemplazarEtiquetasDto,
    userId: number,
  ) {
    // Verificar que el chat existe
    const chat = await this.prisma.whatsapp_chat.findUnique({
      where: { id_chat: chatId },
    });

    if (!chat) {
      throw new NotFoundException(`Chat con ID ${chatId} no encontrado`);
    }

    // Si hay etiquetas a asignar, verificar que existen
    if (dto.id_etiquetas.length > 0) {
      const etiquetas = await this.prisma.whatsapp_chat_etiqueta.findMany({
        where: {
          id_etiqueta: { in: dto.id_etiquetas },
          activo: true,
        },
      });

      if (etiquetas.length !== dto.id_etiquetas.length) {
        throw new BadRequestException(
          'Una o más etiquetas no existen o no están activas',
        );
      }
    }

    // Eliminar todas las etiquetas actuales
    await this.prisma.whatsapp_chat_etiqueta_chat.deleteMany({
      where: { id_chat: chatId },
    });

    // Si hay etiquetas nuevas, agregarlas
    if (dto.id_etiquetas.length > 0) {
      await this.prisma.whatsapp_chat_etiqueta_chat.createMany({
        data: dto.id_etiquetas.map((id_etiqueta) => ({
          id_chat: chatId,
          id_etiqueta,
          id_usuario_asigno: userId,
        })),
      });
    }

    // Obtener etiquetas actualizadas
    const etiquetasActuales = await this.getEtiquetasDeChat(chatId);

    // Emitir evento WebSocket
    this.chatGateway.emitChatEtiquetasUpdated(chatId, etiquetasActuales);

    return {
      message: dto.id_etiquetas.length > 0
        ? 'Etiquetas reemplazadas correctamente'
        : 'Todas las etiquetas eliminadas correctamente',
      etiquetas: etiquetasActuales,
    };
  }

  // ===================== ESTADÍSTICAS =====================

  /**
   * Obtener estadísticas de etiquetas
   */
  async getEtiquetaStats() {
    const etiquetas = await this.prisma.whatsapp_chat_etiqueta.findMany({
      where: { activo: true },
      include: {
        _count: {
          select: { chats: true },
        },
      },
      orderBy: { orden: 'asc' },
    });

    return etiquetas.map((e) => ({
      id_etiqueta: e.id_etiqueta,
      nombre: e.nombre,
      color: e.color,
      total_chats: e._count.chats,
    }));
  }
}
