import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface DateRange {
  desde?: string;
  hasta?: string;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtener métricas generales de chats
   */
  async getOverview(range?: DateRange) {
    const dateFilter = this.buildDateFilter(range);

    const [
      totalChats,
      chatsAbiertos,
      chatsPendientes,
      chatsIaManejando,
      chatsCerrados,
      promedioTiempoRespuesta,
      totalMensajes,
    ] = await Promise.all([
      // Total de chats
      this.prisma.whatsapp_chat.count({
        where: dateFilter,
      }),
      // Chats abiertos
      this.prisma.whatsapp_chat.count({
        where: { ...dateFilter, estado: 'ABIERTO' },
      }),
      // Chats pendientes
      this.prisma.whatsapp_chat.count({
        where: { ...dateFilter, estado: 'PENDIENTE' },
      }),
      // Chats manejados por IA
      this.prisma.whatsapp_chat.count({
        where: { ...dateFilter, estado: 'IA_MANEJANDO' },
      }),
      // Chats cerrados
      this.prisma.whatsapp_chat.count({
        where: { ...dateFilter, estado: 'CERRADO' },
      }),
      // Tiempo promedio de primera respuesta
      this.prisma.whatsapp_chat_metrics.aggregate({
        _avg: { tiempo_primera_respuesta: true },
        where: {
          tiempo_primera_respuesta: { not: null },
          chat: dateFilter,
        },
      }),
      // Total de mensajes
      this.prisma.whatsapp_message.count({
        where: { chat: dateFilter },
      }),
    ]);

    // Chats por hora (últimas 24 horas)
    const hace24Horas = new Date();
    hace24Horas.setHours(hace24Horas.getHours() - 24);

    const chatsPorHora = await this.prisma.$queryRaw`
      SELECT
        EXTRACT(HOUR FROM fecha_creacion) as hora,
        COUNT(*)::int as cantidad
      FROM whatsapp_chat
      WHERE fecha_creacion >= ${hace24Horas}
      GROUP BY EXTRACT(HOUR FROM fecha_creacion)
      ORDER BY hora
    `;

    return {
      total_chats: totalChats,
      chats_abiertos: chatsAbiertos,
      chats_pendientes: chatsPendientes,
      chats_ia_manejando: chatsIaManejando,
      chats_cerrados: chatsCerrados,
      promedio_tiempo_primera_respuesta_seg:
        Math.round(promedioTiempoRespuesta._avg.tiempo_primera_respuesta || 0),
      total_mensajes: totalMensajes,
      chats_por_hora: chatsPorHora,
    };
  }

  /**
   * Obtener rendimiento por agente
   */
  async getAgentPerformance(range?: DateRange) {
    const dateFilter = this.buildDateFilter(range);

    // Obtener usuarios que han sido asignados a chats
    const chatsConAsignacion = await this.prisma.whatsapp_chat.findMany({
      where: {
        ...dateFilter,
        id_usuario_asignado: { not: null },
      },
      select: {
        id_usuario_asignado: true,
      },
      distinct: ['id_usuario_asignado'],
    });

    const usuarioIds = chatsConAsignacion
      .map((c) => c.id_usuario_asignado)
      .filter((id): id is number => id !== null);

    const agentes = await this.prisma.usuarios.findMany({
      where: { id_usuario: { in: usuarioIds } },
      select: {
        id_usuario: true,
        nombres: true,
        apellidos: true,
      },
    });

    // Para cada agente, calcular métricas
    const agentesConMetricas = await Promise.all(
      agentes.map(async (agente) => {
        const chatsAgente = await this.prisma.whatsapp_chat.findMany({
          where: {
            ...dateFilter,
            id_usuario_asignado: agente.id_usuario,
          },
          include: {
            metricas: true,
            _count: {
              select: { mensajes: true },
            },
          },
        });

        const chatsCerrados = chatsAgente.filter((c) => c.estado === 'CERRADO');
        const tiemposRespuesta = chatsAgente
          .filter((c) => c.metricas?.tiempo_primera_respuesta)
          .map((c) => c.metricas!.tiempo_primera_respuesta!);

        const promedioTiempoRespuesta =
          tiemposRespuesta.length > 0
            ? Math.round(
                tiemposRespuesta.reduce((a, b) => a + b, 0) /
                  tiemposRespuesta.length,
              )
            : null;

        const duraciones = chatsCerrados
          .filter((c) => c.metricas?.duracion)
          .map((c) => c.metricas!.duracion!);

        const promedioDuracion =
          duraciones.length > 0
            ? Math.round(duraciones.reduce((a, b) => a + b, 0) / duraciones.length)
            : null;

        const totalMensajesAgente = await this.prisma.whatsapp_message.count({
          where: {
            id_usuario_envia: agente.id_usuario,
            chat: dateFilter,
          },
        });

        return {
          id_usuario: agente.id_usuario,
          nombre: `${agente.nombres} ${agente.apellidos}`,
          total_chats: chatsAgente.length,
          chats_abiertos: chatsAgente.filter((c) => c.estado === 'ABIERTO').length,
          chats_cerrados: chatsCerrados.length,
          promedio_tiempo_primera_respuesta_seg: promedioTiempoRespuesta,
          promedio_duracion_chat_seg: promedioDuracion,
          total_mensajes_enviados: totalMensajesAgente,
        };
      }),
    );

    return agentesConMetricas.sort((a, b) => b.total_chats - a.total_chats);
  }

  /**
   * Obtener estadísticas de la IA
   */
  async getIAStats(range?: DateRange) {
    const dateFilter = this.buildDateFilter(range);

    const [
      totalMensajesIA,
      chatsManejadosPorIA,
      escalados,
      reglasMasUsadas,
    ] = await Promise.all([
      // Total mensajes de IA
      this.prisma.whatsapp_message.count({
        where: { es_de_ia: true, chat: dateFilter },
      }),
      // Chats manejados por IA
      this.prisma.whatsapp_chat.count({
        where: {
          ...dateFilter,
          ia_mensajes_count: { gt: 0 },
        },
      }),
      // Chats escalados
      this.prisma.whatsapp_chat_metrics.count({
        where: {
          fue_escalado: true,
          chat: dateFilter,
        },
      }),
      // Reglas más usadas
      this.prisma.whatsapp_ia_rule.findMany({
        where: { ejecuciones_count: { gt: 0 } },
        orderBy: { ejecuciones_count: 'desc' },
        take: 10,
        select: {
          id_regla: true,
          nombre: true,
          ejecuciones_count: true,
          ultima_ejecucion_at: true,
        },
      }),
    ]);

    // Porcentaje de resolución por IA
    const totalChatsConIA = await this.prisma.whatsapp_chat.count({
      where: {
        ...dateFilter,
        ia_mensajes_count: { gt: 0 },
      },
    });

    const resueltosPorIA = await this.prisma.whatsapp_chat.count({
      where: {
        ...dateFilter,
        ia_mensajes_count: { gt: 0 },
        estado: 'CERRADO',
        id_usuario_asignado: null,
      },
    });

    const porcentajeResolucion =
      totalChatsConIA > 0
        ? Math.round((resueltosPorIA / totalChatsConIA) * 100)
        : 0;

    return {
      total_mensajes_ia: totalMensajesIA,
      chats_manejados_por_ia: chatsManejadosPorIA,
      chats_escalados: escalados,
      tasa_escalamiento:
        chatsManejadosPorIA > 0
          ? Math.round((escalados / chatsManejadosPorIA) * 100)
          : 0,
      porcentaje_resolucion_ia: porcentajeResolucion,
      reglas_mas_usadas: reglasMasUsadas,
    };
  }

  /**
   * Obtener métricas de un chat específico
   */
  async getChatMetrics(chatId: number) {
    const metrics = await this.prisma.whatsapp_chat_metrics.findUnique({
      where: { id_chat: chatId },
      include: {
        chat: {
          select: {
            id_chat: true,
            estado: true,
            fecha_creacion: true,
            fecha_cierre: true,
          },
        },
      },
    });

    if (!metrics) {
      return null;
    }

    return {
      ...metrics,
      tiempo_primera_respuesta_formato: this.formatSeconds(
        metrics.tiempo_primera_respuesta,
      ),
      tiempo_respuesta_promedio_formato: this.formatSeconds(
        metrics.tiempo_respuesta_promedio,
      ),
      duracion_formato: this.formatSeconds(metrics.duracion),
    };
  }

  /**
   * Obtener tendencias de chats por período
   */
  async getTrends(periodo: 'dia' | 'semana' | 'mes' = 'semana') {
    let dias: number;

    switch (periodo) {
      case 'dia':
        dias = 1;
        break;
      case 'semana':
        dias = 7;
        break;
      case 'mes':
        dias = 30;
        break;
    }

    const desde = new Date();
    desde.setDate(desde.getDate() - dias);

    // Queries separadas porque DATE_TRUNC no acepta parámetros para el intervalo
    let tendencias;

    if (periodo === 'dia') {
      tendencias = await this.prisma.$queryRaw`
        SELECT
          DATE_TRUNC('hour', fecha_creacion) as periodo,
          COUNT(*)::int as total_chats,
          COUNT(*) FILTER (WHERE estado = 'CERRADO')::int as cerrados,
          COUNT(*) FILTER (WHERE ia_mensajes_count > 0)::int as con_ia
        FROM whatsapp_chat
        WHERE fecha_creacion >= ${desde}
        GROUP BY 1
        ORDER BY periodo
      `;
    } else {
      tendencias = await this.prisma.$queryRaw`
        SELECT
          DATE_TRUNC('day', fecha_creacion) as periodo,
          COUNT(*)::int as total_chats,
          COUNT(*) FILTER (WHERE estado = 'CERRADO')::int as cerrados,
          COUNT(*) FILTER (WHERE ia_mensajes_count > 0)::int as con_ia
        FROM whatsapp_chat
        WHERE fecha_creacion >= ${desde}
        GROUP BY 1
        ORDER BY periodo
      `;
    }

    return tendencias;
  }

  /**
   * Helper para construir filtro de fechas
   */
  private buildDateFilter(range?: DateRange): any {
    if (!range || (!range.desde && !range.hasta)) {
      return {};
    }

    const filter: any = { fecha_creacion: {} };

    if (range.desde) {
      filter.fecha_creacion.gte = new Date(range.desde);
    }
    if (range.hasta) {
      filter.fecha_creacion.lte = new Date(range.hasta);
    }

    return filter;
  }

  /**
   * Helper para formatear segundos a formato legible
   */
  private formatSeconds(seconds: number | null): string | null {
    if (seconds === null) return null;

    if (seconds < 60) {
      return `${seconds} seg`;
    } else if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}m ${secs}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${mins}m`;
    }
  }
}
