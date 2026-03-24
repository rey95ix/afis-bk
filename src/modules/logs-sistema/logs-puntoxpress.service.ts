import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { QueryPuntoxpressLegacyLogDto } from './dto';
import { PaginatedResult } from 'src/common/dto/pagination.dto';

@Injectable()
export class LogsPuntoxpressService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    queryDto: QueryPuntoxpressLegacyLogDto,
  ): Promise<PaginatedResult<any>> {
    const {
      page = 1,
      limit = 10,
      metodo,
      codigo_respuesta,
      ip,
      fecha_desde,
      fecha_hasta,
    } = queryDto;

    const skip = (page - 1) * limit;
    const where: any = {};

    if (metodo) {
      where.metodo = metodo;
    }

    if (codigo_respuesta !== undefined && codigo_respuesta !== null) {
      where.codigo_respuesta = codigo_respuesta;
    }

    if (ip) {
      where.ip = { contains: ip, mode: 'insensitive' };
    }

    if (fecha_desde || fecha_hasta) {
      where.fecha_creacion = {};
      if (fecha_desde) {
        where.fecha_creacion.gte = new Date(fecha_desde);
      }
      if (fecha_hasta) {
        const hasta = new Date(fecha_hasta);
        hasta.setHours(23, 59, 59, 999);
        where.fecha_creacion.lte = hasta;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.puntoxpress_legacy_log.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fecha_creacion: 'desc' },
      }),
      this.prisma.puntoxpress_legacy_log.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }
}
