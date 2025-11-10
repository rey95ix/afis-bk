import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryReportesDto } from './dto/query-reportes.dto';

@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  async getReporteOrdenes(queryDto: QueryReportesDto) {
    const { desde, hasta, estado } = queryDto;

    const where: any = {};

    if (estado) {
      where.estado = estado;
    }

    if (desde || hasta) {
      where.fecha_creacion = {};
      if (desde) {
        where.fecha_creacion.gte = new Date(desde);
      }
      if (hasta) {
        where.fecha_creacion.lte = new Date(hasta);
      }
    }

    const [ordenes, resumen] = await Promise.all([
      this.prisma.orden_trabajo.findMany({
        where,
        include: {
          cliente: {
            select: {
              titular: true,
            },
          },
          tecnico_asignado: {
            select: {
              nombres: true,
              apellidos: true,
            },
          },
          materiales: true,
          actividades: true,
        },
        orderBy: {
          fecha_creacion: 'desc',
        },
      }),
      this.prisma.orden_trabajo.groupBy({
        by: ['estado'],
        where,
        _count: {
          id_orden: true,
        },
      }),
    ]);

    const totalOrdenes = ordenes.length;
    const totalMateriales = ordenes.reduce(
      (sum, orden) => sum + orden.materiales.length,
      0,
    );
    const totalActividades = ordenes.reduce(
      (sum, orden) => sum + orden.actividades.length,
      0,
    );

    // Calcular tiempos promedio
    const ordenesConTiempos = ordenes.filter(
      (o) => o.fecha_inicio_trabajo && o.fecha_fin_trabajo,
    );
    const tiempoPromedioMinutos =
      ordenesConTiempos.length > 0
        ? ordenesConTiempos.reduce((sum, orden) => {
            const diff =
              orden.fecha_fin_trabajo!.getTime() -
              orden.fecha_inicio_trabajo!.getTime();
            return sum + diff / (1000 * 60); // convertir a minutos
          }, 0) / ordenesConTiempos.length
        : 0;

    return {
      ordenes,
      resumen: {
        totalOrdenes,
        totalMateriales,
        totalActividades,
        tiempoPromedioMinutos: Math.round(tiempoPromedioMinutos),
        porEstado: resumen.map((r) => ({
          estado: r.estado,
          cantidad: r._count.id_orden,
        })),
      },
    };
  }

  async getReporteProductividadTecnicos(queryDto: QueryReportesDto) {
    const { desde, hasta, id_tecnico } = queryDto;

    const where: any = {
      id_tecnico_asignado: {
        not: null,
      },
    };

    if (id_tecnico) {
      where.id_tecnico_asignado = id_tecnico;
    }

    if (desde || hasta) {
      where.fecha_creacion = {};
      if (desde) {
        where.fecha_creacion.gte = new Date(desde);
      }
      if (hasta) {
        where.fecha_creacion.lte = new Date(hasta);
      }
    }

    const ordenes = await this.prisma.orden_trabajo.findMany({
      where,
      include: {
        tecnico_asignado: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
        actividades: true,
      },
    });

    // Agrupar por técnico
    const tecnicosMap = new Map();

    ordenes.forEach((orden) => {
      if (!orden.tecnico_asignado) return;

      const tecnicoId = orden.tecnico_asignado.id_usuario;

      if (!tecnicosMap.has(tecnicoId)) {
        tecnicosMap.set(tecnicoId, {
          tecnico: {
            id: orden.tecnico_asignado.id_usuario,
            nombre: `${orden.tecnico_asignado.nombres} ${orden.tecnico_asignado.apellidos}`,
          },
          totalOrdenes: 0,
          completadas: 0,
          canceladas: 0,
          enProceso: 0,
          totalActividades: 0,
          tiemposTrabajo: [],
        });
      }

      const tecnico = tecnicosMap.get(tecnicoId);
      tecnico.totalOrdenes++;

      if (orden.estado === 'COMPLETADA') {
        tecnico.completadas++;
      } else if (orden.estado === 'CANCELADA') {
        tecnico.canceladas++;
      } else {
        tecnico.enProceso++;
      }

      tecnico.totalActividades += orden.actividades.length;

      if (orden.fecha_inicio_trabajo && orden.fecha_fin_trabajo) {
        const tiempoMinutos =
          (orden.fecha_fin_trabajo.getTime() -
            orden.fecha_inicio_trabajo.getTime()) /
          (1000 * 60);
        tecnico.tiemposTrabajo.push(tiempoMinutos);
      }
    });

    // Calcular promedios y formatear resultado
    const productividad = Array.from(tecnicosMap.values()).map((tecnico) => {
      const tiempoPromedioMinutos =
        tecnico.tiemposTrabajo.length > 0
          ? tecnico.tiemposTrabajo.reduce((a, b) => a + b, 0) /
            tecnico.tiemposTrabajo.length
          : 0;

      const tasaCompletamiento =
        tecnico.totalOrdenes > 0
          ? (tecnico.completadas / tecnico.totalOrdenes) * 100
          : 0;

      return {
        tecnico: tecnico.tecnico,
        totalOrdenes: tecnico.totalOrdenes,
        completadas: tecnico.completadas,
        canceladas: tecnico.canceladas,
        enProceso: tecnico.enProceso,
        totalActividades: tecnico.totalActividades,
        tiempoPromedioMinutos: Math.round(tiempoPromedioMinutos),
        tasaCompletamiento: Math.round(tasaCompletamiento * 100) / 100,
      };
    });

    // Ordenar por total de órdenes completadas
    productividad.sort((a, b) => b.completadas - a.completadas);

    return {
      productividad,
      resumen: {
        totalTecnicos: productividad.length,
        totalOrdenesGestionadas: productividad.reduce(
          (sum, t) => sum + t.totalOrdenes,
          0,
        ),
        totalCompletadas: productividad.reduce(
          (sum, t) => sum + t.completadas,
          0,
        ),
      },
    };
  }

  async getReporteConsumoMateriales(queryDto: QueryReportesDto) {
    const { desde, hasta } = queryDto;

    const where: any = {};

    if (desde || hasta) {
      where.orden = {
        fecha_creacion: {},
      };
      if (desde) {
        where.orden.fecha_creacion.gte = new Date(desde);
      }
      if (hasta) {
        where.orden.fecha_creacion.lte = new Date(hasta);
      }
    }

    const materiales = await this.prisma.ot_materiales.findMany({
      where,
      include: {
        orden: {
          select: {
            codigo: true,
            fecha_creacion: true,
            tecnico_asignado: {
              select: {
                nombres: true,
                apellidos: true,
              },
            },
          },
        },
      },
      orderBy: {
        fecha_registro: 'desc',
      },
    });

    // Agrupar por SKU
    const materialesMap = new Map();

    materiales.forEach((material) => {
      const sku = material.sku;

      if (!materialesMap.has(sku)) {
        materialesMap.set(sku, {
          sku: material.sku,
          nombre: material.nombre,
          cantidadTotal: 0,
          cantidadOrdenes: 0,
          costoTotal: 0,
          usos: [],
        });
      }

      const mat = materialesMap.get(sku);
      mat.cantidadTotal += material.cantidad;
      mat.cantidadOrdenes++;

      if (material.costo_unitario) {
        mat.costoTotal +=
          parseFloat(material.costo_unitario.toString()) * material.cantidad;
      }

      mat.usos.push({
        orden: material.orden.codigo,
        fecha: material.fecha_registro,
        cantidad: material.cantidad,
        tecnico: material.orden.tecnico_asignado
          ? `${material.orden.tecnico_asignado.nombres} ${material.orden.tecnico_asignado.apellidos}`
          : 'No asignado',
      });
    });

    // Formatear resultado
    const consumo = Array.from(materialesMap.values()).map((material) => ({
      sku: material.sku,
      nombre: material.nombre,
      cantidadTotal: material.cantidadTotal,
      cantidadOrdenes: material.cantidadOrdenes,
      costoTotal: Math.round(material.costoTotal * 100) / 100,
      usos: material.usos.slice(0, 10), // Limitar a últimos 10 usos
    }));

    // Ordenar por cantidad total
    consumo.sort((a, b) => b.cantidadTotal - a.cantidadTotal);

    return {
      consumo,
      resumen: {
        totalMaterialesUnicos: consumo.length,
        cantidadTotalConsumida: consumo.reduce(
          (sum, m) => sum + m.cantidadTotal,
          0,
        ),
        costoTotal: consumo.reduce((sum, m) => sum + m.costoTotal, 0),
      },
    };
  }
}
