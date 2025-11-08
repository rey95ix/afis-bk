import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import {
  QueryInventarioDto,
  QueryMovimientosDto,
  QuerySeriesDto,
} from './dto';
import { PaginatedResult } from 'src/common/dto';

@Injectable()
export class ItemsInventarioService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista items del inventario con filtros y paginación
   */
  async findAll(queryDto: QueryInventarioDto): Promise<PaginatedResult<any>> {
    const {
      page = 1,
      limit = 10,
      search = '',
      id_bodega,
      id_estante,
      id_categoria,
      estado,
      stock_bajo,
    } = queryDto;

    const skip = (page - 1) * limit;

    // Construir filtro para inventario
    const inventarioWhere: any = {};

    if (id_bodega) {
      inventarioWhere.id_bodega = +id_bodega;
    }

    if (id_estante) {
      inventarioWhere.id_estante = +id_estante;
    }

    if (estado) {
      inventarioWhere.estado = estado;
    }

    // El filtro de stock bajo se aplicará después de la consulta
    // porque requiere comparar campos dinámicamente

    // Construir filtro para catálogo (búsqueda y categoría)
    const catalogoWhere: any = {};

    if (search) {
      catalogoWhere.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { codigo: { contains: search, mode: 'insensitive' } },
        { descripcion: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (id_categoria) {
      catalogoWhere.id_categoria = +id_categoria;
    }

    // Si hay filtros de catálogo, agregarlo al where principal
    if (Object.keys(catalogoWhere).length > 0) {
      inventarioWhere.catalogo = catalogoWhere;
    }

    // Consultar inventario con relaciones
    let data = await this.prisma.inventario.findMany({
      where: inventarioWhere,
      include: {
        catalogo: {
          include: {
            categoria: true,
          },
        },
        bodega: {
          include: {
            sucursal: true,
          },
        },
        estante: true,
        series: {
          where: { estado: 'DISPONIBLE' },
          take: 5, // Solo las primeras 5 series disponibles
        },
      },
      orderBy: { fecha_creacion: 'desc' },
    });

    // Aplicar filtro de stock bajo si es necesario
    if (stock_bajo) {
      data = data.filter(
        (item) =>
          item.catalogo.cantidad_minima &&
          item.cantidad_disponible <= item.catalogo.cantidad_minima,
      );
    }

    // Aplicar paginación después del filtro
    const total = data.length;
    data = data.slice(skip, skip + limit);

    // Transformar datos para incluir información calculada
    const dataTransformada = data.map((item) => ({
      ...item,
      cantidad_total: item.cantidad_disponible + item.cantidad_reservada,
      porcentaje_disponible:
        item.cantidad_disponible + item.cantidad_reservada > 0
          ? (
              (item.cantidad_disponible /
                (item.cantidad_disponible + item.cantidad_reservada)) *
              100
            ).toFixed(2)
          : 0,
      alerta_stock_bajo:
        item.catalogo.cantidad_minima && item.cantidad_disponible <= item.catalogo.cantidad_minima,
      total_series: item.series.length,
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      data: dataTransformada,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Obtener detalle de un item del inventario
   */
  async findOne(id: number): Promise<any> {
    const inventario = await this.prisma.inventario.findUnique({
      where: { id_inventario: id },
      include: {
        catalogo: {
          include: {
            categoria: true,
          },
        },
        bodega: {
          include: {
            sucursal: true,
            responsable: {
              select: {
                id_usuario: true,
                nombres: true,
                apellidos: true,
              },
            },
          },
        },
        estante: true,
        series: {
          include: {
            cliente: {
              select: {
                id_cliente: true,
                titular: true,
              },
            },
            orden_trabajo: {
              select: {
                id_orden: true,
                codigo: true,
              },
            },
          },
        },
      },
    });

    if (!inventario) {
      throw new NotFoundException(`Inventario con ID ${id} no encontrado`);
    }

    // Calcular totales de series por estado
    const seriesPorEstado = await this.prisma.inventario_series.groupBy({
      by: ['estado'],
      where: { id_inventario: id },
      _count: { id_serie: true },
    });

    return {
      ...inventario,
      cantidad_total:
        inventario.cantidad_disponible + inventario.cantidad_reservada,
      alerta_stock_bajo:
        inventario.catalogo.cantidad_minima &&
        inventario.cantidad_disponible <= inventario.catalogo.cantidad_minima,
      series_por_estado: seriesPorEstado.map((s) => ({
        estado: s.estado,
        cantidad: s._count.id_serie,
      })),
    };
  }

  /**
   * Obtener series de un item del inventario
   */
  async findSeries(
    id_inventario: number,
    queryDto: QuerySeriesDto,
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 10, estado, search } = queryDto;
    const skip = (page - 1) * limit;

    // Verificar que el inventario existe
    await this.findOne(id_inventario);

    const where: any = {
      id_inventario,
    };

    if (estado) {
      where.estado = estado;
    }

    if (search) {
      where.OR = [
        { numero_serie: { contains: search, mode: 'insensitive' } },
        { mac_address: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.inventario_series.findMany({
        where,
        include: {
          cliente: {
            select: {
              id_cliente: true,
              titular: true,
              telefono1: true,
            },
          },
          orden_trabajo: {
            select: {
              id_orden: true,
              codigo: true,
              estado: true,
            },
          },
          compra_detalle: {
            select: {
              id_compras_detalle: true,
              Compras: {
                select: {
                  id_compras: true,
                  numero_factura: true,
                  fecha_factura: true,
                },
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { fecha_ingreso: 'desc' },
      }),
      this.prisma.inventario_series.count({ where }),
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

  /**
   * Obtener distribución del inventario
   */
  async getDistribucion(): Promise<any> {
    // Distribución por bodega
    const porBodega = await this.prisma.inventario.groupBy({
      by: ['id_bodega'],
      where: { estado: 'ACTIVO' },
      _sum: {
        cantidad_disponible: true,
        cantidad_reservada: true,
      },
      _count: {
        id_inventario: true,
      },
    });

    // Obtener nombres de bodegas
    const bodegasIds = porBodega.map((b) => b.id_bodega);
    const bodegas = await this.prisma.bodegas.findMany({
      where: { id_bodega: { in: bodegasIds } },
      select: {
        id_bodega: true,
        nombre: true,
        tipo: true,
        sucursal: {
          select: {
            nombre: true,
          },
        },
      },
    });

    const distribucionPorBodega = porBodega.map((item) => {
      const bodega = bodegas.find((b) => b.id_bodega === item.id_bodega);
      return {
        id_bodega: item.id_bodega,
        nombre_bodega: bodega?.nombre,
        tipo_bodega: bodega?.tipo,
        nombre_sucursal: bodega?.sucursal?.nombre,
        cantidad_items: item._count.id_inventario,
        cantidad_disponible: item._sum.cantidad_disponible || 0,
        cantidad_reservada: item._sum.cantidad_reservada || 0,
        cantidad_total:
          (item._sum.cantidad_disponible || 0) +
          (item._sum.cantidad_reservada || 0),
      };
    });

    // Distribución por categoría
    const porCategoria = await this.prisma.inventario.groupBy({
      by: ['id_catalogo'],
      where: { estado: 'ACTIVO' },
      _sum: {
        cantidad_disponible: true,
        cantidad_reservada: true,
      },
    });

    // Obtener información de catálogo y categoría
    const catalogoIds = porCategoria.map((c) => c.id_catalogo);
    const catalogos = await this.prisma.catalogo.findMany({
      where: { id_catalogo: { in: catalogoIds } },
      include: {
        categoria: true,
      },
    });

    const distribucionPorCategoria = porCategoria.map((item) => {
      const catalogo = catalogos.find((c) => c.id_catalogo === item.id_catalogo);
      return {
        id_catalogo: item.id_catalogo,
        nombre_item: catalogo?.nombre,
        codigo_item: catalogo?.codigo,
        id_categoria: catalogo?.id_categoria,
        nombre_categoria: catalogo?.categoria?.nombre,
        cantidad_disponible: item._sum.cantidad_disponible || 0,
        cantidad_reservada: item._sum.cantidad_reservada || 0,
        cantidad_total:
          (item._sum.cantidad_disponible || 0) +
          (item._sum.cantidad_reservada || 0),
      };
    });

    // Estadísticas generales
    const estadisticasGenerales = await this.prisma.inventario.aggregate({
      where: { estado: 'ACTIVO' },
      _sum: {
        cantidad_disponible: true,
        cantidad_reservada: true,
      },
      _count: {
        id_inventario: true,
      },
    });

    return {
      por_bodega: distribucionPorBodega,
      por_categoria: distribucionPorCategoria,
      resumen_general: {
        total_items: estadisticasGenerales._count.id_inventario,
        total_disponible: estadisticasGenerales._sum.cantidad_disponible || 0,
        total_reservado: estadisticasGenerales._sum.cantidad_reservada || 0,
        total_general:
          (estadisticasGenerales._sum.cantidad_disponible || 0) +
          (estadisticasGenerales._sum.cantidad_reservada || 0),
      },
    };
  }

  /**
   * Obtener alertas de stock bajo
   */
  async getAlertas(): Promise<any> {
    // Obtener todos los inventarios activos con cantidad_minima definida en el catálogo
    const inventarios = await this.prisma.inventario.findMany({
      where: {
        estado: 'ACTIVO',
        catalogo: {
          cantidad_minima: { not: null, gt: 0 },
        },
      },
      include: {
        catalogo: {
          include: {
            categoria: true,
          },
        },
        bodega: {
          include: {
            sucursal: true,
          },
        },
        estante: true,
      },
    });

    // Filtrar manualmente los que tienen stock bajo
    const alertas = inventarios.filter(
      (item) =>
        item.catalogo.cantidad_minima &&
        item.cantidad_disponible <= item.catalogo.cantidad_minima,
    );

    // Ordenar por cantidad disponible (ascendente)
    alertas.sort((a, b) => a.cantidad_disponible - b.cantidad_disponible);

    return alertas.map((item) => ({
      ...item,
      diferencia: (item.catalogo.cantidad_minima || 0) - item.cantidad_disponible,
      porcentaje_stock: item.catalogo.cantidad_minima
        ? ((item.cantidad_disponible / item.catalogo.cantidad_minima) * 100).toFixed(2)
        : 0,
      nivel_criticidad:
        item.cantidad_disponible === 0
          ? 'CRITICO'
          : item.cantidad_disponible <= (item.catalogo.cantidad_minima || 0) * 0.5
            ? 'ALTO'
            : 'MEDIO',
    }));
  }

  /**
   * Obtener movimientos de un item del inventario
   */
  async findMovimientos(
    id_catalogo: number,
    queryDto: QueryMovimientosDto,
  ): Promise<PaginatedResult<any>> {
    const {
      page = 1,
      limit = 10,
      tipo,
      id_bodega_origen,
      id_bodega_destino,
    } = queryDto;
    const skip = (page - 1) * limit;

    const where: any = {
      id_catalogo,
    };

    if (tipo) {
      where.tipo = tipo;
    }

    if (id_bodega_origen) {
      where.id_bodega_origen = +id_bodega_origen;
    }

    if (id_bodega_destino) {
      where.id_bodega_destino = +id_bodega_destino;
    }

    const [data, total] = await Promise.all([
      this.prisma.movimientos_inventario.findMany({
        where,
        include: {
          catalogo: true,
          bodega_origen: {
            include: {
              sucursal: true,
            },
          },
          bodega_destino: {
            include: {
              sucursal: true,
            },
          },
          usuario: {
            select: {
              id_usuario: true,
              nombres: true,
              apellidos: true,
            },
          },
          compra: {
            select: {
              id_compras: true,
              numero_factura: true,
            },
          },
          importacion: {
            select: {
              id_importacion: true,
              numero_orden: true,
            },
          },
          orden_trabajo: {
            select: {
              id_orden: true,
              codigo: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { fecha_movimiento: 'desc' },
      }),
      this.prisma.movimientos_inventario.count({ where }),
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
