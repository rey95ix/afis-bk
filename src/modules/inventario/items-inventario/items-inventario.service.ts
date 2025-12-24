import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import {
  QueryInventarioDto,
  QueryMovimientosDto,
  QuerySeriesDto,
  QuerySeriesDisponiblesDto,
  RealizarInspeccionDto,
  ResultadoInspeccion,
  CompletarReparacionDto,
  ResultadoReparacion,
} from './dto';
import { PaginatedResult } from 'src/common/dto';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import { estado_inventario, tipo_movimiento } from '@prisma/client';

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

  // ============================================
  // MÉTODOS PARA CÁLCULO DE ROP (PUNTO DE REORDEN)
  // ============================================

  /**
   * Calcula el Punto de Reorden para un producto
   * ROP = (Demanda Promedio Diaria × Lead Time) + Stock Seguridad
   */
  async calcularROP(catalogoId: number): Promise<number> {
    const catalogo = await this.prisma.catalogo.findUnique({
      where: { id_catalogo: catalogoId },
    });

    if (!catalogo) {
      throw new NotFoundException(
        `Catálogo con ID ${catalogoId} no encontrado`,
      );
    }

    // Si no hay datos para calcular, retornar cantidad_minima como fallback
    if (!catalogo.demanda_promedio_diaria || !catalogo.lead_time_dias) {
      return catalogo.cantidad_minima || 0;
    }

    const demandaDuranteLeadTime =
      Number(catalogo.demanda_promedio_diaria) * catalogo.lead_time_dias;

    const stockSeguridad = catalogo.stock_seguridad || 0;

    return Math.ceil(demandaDuranteLeadTime + stockSeguridad);
  }

  /**
   * Actualiza el ROP calculado en el catálogo
   */
  async actualizarROPAutomatico(
    catalogoId: number,
  ): Promise<{ id_catalogo: number; punto_reorden: number; calculado: boolean }> {
    const catalogo = await this.prisma.catalogo.findUnique({
      where: { id_catalogo: catalogoId },
    });

    if (!catalogo) {
      throw new NotFoundException(
        `Catálogo con ID ${catalogoId} no encontrado`,
      );
    }

    // Verificar si hay datos suficientes para calcular
    const tieneParametros =
      catalogo.demanda_promedio_diaria && catalogo.lead_time_dias;

    if (!tieneParametros) {
      return {
        id_catalogo: catalogoId,
        punto_reorden: catalogo.punto_reorden || catalogo.cantidad_minima || 0,
        calculado: false,
      };
    }

    const rop = await this.calcularROP(catalogoId);

    await this.prisma.catalogo.update({
      where: { id_catalogo: catalogoId },
      data: { punto_reorden: rop },
    });

    return {
      id_catalogo: catalogoId,
      punto_reorden: rop,
      calculado: true,
    };
  }

  /**
   * Actualiza los parámetros ROP de un catálogo y recalcula automáticamente
   */
  async actualizarParametrosROP(
    catalogoId: number,
    params: {
      lead_time_dias?: number;
      demanda_promedio_diaria?: number;
      stock_seguridad?: number;
    },
  ): Promise<{
    id_catalogo: number;
    lead_time_dias: number | null;
    demanda_promedio_diaria: number | null;
    stock_seguridad: number | null;
    punto_reorden: number | null;
  }> {
    const catalogo = await this.prisma.catalogo.findUnique({
      where: { id_catalogo: catalogoId },
    });

    if (!catalogo) {
      throw new NotFoundException(
        `Catálogo con ID ${catalogoId} no encontrado`,
      );
    }

    // Actualizar parámetros
    const updatedCatalogo = await this.prisma.catalogo.update({
      where: { id_catalogo: catalogoId },
      data: {
        lead_time_dias: params.lead_time_dias ?? catalogo.lead_time_dias,
        demanda_promedio_diaria:
          params.demanda_promedio_diaria ?? catalogo.demanda_promedio_diaria,
        stock_seguridad: params.stock_seguridad ?? catalogo.stock_seguridad,
      },
    });

    // Recalcular ROP si hay datos suficientes
    let puntoReorden = updatedCatalogo.punto_reorden;

    if (
      updatedCatalogo.demanda_promedio_diaria &&
      updatedCatalogo.lead_time_dias
    ) {
      const rop = await this.calcularROP(catalogoId);
      await this.prisma.catalogo.update({
        where: { id_catalogo: catalogoId },
        data: { punto_reorden: rop },
      });
      puntoReorden = rop;
    }

    return {
      id_catalogo: catalogoId,
      lead_time_dias: updatedCatalogo.lead_time_dias,
      demanda_promedio_diaria: updatedCatalogo.demanda_promedio_diaria
        ? Number(updatedCatalogo.demanda_promedio_diaria)
        : null,
      stock_seguridad: updatedCatalogo.stock_seguridad,
      punto_reorden: puntoReorden,
    };
  }

  /**
   * Recalcula el ROP para todos los productos que tienen parámetros configurados
   */
  async recalcularROPMasivo(): Promise<{
    total_procesados: number;
    total_actualizados: number;
    resultados: Array<{ id_catalogo: number; nombre: string; punto_reorden: number }>;
  }> {
    // Obtener todos los catálogos con parámetros ROP configurados
    const catalogos = await this.prisma.catalogo.findMany({
      where: {
        demanda_promedio_diaria: { not: null },
        lead_time_dias: { not: null },
        estado: 'ACTIVO',
      },
      select: {
        id_catalogo: true,
        nombre: true,
        demanda_promedio_diaria: true,
        lead_time_dias: true,
        stock_seguridad: true,
      },
    });

    const resultados: Array<{
      id_catalogo: number;
      nombre: string;
      punto_reorden: number;
    }> = [];

    for (const catalogo of catalogos) {
      const demandaDuranteLeadTime =
        Number(catalogo.demanda_promedio_diaria) * catalogo.lead_time_dias!;
      const stockSeguridad = catalogo.stock_seguridad || 0;
      const rop = Math.ceil(demandaDuranteLeadTime + stockSeguridad);

      await this.prisma.catalogo.update({
        where: { id_catalogo: catalogo.id_catalogo },
        data: { punto_reorden: rop },
      });

      resultados.push({
        id_catalogo: catalogo.id_catalogo,
        nombre: catalogo.nombre,
        punto_reorden: rop,
      });
    }

    return {
      total_procesados: catalogos.length,
      total_actualizados: resultados.length,
      resultados,
    };
  }

  /**
   * Obtiene productos con stock por debajo del punto de reorden (ROP)
   */
  async getAlertasROP(bodegaId?: number): Promise<any[]> {
    const whereClause: any = {
      catalogo: {
        punto_reorden: { not: null },
        estado: 'ACTIVO',
      },
    };

    if (bodegaId) {
      whereClause.id_bodega = bodegaId;
    }

    const inventarios = await this.prisma.inventario.findMany({
      where: whereClause,
      include: {
        catalogo: {
          select: {
            id_catalogo: true,
            codigo: true,
            nombre: true,
            cantidad_minima: true,
            punto_reorden: true,
            lead_time_dias: true,
            demanda_promedio_diaria: true,
            stock_seguridad: true,
          },
        },
        bodega: {
          select: {
            id_bodega: true,
            nombre: true,
          },
        },
      },
    });

    // Filtrar los que están por debajo del ROP
    return inventarios
      .filter((inv) => {
        const rop = inv.catalogo.punto_reorden || 0;
        return inv.cantidad_disponible <= rop;
      })
      .map((inv) => {
        const rop = inv.catalogo.punto_reorden || 0;
        const stockActual = inv.cantidad_disponible;
        const diasCubiertos = inv.catalogo.demanda_promedio_diaria
          ? Math.floor(
              stockActual / Number(inv.catalogo.demanda_promedio_diaria),
            )
          : null;

        return {
          id_inventario: inv.id_inventario,
          producto: {
            id_catalogo: inv.catalogo.id_catalogo,
            codigo: inv.catalogo.codigo,
            nombre: inv.catalogo.nombre,
          },
          bodega: inv.bodega,
          stock_actual: stockActual,
          punto_reorden: rop,
          deficit: rop - stockActual,
          dias_cubiertos: diasCubiertos,
          lead_time_dias: inv.catalogo.lead_time_dias,
          requiere_pedido_urgente:
            diasCubiertos !== null &&
            inv.catalogo.lead_time_dias !== null &&
            diasCubiertos < inv.catalogo.lead_time_dias,
        };
      })
      .sort((a, b) => {
        // Ordenar por urgencia: primero los que requieren pedido urgente
        if (a.requiere_pedido_urgente && !b.requiere_pedido_urgente) return -1;
        if (!a.requiere_pedido_urgente && b.requiere_pedido_urgente) return 1;
        // Luego por déficit (mayor déficit primero)
        return b.deficit - a.deficit;
      });
  }

  // ============================================
  // ALERTAS STOCK BAJO (cantidad_minima)
  // ============================================

  /**
   * Obtiene items con stock por debajo de cantidad_minima
   * Diferente de ROP: usa cantidad_minima como umbral simple
   */
  async getAlertasStockBajo(bodegaId?: number): Promise<any[]> {
    const whereClause: any = {
      catalogo: {
        cantidad_minima: { not: null },
        estado: 'ACTIVO',
      },
    };

    if (bodegaId) {
      whereClause.id_bodega = bodegaId;
    }

    const inventarios = await this.prisma.inventario.findMany({
      where: whereClause,
      include: {
        catalogo: true,
        bodega: true,
      },
    });

    // Filtrar los que están por debajo de cantidad_minima
    return inventarios
      .filter((inv) => {
        const minimo = inv.catalogo.cantidad_minima || 0;
        return inv.cantidad_disponible <= minimo;
      })
      .map((inv) => {
        const minimo = inv.catalogo.cantidad_minima || 0;
        const diferencia = inv.cantidad_disponible - minimo;

        return {
          id_inventario: inv.id_inventario,
          catalogo: inv.catalogo.nombre,
          codigo: inv.catalogo.codigo,
          bodega: inv.bodega.nombre,
          cantidad_disponible: inv.cantidad_disponible,
          cantidad_minima: minimo,
          diferencia: diferencia,
          criticidad:
            diferencia <= -minimo * 0.5
              ? 'CRITICO'
              : diferencia < 0
                ? 'ALERTA'
                : 'BAJO',
        };
      })
      .sort((a, b) => a.diferencia - b.diferencia); // Más críticos primero
  }

  // ============================================
  // LOGICA FIFO PARA ASIGNACION DE SERIES
  // ============================================

  /**
   * Obtiene series disponibles para asignación usando FIFO
   * Los equipos más antiguos (fecha_ingreso ASC) se asignan primero
   * @param catalogoId - ID del producto en catálogo
   * @param bodegaId - ID de la bodega
   * @param cantidad - Cantidad de series a obtener
   * @returns Series ordenadas por fecha de ingreso (más antigua primero)
   */
  async getSeriesForAssignment(
    catalogoId: number,
    bodegaId: number,
    cantidad: number,
  ): Promise<any[]> {
    // Primero verificar que existe inventario del producto en la bodega
    const inventario = await this.prisma.inventario.findFirst({
      where: {
        id_catalogo: catalogoId,
        id_bodega: bodegaId,
      },
    });

    if (!inventario) {
      throw new NotFoundException(
        `No existe inventario del producto ${catalogoId} en la bodega ${bodegaId}`,
      );
    }

    // Obtener series disponibles ordenadas por FIFO (fecha_ingreso ASC)
    const series = await this.prisma.inventario_series.findMany({
      where: {
        id_inventario: inventario.id_inventario,
        estado: 'DISPONIBLE',
      },
      orderBy: {
        fecha_ingreso: 'asc', // FIFO - primero los más antiguos
      },
      take: cantidad,
      select: {
        id_serie: true,
        numero_serie: true,
        fecha_ingreso: true,
        estado: true,
        inventario: {
          select: {
            catalogo: {
              select: {
                id_catalogo: true,
                codigo: true,
                nombre: true,
              },
            },
            bodega: {
              select: {
                id_bodega: true,
                nombre: true,
              },
            },
          },
        },
      },
    });

    if (series.length < cantidad) {
      throw new BadRequestException(
        `Stock insuficiente. Se solicitaron ${cantidad} unidades pero solo hay ${series.length} disponibles`,
      );
    }

    return series.map((serie) => ({
      id_serie: serie.id_serie,
      numero_serie: serie.numero_serie,
      fecha_ingreso: serie.fecha_ingreso,
      dias_en_inventario: Math.floor(
        (Date.now() - new Date(serie.fecha_ingreso).getTime()) /
          (1000 * 60 * 60 * 24),
      ),
      producto: serie.inventario?.catalogo,
      bodega: serie.inventario?.bodega,
    }));
  }

  /**
   * Valida y sugiere series a asignar usando FIFO
   * Útil para preview antes de confirmar asignación
   */
  async sugerirSeriesFIFO(
    catalogoId: number,
    bodegaId: number,
    cantidad: number,
  ): Promise<{
    series_sugeridas: any[];
    stock_disponible: number;
    stock_solicitado: number;
    puede_completar: boolean;
  }> {
    const inventario = await this.prisma.inventario.findFirst({
      where: {
        id_catalogo: catalogoId,
        id_bodega: bodegaId,
      },
    });

    if (!inventario) {
      return {
        series_sugeridas: [],
        stock_disponible: 0,
        stock_solicitado: cantidad,
        puede_completar: false,
      };
    }

    const seriesDisponibles = await this.prisma.inventario_series.findMany({
      where: {
        id_inventario: inventario.id_inventario,
        estado: 'DISPONIBLE',
      },
      orderBy: {
        fecha_ingreso: 'asc', // FIFO
      },
      select: {
        id_serie: true,
        numero_serie: true,
        fecha_ingreso: true,
      },
    });

    const seriesSugeridas = seriesDisponibles.slice(0, cantidad).map((s) => ({
      id_serie: s.id_serie,
      numero_serie: s.numero_serie,
      fecha_ingreso: s.fecha_ingreso,
      dias_en_inventario: Math.floor(
        (Date.now() - new Date(s.fecha_ingreso).getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    }));

    return {
      series_sugeridas: seriesSugeridas,
      stock_disponible: seriesDisponibles.length,
      stock_solicitado: cantidad,
      puede_completar: seriesDisponibles.length >= cantidad,
    };
  }

  // ============================================
  // INSPECCIÓN DE EQUIPOS DEVUELTOS
  // ============================================

  /**
   * Obtiene series en estado EN_INSPECCION
   */
  async findSeriesEnInspeccion(
    queryDto: QuerySeriesDisponiblesDto,
  ): Promise<PaginatedResult<any>> {
    const {
      id_bodega,
      page = 1,
      limit = 10,
      search,
    } = queryDto;

    const skip = (page - 1) * limit;

    // Construir where
    const where: any = {
      estado: estado_inventario.EN_INSPECCION,
    };

    if (id_bodega) {
      where.inventario = {
        id_bodega: +id_bodega,
      };
    }

    if (search) {
      where.OR = [
        { numero_serie: { contains: search, mode: 'insensitive' } },
        { mac_address: { contains: search, mode: 'insensitive' } },
        {
          inventario: {
            catalogo: {
              nombre: { contains: search, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.inventario_series.findMany({
        where,
        include: {
          inventario: {
            include: {
              catalogo: {
                select: {
                  id_catalogo: true,
                  codigo: true,
                  nombre: true,
                  descripcion: true,
                },
              },
              bodega: {
                select: {
                  id_bodega: true,
                  nombre: true,
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
        },
        skip,
        take: limit,
        orderBy: { fecha_ultima_actualizacion: 'desc' },
      }),
      this.prisma.inventario_series.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // Transformar datos para incluir catalogo y bodega directamente
    const seriesTransformadas = data.map((serie) => ({
      id_serie: serie.id_serie,
      numero_serie: serie.numero_serie,
      estado: serie.estado,
      observaciones: serie.observaciones,
      fecha_ultima_actualizacion: serie.fecha_ultima_actualizacion,
      id_catalogo: serie.inventario?.catalogo?.id_catalogo,
      catalogo: serie.inventario?.catalogo,
      id_bodega: serie.inventario?.id_bodega,
      bodega: serie.inventario?.bodega,
      id_orden_trabajo: serie.id_orden_trabajo,
      orden_trabajo: serie.orden_trabajo,
    }));

    return {
      data: seriesTransformadas,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Obtiene detalle de una serie específica
   */
  async findSerieById(id: number): Promise<any> {
    const serie = await this.prisma.inventario_series.findUnique({
      where: { id_serie: id },
      include: {
        inventario: {
          include: {
            catalogo: true,
            bodega: true,
          },
        },
        orden_trabajo: {
          include: {
            cliente: true,
          },
        },
        cliente: true,
      },
    });

    if (!serie) {
      throw new NotFoundException(`Serie con ID ${id} no encontrada`);
    }

    return serie;
  }

  /**
   * Obtiene historial de movimientos de una serie
   */
  async findHistorialSerie(id: number): Promise<any> {
    // Verificar que la serie existe
    await this.findSerieById(id);

    // Buscar historial de cambios de estado de esta serie
    const historial = await this.prisma.historial_series.findMany({
      where: {
        id_serie: id,
      },
      include: {
        usuario: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
      orderBy: {
        fecha_movimiento: 'desc',
      },
      take: 50,
    });

    return {
      movimientos: historial.map((h) => ({
        id_historial: h.id_historial,
        estado_anterior: h.estado_anterior,
        estado_nuevo: h.estado_nuevo,
        fecha_movimiento: h.fecha_movimiento,
        observaciones: h.observaciones,
        usuario: h.usuario
          ? {
              id: h.usuario.id_usuario,
              nombre: `${h.usuario.nombres} ${h.usuario.apellidos}`,
            }
          : null,
        id_orden_trabajo: h.id_orden_trabajo,
      })),
    };
  }

  /**
   * Realiza la inspección de una serie y cambia su estado
   */
  async realizarInspeccion(
    dto: RealizarInspeccionDto,
    userId: number,
  ): Promise<any> {
    const { id_serie, resultado, observaciones, id_bodega_destino } = dto;

    // Obtener la serie
    const serie = await this.prisma.inventario_series.findUnique({
      where: { id_serie },
      include: {
        inventario: {
          include: {
            catalogo: true,
            bodega: true,
          },
        },
      },
    });

    if (!serie) {
      throw new NotFoundException(`Serie con ID ${id_serie} no encontrada`);
    }

    if (serie.estado !== estado_inventario.EN_INSPECCION) {
      throw new BadRequestException(
        `La serie no está en estado EN_INSPECCION. Estado actual: ${serie.estado}`,
      );
    }

    // Determinar nuevo estado según resultado
    let nuevoEstado: estado_inventario;
    switch (resultado) {
      case ResultadoInspeccion.APROBADO:
        nuevoEstado = estado_inventario.DISPONIBLE;
        break;
      case ResultadoInspeccion.REQUIERE_REPARACION:
        nuevoEstado = estado_inventario.EN_REPARACION;
        break;
      case ResultadoInspeccion.DANO_PERMANENTE:
        nuevoEstado = estado_inventario.DEFECTUOSO;
        break;
      default:
        throw new BadRequestException('Resultado de inspección no válido');
    }

    // Actualizar la serie (fecha_ultima_actualizacion se actualiza automáticamente con @updatedAt)
    const serieActualizada = await this.prisma.inventario_series.update({
      where: { id_serie },
      data: {
        estado: nuevoEstado,
        observaciones: `[Inspección ${new Date().toISOString()}] ${resultado}: ${observaciones}`,
      },
      include: {
        inventario: {
          include: {
            catalogo: true,
            bodega: true,
          },
        },
      },
    });

    // Registrar en historial de la serie
    await this.prisma.historial_series.create({
      data: {
        id_serie,
        estado_anterior: estado_inventario.EN_INSPECCION,
        estado_nuevo: nuevoEstado,
        id_bodega_anterior: serie.inventario?.id_bodega,
        id_bodega_nueva: id_bodega_destino || serie.inventario?.id_bodega,
        id_usuario: userId,
        observaciones: `Inspección: ${resultado}. ${observaciones}`,
      },
    });

    // Si vuelve a DISPONIBLE, actualizar cantidad disponible en inventario
    if (nuevoEstado === estado_inventario.DISPONIBLE && serie.id_inventario) {
      await this.prisma.inventario.update({
        where: { id_inventario: serie.id_inventario },
        data: {
          cantidad_disponible: {
            increment: 1,
          },
        },
      });
    }

    // Registrar movimiento si hay inventario asociado
    if (serie.inventario) {
      await this.prisma.movimientos_inventario.create({
        data: {
          tipo: tipo_movimiento.AJUSTE_INVENTARIO,
          id_catalogo: serie.inventario.id_catalogo,
          id_bodega_origen: serie.inventario.id_bodega,
          id_bodega_destino: id_bodega_destino || serie.inventario.id_bodega,
          cantidad: 1,
          observaciones: `Inspección de equipo: ${resultado}. ${observaciones}`,
          id_usuario: userId,
          fecha_movimiento: new Date(),
        },
      });
    }

    return {
      success: true,
      message: `Inspección registrada. Nuevo estado: ${nuevoEstado}`,
      data: serieActualizada,
    };
  }

  /**
   * Cambia el estado de una serie directamente
   */
  async cambiarEstadoSerie(
    id: number,
    nuevoEstado: string,
    observaciones?: string,
  ): Promise<any> {
    const serie = await this.prisma.inventario_series.findUnique({
      where: { id_serie: id },
    });

    if (!serie) {
      throw new NotFoundException(`Serie con ID ${id} no encontrada`);
    }

    const estadosValidos = Object.values(estado_inventario);

    if (!estadosValidos.includes(nuevoEstado as estado_inventario)) {
      throw new BadRequestException(
        `Estado no válido. Estados permitidos: ${estadosValidos.join(', ')}`,
      );
    }

    const serieActualizada = await this.prisma.inventario_series.update({
      where: { id_serie: id },
      data: {
        estado: nuevoEstado as estado_inventario,
        observaciones: observaciones
          ? `${serie.observaciones || ''}\n[${new Date().toISOString()}] ${observaciones}`
          : serie.observaciones,
      },
    });

    return {
      success: true,
      message: `Estado actualizado a ${nuevoEstado}`,
      data: serieActualizada,
    };
  }

  /**
   * Obtiene conteo de series por estado
   */
  async getConteosPorEstado(): Promise<Record<string, number>> {
    const conteos = await this.prisma.inventario_series.groupBy({
      by: ['estado'],
      _count: {
        id_serie: true,
      },
    });

    const resultado: Record<string, number> = {};
    conteos.forEach((c) => {
      resultado[c.estado] = c._count.id_serie;
    });

    return resultado;
  }

  // ============================================
  // REPARACIONES
  // ============================================

  /**
   * Completa la reparación de una serie
   * Cambia el estado de EN_REPARACION a DISPONIBLE o DEFECTUOSO
   */
  async completarReparacion(
    dto: CompletarReparacionDto,
    userId: number,
  ): Promise<any> {
    const { id_serie, resultado, observaciones, costo_reparacion } = dto;

    // Obtener la serie
    const serie = await this.prisma.inventario_series.findUnique({
      where: { id_serie },
      include: {
        inventario: {
          include: {
            catalogo: true,
            bodega: true,
          },
        },
      },
    });

    if (!serie) {
      throw new NotFoundException(`Serie con ID ${id_serie} no encontrada`);
    }

    if (serie.estado !== estado_inventario.EN_REPARACION) {
      throw new BadRequestException(
        `La serie no está en estado EN_REPARACION. Estado actual: ${serie.estado}`,
      );
    }

    // Determinar nuevo estado según resultado
    const nuevoEstado =
      resultado === ResultadoReparacion.EXITOSA
        ? estado_inventario.DISPONIBLE
        : estado_inventario.DEFECTUOSO;

    // Construir observaciones con costo si aplica
    const obsCompleta = costo_reparacion
      ? `[Reparación ${new Date().toISOString()}] ${resultado}: ${observaciones}. Costo: $${costo_reparacion}`
      : `[Reparación ${new Date().toISOString()}] ${resultado}: ${observaciones}`;

    // Actualizar la serie
    const serieActualizada = await this.prisma.inventario_series.update({
      where: { id_serie },
      data: {
        estado: nuevoEstado,
        observaciones: obsCompleta,
      },
      include: {
        inventario: {
          include: {
            catalogo: true,
            bodega: true,
          },
        },
      },
    });

    // Registrar en historial de la serie
    await this.prisma.historial_series.create({
      data: {
        id_serie,
        estado_anterior: estado_inventario.EN_REPARACION,
        estado_nuevo: nuevoEstado,
        id_bodega_anterior: serie.inventario?.id_bodega,
        id_bodega_nueva: serie.inventario?.id_bodega,
        id_usuario: userId,
        observaciones: `Reparación ${resultado}. ${observaciones}${costo_reparacion ? `. Costo: $${costo_reparacion}` : ''}`,
      },
    });

    // Si vuelve a DISPONIBLE, actualizar cantidad disponible en inventario
    if (nuevoEstado === estado_inventario.DISPONIBLE && serie.id_inventario) {
      await this.prisma.inventario.update({
        where: { id_inventario: serie.id_inventario },
        data: {
          cantidad_disponible: {
            increment: 1,
          },
        },
      });
    }

    // Registrar movimiento si hay inventario asociado
    if (serie.inventario) {
      await this.prisma.movimientos_inventario.create({
        data: {
          tipo: tipo_movimiento.AJUSTE_INVENTARIO,
          id_catalogo: serie.inventario.id_catalogo,
          id_bodega_origen: serie.inventario.id_bodega,
          id_bodega_destino: serie.inventario.id_bodega,
          cantidad: resultado === ResultadoReparacion.EXITOSA ? 1 : 0,
          observaciones: `Reparación completada: ${resultado}. ${observaciones}${costo_reparacion ? `. Costo: $${costo_reparacion}` : ''}`,
          id_usuario: userId,
          fecha_movimiento: new Date(),
        },
      });
    }

    const mensaje =
      resultado === ResultadoReparacion.EXITOSA
        ? 'Equipo reparado y devuelto a inventario disponible'
        : 'Reparación fallida. Equipo marcado como defectuoso';

    return {
      success: true,
      message: mensaje,
      data: serieActualizada,
    };
  }

  // ============================================
  // ITEMS OBSOLETOS (VIDA ÚTIL VENCIDA)
  // ============================================

  /**
   * Obtiene series con vida útil vencida
   * Obsoleto = fecha_ingreso + vida_util_meses < fecha_actual
   * @param bodegaId - Filtro opcional por bodega
   * @param categoriaId - Filtro opcional por categoría
   */
  async getItemsObsoletos(
    bodegaId?: number,
    categoriaId?: number,
  ): Promise<any[]> {
    const ahora = new Date();

    // Buscar series activas con vida_util_meses definida en catálogo
    const whereClause: any = {
      estado: { in: ['DISPONIBLE', 'ASIGNADO', 'RESERVADO'] },
      inventario: {
        catalogo: {
          vida_util_meses: { not: null },
        },
      },
    };

    // Agregar filtro de bodega si se proporciona
    if (bodegaId) {
      whereClause.inventario.id_bodega = bodegaId;
    }

    // Agregar filtro de categoría si se proporciona
    if (categoriaId) {
      whereClause.inventario.catalogo.id_categoria = categoriaId;
    }

    const series = await this.prisma.inventario_series.findMany({
      where: whereClause,
      include: {
        inventario: {
          include: {
            catalogo: {
              select: {
                id_catalogo: true,
                codigo: true,
                nombre: true,
                descripcion: true,
                vida_util_meses: true,
                categoria: {
                  select: {
                    id_categoria: true,
                    nombre: true,
                  },
                },
              },
            },
            bodega: {
              select: {
                id_bodega: true,
                nombre: true,
                tipo: true,
              },
            },
          },
        },
        cliente: {
          select: {
            id_cliente: true,
            titular: true,
          },
        },
      },
      orderBy: {
        fecha_ingreso: 'asc',
      },
    });

    // Filtrar los que tienen vida útil vencida y calcular días vencido
    const itemsObsoletos = series
      .filter((serie) => {
        const vidaUtilMeses = serie.inventario?.catalogo?.vida_util_meses;
        if (!vidaUtilMeses || !serie.fecha_ingreso) return false;

        const fechaIngreso = new Date(serie.fecha_ingreso);
        const fechaVencimiento = new Date(fechaIngreso);
        fechaVencimiento.setMonth(fechaVencimiento.getMonth() + vidaUtilMeses);

        return fechaVencimiento < ahora;
      })
      .map((serie) => {
        const vidaUtilMeses = serie.inventario?.catalogo?.vida_util_meses || 0;
        const fechaIngreso = new Date(serie.fecha_ingreso);
        const fechaVencimiento = new Date(fechaIngreso);
        fechaVencimiento.setMonth(fechaVencimiento.getMonth() + vidaUtilMeses);

        // Calcular días vencido
        const diasVencido = Math.floor(
          (ahora.getTime() - fechaVencimiento.getTime()) / (1000 * 60 * 60 * 24),
        );

        return {
          id_serie: serie.id_serie,
          numero_serie: serie.numero_serie,
          estado: serie.estado,
          fecha_ingreso: serie.fecha_ingreso,
          vida_util_meses: vidaUtilMeses,
          fecha_vencimiento: fechaVencimiento,
          dias_vencido: diasVencido,
          producto: {
            id_catalogo: serie.inventario?.catalogo?.id_catalogo,
            codigo: serie.inventario?.catalogo?.codigo,
            nombre: serie.inventario?.catalogo?.nombre,
            descripcion: serie.inventario?.catalogo?.descripcion,
          },
          categoria: serie.inventario?.catalogo?.categoria,
          bodega: serie.inventario?.bodega,
          cliente: serie.cliente,
          recomendacion:
            diasVencido > 180
              ? 'BAJA_INMEDIATA'
              : diasVencido > 90
                ? 'PROGRAMAR_BAJA'
                : 'EVALUAR_REEMPLAZO',
        };
      });

    // Ordenar por días vencido (más vencido primero)
    return itemsObsoletos.sort((a, b) => b.dias_vencido - a.dias_vencido);
  }

  /**
   * Obtiene resumen de items obsoletos por categoría y bodega
   */
  async getResumenItemsObsoletos(): Promise<{
    total_obsoletos: number;
    por_categoria: Array<{ categoria: string; cantidad: number }>;
    por_bodega: Array<{ bodega: string; cantidad: number }>;
    por_recomendacion: Record<string, number>;
  }> {
    const itemsObsoletos = await this.getItemsObsoletos();

    // Agrupar por categoría
    const porCategoriaMap = new Map<string, number>();
    const porBodegaMap = new Map<string, number>();
    const porRecomendacion: Record<string, number> = {
      BAJA_INMEDIATA: 0,
      PROGRAMAR_BAJA: 0,
      EVALUAR_REEMPLAZO: 0,
    };

    itemsObsoletos.forEach((item) => {
      // Por categoría
      const categoriaNombre = item.categoria?.nombre || 'Sin categoría';
      porCategoriaMap.set(
        categoriaNombre,
        (porCategoriaMap.get(categoriaNombre) || 0) + 1,
      );

      // Por bodega
      const bodegaNombre = item.bodega?.nombre || 'Sin bodega';
      porBodegaMap.set(bodegaNombre, (porBodegaMap.get(bodegaNombre) || 0) + 1);

      // Por recomendación
      porRecomendacion[item.recomendacion]++;
    });

    return {
      total_obsoletos: itemsObsoletos.length,
      por_categoria: Array.from(porCategoriaMap.entries())
        .map(([categoria, cantidad]) => ({ categoria, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad),
      por_bodega: Array.from(porBodegaMap.entries())
        .map(([bodega, cantidad]) => ({ bodega, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad),
      por_recomendacion: porRecomendacion,
    };
  }
}
