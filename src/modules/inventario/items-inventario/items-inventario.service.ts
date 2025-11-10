import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import {
  QueryInventarioDto,
  QueryMovimientosDto,
  QuerySeriesDto,
  QuerySeriesDisponiblesDto,
} from './dto';
import { PaginatedResult } from 'src/common/dto';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';

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
   * Buscar series disponibles basándose en filtros (catálogo, bodega, estante, estado)
   * Usado para requisiciones y transferencias
   */
  async findSeriesDisponibles(
    queryDto: QuerySeriesDisponiblesDto,
  ): Promise<PaginatedResult<any>> {
    const {
      id_catalogo,
      id_bodega,
      id_estante,
      estado,
      page = 1,
      limit = 100,
      search,
    } = queryDto;

    const skip = (page - 1) * limit;

    // Construir where para buscar el inventario que coincida
    const inventarioWhere: any = {
      id_catalogo,
      id_bodega,
    };

    if (id_estante) {
      inventarioWhere.id_estante = id_estante;
    }

    // Buscar los registros de inventario que coincidan
    const inventarios = await this.prisma.inventario.findMany({
      where: inventarioWhere,
      select: {
        id_inventario: true,
      },
    });

    // Si no hay inventarios, retornar vacío
    if (inventarios.length === 0) {
      return {
        data: [],
        meta: {
          total: 0,
          page,
          limit,
          totalPages: 0,
        },
      };
    }

    // Extraer IDs de inventarios
    const inventarioIds = inventarios.map((inv) => inv.id_inventario);

    // Construir where para series
    const seriesWhere: any = {
      id_inventario: { in: inventarioIds },
      estado,
    };

    if (search) {
      seriesWhere.OR = [
        { numero_serie: { contains: search, mode: 'insensitive' } },
        { mac_address: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Buscar series
    const [data, total] = await Promise.all([
      this.prisma.inventario_series.findMany({
        where: seriesWhere,
        include: {
          inventario: {
            include: {
              catalogo: {
                select: {
                  id_catalogo: true,
                  nombre: true,
                  codigo: true,
                },
              },
              bodega: {
                select: {
                  id_bodega: true,
                  nombre: true,
                },
              },
              estante: {
                select: {
                  id_estante: true,
                  nombre: true,
                },
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { numero_serie: 'asc' },
      }),
      this.prisma.inventario_series.count({ where: seriesWhere }),
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

  /**
   * Generar PDF de reporte de existencias de inventario
   */
  async generateExistenciasPdf(): Promise<Buffer> {
    // 1. Obtener distribución del inventario
    const distribucion = await this.getDistribucion();

    // 2. Obtener alertas de stock bajo
    const alertas = await this.getAlertas();

    // 3. Leer plantilla HTML
    const templatePath = path.join(
      process.cwd(),
      'templates/inventario/existencias-inventario.html',
    );

    if (!fs.existsSync(templatePath)) {
      throw new NotFoundException('Plantilla de reporte no encontrada');
    }

    const templateHtml = fs.readFileSync(templatePath, 'utf-8');

    // 4. Formatear fecha
    const formatDate = (date: Date): string => {
      return new Date(date).toLocaleString('es-SV', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    // 5. Preparar datos para la plantilla
    const templateData = {
      fechaGeneracion: formatDate(new Date()),
      filtrosAplicados: 'Todos los items activos',
      resumen_general: distribucion.resumen_general,
      por_bodega: distribucion.por_bodega,
      por_categoria: distribucion.por_categoria,
      alertas: alertas.slice(0, 20), // Limitar a las primeras 20 alertas más críticas
    };

    // 6. Configurar petición a jsReport
    const API_REPORT = process.env.API_REPORT || 'https://reports.edal.group/api/report';

    try {
      const response = await axios.post(
        API_REPORT,
        {
          template: {
            content: templateHtml,
            engine: 'jsrender',
            recipe: 'chrome-pdf',
          },
          data: templateData,
          options: {
            reportName: `Existencias_Inventario_${new Date().getTime()}`,
          },
        },
        {
          responseType: 'arraybuffer',
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 60000, // 60 segundos
        },
      );

      return Buffer.from(response.data);
    } catch (error) {
      console.error('Error generating PDF:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      throw new BadRequestException(
        'Error al generar el PDF. Por favor intente nuevamente.',
      );
    }
  }

  /**
   * Generar Excel de reporte de existencias de inventario
   */
  async generateExistenciasExcel(): Promise<Buffer> {
    // 1. Obtener distribución del inventario
    const distribucion = await this.getDistribucion();

    // 2. Obtener alertas de stock bajo
    const alertas = await this.getAlertas();

    // 3. Crear workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema de Inventario';
    workbook.created = new Date();
    workbook.modified = new Date();

    // 4. Crear hoja de existencias actuales detalladas (PRIMERA HOJA - DEFAULT)
    const sheetExistencias = workbook.addWorksheet('Existencias Actuales', {
      properties: { tabColor: { argb: '9b59b6' } },
    });

    // Título principal
    sheetExistencias.mergeCells('A1:H1');
    sheetExistencias.getCell('A1').value = 'EXISTENCIAS ACTUALES';
    sheetExistencias.getCell('A1').font = { size: 18, bold: true, color: { argb: '2c3e50' } };
    sheetExistencias.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    sheetExistencias.getRow(1).height = 35;

    // Subtítulo - Fecha de generación
    sheetExistencias.mergeCells('A2:H2');
    sheetExistencias.getCell('A2').value = `Fecha de generación: ${new Date().toLocaleString('es-SV')}`;
    sheetExistencias.getCell('A2').font = { size: 11, italic: true, color: { argb: '7f8c8d' } };
    sheetExistencias.getCell('A2').alignment = { horizontal: 'center' };
    sheetExistencias.getRow(2).height = 20;

    // Espacio
    sheetExistencias.addRow([]);

    // Configurar anchos de columna
    sheetExistencias.getColumn(1).width = 15;  // Código
    sheetExistencias.getColumn(2).width = 40;  // Producto
    sheetExistencias.getColumn(3).width = 25;  // Sucursal
    sheetExistencias.getColumn(4).width = 25;  // Bodega
    sheetExistencias.getColumn(5).width = 20;  // Estante
    sheetExistencias.getColumn(6).width = 12;  // Existencia
    sheetExistencias.getColumn(7).width = 15;  // Costo Promedio
    sheetExistencias.getColumn(8).width = 15;  // Subtotal

    // Agregar encabezados en la fila 4
    const headerRow = sheetExistencias.getRow(4);
    headerRow.values = ['Código', 'Producto', 'Sucursal', 'Bodega', 'Estante', 'Existencia', 'Costo Promedio', 'Subtotal'];
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '9b59b6' },
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;

    // Obtener todos los items del inventario con detalle
    const inventarioDetallado = await this.prisma.inventario.findMany({
      where: { estado: 'ACTIVO' },
      include: {
        catalogo: true,
        bodega: {
          include: {
            sucursal: true,
          },
        },
        estante: true,
      },
      orderBy: [
        { catalogo: { codigo: 'asc' } },
      ],
    });

    // Variable para acumular el total
    let totalGeneral = 0;

    // Agregar datos
    inventarioDetallado.forEach((item) => {
      const existencia = item.cantidad_disponible + item.cantidad_reservada;
      const costoPromedio = item.costo_promedio || 0;
      const subtotal = existencia * Number(costoPromedio);
      totalGeneral += subtotal;

      const row = sheetExistencias.addRow([
        item.catalogo?.codigo || 'N/A',
        item.catalogo?.nombre || 'N/A',
        item.bodega?.sucursal?.nombre || 'N/A',
        item.bodega?.nombre || 'N/A',
        item.estante?.nombre || 'N/A',
        existencia,
        costoPromedio,
        subtotal,
      ]);

      // Formatear columnas numéricas
      row.getCell(6).numFmt = '#,##0';  // Existencia
      row.getCell(7).numFmt = '$#,##0.00';  // Costo Promedio
      row.getCell(8).numFmt = '$#,##0.00';  // Subtotal
      row.getCell(8).font = { bold: true };
    });

    // Fila de total
    const totalRow = sheetExistencias.addRow([
      '',
      '',
      '',
      '',
      '',
      '',
      'TOTAL GENERAL:',
      totalGeneral,
    ]);

    // Estilo de la fila de total
    totalRow.font = { bold: true, size: 12, color: { argb: 'FFFFFF' } };
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '2c3e50' },
    };
    totalRow.getCell(7).alignment = { horizontal: 'right' };  // TOTAL GENERAL:
    totalRow.getCell(8).numFmt = '$#,##0.00';  // Subtotal
    totalRow.height = 30;

    // Aplicar bordes a todas las celdas con datos
    sheetExistencias.eachRow((row, rowNumber) => {
      if (rowNumber >= 4) {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
        });

        // Alternar color de fondo en filas (excepto header y total)
        if (rowNumber > 4 && rowNumber < sheetExistencias.rowCount) {
          if ((rowNumber - 4) % 2 === 0) {
            row.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'f8f9fa' },
            };
          }
        }
      }
    });

    // 5. Crear hoja de resumen general
    const sheetResumen = workbook.addWorksheet('Resumen General', {
      properties: { tabColor: { argb: '3498db' } },
    });

    // Header del resumen
    sheetResumen.mergeCells('A1:D1');
    sheetResumen.getCell('A1').value = 'REPORTE DE EXISTENCIAS DE INVENTARIO';
    sheetResumen.getCell('A1').font = { size: 16, bold: true, color: { argb: '2c3e50' } };
    sheetResumen.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    sheetResumen.getRow(1).height = 30;

    sheetResumen.mergeCells('A2:D2');
    sheetResumen.getCell('A2').value = `Fecha de generación: ${new Date().toLocaleString('es-SV')}`;
    sheetResumen.getCell('A2').font = { size: 10, italic: true };
    sheetResumen.getCell('A2').alignment = { horizontal: 'center' };

    // Resumen de métricas
    sheetResumen.addRow([]);
    sheetResumen.addRow(['Métrica', 'Valor']);
    sheetResumen.getRow(4).font = { bold: true };
    sheetResumen.getRow(4).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '2c3e50' },
    };
    sheetResumen.getRow(4).font = { color: { argb: 'FFFFFF' }, bold: true };

    sheetResumen.addRow(['Total Items', distribucion.resumen_general.total_items]);
    sheetResumen.addRow(['Total Disponible', distribucion.resumen_general.total_disponible]);
    sheetResumen.addRow(['Total Reservado', distribucion.resumen_general.total_reservado]);
    sheetResumen.addRow(['Total General', distribucion.resumen_general.total_general]);

    sheetResumen.getColumn(1).width = 30;
    sheetResumen.getColumn(2).width = 20;

    // Aplicar bordes
    for (let i = 4; i <= 8; i++) {
      sheetResumen.getRow(i).eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    }

    // 6. Crear hoja de distribución por bodega
    const sheetBodegas = workbook.addWorksheet('Distribución por Bodega', {
      properties: { tabColor: { argb: '27ae60' } },
    });

    sheetBodegas.columns = [
      { header: '#', key: 'index', width: 8 },
      { header: 'Bodega', key: 'nombre_bodega', width: 30 },
      { header: 'Tipo', key: 'tipo_bodega', width: 20 },
      { header: 'Sucursal', key: 'nombre_sucursal', width: 30 },
      { header: 'Items', key: 'cantidad_items', width: 12 },
      { header: 'Disponible', key: 'cantidad_disponible', width: 15 },
      { header: 'Reservado', key: 'cantidad_reservada', width: 15 },
      { header: 'Total', key: 'cantidad_total', width: 15 },
    ];

    // Estilo del header
    sheetBodegas.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    sheetBodegas.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '2c3e50' },
    };
    sheetBodegas.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
    sheetBodegas.getRow(1).height = 25;

    // Agregar datos
    distribucion.por_bodega.forEach((bodega, index) => {
      sheetBodegas.addRow({
        index: index + 1,
        nombre_bodega: bodega.nombre_bodega,
        tipo_bodega: bodega.tipo_bodega,
        nombre_sucursal: bodega.nombre_sucursal,
        cantidad_items: bodega.cantidad_items,
        cantidad_disponible: bodega.cantidad_disponible,
        cantidad_reservada: bodega.cantidad_reservada,
        cantidad_total: bodega.cantidad_total,
      });
    });

    // Aplicar bordes y formato
    sheetBodegas.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });

      if (rowNumber > 1 && rowNumber % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'f8f9fa' },
        };
      }
    });

    // 7. Crear hoja de distribución por categoría
    const sheetCategorias = workbook.addWorksheet('Distribución por Categoría', {
      properties: { tabColor: { argb: 'f39c12' } },
    });

    sheetCategorias.columns = [
      { header: '#', key: 'index', width: 8 },
      { header: 'Código', key: 'codigo_item', width: 15 },
      { header: 'Producto', key: 'nombre_item', width: 40 },
      { header: 'Categoría', key: 'nombre_categoria', width: 25 },
      { header: 'Disponible', key: 'cantidad_disponible', width: 15 },
      { header: 'Reservado', key: 'cantidad_reservada', width: 15 },
      { header: 'Total', key: 'cantidad_total', width: 15 },
    ];

    // Estilo del header
    sheetCategorias.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    sheetCategorias.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '2c3e50' },
    };
    sheetCategorias.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
    sheetCategorias.getRow(1).height = 25;

    // Agregar datos
    distribucion.por_categoria.forEach((categoria, index) => {
      sheetCategorias.addRow({
        index: index + 1,
        codigo_item: categoria.codigo_item,
        nombre_item: categoria.nombre_item,
        nombre_categoria: categoria.nombre_categoria,
        cantidad_disponible: categoria.cantidad_disponible,
        cantidad_reservada: categoria.cantidad_reservada,
        cantidad_total: categoria.cantidad_total,
      });
    });

    // Aplicar bordes y formato
    sheetCategorias.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });

      if (rowNumber > 1 && rowNumber % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'f8f9fa' },
        };
      }
    });

    // 8. Crear hoja de alertas (si existen)
    if (alertas.length > 0) {
      const sheetAlertas = workbook.addWorksheet('Alertas de Stock Bajo', {
        properties: { tabColor: { argb: 'e74c3c' } },
      });

      sheetAlertas.columns = [
        { header: '#', key: 'index', width: 8 },
        { header: 'Criticidad', key: 'nivel_criticidad', width: 15 },
        { header: 'Código', key: 'codigo', width: 15 },
        { header: 'Producto', key: 'nombre', width: 40 },
        { header: 'Categoría', key: 'categoria', width: 25 },
        { header: 'Bodega', key: 'bodega', width: 30 },
        { header: 'Disponible', key: 'cantidad_disponible', width: 15 },
        { header: 'Mínimo', key: 'cantidad_minima', width: 15 },
        { header: 'Diferencia', key: 'diferencia', width: 15 },
        { header: '% Stock', key: 'porcentaje_stock', width: 12 },
      ];

      // Estilo del header
      sheetAlertas.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
      sheetAlertas.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'e74c3c' },
      };
      sheetAlertas.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
      sheetAlertas.getRow(1).height = 25;

      // Agregar datos (limitado a 20)
      alertas.slice(0, 20).forEach((alerta, index) => {
        const row = sheetAlertas.addRow({
          index: index + 1,
          nivel_criticidad: alerta.nivel_criticidad,
          codigo: alerta.catalogo?.codigo,
          nombre: alerta.catalogo?.nombre,
          categoria: alerta.catalogo?.categoria?.nombre,
          bodega: alerta.bodega?.nombre,
          cantidad_disponible: alerta.cantidad_disponible,
          cantidad_minima: alerta.catalogo?.cantidad_minima,
          diferencia: alerta.diferencia,
          porcentaje_stock: `${alerta.porcentaje_stock}%`,
        });

        // Colorear según criticidad
        if (alerta.nivel_criticidad === 'CRITICO') {
          row.getCell('nivel_criticidad').fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'e74c3c' },
          };
          row.getCell('nivel_criticidad').font = { color: { argb: 'FFFFFF' }, bold: true };
        } else if (alerta.nivel_criticidad === 'ALTO') {
          row.getCell('nivel_criticidad').fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'f39c12' },
          };
          row.getCell('nivel_criticidad').font = { color: { argb: 'FFFFFF' }, bold: true };
        }
      });

      // Aplicar bordes
      sheetAlertas.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
        });

        if (rowNumber > 1 && rowNumber % 2 === 0) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'fff3cd' },
          };
        }
      });
    }

    // 8. Generar buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
