import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppChatGateway } from '../whatsapp-chat.gateway';
import { ChatService } from './chat.service';

/**
 * Servicio de tareas programadas para el módulo de WhatsApp Chat.
 * Implementa CRON jobs para automatización de estados de chat.
 */
@Injectable()
export class ChatSchedulerService {
  private readonly logger = new Logger(ChatSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => WhatsAppChatGateway))
    private readonly chatGateway: WhatsAppChatGateway,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
  ) {}

  /**
   * CRON Job: Cierre automático de chats inactivos por más de 24 horas.
   * Se ejecuta cada hora.
   *
   * Criterios de cierre:
   * - Estado: ABIERTO, PENDIENTE, o IA_MANEJANDO
   * - No archivado
   * - ultima_interaccion_cliente < NOW() - 24 horas
   * - ultima_interaccion_cliente no es NULL
   */
  @Cron(CronExpression.EVERY_HOUR)
  async closeInactiveChats(): Promise<void> {
    this.logger.log('Ejecutando cierre automático de chats inactivos...');

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    try {
      // Buscar chats inactivos
      const inactiveChats = await this.prisma.whatsapp_chat.findMany({
        where: {
          estado: { in: ['ABIERTO', 'PENDIENTE', 'IA_MANEJANDO'] },
          archivado: false,
          ultima_interaccion_cliente: {
            not: null,
            lt: twentyFourHoursAgo,
          },
        },
        select: {
          id_chat: true,
          telefono_cliente: true,
          nombre_cliente: true,
          fecha_creacion: true,
          ultima_interaccion_cliente: true,
        },
      });

      if (inactiveChats.length === 0) {
        this.logger.log('No se encontraron chats inactivos para cerrar');
        return;
      }

      this.logger.log(`Encontrados ${inactiveChats.length} chats inactivos para cerrar`);

      let closedCount = 0;
      let errorCount = 0;

      for (const chat of inactiveChats) {
        try {
          await this.closeInactiveChat(chat);
          closedCount++;
        } catch (error) {
          errorCount++;
          this.logger.error(
            `Error cerrando chat #${chat.id_chat}: ${error.message}`,
          );
        }
      }

      // Emitir estadísticas actualizadas una sola vez al finalizar
      if (closedCount > 0) {
        const stats = await this.chatService.getStats();
        this.chatGateway.emitStatsUpdated(stats);
      }

      this.logger.log(
        `Cierre automático completado: ${closedCount} chats cerrados, ${errorCount} errores`,
      );
    } catch (error) {
      this.logger.error(`Error en cierre automático de chats: ${error.message}`);
    }
  }

  /**
   * Cerrar un chat individual por inactividad
   */
  private async closeInactiveChat(chat: {
    id_chat: number;
    telefono_cliente: string;
    nombre_cliente: string | null;
    fecha_creacion: Date;
    ultima_interaccion_cliente: Date | null;
  }): Promise<void> {
    // Calcular duración
    const duracion = Math.floor(
      (new Date().getTime() - chat.fecha_creacion.getTime()) / 1000,
    );

    // Ejecutar en transacción
    await this.prisma.$transaction([
      // Actualizar chat a CERRADO
      this.prisma.whatsapp_chat.update({
        where: { id_chat: chat.id_chat },
        data: {
          estado: 'CERRADO',
          fecha_cierre: new Date(),
        },
      }),
      // Actualizar métricas con duración
      this.prisma.whatsapp_chat_metrics.update({
        where: { id_chat: chat.id_chat },
        data: { duracion },
      }),
      // Desactivar asignaciones activas
      this.prisma.whatsapp_chat_assignment.updateMany({
        where: { id_chat: chat.id_chat, activo: true },
        data: {
          activo: false,
          fecha_desasignacion: new Date(),
          razon: 'Chat cerrado automáticamente por inactividad (24h)',
        },
      }),
    ]);

    // Registrar en log (sin userId porque es automático)
    await this.prisma.log.create({
      data: {
        accion: 'CERRAR_WHATSAPP_CHAT_INACTIVIDAD',
        descripcion: `Chat WhatsApp #${chat.id_chat} (${chat.telefono_cliente}) cerrado automáticamente por inactividad de 24h`,
      },
    });

    // Obtener chat actualizado para emitir
    const updatedChat = await this.prisma.whatsapp_chat.findUnique({
      where: { id_chat: chat.id_chat },
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

    // Emitir actualización del chat via WebSocket
    this.chatGateway.emitChatUpdated(updatedChat);

    this.logger.debug(
      `Chat #${chat.id_chat} cerrado por inactividad. Última interacción: ${chat.ultima_interaccion_cliente}`,
    );
  }

  /**
   * Método público para ejecutar el cierre manualmente (útil para testing)
   */
  async triggerCloseInactiveChats(): Promise<{ closedCount: number }> {
    this.logger.log('Ejecución manual del cierre de chats inactivos');
    await this.closeInactiveChats();

    // Contar chats cerrados hoy por inactividad
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const closedCount = await this.prisma.log.count({
      where: {
        accion: 'CERRAR_WHATSAPP_CHAT_INACTIVIDAD',
        fecha_creacion: { gte: today },
      },
    });

    return { closedCount };
  }
}
