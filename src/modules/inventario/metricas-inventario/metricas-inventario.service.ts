import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import {
  QueryMetricasKPIDto,
  QueryMetricasHistoricasDto,
  QueryTasaRotacionDto,
  QueryStockOutRateDto,
  QueryItemsBajoMinimoDto,
  CalcularMetricasDto,
  TipoPeriodo,
} from './dto';
import { Prisma, estado_auditoria, tipo_movimiento } from '@prisma/client';

/**
 * Servicio de Métricas de Inventario
 *
 * Calcula y almacena KPIs críticos según política:
 * - Precisión de Inventario (objetivo > 98%)
 * - Tasa de Rotación
 * - Stock-Out Rate (objetivo 0%)
 * - Items Bajo Mínimo
 */
@Injectable()
export class MetricasInventarioService {
  private readonly logger = new Logger(MetricasInventarioService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // CÁLCULO DE KPIs PRINCIPALES
  // ============================================================

  /**
   * Calcula la Precisión de Inventario basada en la última auditoría
   *
   * Fórmula: (Inventario Físico / Inventario Sistema) * 100
   * O alternativamente: (Items Conformes / Total Items Auditados) * 100
   *
   * Objetivo según política: > 98%
   */
  async calcularPrecisionInventario(query?: QueryMetricasKPIDto): Promise<{
    precision_porcentaje: number;
    ultima_auditoria: any;
    objetivo: number;
    cumple_objetivo: boolean;
    detalle: {
      total_items_auditados: number;
      items_conformes: number;
      items_con_discrepancia: number;
    };
  }> {
    const where: Prisma.auditorias_inventarioWhereInput = {
      estado: estado_auditoria.COMPLETADA,
    };

    if (query?.id_bodega) {
      where.id_bodega = query.id_bodega;
    }

    // Obtener última auditoría completada
    const ultimaAuditoria = await this.prisma.auditorias_inventario.findFirst({
      where,
      orderBy: { fecha_fin: 'desc' },
      include: {
        bodega: {
          select: {
            id_bodega: true,
            nombre: true,
          },
        },
      },
    });

    if (!ultimaAuditoria) {
      return {
        precision_porcentaje: 0,
        ultima_auditoria: null,
        objetivo: 98,
        cumple_objetivo: false,
        detalle: {
          total_items_auditados: 0,
          items_conformes: 0,
          items_con_discrepancia: 0,
        },
      };
    }

    const totalItems = ultimaAuditoria.total_items_auditados;
    const itemsConformes = ultimaAuditoria.total_items_conformes;
    const precision = totalItems > 0 ? (itemsConformes / totalItems) * 100 : 0;

    return {
      precision_porcentaje: Number(precision.toFixed(2)),
      ultima_auditoria: {
        id_auditoria: ultimaAuditoria.id_auditoria,
        codigo: ultimaAuditoria.codigo,
        fecha_fin: ultimaAuditoria.fecha_fin,
        bodega: ultimaAuditoria.bodega,
      },
      objetivo: 98,
      cumple_objetivo: precision >= 98,
      detalle: {
        total_items_auditados: totalItems,
        items_conformes: itemsConformes,
        items_con_discrepancia: ultimaAuditoria.total_items_con_discrepancia,
      },
    };
  }

  /**
   * Calcula la Precisión de Inventario por bodega específica
   * Útil para dashboards por ubicación
   */
  async calcularPrecisionPorBodega(id_bodega: number): Promise<{
    precision_porcentaje: number;
    cantidad_sistema: number;
    cantidad_auditada: number | null;
  }> {
    // Obtener inventario actual del sistema
    const inventarioSistema = await this.prisma.inventario.aggregate({
      where: { id_bodega },
      _sum: { cantidad_disponible: true },
    });

    // Obtener último conteo de auditoría
    const ultimaAuditoria = await this.prisma.auditorias_inventario.findFirst({
      where: {
        id_bodega,
        estado: estado_auditoria.COMPLETADA,
      },
      orderBy: { fecha_fin: 'desc' },
      include: {
        detalle: {
          select: {
            cantidad_fisica: true,
          },
        },
      },
    });

    const cantidadSistema = inventarioSistema._sum.cantidad_disponible || 0;

    if (!ultimaAuditoria) {
      return {
        precision_porcentaje: 100, // Sin auditoría, asumimos 100%
        cantidad_sistema: cantidadSistema,
        cantidad_auditada: null,
      };
    }

    const cantidadFisica = ultimaAuditoria.detalle.reduce(
      (sum, d) => sum + (d.cantidad_fisica || 0),
      0,
    );

    const precision = cantidadSistema > 0
      ? (cantidadFisica / cantidadSistema) * 100
      : 100;

    return {
      precision_porcentaje: Number(Math.min(precision, 100).toFixed(2)),
      cantidad_sistema: cantidadSistema,
      cantidad_auditada: cantidadFisica,
    };
  }

  /**
   * Calcula la Tasa de Rotación del inventario
   *
   * Fórmula: Costo de Bienes Vendidos / Inventario Promedio
   *
   * Interpretación:
   * - Alta rotación: Inventario se mueve rápido (positivo)
   * - Baja rotación: Stock estancado (riesgo de obsolescencia)
   */
  async calcularTasaRotacion(query?: QueryTasaRotacionDto): Promise<{
    tasa_rotacion: number;
    costo_salidas: number;
    inventario_promedio: number;
    inventario_inicio: number;
    inventario_fin: number;
    periodo: {
      inicio: Date;
      fin: Date;
    };
    interpretacion: string;
  }> {
    // Por defecto, últimos 12 meses
    const fechaFin = query?.fecha_fin ? new Date(query.fecha_fin) : new Date();
    const fechaInicio = query?.fecha_inicio
      ? new Date(query.fecha_inicio)
      : new Date(fechaFin.getTime() - 365 * 24 * 60 * 60 * 1000); // 12 meses atrás

    // Construir filtro de movimientos
    // Usamos SALIDA_OT y BAJA como proxy de consumo/salidas
    const whereMovimientos: Prisma.movimientos_inventarioWhereInput = {
      tipo: {
        in: [tipo_movimiento.SALIDA_OT, tipo_movimiento.BAJA],
      },
      fecha_movimiento: {
        gte: fechaInicio,
        lte: fechaFin,
      },
    };

    if (query?.id_bodega) {
      whereMovimientos.id_bodega_origen = query.id_bodega;
    }

    // Costo de bienes salidos (proxy de ventas/consumo)
    const salidas = await this.prisma.movimientos_inventario.findMany({
      where: whereMovimientos,
      select: {
        cantidad: true,
        costo_unitario: true,
      },
    });

    const costoSalidas = salidas.reduce(
      (sum, s) => sum + s.cantidad * Number(s.costo_unitario || 0),
      0,
    );

    // Inventario promedio del período
    const inventarioInicio = await this.getValorInventarioEnFecha(
      fechaInicio,
      query?.id_bodega,
      query?.id_categoria,
    );
    const inventarioFin = await this.getValorInventarioEnFecha(
      fechaFin,
      query?.id_bodega,
      query?.id_categoria,
    );
    const inventarioPromedio = (inventarioInicio + inventarioFin) / 2;

    const tasaRotacion = inventarioPromedio > 0
      ? costoSalidas / inventarioPromedio
      : 0;

    // Interpretación de la tasa
    let interpretacion: string;
    if (tasaRotacion >= 12) {
      interpretacion = 'Excelente: Inventario rota más de una vez al mes';
    } else if (tasaRotacion >= 6) {
      interpretacion = 'Buena: Inventario rota cada 2 meses aproximadamente';
    } else if (tasaRotacion >= 4) {
      interpretacion = 'Aceptable: Inventario rota cada 3 meses';
    } else if (tasaRotacion >= 2) {
      interpretacion = 'Baja: Revisar items con poca rotación';
    } else {
      interpretacion = 'Crítica: Alto riesgo de obsolescencia';
    }

    return {
      tasa_rotacion: Number(tasaRotacion.toFixed(2)),
      costo_salidas: Number(costoSalidas.toFixed(2)),
      inventario_promedio: Number(inventarioPromedio.toFixed(2)),
      inventario_inicio: Number(inventarioInicio.toFixed(2)),
      inventario_fin: Number(inventarioFin.toFixed(2)),
      periodo: {
        inicio: fechaInicio,
        fin: fechaFin,
      },
      interpretacion,
    };
  }

  /**
   * Obtiene el valor del inventario en una fecha específica
   * (Aproximación basada en inventario actual - no histórico real)
   */
  private async getValorInventarioEnFecha(
    fecha: Date,
    id_bodega?: number,
    id_categoria?: number,
  ): Promise<number> {
    const where: Prisma.inventarioWhereInput = {
      estado: 'ACTIVO',
    };

    if (id_bodega) {
      where.id_bodega = id_bodega;
    }

    if (id_categoria) {
      where.catalogo = {
        id_categoria,
      };
    }

    const inventario = await this.prisma.inventario.findMany({
      where,
      select: {
        cantidad_disponible: true,
        cantidad_reservada: true,
        costo_promedio: true,
      },
    });

    return inventario.reduce(
      (sum, inv) =>
        sum +
        (inv.cantidad_disponible + inv.cantidad_reservada) *
          Number(inv.costo_promedio || 0),
      0,
    );
  }

  /**
   * Calcula el Stock-Out Rate (Tasa de desabasto)
   *
   * Fórmula: (Órdenes No Completadas por Falta de Stock / Total Órdenes) * 100
   *
   * Objetivo: 0% - Ninguna orden debe fallar por falta de inventario
   */
  async calcularStockOutRate(query?: QueryStockOutRateDto): Promise<{
    stock_out_rate: number;
    ordenes_sin_stock: number;
    total_ordenes: number;
    objetivo: number;
    cumple_objetivo: boolean;
    periodo: {
      inicio: Date;
      fin: Date;
    };
    detalle_ordenes?: any[];
  }> {
    // Por defecto, último mes
    const fechaFin = query?.fecha_fin ? new Date(query.fecha_fin) : new Date();
    const fechaInicio = query?.fecha_inicio
      ? new Date(query.fecha_inicio)
      : new Date(fechaFin.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 días atrás

    // Total de órdenes de trabajo en el período
    const whereOrdenes: Prisma.orden_trabajoWhereInput = {
      fecha_creacion: {
        gte: fechaInicio,
        lte: fechaFin,
      },
    };

    const totalOrdenes = await this.prisma.orden_trabajo.count({
      where: whereOrdenes,
    });

    // Órdenes canceladas o con problemas por falta de stock
    // Buscamos en observaciones_tecnico o notas_cierre
    const ordenesSinStock = await this.prisma.orden_trabajo.count({
      where: {
        ...whereOrdenes,
        OR: [
          { observaciones_tecnico: { contains: 'sin stock', mode: 'insensitive' } },
          { observaciones_tecnico: { contains: 'falta de inventario', mode: 'insensitive' } },
          { observaciones_tecnico: { contains: 'no disponible', mode: 'insensitive' } },
          { observaciones_tecnico: { contains: 'stock insuficiente', mode: 'insensitive' } },
          { notas_cierre: { contains: 'sin stock', mode: 'insensitive' } },
          { notas_cierre: { contains: 'falta de inventario', mode: 'insensitive' } },
        ],
      },
    });

    // Alternativamente, buscar reservas no completadas
    const reservasNoCompletadas = await this.prisma.reservas_inventario.count({
      where: {
        fecha_reserva: {
          gte: fechaInicio,
          lte: fechaFin,
        },
        estado: 'INACTIVO', // Canceladas
      },
    });

    // Usamos el mayor de los dos como indicador
    const totalSinStock = Math.max(ordenesSinStock, reservasNoCompletadas);
    const stockOutRate = totalOrdenes > 0
      ? (totalSinStock / totalOrdenes) * 100
      : 0;

    return {
      stock_out_rate: Number(stockOutRate.toFixed(2)),
      ordenes_sin_stock: totalSinStock,
      total_ordenes: totalOrdenes,
      objetivo: 0,
      cumple_objetivo: stockOutRate === 0,
      periodo: {
        inicio: fechaInicio,
        fin: fechaFin,
      },
    };
  }

  /**
   * Cuenta y lista los items por debajo del punto de reorden o stock mínimo
   *
   * Incluye:
   * - Items bajo punto de reorden (ROP)
   * - Items bajo cantidad mínima
   * - Items críticos (bajo stock de seguridad)
   */
  async contarItemsBajoMinimo(query?: QueryItemsBajoMinimoDto): Promise<{
    total_items_bajo_minimo: number;
    total_items_criticos: number;
    items: any[];
    meta?: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    // Obtener inventario con información de catálogo
    const whereInventario: Prisma.inventarioWhereInput = {
      estado: 'ACTIVO',
      cantidad_disponible: { gt: 0 }, // Solo items con stock
    };

    if (query?.id_bodega) {
      whereInventario.id_bodega = query.id_bodega;
    }

    if (query?.id_categoria) {
      whereInventario.catalogo = {
        id_categoria: query.id_categoria,
      };
    }

    // Obtener todos los inventarios con su catálogo
    const inventarios = await this.prisma.inventario.findMany({
      where: whereInventario,
      include: {
        catalogo: {
          select: {
            id_catalogo: true,
            codigo: true,
            nombre: true,
            cantidad_minima: true,
            punto_reorden: true,
            stock_seguridad: true,
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
          },
        },
      },
    });

    // Filtrar items bajo mínimo
    const itemsBajoMinimo = inventarios.filter((inv) => {
      const stockActual = inv.cantidad_disponible;
      const puntoReorden = inv.catalogo.punto_reorden || 0;
      const cantidadMinima = inv.catalogo.cantidad_minima || 0;
      const stockSeguridad = inv.catalogo.stock_seguridad || 0;

      // Bajo mínimo si está por debajo de ROP o cantidad mínima
      return stockActual <= puntoReorden || stockActual <= cantidadMinima;
    });

    // Marcar críticos (bajo stock de seguridad)
    const itemsConEstado = itemsBajoMinimo.map((inv) => {
      const stockActual = inv.cantidad_disponible;
      const stockSeguridad = inv.catalogo.stock_seguridad || 0;
      const puntoReorden = inv.catalogo.punto_reorden || 0;
      const cantidadMinima = inv.catalogo.cantidad_minima || 0;

      const esCritico = stockSeguridad > 0 && stockActual <= stockSeguridad;
      const porcentajeStock = puntoReorden > 0
        ? (stockActual / puntoReorden) * 100
        : cantidadMinima > 0
          ? (stockActual / cantidadMinima) * 100
          : 100;

      return {
        id_inventario: inv.id_inventario,
        catalogo: inv.catalogo,
        bodega: inv.bodega,
        cantidad_disponible: stockActual,
        cantidad_reservada: inv.cantidad_reservada,
        punto_reorden: puntoReorden,
        cantidad_minima: cantidadMinima,
        stock_seguridad: stockSeguridad,
        es_critico: esCritico,
        porcentaje_stock: Number(porcentajeStock.toFixed(1)),
        unidades_faltantes: Math.max(0, puntoReorden - stockActual),
      };
    });

    // Ordenar por criticidad y porcentaje
    itemsConEstado.sort((a, b) => {
      if (a.es_critico !== b.es_critico) {
        return a.es_critico ? -1 : 1;
      }
      return a.porcentaje_stock - b.porcentaje_stock;
    });

    // Filtrar solo críticos si se solicita
    const itemsFiltrados = query?.solo_criticos
      ? itemsConEstado.filter((i) => i.es_critico)
      : itemsConEstado;

    // Paginar
    const itemsPaginados = itemsFiltrados.slice(skip, skip + limit);

    return {
      total_items_bajo_minimo: itemsBajoMinimo.length,
      total_items_criticos: itemsConEstado.filter((i) => i.es_critico).length,
      items: itemsPaginados,
      meta: {
        total: itemsFiltrados.length,
        page,
        limit,
        totalPages: Math.ceil(itemsFiltrados.length / limit),
      },
    };
  }

  // ============================================================
  // CÁLCULO AUTOMÁTICO Y ALMACENAMIENTO
  // ============================================================

  /**
   * CRON Job: Calcula métricas diariamente a medianoche
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async calcularMetricasDiarias(): Promise<void> {
    this.logger.log('Iniciando cálculo de métricas diarias de inventario...');

    try {
      const fecha = new Date();
      const periodo = this.formatearPeriodo(fecha);

      // Calcular KPIs
      const precision = await this.calcularPrecisionInventario();
      const rotacion = await this.calcularTasaRotacion();
      const stockOut = await this.calcularStockOutRate();
      const itemsBajoMinimo = await this.contarItemsBajoMinimo();

      // Obtener métricas de auditorías del mes
      const metricsAuditorias = await this.getMetricasAuditoriasMes(fecha);

      // Almacenar métricas
      await this.prisma.metricas_inventario.upsert({
        where: {
          periodo_id_bodega_id_categoria: {
            periodo,
            id_bodega: null as any, // Global
            id_categoria: null as any, // Todas
          },
        },
        create: {
          periodo,
          tipo_periodo: TipoPeriodo.DIARIO,
          accuracy_porcentaje: precision.precision_porcentaje,
          total_auditorias_realizadas: metricsAuditorias.total,
          total_items_auditados: metricsAuditorias.items_auditados,
          total_items_conformes: metricsAuditorias.items_conformes,
          total_items_con_discrepancia: metricsAuditorias.items_discrepancia,
          valor_total_inventario: await this.getValorInventarioEnFecha(fecha),
          total_movimientos: await this.contarMovimientosMes(fecha),
          total_ajustes: metricsAuditorias.ajustes_total,
          total_ajustes_autorizados: metricsAuditorias.ajustes_autorizados,
        },
        update: {
          accuracy_porcentaje: precision.precision_porcentaje,
          total_auditorias_realizadas: metricsAuditorias.total,
          total_items_auditados: metricsAuditorias.items_auditados,
          total_items_conformes: metricsAuditorias.items_conformes,
          total_items_con_discrepancia: metricsAuditorias.items_discrepancia,
          valor_total_inventario: await this.getValorInventarioEnFecha(fecha),
          total_movimientos: await this.contarMovimientosMes(fecha),
          total_ajustes: metricsAuditorias.ajustes_total,
          total_ajustes_autorizados: metricsAuditorias.ajustes_autorizados,
          fecha_calculo: new Date(),
        },
      });

      this.logger.log(
        `Métricas calculadas: Precisión=${precision.precision_porcentaje}%, ` +
        `Rotación=${rotacion.tasa_rotacion}, Stock-Out=${stockOut.stock_out_rate}%, ` +
        `Bajo mínimo=${itemsBajoMinimo.total_items_bajo_minimo}`,
      );
    } catch (error) {
      this.logger.error('Error al calcular métricas diarias', error);
    }
  }

  /**
   * Calcula métricas manualmente para un período específico
   */
  async calcularMetricasManual(dto: CalcularMetricasDto): Promise<any> {
    const fecha = new Date();
    const periodo = dto.periodo || this.formatearPeriodo(fecha);

    // Parsear período
    const [year, month] = periodo.split('-').map(Number);
    const fechaInicio = new Date(year, month - 1, 1);
    const fechaFin = new Date(year, month, 0, 23, 59, 59);

    const queryParams = {
      id_bodega: dto.id_bodega,
      id_categoria: dto.id_categoria,
      fecha_inicio: fechaInicio.toISOString(),
      fecha_fin: fechaFin.toISOString(),
    };

    // Calcular todos los KPIs
    const [precision, rotacion, stockOut, itemsBajoMinimo] = await Promise.all([
      this.calcularPrecisionInventario(queryParams),
      this.calcularTasaRotacion(queryParams),
      this.calcularStockOutRate(queryParams),
      this.contarItemsBajoMinimo(queryParams),
    ]);

    // Obtener métricas de auditorías
    const metricsAuditorias = await this.getMetricasAuditoriasRango(
      fechaInicio,
      fechaFin,
      dto.id_bodega,
    );

    // Almacenar
    const metrica = await this.prisma.metricas_inventario.upsert({
      where: {
        periodo_id_bodega_id_categoria: {
          periodo,
          id_bodega: dto.id_bodega || null as any,
          id_categoria: dto.id_categoria || null as any,
        },
      },
      create: {
        periodo,
        tipo_periodo: dto.tipo_periodo || TipoPeriodo.MENSUAL,
        id_bodega: dto.id_bodega,
        id_categoria: dto.id_categoria,
        accuracy_porcentaje: precision.precision_porcentaje,
        total_auditorias_realizadas: metricsAuditorias.total,
        total_items_auditados: metricsAuditorias.items_auditados,
        total_items_conformes: metricsAuditorias.items_conformes,
        total_items_con_discrepancia: metricsAuditorias.items_discrepancia,
        valor_total_inventario: await this.getValorInventarioEnFecha(
          fechaFin,
          dto.id_bodega,
          dto.id_categoria,
        ),
        total_movimientos: await this.contarMovimientosRango(
          fechaInicio,
          fechaFin,
          dto.id_bodega,
        ),
        total_ajustes: metricsAuditorias.ajustes_total,
        total_ajustes_autorizados: metricsAuditorias.ajustes_autorizados,
      },
      update: {
        accuracy_porcentaje: precision.precision_porcentaje,
        total_auditorias_realizadas: metricsAuditorias.total,
        total_items_auditados: metricsAuditorias.items_auditados,
        total_items_conformes: metricsAuditorias.items_conformes,
        total_items_con_discrepancia: metricsAuditorias.items_discrepancia,
        valor_total_inventario: await this.getValorInventarioEnFecha(
          fechaFin,
          dto.id_bodega,
          dto.id_categoria,
        ),
        total_movimientos: await this.contarMovimientosRango(
          fechaInicio,
          fechaFin,
          dto.id_bodega,
        ),
        total_ajustes: metricsAuditorias.ajustes_total,
        total_ajustes_autorizados: metricsAuditorias.ajustes_autorizados,
        fecha_calculo: new Date(),
      },
      include: {
        bodega: true,
        categoria: true,
      },
    });

    return {
      metrica,
      kpis: {
        precision,
        rotacion,
        stockOut,
        itemsBajoMinimo: {
          total: itemsBajoMinimo.total_items_bajo_minimo,
          criticos: itemsBajoMinimo.total_items_criticos,
        },
      },
    };
  }

  // ============================================================
  // CONSULTA DE MÉTRICAS HISTÓRICAS
  // ============================================================

  /**
   * Obtiene el dashboard de KPIs actuales
   */
  async getDashboardKPIs(query?: QueryMetricasKPIDto): Promise<{
    precision_inventario: any;
    tasa_rotacion: any;
    stock_out_rate: any;
    items_bajo_minimo: any;
    resumen: {
      estado_general: 'EXCELENTE' | 'BUENO' | 'REGULAR' | 'CRITICO';
      alertas: string[];
    };
  }> {
    const [precision, rotacion, stockOut, itemsBajoMinimo] = await Promise.all([
      this.calcularPrecisionInventario(query),
      this.calcularTasaRotacion({ id_bodega: query?.id_bodega }),
      this.calcularStockOutRate({ id_bodega: query?.id_bodega }),
      this.contarItemsBajoMinimo({ id_bodega: query?.id_bodega, id_categoria: query?.id_categoria, limit: 5 }),
    ]);

    // Determinar estado general
    const alertas: string[] = [];
    let puntaje = 0;

    if (precision.cumple_objetivo) puntaje += 2;
    else alertas.push(`Precisión de inventario (${precision.precision_porcentaje}%) por debajo del objetivo (98%)`);

    if (stockOut.cumple_objetivo) puntaje += 2;
    else alertas.push(`Stock-Out Rate (${stockOut.stock_out_rate}%) por encima del objetivo (0%)`);

    if (rotacion.tasa_rotacion >= 4) puntaje += 1;
    else alertas.push(`Tasa de rotación baja (${rotacion.tasa_rotacion})`);

    if (itemsBajoMinimo.total_items_criticos === 0) puntaje += 1;
    else alertas.push(`${itemsBajoMinimo.total_items_criticos} items en estado crítico`);

    let estadoGeneral: 'EXCELENTE' | 'BUENO' | 'REGULAR' | 'CRITICO';
    if (puntaje >= 5) estadoGeneral = 'EXCELENTE';
    else if (puntaje >= 3) estadoGeneral = 'BUENO';
    else if (puntaje >= 1) estadoGeneral = 'REGULAR';
    else estadoGeneral = 'CRITICO';

    return {
      precision_inventario: precision,
      tasa_rotacion: rotacion,
      stock_out_rate: stockOut,
      items_bajo_minimo: itemsBajoMinimo,
      resumen: {
        estado_general: estadoGeneral,
        alertas,
      },
    };
  }

  /**
   * Obtiene métricas históricas con filtros y paginación
   */
  async getMetricasHistoricas(query: QueryMetricasHistoricasDto): Promise<{
    data: any[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const { page = 1, limit = 12, ...filters } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.metricas_inventarioWhereInput = {};

    if (filters.tipo_periodo) {
      where.tipo_periodo = filters.tipo_periodo;
    }

    if (filters.id_bodega) {
      where.id_bodega = filters.id_bodega;
    }

    if (filters.id_categoria) {
      where.id_categoria = filters.id_categoria;
    }

    if (filters.fecha_inicio || filters.fecha_fin) {
      // Filtrar por períodos
      const periodos: string[] = [];
      const startDate = filters.fecha_inicio
        ? new Date(filters.fecha_inicio)
        : new Date(new Date().setFullYear(new Date().getFullYear() - 1));
      const endDate = filters.fecha_fin
        ? new Date(filters.fecha_fin)
        : new Date();

      let current = new Date(startDate);
      while (current <= endDate) {
        periodos.push(this.formatearPeriodo(current));
        current.setMonth(current.getMonth() + 1);
      }

      where.periodo = { in: periodos };
    }

    const [metricas, total] = await Promise.all([
      this.prisma.metricas_inventario.findMany({
        where,
        skip,
        take: limit,
        orderBy: { periodo: 'desc' },
        include: {
          bodega: {
            select: {
              id_bodega: true,
              nombre: true,
            },
          },
          categoria: {
            select: {
              id_categoria: true,
              nombre: true,
            },
          },
        },
      }),
      this.prisma.metricas_inventario.count({ where }),
    ]);

    return {
      data: metricas,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================================
  // MÉTODOS AUXILIARES
  // ============================================================

  private formatearPeriodo(fecha: Date): string {
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
  }

  private async getMetricasAuditoriasMes(fecha: Date): Promise<{
    total: number;
    items_auditados: number;
    items_conformes: number;
    items_discrepancia: number;
    ajustes_total: number;
    ajustes_autorizados: number;
  }> {
    const primerDia = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
    const ultimoDia = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0, 23, 59, 59);

    return this.getMetricasAuditoriasRango(primerDia, ultimoDia);
  }

  private async getMetricasAuditoriasRango(
    fechaInicio: Date,
    fechaFin: Date,
    id_bodega?: number,
  ): Promise<{
    total: number;
    items_auditados: number;
    items_conformes: number;
    items_discrepancia: number;
    ajustes_total: number;
    ajustes_autorizados: number;
  }> {
    const whereAuditorias: Prisma.auditorias_inventarioWhereInput = {
      fecha_fin: {
        gte: fechaInicio,
        lte: fechaFin,
      },
      estado: estado_auditoria.COMPLETADA,
    };

    if (id_bodega) {
      whereAuditorias.id_bodega = id_bodega;
    }

    const auditorias = await this.prisma.auditorias_inventario.findMany({
      where: whereAuditorias,
    });

    const ajustesWhere: Prisma.ajustes_inventarioWhereInput = {
      fecha_solicitud: {
        gte: fechaInicio,
        lte: fechaFin,
      },
    };

    if (id_bodega) {
      ajustesWhere.id_bodega = id_bodega;
    }

    const [ajustesTotal, ajustesAutorizados] = await Promise.all([
      this.prisma.ajustes_inventario.count({ where: ajustesWhere }),
      this.prisma.ajustes_inventario.count({
        where: {
          ...ajustesWhere,
          estado: 'AUTORIZADO',
        },
      }),
    ]);

    return {
      total: auditorias.length,
      items_auditados: auditorias.reduce((s, a) => s + a.total_items_auditados, 0),
      items_conformes: auditorias.reduce((s, a) => s + a.total_items_conformes, 0),
      items_discrepancia: auditorias.reduce((s, a) => s + a.total_items_con_discrepancia, 0),
      ajustes_total: ajustesTotal,
      ajustes_autorizados: ajustesAutorizados,
    };
  }

  private async contarMovimientosMes(fecha: Date): Promise<number> {
    const primerDia = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
    const ultimoDia = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0, 23, 59, 59);

    return this.contarMovimientosRango(primerDia, ultimoDia);
  }

  private async contarMovimientosRango(
    fechaInicio: Date,
    fechaFin: Date,
    id_bodega?: number,
  ): Promise<number> {
    const where: Prisma.movimientos_inventarioWhereInput = {
      fecha_movimiento: {
        gte: fechaInicio,
        lte: fechaFin,
      },
    };

    if (id_bodega) {
      where.OR = [
        { id_bodega_origen: id_bodega },
        { id_bodega_destino: id_bodega },
      ];
    }

    return this.prisma.movimientos_inventario.count({ where });
  }
}
