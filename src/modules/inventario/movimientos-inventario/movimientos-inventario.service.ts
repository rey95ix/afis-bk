import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { FilterMovimientoInventarioDto } from './dto/filter-movimiento-inventario.dto';

interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class MovimientosInventarioService {
  constructor(private readonly prisma: PrismaService) { }

  async findAll(
    filterDto: FilterMovimientoInventarioDto,
  ) {
    const {
      page = 1,
      limit = 10,
      fecha_desde,
      fecha_hasta,
      tipo,
      id_catalogo,
      id_bodega_origen,
      id_bodega_destino,
      id_usuario,
    } = filterDto;

    const skip = (page - 1) * limit;
    const where: any = {};

    // Filter by tipo_movimiento
    if (tipo) {
      where.tipo = tipo;
    }

    // Filter by catalogo
    if (id_catalogo) {
      where.id_catalogo = id_catalogo;
    }

    // Filter by bodega_origen
    if (id_bodega_origen) {
      where.id_bodega_origen = id_bodega_origen;
    }

    // Filter by bodega_destino
    if (id_bodega_destino) {
      where.id_bodega_destino = id_bodega_destino;
    }

    // Filter by usuario
    if (id_usuario) {
      where.id_usuario = id_usuario;
    }

    // Date range filter
    if (fecha_desde || fecha_hasta) {
      where.fecha_movimiento = {};
      if (fecha_desde) {
        where.fecha_movimiento.gte = new Date(fecha_desde);
      }
      if (fecha_hasta) {
        // Add 23:59:59 to include the entire end date
        const fechaHastaEnd = new Date(fecha_hasta);
        fechaHastaEnd.setHours(23, 59, 59, 999);
        where.fecha_movimiento.lte = fechaHastaEnd;
      }
    }

    // Execute query with pagination
    const [data, total] = await Promise.all([
      this.prisma.movimientos_inventario.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fecha_movimiento: 'desc' },
        include: {
          catalogo: {
            select: {
              id_catalogo: true,
              codigo: true,
              nombre: true,
              descripcion: true,
              categoria: {
                select: {
                  id_categoria: true,
                  nombre: true,
                  codigo: true,
                },
              },
            },
          },
          bodega_origen: {
            select: {
              id_bodega: true,
              nombre: true,
              tipo: true,
              sucursal: {
                select: {
                  id_sucursal: true,
                  nombre: true,
                },
              },
            },
          },
          bodega_destino: {
            select: {
              id_bodega: true,
              nombre: true,
              tipo: true,
              sucursal: {
                select: {
                  id_sucursal: true,
                  nombre: true,
                },
              },
            },
          },
          usuario: {
            select: {
              id_usuario: true,
              nombres: true,
              apellidos: true,
              usuario: true,
            },
          },
          compra: {
            select: {
              id_compras: true,
              numero_factura: true,
              proveedor: {
                select: {
                  id_proveedor: true,
                  nombre_razon_social: true,
                },
              },
            },
          },
          importacion: {
            select: {
              id_importacion: true,
              numero_orden: true,
              proveedor: {
                select: {
                  id_proveedor: true,
                  nombre_razon_social: true,
                },
              },
            },
          },
          orden_trabajo: {
            select: {
              id_orden: true,
              codigo: true,
              cliente: {
                select: {
                  id_cliente: true,
                  titular: true,
                },
              },
            },
          },
          orden_salida: {
            select: {
              id_orden_salida: true,
              codigo: true,
              tipo: true,
            },
          },
        },
      }),
      this.prisma.movimientos_inventario.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: { total, page, limit, totalPages },
    };
  }

  async findOne(id: number) {
    const movimiento = await this.prisma.movimientos_inventario.findUnique({
      where: { id_movimiento: id },
      include: {
        catalogo: {
          select: {
            id_catalogo: true,
            codigo: true,
            nombre: true,
            descripcion: true,
            categoria: {
              select: {
                id_categoria: true,
                nombre: true,
                codigo: true,
              },
            },
          },
        },
        bodega_origen: {
          select: {
            id_bodega: true,
            nombre: true,
            tipo: true,
            sucursal: {
              select: {
                id_sucursal: true,
                nombre: true,
              },
            },
          },
        },
        bodega_destino: {
          select: {
            id_bodega: true,
            nombre: true,
            tipo: true,
            sucursal: {
              select: {
                id_sucursal: true,
                nombre: true,
              },
            },
          },
        },
        usuario: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
            usuario: true,
          },
        },
        compra: {
          select: {
            id_compras: true,
            numero_factura: true,
            fecha_factura: true,
            proveedor: {
              select: {
                id_proveedor: true,
                nombre_razon_social: true,
              },
            },
          },
        },
        importacion: {
          select: {
            id_importacion: true,
            numero_orden: true,
            fecha_orden: true,
            proveedor: {
              select: {
                id_proveedor: true,
                nombre_razon_social: true,
              },
            },
          },
        },
        orden_trabajo: {
          select: {
            id_orden: true,
            codigo: true,
            tipo: true,
            cliente: {
              select: {
                id_cliente: true,
                titular: true,
              },
            },
          },
        },
        orden_salida: {
          select: {
            id_orden_salida: true,
            codigo: true,
            tipo: true,
            motivo: true,
          },
        },
      },
    });

    if (!movimiento) {
      throw new NotFoundException(
        `Movimiento de inventario con ID ${id} no encontrado`,
      );
    }

    return movimiento;
  }
}
