import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { QueryTicketDto } from './dto/query-ticket.dto';
import { EscalarTicketDto } from './dto/escalar-ticket.dto';
import { orden_trabajo } from '@prisma/client';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) { }

  async create(createTicketDto: CreateTicketDto, userId: number) {
    // Verificar que el cliente existe
    const cliente = await this.prisma.cliente.findUnique({
      where: { id_cliente: createTicketDto.id_cliente },
    });

    if (!cliente) {
      throw new NotFoundException(
        `Cliente con ID ${createTicketDto.id_cliente} no encontrado`,
      );
    }

    // Si se proporciona dirección de servicio, verificar que existe
    if (createTicketDto.id_direccion_servicio) {
      const direccion = await this.prisma.clienteDirecciones.findUnique({
        where: {
          id_cliente_direccion: createTicketDto.id_direccion_servicio,
        },
      });

      if (!direccion) {
        throw new NotFoundException(
          `Dirección con ID ${createTicketDto.id_direccion_servicio} no encontrada`,
        );
      }
    }

    // Si se proporciona diagnóstico de catálogo, verificar que existe
    if (createTicketDto.id_diagnostico_catalogo) {
      const diagnostico = await this.prisma.diagnostico_catalogo.findUnique({
        where: { id_diagnostico: createTicketDto.id_diagnostico_catalogo },
      });

      if (!diagnostico) {
        throw new NotFoundException(
          `Diagnóstico con ID ${createTicketDto.id_diagnostico_catalogo} no encontrado`,
        );
      }
    }

    // Construir objeto data filtrando campos undefined
    const data: any = {
      id_cliente: createTicketDto.id_cliente,
      canal: createTicketDto.canal,
      descripcion_problema: createTicketDto.descripcion_problema,
      severidad: createTicketDto.severidad || 'MEDIA',
      requiere_visita: createTicketDto.requiere_visita ?? false,
      estado: 'ABIERTO',
    };

    // Agregar campos opcionales solo si tienen valor
    if (createTicketDto.id_direccion_servicio !== undefined) {
      data.id_direccion_servicio = createTicketDto.id_direccion_servicio;
    }
    if (createTicketDto.diagnostico_inicial) {
      data.diagnostico_inicial = createTicketDto.diagnostico_inicial;
    }
    if (createTicketDto.id_diagnostico_catalogo !== undefined) {
      data.id_diagnostico_catalogo = createTicketDto.id_diagnostico_catalogo;
    }
    if (createTicketDto.pruebas_remotas) {
      data.pruebas_remotas = createTicketDto.pruebas_remotas;
    }

    const ticket = await this.prisma.ticket_soporte.create({
      data,
      include: {
        cliente: {
          select: {
            id_cliente: true,
            titular: true,
            correo_electronico: true,
            telefono1: true,
          },
        },
        direccion_servicio: true,
        diagnostico_catalogo: true,
      },
    });

    await this.prisma.logAction(
      'CREAR_TICKETS',
      userId,
      `Ticket #${ticket.id_ticket} creado para cliente ${cliente.titular}`,
    );

    return ticket;
  }

  async findAll(queryDto: QueryTicketDto) {
    const { estado, id_cliente, severidad, fecha_desde, fecha_hasta, page, limit } = queryDto;

    const where: any = {};

    if (estado) {
      where.estado = estado;
    }

    if (id_cliente) {
      where.id_cliente = id_cliente;
    }

    if (severidad) {
      where.severidad = severidad;
    }

    if (fecha_desde || fecha_hasta) {
      where.fecha_apertura = {};
      if (fecha_desde) {
        where.fecha_apertura.gte = new Date(fecha_desde);
      }
      if (fecha_hasta) {
        where.fecha_apertura.lte = new Date(fecha_hasta);
      }
    }

    const skip = ((page || 1) - 1) * (limit || 10);
    const take = limit || 10;

    const [tickets, total] = await Promise.all([
      this.prisma.ticket_soporte.findMany({
        where,
        skip,
        take,
        include: {
          cliente: {
            select: {
              id_cliente: true,
              titular: true,
              correo_electronico: true,
              telefono1: true,
            },
          },
          direccion_servicio: {
            select: {
              id_cliente_direccion: true,
              direccion: true,
              municipio: {
                select: {
                  nombre: true,
                },
              },
            },
          },
          diagnostico_catalogo: true,
          ordenes: {
            select: {
              id_orden: true,
              codigo: true,
              estado: true,
              tipo: true,
            },
          },
        },
        orderBy: {
          fecha_apertura: 'desc',
        },
      }),
      this.prisma.ticket_soporte.count({ where }),
    ]);

    return {
      data: tickets,
      meta: {
        total,
        page: page || 1,
        limit: limit || 10,
        totalPages: Math.ceil(total / (limit || 10)),
      },
    };
  }

  async findOne(id: number) {
    const ticket = await this.prisma.ticket_soporte.findUnique({
      where: { id_ticket: id },
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
        direccion_servicio: {
          select: {
            id_cliente_direccion: true,
            direccion: true,
            codigo_postal: true,
            colonias: {
              select: {
                nombre: true,
              },
            },
            municipio: {
              select: {
                nombre: true,
              },
            },
            departamento: {
              select: {
                nombre: true,
              },
            },
          },
        },
        diagnostico_catalogo: true,
        ordenes: {
          include: {
            tecnico_asignado: {
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
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket con ID ${id} no encontrado`);
    }

    return ticket;
  }

  async update(id: number, updateTicketDto: UpdateTicketDto, userId: number) {
    const ticket = await this.prisma.ticket_soporte.findUnique({
      where: { id_ticket: id },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket con ID ${id} no encontrado`);
    }

    const updatedTicket = await this.prisma.ticket_soporte.update({
      where: { id_ticket: id },
      data: updateTicketDto,
      include: {
        cliente: {
          select: {
            id_cliente: true,
            titular: true,
            correo_electronico: true,
            telefono1: true,
          },
        },
        direccion_servicio: true,
        diagnostico_catalogo: true,
        ordenes: true
      },
    });

    await this.prisma.logAction(
      'ACTUALIZAR_TICKETS',
      userId,
      `Ticket #${updatedTicket.id_ticket} actualizado`,
    );

    return updatedTicket;
  }

  async escalar(
    id: number,
    escalarDto: EscalarTicketDto,
    userId: number,
  ) {
    const ticket = await this.prisma.ticket_soporte.findUnique({
      where: { id_ticket: id },
      include: {
        cliente: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket con ID ${id} no encontrado`);
    }

    if (ticket.estado === 'ESCALADO' || ticket.estado === 'CERRADO') {
      throw new BadRequestException(
        `El ticket ya está en estado ${ticket.estado} y no puede ser escalado`,
      );
    }

    if (!ticket.id_direccion_servicio) {
      throw new BadRequestException(
        'El ticket debe tener una dirección de servicio para ser escalado',
      );
    }

    // Generar código de orden de trabajo: OT-YYYYMM-#####
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Obtener el último número de secuencia del mes
    const lastOrden = await this.prisma.orden_trabajo.findFirst({
      where: {
        codigo: {
          startsWith: `OT-${yearMonth}-`,
        },
      },
      orderBy: {
        codigo: 'desc',
      },
    });

    let secuencia = 1;
    if (lastOrden) {
      const lastSecuencia = parseInt(lastOrden.codigo.split('-')[2]);
      secuencia = lastSecuencia + 1;
    }

    const codigo = `OT-${yearMonth}-${String(secuencia).padStart(5, '0')}`;

    // Crear orden de trabajo y actualizar ticket en una transacción
    const result = await this.prisma.$transaction(async (prisma) => {
      // Construir objeto data para la orden de trabajo
      const ordenData: any = {
        codigo,
        id_ticket: ticket.id_ticket,
        tipo: escalarDto.tipo,
        id_cliente: ticket.id_cliente,
        id_direccion_servicio: ticket.id_direccion_servicio,
        estado: escalarDto.id_tecnico_asignado ? 'ASIGNADA' : 'PENDIENTE_ASIGNACION',
      };

      // Agregar campos opcionales solo si tienen valor
      if (escalarDto.id_tecnico_asignado !== undefined) {
        ordenData.id_tecnico_asignado = escalarDto.id_tecnico_asignado;
        ordenData.fecha_asignacion = new Date();
      } else {
        ordenData.fecha_asignacion = null;
      }
      if (escalarDto.observaciones) {
        ordenData.observaciones_tecnico = escalarDto.observaciones;
      }

      const orden = await prisma.orden_trabajo.create({
        data: ordenData,
        include: {
          ticket: true,
          cliente: {
            select: {
              id_cliente: true,
              titular: true,
              correo_electronico: true,
              telefono1: true,
            },
          },
          direccion_servicio: true,
          tecnico_asignado: {
            select: {
              id_usuario: true,
              nombres: true,
              apellidos: true,
            },
          },
        },
      });

      // Crear historial de estado inicial
      await prisma.ot_historial_estado.create({
        data: {
          id_orden: orden.id_orden,
          estado: orden.estado,
          comentario: 'Orden de trabajo creada desde ticket',
          cambiado_por: userId,
        },
      });

      // Actualizar estado del ticket
      const updatedTicket = await prisma.ticket_soporte.update({
        where: { id_ticket: id },
        data: {
          estado: 'ESCALADO',
          requiere_visita: true,
        },
      });

      return { orden, ticket: updatedTicket };
    });

    await this.prisma.logAction(
      'ESCALAR_TICKETS',
      userId,
      `Ticket #${id} escalado a orden de trabajo ${result.orden.codigo}`,
    );

    return result;
  }
}
