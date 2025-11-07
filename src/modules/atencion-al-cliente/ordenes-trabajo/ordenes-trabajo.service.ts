import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrdenDto } from './dto/create-orden.dto';
import { UpdateOrdenDto } from './dto/update-orden.dto';
import { QueryOrdenDto } from './dto/query-orden.dto';
import { AsignarOrdenDto } from './dto/asignar-orden.dto';
import { AgendarOrdenDto } from './dto/agendar-orden.dto';
import { ReprogramarOrdenDto } from './dto/reprogramar-orden.dto';
import { CambiarEstadoOrdenDto } from './dto/cambiar-estado-orden.dto';
import { IniciarOrdenDto } from './dto/iniciar-orden.dto';
import { CerrarOrdenDto } from './dto/cerrar-orden.dto';
import { CreateActividadDto } from './dto/create-actividad.dto';
import { UpdateActividadDto } from './dto/update-actividad.dto';
import { CreateMaterialDto } from './dto/create-material.dto';
import { CreateEvidenciaDto } from './dto/create-evidencia.dto';

@Injectable()
export class OrdenesTrabajoService {
  constructor(private readonly prisma: PrismaService) { }

  private async generarCodigoOrden(): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

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

    return `OT-${yearMonth}-${String(secuencia).padStart(5, '0')}`;
  }

  async create(createOrdenDto: CreateOrdenDto, userId: number) {
    // Validar cliente
    const cliente = await this.prisma.cliente.findUnique({
      where: { id_cliente: createOrdenDto.id_cliente },
    });

    if (!cliente) {
      throw new NotFoundException(
        `Cliente con ID ${createOrdenDto.id_cliente} no encontrado`,
      );
    }

    // Validar dirección
    const direccion = await this.prisma.clienteDirecciones.findUnique({
      where: {
        id_cliente_direccion: createOrdenDto.id_direccion_servicio,
      },
    });

    if (!direccion) {
      throw new NotFoundException(
        `Dirección con ID ${createOrdenDto.id_direccion_servicio} no encontrada`,
      );
    }

    // Si se proporciona ticket, validar que existe
    if (createOrdenDto.id_ticket) {
      const ticket = await this.prisma.ticket_soporte.findUnique({
        where: { id_ticket: createOrdenDto.id_ticket },
      });

      if (!ticket) {
        throw new NotFoundException(
          `Ticket con ID ${createOrdenDto.id_ticket} no encontrado`,
        );
      }
    }

    // Si se proporciona técnico, validar que existe
    if (createOrdenDto.id_tecnico_asignado) {
      const tecnico = await this.prisma.usuarios.findUnique({
        where: { id_usuario: createOrdenDto.id_tecnico_asignado },
      });

      if (!tecnico) {
        throw new NotFoundException(
          `Técnico con ID ${createOrdenDto.id_tecnico_asignado} no encontrado`,
        );
      }
    }

    const codigo = await this.generarCodigoOrden();

    const orden = await this.prisma.$transaction(async (prisma) => {
      // Construir objeto data con campos requeridos
      const data: any = {
        codigo,
        tipo: createOrdenDto.tipo,
        id_cliente: createOrdenDto.id_cliente,
        id_direccion_servicio: createOrdenDto.id_direccion_servicio,
        estado: createOrdenDto.id_tecnico_asignado
          ? 'ASIGNADA'
          : 'PENDIENTE_ASIGNACION',
      };

      // Agregar campos opcionales solo si tienen valor
      if (createOrdenDto.id_ticket !== undefined) {
        data.id_ticket = createOrdenDto.id_ticket;
      }
      if (createOrdenDto.id_tecnico_asignado !== undefined) {
        data.id_tecnico_asignado = createOrdenDto.id_tecnico_asignado;
        data.fecha_asignacion = new Date();
      } else {
        data.fecha_asignacion = null;
      }
      if (createOrdenDto.observaciones_tecnico) {
        data.observaciones_tecnico = createOrdenDto.observaciones_tecnico;
      }

      const nuevaOrden = await prisma.orden_trabajo.create({
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
          id_orden: nuevaOrden.id_orden,
          estado: nuevaOrden.estado,
          comentario: 'Orden de trabajo creada',
          cambiado_por: userId,
        },
      });

      return nuevaOrden;
    });

    await this.prisma.logAction(
      'CREAR_ORDENES_TRABAJO',
      userId,
      `Orden de trabajo ${codigo} creada`,
    );

    return orden;
  }

  async findAll(queryDto: QueryOrdenDto) {
    const {
      estado,
      id_tecnico,
      tipo,
      id_cliente,
      fecha_desde,
      fecha_hasta,
      page,
      limit,
    } = queryDto;

    const where: any = {};

    if (estado) {
      where.estado = estado;
    }

    if (id_tecnico) {
      where.id_tecnico_asignado = id_tecnico;
    }

    if (tipo) {
      where.tipo = tipo;
    }

    if (id_cliente) {
      where.id_cliente = id_cliente;
    }

    if (fecha_desde || fecha_hasta) {
      where.fecha_creacion = {};
      if (fecha_desde) {
        where.fecha_creacion.gte = new Date(fecha_desde);
      }
      if (fecha_hasta) {
        where.fecha_creacion.lte = new Date(fecha_hasta);
      }
    }

    const skip = ((page || 1) - 1) * (limit || 10);
    const take = limit || 10;

    const [ordenes, total] = await Promise.all([
      this.prisma.orden_trabajo.findMany({
        where,
        skip,
        take,
        include: {
          cliente: {
            select: {
              id_cliente: true,
              titular: true,
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
          tecnico_asignado: {
            select: {
              id_usuario: true,
              nombres: true,
              apellidos: true,
            },
          },
          ticket: {
            select: {
              id_ticket: true,
              severidad: true,
              descripcion_problema: true,
            },
          },
        },
        orderBy: {
          fecha_creacion: 'desc',
        },
      }),
      this.prisma.orden_trabajo.count({ where }),
    ]);

    return {
      data: ordenes,
      meta: {
        total,
        page: page || 1,
        limit: limit || 10,
        totalPages: Math.ceil(total / (limit || 10)),
      },
    };
  }

  async findOne(id: number) {
    const orden = await this.prisma.orden_trabajo.findUnique({
      where: { id_orden: id },
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
          include: {
            colonias: true,
            municipio: true,
            departamento: true,
          },
        },
        tecnico_asignado: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
            dui: true,
          },
        },
        ticket: true,
        motivo_cierre: true,
        actividades: {
          include: {
            solucion: true,
          },
          orderBy: {
            fecha_creacion: 'asc',
          },
        },
        materiales: {
          orderBy: {
            fecha_registro: 'asc',
          },
        },
        evidencias: {
          orderBy: {
            fecha_subida: 'asc',
          },
        },
        agendas: {
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
        },
        historico_estados: {
          orderBy: {
            fecha_cambio: 'desc',
          },
          include: {
            tecnico: true
          }
        },
      },
    });

    if (!orden) {
      throw new NotFoundException(`Orden de trabajo con ID ${id} no encontrada`);
    }

    return orden;
  }

  async update(id: number, updateOrdenDto: UpdateOrdenDto, userId: number) {
    const orden = await this.prisma.orden_trabajo.findUnique({
      where: { id_orden: id },
    });

    if (!orden) {
      throw new NotFoundException(`Orden de trabajo con ID ${id} no encontrada`);
    }

    const result = await this.prisma.$transaction(async (prisma) => {
      const updatedOrden = await prisma.orden_trabajo.update({
        where: { id_orden: id },
        data: updateOrdenDto,
      });

      // Registrar en historial
      await prisma.ot_historial_estado.create({
        data: {
          id_orden: id,
          estado: updatedOrden.estado, // Mantener el estado actual
          comentario: 'Información de la orden actualizada',
          cambiado_por: userId,
        },
      });

      return updatedOrden;
    });

    await this.prisma.logAction(
      'ACTUALIZAR_ORDENES_TRABAJO',
      userId,
      `Orden de trabajo ${orden.codigo} actualizada`,
    );

    return result;
  }

  async asignar(id: number, asignarDto: AsignarOrdenDto, userId: number) {
    const orden = await this.prisma.orden_trabajo.findUnique({
      where: { id_orden: id },
    });

    if (!orden) {
      throw new NotFoundException(`Orden de trabajo con ID ${id} no encontrada`);
    }

    const tecnico = await this.prisma.usuarios.findUnique({
      where: { id_usuario: asignarDto.id_tecnico },
    });

    if (!tecnico) {
      throw new NotFoundException(
        `Técnico con ID ${asignarDto.id_tecnico} no encontrado`,
      );
    }

    const result = await this.prisma.$transaction(async (prisma) => {
      const ordenActualizada = await prisma.orden_trabajo.update({
        where: { id_orden: id },
        data: {
          id_tecnico_asignado: asignarDto.id_tecnico,
          fecha_asignacion: new Date(),
          estado: 'ASIGNADA',
        },
        include: {
          tecnico_asignado: {
            select: {
              id_usuario: true,
              nombres: true,
              apellidos: true,
            },
          },
        },
      });

      await prisma.ot_historial_estado.create({
        data: {
          id_orden: id,
          estado: 'ASIGNADA',
          comentario: `Asignada a técnico ${tecnico.nombres} ${tecnico.apellidos}`,
          cambiado_por: userId,
        },
      });

      return ordenActualizada;
    });

    await this.prisma.logAction(
      'ASIGNAR_ORDENES_TRABAJO',
      userId,
      `Orden ${orden.codigo} asignada a técnico ${tecnico.nombres} ${tecnico.apellidos}`,
    );

    return result;
  }

  async agendar(id: number, agendarDto: AgendarOrdenDto, userId: number) {
    const orden = await this.prisma.orden_trabajo.findUnique({
      where: { id_orden: id },
      include: {
        tecnico_asignado: true,
      },
    });

    if (!orden) {
      throw new NotFoundException(`Orden de trabajo con ID ${id} no encontrada`);
    }

    const idTecnico = agendarDto.id_tecnico || orden.id_tecnico_asignado;

    if (!idTecnico) {
      throw new BadRequestException(
        'Debe proporcionar un técnico o la orden debe tener un técnico asignado',
      );
    }

    const inicio = new Date(agendarDto.inicio);
    const fin = new Date(agendarDto.fin);

    if (inicio >= fin) {
      throw new BadRequestException(
        'La fecha de inicio debe ser anterior a la fecha de fin',
      );
    }

    const result = await this.prisma.$transaction(async (prisma) => {
      // Marcar agendas anteriores como inactivas
      await prisma.agenda_visitas.updateMany({
        where: {
          id_orden: id,
          activo: true,
        },
        data: {
          activo: false,
        },
      });

      // Crear nueva agenda
      const agenda = await prisma.agenda_visitas.create({
        data: {
          id_orden: id,
          inicio,
          fin,
          id_tecnico: idTecnico,
          activo: true,
          creado_por: userId,
        },
      });

      // Actualizar orden
      const ordenActualizada = await prisma.orden_trabajo.update({
        where: { id_orden: id },
        data: {
          ventana_programada_inicio: inicio,
          ventana_programada_fin: fin,
          id_tecnico_asignado: idTecnico,
          estado: 'AGENDADA',
        },
      });

      // Registrar en historial
      await prisma.ot_historial_estado.create({
        data: {
          id_orden: id,
          estado: 'AGENDADA',
          comentario: `Agendada para ${inicio.toLocaleDateString()} ${inicio.toLocaleTimeString()}`,
          cambiado_por: userId,
        },
      });

      return { orden: ordenActualizada, agenda };
    });

    await this.prisma.logAction(
      'AGENDAR_ORDENES_TRABAJO',
      userId,
      `Orden ${orden.codigo} agendada`,
    );

    return result;
  }

  async reprogramar(
    id: number,
    reprogramarDto: ReprogramarOrdenDto,
    userId: number,
  ) {
    const orden = await this.prisma.orden_trabajo.findUnique({
      where: { id_orden: id },
    });

    if (!orden) {
      throw new NotFoundException(`Orden de trabajo con ID ${id} no encontrada`);
    }

    const inicio = new Date(reprogramarDto.inicio);
    const fin = new Date(reprogramarDto.fin);

    if (inicio >= fin) {
      throw new BadRequestException(
        'La fecha de inicio debe ser anterior a la fecha de fin',
      );
    }

    const result = await this.prisma.$transaction(async (prisma) => {
      // Marcar agenda actual como inactiva
      await prisma.agenda_visitas.updateMany({
        where: {
          id_orden: id,
          activo: true,
        },
        data: {
          activo: false,
        },
      });

      // Crear nueva agenda con motivo
      const agenda = await prisma.agenda_visitas.create({
        data: {
          id_orden: id,
          inicio,
          fin,
          id_tecnico: orden.id_tecnico_asignado,
          motivo: reprogramarDto.motivo,
          activo: true,
          creado_por: userId,
        },
      });

      // Actualizar orden
      const ordenActualizada = await prisma.orden_trabajo.update({
        where: { id_orden: id },
        data: {
          ventana_programada_inicio: inicio,
          ventana_programada_fin: fin,
          estado: 'REPROGRAMADA',
        },
      });

      // Registrar en historial
      await prisma.ot_historial_estado.create({
        data: {
          id_orden: id,
          estado: 'REPROGRAMADA',
          comentario: `Reprogramada: ${reprogramarDto.motivo}`,
          cambiado_por: userId,
        },
      });

      return { orden: ordenActualizada, agenda };
    });

    await this.prisma.logAction(
      'REPROGRAMAR_ORDENES_TRABAJO',
      userId,
      `Orden ${orden.codigo} reprogramada: ${reprogramarDto.motivo}`,
    );

    return result;
  }

  async cambiarEstado(
    id: number,
    cambiarEstadoDto: CambiarEstadoOrdenDto,
    userId: number,
    archivos?: Express.Multer.File[],
  ) {
    const orden = await this.prisma.orden_trabajo.findUnique({
      where: { id_orden: id },
    });

    if (!orden) {
      throw new NotFoundException(`Orden de trabajo con ID ${id} no encontrada`);
    }

    const result = await this.prisma.$transaction(async (prisma) => {
      const ordenActualizada = await prisma.orden_trabajo.update({
        where: { id_orden: id },
        data: {
          estado: cambiarEstadoDto.estado,
        },
      });

      await prisma.ot_historial_estado.create({
        data: {
          id_orden: id,
          estado: cambiarEstadoDto.estado,
          comentario: cambiarEstadoDto.comentario,
          cambiado_por: userId,
        },
      });

      // Procesar y guardar evidencias si se subieron archivos
      if (archivos && archivos.length > 0) {
        for (const archivo of archivos) {
          const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
          const urlArchivo = `${baseUrl}/uploads/evidencias/${archivo.filename}`;

          await prisma.ot_evidencias.create({
            data: {
              id_orden: id,
              tipo: archivo.mimetype.startsWith('image/')
                ? 'FOTO'
                : archivo.mimetype === 'application/pdf'
                  ? 'PDF'
                  : 'OTRO',
              url: urlArchivo,
              metadata: JSON.stringify({
                nombreOriginal: archivo.originalname,
                tamano: archivo.size,
                mimeType: archivo.mimetype,
                contexto: 'CAMBIO_ESTADO',
              }),
              subido_por: userId,
            },
          });
        }
      }

      return ordenActualizada;
    });

    await this.prisma.logAction(
      'CAMBIAR_ESTADO_ORDENES_TRABAJO',
      userId,
      `Orden ${orden.codigo} cambió a estado ${cambiarEstadoDto.estado}${archivos && archivos.length > 0 ? ` con ${archivos.length} evidencia(s)` : ''}`,
    );

    return result;
  }

  async iniciar(id: number, iniciarDto: IniciarOrdenDto, userId: number) {
    const orden = await this.prisma.orden_trabajo.findUnique({
      where: { id_orden: id },
    });

    if (!orden) {
      throw new NotFoundException(`Orden de trabajo con ID ${id} no encontrada`);
    }

    const fechaLlegada = iniciarDto.fecha_llegada
      ? new Date(iniciarDto.fecha_llegada)
      : new Date();
    const fechaInicio = iniciarDto.fecha_inicio_trabajo
      ? new Date(iniciarDto.fecha_inicio_trabajo)
      : new Date();

    const result = await this.prisma.$transaction(async (prisma) => {
      const ordenActualizada = await prisma.orden_trabajo.update({
        where: { id_orden: id },
        data: {
          estado: 'EN_PROGRESO',
          fecha_llegada: fechaLlegada,
          fecha_inicio_trabajo: fechaInicio,
        },
      });

      await prisma.ot_historial_estado.create({
        data: {
          id_orden: id,
          estado: 'EN_PROGRESO',
          comentario: 'Trabajo iniciado',
          cambiado_por: userId,
        },
      });

      return ordenActualizada;
    });

    await this.prisma.logAction(
      'INICIAR_ORDENES_TRABAJO',
      userId,
      `Orden ${orden.codigo} iniciada`,
    );

    return result;
  }

  async cerrar(id: number, cerrarDto: CerrarOrdenDto, userId: number, archivos?: Express.Multer.File[]) {
    const orden = await this.prisma.orden_trabajo.findUnique({
      where: { id_orden: id },
      include: {
        actividades: true,
        evidencias: true,
      },
    });

    if (!orden) {
      throw new NotFoundException(`Orden de trabajo con ID ${id} no encontrada`);
    }

    // Validaciones
    if (orden.actividades.length === 0) {
      throw new BadRequestException(
        'No se puede cerrar la orden sin al menos una actividad registrada',
      );
    }

    // Validar evidencias: deben existir previamente O estar siendo subidas ahora
    const tieneEvidencias = orden.evidencias.length > 0 || (archivos && archivos.length > 0);
    if (!tieneEvidencias) {
      throw new BadRequestException(
        'No se puede cerrar la orden sin al menos una evidencia. Debe subir archivos de evidencia.',
      );
    }

    if (cerrarDto.id_motivo_cierre) {
      const motivo = await this.prisma.motivo_cierre_catalogo.findUnique({
        where: { id_motivo: cerrarDto.id_motivo_cierre },
      });

      if (!motivo) {
        throw new NotFoundException(
          `Motivo de cierre con ID ${cerrarDto.id_motivo_cierre} no encontrado`,
        );
      }
    }

    const estadoFinal =
      cerrarDto.resultado === 'RESUELTO' ||
        cerrarDto.resultado === 'NO_RESUELTO'
        ? 'COMPLETADA'
        : 'CANCELADA';

    const result = await this.prisma.$transaction(async (prisma) => {
      const ordenActualizada = await prisma.orden_trabajo.update({
        where: { id_orden: id },
        data: {
          estado: estadoFinal,
          resultado: cerrarDto.resultado,
          id_motivo_cierre: cerrarDto.id_motivo_cierre,
          notas_cierre: cerrarDto.notas_cierre,
          calificacion_cliente: cerrarDto.calificacion_cliente,
          fecha_fin_trabajo: new Date(),
        },
        include: {
          cliente: true,
          tecnico_asignado: true,
          motivo_cierre: true,
        },
      });

      await prisma.ot_historial_estado.create({
        data: {
          id_orden: id,
          estado: estadoFinal,
          comentario: `Cerrada con resultado: ${cerrarDto.resultado}`,
          cambiado_por: userId,
        },
      });

      // Procesar y guardar evidencias de cierre si se subieron archivos
      if (archivos && archivos.length > 0) {
        for (const archivo of archivos) {
          const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
          const urlArchivo = `${baseUrl}/uploads/evidencias/${archivo.filename}`;

          await prisma.ot_evidencias.create({
            data: {
              id_orden: id,
              tipo: archivo.mimetype.startsWith('image/')
                ? 'FOTO'
                : archivo.mimetype === 'application/pdf'
                  ? 'PDF'
                  : 'OTRO',
              url: urlArchivo,
              metadata: JSON.stringify({
                nombreOriginal: archivo.originalname,
                tamano: archivo.size,
                mimeType: archivo.mimetype,
                contexto: 'CIERRE_ORDEN',
              }),
              subido_por: userId,
            },
          });
        }
      }

      return ordenActualizada;
    });

    await this.prisma.logAction(
      'CERRAR_ORDENES_TRABAJO',
      userId,
      `Orden ${orden.codigo} cerrada con resultado ${cerrarDto.resultado}`,
    );

    return result;
  }

  // === Actividades ===

  async createActividad(
    idOrden: number,
    createActividadDto: CreateActividadDto,
    userId: number,
  ) {
    const orden = await this.prisma.orden_trabajo.findUnique({
      where: { id_orden: idOrden },
    });

    if (!orden) {
      throw new NotFoundException(
        `Orden de trabajo con ID ${idOrden} no encontrada`,
      );
    }

    if (createActividadDto.id_solucion) {
      const solucion = await this.prisma.solucion_catalogo.findUnique({
        where: { id_solucion: createActividadDto.id_solucion },
      });

      if (!solucion) {
        throw new NotFoundException(
          `Solución con ID ${createActividadDto.id_solucion} no encontrada`,
        );
      }
    }

    const result = await this.prisma.$transaction(async (prisma) => {
      const actividad = await prisma.ot_actividades.create({
        data: {
          id_orden: idOrden,
          ...createActividadDto,
        },
        include: {
          solucion: true,
        },
      });

      // Registrar en historial
      await prisma.ot_historial_estado.create({
        data: {
          id_orden: idOrden,
          estado: orden.estado,
          comentario: `Actividad agregada: ${createActividadDto.descripcion.substring(0, 100)}${createActividadDto.descripcion.length > 100 ? '...' : ''}`,
          cambiado_por: userId,
        },
      });

      return actividad;
    });

    await this.prisma.logAction(
      'CREAR_OT_ACTIVIDADES',
      userId,
      `Actividad creada en orden ${orden.codigo}`,
    );

    return result;
  }

  async updateActividad(
    idOrden: number,
    idActividad: number,
    updateActividadDto: UpdateActividadDto,
    userId: number,
  ) {
    const actividad = await this.prisma.ot_actividades.findFirst({
      where: {
        id_actividad: idActividad,
        id_orden: idOrden,
      },
      include: {
        orden: true,
      },
    });

    if (!actividad) {
      throw new NotFoundException(
        `Actividad con ID ${idActividad} no encontrada en la orden ${idOrden}`,
      );
    }

    const result = await this.prisma.$transaction(async (prisma) => {
      const actividadActualizada = await prisma.ot_actividades.update({
        where: { id_actividad: idActividad },
        data: updateActividadDto,
        include: {
          solucion: true,
        },
      });

      // Registrar en historial
      await prisma.ot_historial_estado.create({
        data: {
          id_orden: idOrden,
          estado: actividad.orden.estado,
          comentario: `Actividad actualizada: ${actividad.descripcion.substring(0, 100)}${actividad.descripcion.length > 100 ? '...' : ''}`,
          cambiado_por: userId,
        },
      });

      return actividadActualizada;
    });

    await this.prisma.logAction(
      'ACTUALIZAR_OT_ACTIVIDADES',
      userId,
      `Actividad ${idActividad} actualizada`,
    );

    return result;
  }

  // === Materiales ===

  async createMaterial(
    idOrden: number,
    createMaterialDto: CreateMaterialDto,
    userId: number,
  ) {
    const orden = await this.prisma.orden_trabajo.findUnique({
      where: { id_orden: idOrden },
    });

    if (!orden) {
      throw new NotFoundException(
        `Orden de trabajo con ID ${idOrden} no encontrada`,
      );
    }

    const { serie, ...materialData } = createMaterialDto;

    const result = await this.prisma.$transaction(async (prisma) => {
      let idSerie: number | undefined = undefined;

      if (serie) {
        const inventarioSerie = await prisma.inventario_series.findUnique({
          where: { numero_serie: serie },
        });

        if (!inventarioSerie) {
          throw new NotFoundException(`Serie con número ${serie} no encontrada.`);
        }
        idSerie = inventarioSerie.id_serie;
      }

      const material = await prisma.ot_materiales.create({
        data: {
          id_orden: idOrden,
          ...materialData,
          id_serie: idSerie,
        },
      });

      // Registrar en historial
      await prisma.ot_historial_estado.create({
        data: {
          id_orden: idOrden,
          estado: orden.estado,
          comentario: `Material agregado: ${createMaterialDto.nombre} (Cantidad: ${createMaterialDto.cantidad})`,
          cambiado_por: userId,
        },
      });

      return material;
    });

    await this.prisma.logAction(
      'CREAR_OT_MATERIALES',
      userId,
      `Material ${createMaterialDto.nombre} agregado a orden ${orden.codigo}`,
    );

    return result;
  }

  async deleteMaterial(idOrden: number, idMaterial: number, userId: number) {
    const material = await this.prisma.ot_materiales.findFirst({
      where: {
        id_material: idMaterial,
        id_orden: idOrden,
      },
      include: {
        orden: true,
      },
    });

    if (!material) {
      throw new NotFoundException(
        `Material con ID ${idMaterial} no encontrado en la orden ${idOrden}`,
      );
    }

    await this.prisma.$transaction(async (prisma) => {
      await prisma.ot_materiales.delete({
        where: { id_material: idMaterial },
      });

      // Registrar en historial
      await prisma.ot_historial_estado.create({
        data: {
          id_orden: idOrden,
          estado: material.orden.estado,
          comentario: `Material eliminado: ${material.nombre} (Cantidad: ${material.cantidad})`,
          cambiado_por: userId,
        },
      });
    });

    await this.prisma.logAction(
      'ELIMINAR_OT_MATERIALES',
      userId,
      `Material ${material.nombre} eliminado de orden ${material.orden.codigo}`,
    );

    return { message: 'Material eliminado exitosamente' };
  }

  // === Evidencias ===

  async createEvidencia(
    idOrden: number,
    createEvidenciaDto: CreateEvidenciaDto,
    userId: number,
  ) {
    const orden = await this.prisma.orden_trabajo.findUnique({
      where: { id_orden: idOrden },
    });

    if (!orden) {
      throw new NotFoundException(
        `Orden de trabajo con ID ${idOrden} no encontrada`,
      );
    }

    const result = await this.prisma.$transaction(async (prisma) => {
      const evidencia = await prisma.ot_evidencias.create({
        data: {
          id_orden: idOrden,
          ...createEvidenciaDto,
        },
      });

      // Registrar en historial
      await prisma.ot_historial_estado.create({
        data: {
          id_orden: idOrden,
          estado: orden.estado,
          comentario: `Evidencia agregada: ${createEvidenciaDto.tipo}`,
          cambiado_por: userId,
        },
      });

      return evidencia;
    });

    await this.prisma.logAction(
      'CREAR_OT_EVIDENCIAS',
      userId,
      `Evidencia tipo ${createEvidenciaDto.tipo} agregada a orden ${orden.codigo}`,
    );

    return result;
  }

  async getEvidencias(idOrden: number) {
    const orden = await this.prisma.orden_trabajo.findUnique({
      where: { id_orden: idOrden },
    });

    if (!orden) {
      throw new NotFoundException(
        `Orden de trabajo con ID ${idOrden} no encontrada`,
      );
    }

    return this.prisma.ot_evidencias.findMany({
      where: { id_orden: idOrden },
      orderBy: {
        fecha_subida: 'asc',
      },
    });
  }
}
