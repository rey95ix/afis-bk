import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryAgendaDto } from './dto/query-agenda.dto';
import { UpdateAgendaDto } from './dto/update-agenda.dto';

@Injectable()
export class AgendaService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(queryDto: QueryAgendaDto) {
    const { tecnico, desde, hasta, activo } = queryDto;

    const where: any = {};

    if (tecnico) {
      where.id_tecnico = tecnico;
    }

    if (activo !== undefined) {
      where.activo = activo;
    }

    if (desde || hasta) {
      where.inicio = {};
      if (desde) {
        where.inicio.gte = new Date(desde);
      }
      if (hasta) {
        where.inicio.lte = new Date(hasta);
      }
    }

    const agendas = await this.prisma.agenda_visitas.findMany({
      where,
      include: {
        orden: {
          select: {
            id_orden: true,
            codigo: true,
            tipo: true,
            estado: true,
            cliente: {
              select: {
                id_cliente: true,
                titular: true,
                telefono1: true,
              },
            },
            direccion_servicio: {
              select: {
                direccion: true,
                municipio: {
                  select: {
                    nombre: true,
                  },
                },
              },
            },
          },
        },
        tecnico: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
      orderBy: {
        inicio: 'asc',
      },
    });

    return agendas;
  }

  async findByOrden(idOrden: number) {
    const orden = await this.prisma.orden_trabajo.findUnique({
      where: { id_orden: idOrden },
    });

    if (!orden) {
      throw new NotFoundException(
        `Orden de trabajo con ID ${idOrden} no encontrada`,
      );
    }

    const agendas = await this.prisma.agenda_visitas.findMany({
      where: { id_orden: idOrden },
      include: {
        tecnico: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
      orderBy: {
        fecha_creacion: 'desc',
      },
    });

    return agendas;
  }

  async update(id: number, updateAgendaDto: UpdateAgendaDto, userId: number) {
    const agenda = await this.prisma.agenda_visitas.findUnique({
      where: { id_agenda: id },
      include: {
        orden: true,
      },
    });

    if (!agenda) {
      throw new NotFoundException(`Agenda con ID ${id} no encontrada`);
    }

    if (!agenda.activo) {
      throw new BadRequestException(
        'No se puede modificar una agenda inactiva',
      );
    }

    const dataToUpdate: any = {};

    if (updateAgendaDto.inicio) {
      dataToUpdate.inicio = new Date(updateAgendaDto.inicio);
    }

    if (updateAgendaDto.fin) {
      dataToUpdate.fin = new Date(updateAgendaDto.fin);
    }

    if (updateAgendaDto.id_tecnico) {
      const tecnico = await this.prisma.usuarios.findUnique({
        where: { id_usuario: updateAgendaDto.id_tecnico },
      });

      if (!tecnico) {
        throw new NotFoundException(
          `Técnico con ID ${updateAgendaDto.id_tecnico} no encontrado`,
        );
      }

      dataToUpdate.id_tecnico = updateAgendaDto.id_tecnico;
    }

    if (updateAgendaDto.motivo) {
      dataToUpdate.motivo = updateAgendaDto.motivo;
    }

    // Validar que inicio sea antes que fin
    const inicio = dataToUpdate.inicio || agenda.inicio;
    const fin = dataToUpdate.fin || agenda.fin;

    if (inicio >= fin) {
      throw new BadRequestException(
        'La fecha de inicio debe ser anterior a la fecha de fin',
      );
    }

    const agendaActualizada = await this.prisma.$transaction(
      async (prisma) => {
        const updated = await prisma.agenda_visitas.update({
          where: { id_agenda: id },
          data: dataToUpdate,
          include: {
            orden: true,
            tecnico: {
              select: {
                id_usuario: true,
                nombres: true,
                apellidos: true,
              },
            },
          },
        });

        // Actualizar la orden de trabajo con las nuevas fechas
        if (dataToUpdate.inicio || dataToUpdate.fin) {
          await prisma.orden_trabajo.update({
            where: { id_orden: agenda.id_orden },
            data: {
              ventana_programada_inicio: updated.inicio,
              ventana_programada_fin: updated.fin,
            },
          });
        }

        return updated;
      },
    );

    await this.prisma.logAction(
      'ACTUALIZAR_AGENDA',
      userId,
      `Agenda ${id} actualizada para orden ${agenda.orden.codigo}`,
    );

    return agendaActualizada;
  }
}
