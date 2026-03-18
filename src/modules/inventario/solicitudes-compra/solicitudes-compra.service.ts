import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSolicitudCompraDto } from './dto/create-solicitud-compra.dto';
import { UpdateSolicitudCompraDto } from './dto/update-solicitud-compra.dto';
import { FilterSolicitudCompraDto } from './dto/filter-solicitud-compra.dto';
import { AutorizarSolicitudCompraDto } from './dto/autorizar-solicitud-compra.dto';
import { RechazarSolicitudCompraDto } from './dto/rechazar-solicitud-compra.dto';
import { CancelarSolicitudCompraDto } from './dto/cancelar-solicitud-compra.dto';
import { usuarios } from '@prisma/client';

@Injectable()
export class SolicitudesCompraService {
  constructor(private prisma: PrismaService) {}

  // =============================================
  // Includes reutilizables
  // =============================================

  private readonly includeBasico = {
    sucursal: {
      select: {
        id_sucursal: true,
        nombre: true,
      },
    },
    bodega: {
      select: {
        id_bodega: true,
        nombre: true,
      },
    },
    usuario_solicita: {
      select: {
        id_usuario: true,
        nombres: true,
        apellidos: true,
        usuario: true,
      },
    },
    usuario_revisa: {
      select: {
        id_usuario: true,
        nombres: true,
        apellidos: true,
        usuario: true,
      },
    },
  };

  private readonly includeCompleto = {
    ...this.includeBasico,
    detalle: {
      include: {
        catalogo: true,
      },
    },
    cotizaciones: {
      select: {
        id_cotizacion_compra: true,
        estado: true,
        total: true,
        fecha_creacion: true,
        proveedor: {
          select: {
            id_proveedor: true,
            nombre_razon_social: true,
            nombre_comercial: true,
          },
        },
      },
    },
    ordenes_compra: {
      select: {
        id_orden_compra: true,
        codigo: true,
        estado: true,
        total: true,
        fecha_creacion: true,
      },
    },
  };

  // =============================================
  // Generación de código
  // =============================================

  private async generarCodigo(): Promise<string> {
    const fecha = new Date();
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const prefix = `SC-${year}${month}-`;

    const ultimaSolicitud = await this.prisma.solicitudes_compra.findFirst({
      where: {
        codigo: {
          startsWith: prefix,
        },
      },
      orderBy: {
        codigo: 'desc',
      },
    });

    let numero = 1;
    if (ultimaSolicitud) {
      const ultimoNumero = parseInt(ultimaSolicitud.codigo.split('-')[2]);
      numero = ultimoNumero + 1;
    }

    return `${prefix}${String(numero).padStart(5, '0')}`;
  }

  // =============================================
  // CRUD
  // =============================================

  async create(dto: CreateSolicitudCompraDto, user: usuarios) {
    // Validar catálogos si se proporcionan
    for (const item of dto.detalle) {
      if (item.id_catalogo) {
        const producto = await this.prisma.catalogo.findUnique({
          where: { id_catalogo: item.id_catalogo },
        });
        if (!producto) {
          throw new NotFoundException(
            `Producto con ID ${item.id_catalogo} no encontrado`,
          );
        }
      }
    }

    const codigo = await this.generarCodigo();

    const solicitud = await this.prisma.solicitudes_compra.create({
      data: {
        codigo,
        estado: 'BORRADOR',
        prioridad: (dto.prioridad as any) || 'MEDIA',
        motivo: dto.motivo,
        id_sucursal: dto.id_sucursal,
        id_bodega: dto.id_bodega,
        observaciones: dto.observaciones,
        id_usuario_solicita: user.id_usuario,
        detalle: {
          create: dto.detalle.map((item) => ({
            id_catalogo: item.id_catalogo,
            codigo: item.codigo,
            nombre: item.nombre,
            descripcion: item.descripcion,
            tiene_serie: item.tiene_serie || false,
            afecta_inventario: item.afecta_inventario ?? true,
            cantidad_solicitada: item.cantidad_solicitada,
            costo_estimado: item.costo_estimado,
            observaciones: item.observaciones,
          })),
        },
      },
      include: this.includeCompleto,
    });

    await this.prisma.logAction(
      'CREAR_SOLICITUD_COMPRA',
      user.id_usuario,
      `Solicitud de compra creada: ${codigo}`,
    );

    return solicitud;
  }

