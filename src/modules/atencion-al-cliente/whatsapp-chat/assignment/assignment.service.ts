import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AssignChatDto, UnassignChatDto } from './dto';

@Injectable()
export class AssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Asignar un chat a un usuario
   */
  async assignChat(chatId: number, dto: AssignChatDto, assignedById: number) {
    // Verificar que el chat existe
    const chat = await this.prisma.whatsapp_chat.findUnique({
      where: { id_chat: chatId },
    });

    if (!chat) {
      throw new NotFoundException(`Chat con ID ${chatId} no encontrado`);
    }

    if (chat.estado === 'CERRADO') {
      throw new BadRequestException('No se puede asignar un chat cerrado');
    }

    // Verificar que el usuario existe
    const usuario = await this.prisma.usuarios.findUnique({
      where: { id_usuario: dto.id_usuario },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${dto.id_usuario} no encontrado`);
    }

    // Desactivar asignaciones anteriores
    await this.prisma.whatsapp_chat_assignment.updateMany({
      where: { id_chat: chatId, activo: true },
      data: {
        activo: false,
        fecha_desasignacion: new Date(),
        razon: 'Reasignado a otro usuario',
      },
    });

    // Crear nueva asignación
    const assignment = await this.prisma.whatsapp_chat_assignment.create({
      data: {
        id_chat: chatId,
        id_usuario: dto.id_usuario,
        id_asignado_por: assignedById,
        razon: dto.razon,
      },
      include: {
        usuario: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
        asignado_por: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
    });

    // Actualizar el chat con el usuario asignado y cambiar estado
    await this.prisma.whatsapp_chat.update({
      where: { id_chat: chatId },
      data: {
        id_usuario_asignado: dto.id_usuario,
        estado: 'ABIERTO',
        ia_habilitada: false, // Desactivar IA al asignar humano
      },
    });

    await this.prisma.logAction(
      'ASIGNAR_WHATSAPP_CHAT',
      assignedById,
      `Chat #${chatId} asignado a ${usuario.nombres} ${usuario.apellidos}`,
    );

    return assignment;
  }

  /**
   * Desasignar un chat
   */
  async unassignChat(chatId: number, dto: UnassignChatDto, userId: number) {
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

    if (!chat.id_usuario_asignado) {
      throw new BadRequestException('El chat no tiene usuario asignado');
    }

    // Desactivar asignación actual
    await this.prisma.whatsapp_chat_assignment.updateMany({
      where: { id_chat: chatId, activo: true },
      data: {
        activo: false,
        fecha_desasignacion: new Date(),
        razon: dto.razon || 'Desasignación manual',
      },
    });

    // Actualizar chat
    await this.prisma.whatsapp_chat.update({
      where: { id_chat: chatId },
      data: {
        id_usuario_asignado: null,
        estado: 'PENDIENTE',
      },
    });

    await this.prisma.logAction(
      'DESASIGNAR_WHATSAPP_CHAT',
      userId,
      `Chat #${chatId} desasignado de ${chat.usuario_asignado?.nombres} ${chat.usuario_asignado?.apellidos}`,
    );

    return { message: 'Chat desasignado exitosamente' };
  }

  /**
   * Obtener historial de asignaciones de un chat
   */
  async getHistory(chatId: number) {
    const chat = await this.prisma.whatsapp_chat.findUnique({
      where: { id_chat: chatId },
    });

    if (!chat) {
      throw new NotFoundException(`Chat con ID ${chatId} no encontrado`);
    }

    return this.prisma.whatsapp_chat_assignment.findMany({
      where: { id_chat: chatId },
      include: {
        usuario: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
        asignado_por: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
      orderBy: { fecha_asignacion: 'desc' },
    });
  }

  /**
   * Obtener usuarios disponibles para asignación
   */
  async getAvailableAgents() {
    // Obtener usuarios activos (simplificado)
    const usuarios = await this.prisma.usuarios.findMany({
      where: {
        estado: 'ACTIVO',
      },
      select: {
        id_usuario: true,
        nombres: true,
        apellidos: true,
      },
      orderBy: { nombres: 'asc' },
    });

    // Contar chats activos por usuario
    const chatsActivos = await this.prisma.whatsapp_chat.groupBy({
      by: ['id_usuario_asignado'],
      where: {
        estado: { in: ['ABIERTO', 'PENDIENTE'] },
        id_usuario_asignado: { not: null },
      },
      _count: true,
    });

    const chatsMap = new Map(
      chatsActivos.map((c) => [c.id_usuario_asignado, c._count]),
    );

    return usuarios.map((u) => ({
      id_usuario: u.id_usuario,
      nombres: u.nombres,
      apellidos: u.apellidos,
      nombre_completo: `${u.nombres} ${u.apellidos}`,
      chats_activos: chatsMap.get(u.id_usuario) || 0,
    }));
  }

  /**
   * Reasignar chat manteniendo historial
   */
  async reassignChat(
    chatId: number,
    dto: AssignChatDto,
    reassignedById: number,
  ) {
    // Primero desasignar
    await this.unassignChat(chatId, { razon: 'Reasignación' }, reassignedById);

    // Luego asignar al nuevo usuario
    return this.assignChat(chatId, dto, reassignedById);
  }
}