  async findAll(filters: FilterSolicitudCompraDto) {
    const { page = 1, limit = 10 } = filters;
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    if (filters.estado) {
      whereClause.estado = filters.estado;
    }

    if (filters.prioridad) {
      whereClause.prioridad = filters.prioridad;
    }

    if (filters.search) {
      whereClause.OR = [
        { codigo: { contains: filters.search, mode: 'insensitive' } },
        { motivo: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.fecha_desde || filters.fecha_hasta) {
      whereClause.fecha_creacion = {};
      if (filters.fecha_desde) {
        whereClause.fecha_creacion.gte = new Date(filters.fecha_desde);
      }
      if (filters.fecha_hasta) {
        whereClause.fecha_creacion.lte = new Date(filters.fecha_hasta);
      }
    }

    const [solicitudes, total] = await Promise.all([
      this.prisma.solicitudes_compra.findMany({
        where: whereClause,
        skip,
        take: limit,
        include: {
          ...this.includeBasico,
          detalle: {
            include: {
              catalogo: true,
            },
          },
          _count: {
            select: {
              cotizaciones: true,
              ordenes_compra: true,
            },
          },
        },
        orderBy: {
          fecha_creacion: 'desc',
        },
      }),
      this.prisma.solicitudes_compra.count({ where: whereClause }),
    ]);

    return {
      data: solicitudes,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const solicitud = await this.prisma.solicitudes_compra.findUnique({
      where: { id_solicitud_compra: id },
      include: this.includeCompleto,
    });

    if (!solicitud) {
      throw new NotFoundException(
        `Solicitud de compra con ID ${id} no encontrada`,
      );
    }

    return solicitud;
  }

  async getEstadisticas() {
    const [
      total,
      borradores,
      pendientesRevision,
      autorizadas,
      enCotizacion,
      cotizacionAprobada,
      rechazadas,
      canceladas,
    ] = await Promise.all([
      this.prisma.solicitudes_compra.count(),
      this.prisma.solicitudes_compra.count({
        where: { estado: 'BORRADOR' },
      }),
      this.prisma.solicitudes_compra.count({
        where: { estado: 'PENDIENTE_REVISION' },
      }),
      this.prisma.solicitudes_compra.count({
        where: { estado: 'AUTORIZADA' },
      }),
      this.prisma.solicitudes_compra.count({
        where: { estado: 'EN_COTIZACION' },
      }),
      this.prisma.solicitudes_compra.count({
        where: { estado: 'COTIZACION_APROBADA' },
      }),
      this.prisma.solicitudes_compra.count({
        where: { estado: 'RECHAZADA' },
      }),
      this.prisma.solicitudes_compra.count({
        where: { estado: 'CANCELADA' },
      }),
    ]);

    return {
      total,
      borradores,
      pendientesRevision,
      autorizadas,
      enCotizacion,
      cotizacionAprobada,
      rechazadas,
      canceladas,
    };
  }

  async update(id: number, dto: UpdateSolicitudCompraDto, user: usuarios) {
    const solicitudExistente = await this.findOne(id);

    if (solicitudExistente.estado !== 'BORRADOR') {
      throw new BadRequestException(
        'Solo se pueden modificar solicitudes en estado BORRADOR',
      );
    }

    // Si se actualizan detalles, validar catálogos
    if (dto.detalle) {
      for (const item of dto.detalle) {
        if (item.id_catalogo) {
          const producto = await this.prisma.catalogo.findUnique({
            where: { id_catalogo: item.id_catalogo },
          });
          if (!producto) {
            throw new NotFoundException(
              `Producto con ID ${item.id_catalogo} no encontrado`,
            );
          }
        }
      }

      // Eliminar detalles existentes
      await this.prisma.solicitudes_compra_detalle.deleteMany({
        where: { id_solicitud_compra: id },
      });
    }

    const solicitudActualizada = await this.prisma.solicitudes_compra.update({
      where: { id_solicitud_compra: id },
      data: {
        prioridad: dto.prioridad ? (dto.prioridad as any) : undefined,
        motivo: dto.motivo,
        id_sucursal: dto.id_sucursal,
        id_bodega: dto.id_bodega,
        observaciones: dto.observaciones,
        detalle: dto.detalle
          ? {
              create: dto.detalle.map((item) => ({
                id_catalogo: item.id_catalogo,
                codigo: item.codigo,
                nombre: item.nombre,
                descripcion: item.descripcion,
                tiene_serie: item.tiene_serie || false,
                afecta_inventario: item.afecta_inventario ?? true,
                cantidad_solicitada: item.cantidad_solicitada,
                costo_estimado: item.costo_estimado,
                observaciones: item.observaciones,
              })),
            }
          : undefined,
      },
      include: this.includeCompleto,
    });

    await this.prisma.logAction(
      'ACTUALIZAR_SOLICITUD_COMPRA',
      user.id_usuario,
      `Solicitud de compra actualizada: ${solicitudExistente.codigo}`,
    );

    return solicitudActualizada;
  }

  async remove(id: number, user: usuarios) {
    const solicitud = await this.findOne(id);

    if (solicitud.estado !== 'BORRADOR' && solicitud.estado !== 'CANCELADA') {
      throw new BadRequestException(
        'Solo se pueden eliminar solicitudes en estado BORRADOR o CANCELADA',
      );
    }

    await this.prisma.solicitudes_compra.delete({
      where: { id_solicitud_compra: id },
    });

    await this.prisma.logAction(
      'ELIMINAR_SOLICITUD_COMPRA',
      user.id_usuario,
      `Solicitud de compra eliminada: ${solicitud.codigo}`,
    );

    return { message: 'Solicitud de compra eliminada exitosamente' };
  }

  // =============================================
  // Workflow
  // =============================================

  async enviarRevision(id: number, user: usuarios) {
    const solicitud = await this.findOne(id);

    if (solicitud.estado !== 'BORRADOR') {
      throw new BadRequestException(
        'Solo se pueden enviar a revisión solicitudes en estado BORRADOR',
      );
    }

    if (solicitud.detalle.length === 0) {
      throw new BadRequestException(
        'La solicitud debe tener al menos un producto/servicio',
      );
    }

    const solicitudActualizada = await this.prisma.solicitudes_compra.update({
      where: { id_solicitud_compra: id },
      data: {
        estado: 'PENDIENTE_REVISION',
      },
      include: this.includeCompleto,
    });

    await this.prisma.logAction(
      'ENVIAR_REVISION_SOLICITUD_COMPRA',
      user.id_usuario,
      `Solicitud de compra enviada a revisión: ${solicitud.codigo}`,
    );

    return solicitudActualizada;
  }

  async autorizar(id: number, dto: AutorizarSolicitudCompraDto, user: usuarios) {
    const solicitud = await this.findOne(id);

    if (solicitud.estado !== 'PENDIENTE_REVISION') {
      throw new BadRequestException(
        'Solo se pueden autorizar solicitudes en estado PENDIENTE_REVISION',
      );
    }

    // Actualizar cantidades aprobadas por ítem
    if (dto.cantidades_aprobadas && dto.cantidades_aprobadas.length > 0) {
      for (const item of dto.cantidades_aprobadas) {
        await this.prisma.solicitudes_compra_detalle.update({
          where: { id_solicitud_compra_detalle: item.id_solicitud_compra_detalle },
          data: { cantidad_aprobada: item.cantidad_aprobada },
        });
      }
    } else {
      // Si no se proporcionan cantidades aprobadas, copiar cantidad_solicitada
      await this.prisma.solicitudes_compra_detalle.updateMany({
        where: { id_solicitud_compra: id },
        data: {}, // No podemos usar updateMany con campo calculado, se hace uno por uno
      });

      // Actualizar cada detalle individualmente
      for (const detalle of solicitud.detalle) {
        await this.prisma.solicitudes_compra_detalle.update({
          where: { id_solicitud_compra_detalle: detalle.id_solicitud_compra_detalle },
          data: { cantidad_aprobada: detalle.cantidad_solicitada },
        });
      }
    }

    const solicitudAutorizada = await this.prisma.solicitudes_compra.update({
      where: { id_solicitud_compra: id },
      data: {
        estado: 'AUTORIZADA',
        id_usuario_revisa: user.id_usuario,
        observaciones_revision: dto.observaciones_revision,
        fecha_revision: new Date(),
      },
      include: this.includeCompleto,
    });

    await this.prisma.logAction(
      'AUTORIZAR_SOLICITUD_COMPRA',
      user.id_usuario,
      `Solicitud de compra autorizada: ${solicitud.codigo}`,
    );

    return solicitudAutorizada;
  }

  async rechazar(id: number, dto: RechazarSolicitudCompraDto, user: usuarios) {
    const solicitud = await this.findOne(id);

    if (solicitud.estado !== 'PENDIENTE_REVISION') {
      throw new BadRequestException(
        'Solo se pueden rechazar solicitudes en estado PENDIENTE_REVISION',
      );
    }

    const solicitudRechazada = await this.prisma.solicitudes_compra.update({
      where: { id_solicitud_compra: id },
      data: {
        estado: 'RECHAZADA',
        id_usuario_revisa: user.id_usuario,
        motivo_rechazo: dto.motivo_rechazo,
        observaciones_revision: dto.observaciones_revision,
        fecha_revision: new Date(),
      },
      include: this.includeCompleto,
    });

    await this.prisma.logAction(
      'RECHAZAR_SOLICITUD_COMPRA',
      user.id_usuario,
      `Solicitud de compra rechazada: ${solicitud.codigo}. Motivo: ${dto.motivo_rechazo}`,
    );

    return solicitudRechazada;
  }

  async reabrir(id: number, user: usuarios) {
    const solicitud = await this.findOne(id);

    if (solicitud.estado !== 'RECHAZADA') {
      throw new BadRequestException(
        'Solo se pueden reabrir solicitudes en estado RECHAZADA',
      );
    }

    const solicitudReabierta = await this.prisma.solicitudes_compra.update({
      where: { id_solicitud_compra: id },
      data: {
        estado: 'BORRADOR',
        motivo_rechazo: null,
        id_usuario_revisa: null,
        observaciones_revision: null,
        fecha_revision: null,
      },
      include: this.includeCompleto,
    });

    await this.prisma.logAction(
      'REABRIR_SOLICITUD_COMPRA',
      user.id_usuario,
      `Solicitud de compra reabierta: ${solicitud.codigo}`,
    );

    return solicitudReabierta;
  }

  async iniciarCotizacion(id: number, user: usuarios) {
    const solicitud = await this.findOne(id);

    if (solicitud.estado !== 'AUTORIZADA') {
      throw new BadRequestException(
        'Solo se pueden iniciar cotizaciones de solicitudes en estado AUTORIZADA',
      );
    }

    const solicitudActualizada = await this.prisma.solicitudes_compra.update({
      where: { id_solicitud_compra: id },
      data: {
        estado: 'EN_COTIZACION',
      },
      include: this.includeCompleto,
    });

    await this.prisma.logAction(
      'INICIAR_COTIZACION_SOLICITUD_COMPRA',
      user.id_usuario,
      `Solicitud de compra en cotización: ${solicitud.codigo}`,
    );

    return solicitudActualizada;
  }

  async cancelar(id: number, dto: CancelarSolicitudCompraDto, user: usuarios) {
    const solicitud = await this.findOne(id);

    if (solicitud.estado === 'CANCELADA') {
      throw new BadRequestException(
        'La solicitud ya se encuentra cancelada',
      );
    }

    const solicitudCancelada = await this.prisma.solicitudes_compra.update({
      where: { id_solicitud_compra: id },
      data: {
        estado: 'CANCELADA',
        observaciones: dto.motivo
          ? `${solicitud.observaciones ? solicitud.observaciones + ' | ' : ''}Cancelada: ${dto.motivo}`
          : solicitud.observaciones,
      },
      include: this.includeCompleto,
    });

    await this.prisma.logAction(
      'CANCELAR_SOLICITUD_COMPRA',
      user.id_usuario,
      `Solicitud de compra cancelada: ${solicitud.codigo}${dto.motivo ? '. Motivo: ' + dto.motivo : ''}`,
    );

    return solicitudCancelada;
  }
}
