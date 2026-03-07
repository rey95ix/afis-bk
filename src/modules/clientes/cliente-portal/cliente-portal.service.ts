import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';

@Injectable()
export class ClientePortalService {
  constructor(private prisma: PrismaService) {}

  async obtenerContratos(idCliente: number) {
    const contratos = await this.prisma.atcContrato.findMany({
      where: {
        id_cliente: idCliente,
        estado: { not: 'CANCELADO' },
      },
      select: {
        id_contrato: true,
        codigo: true,
        estado: true,
        fecha_inicio_contrato: true,
        fecha_fin_contrato: true,
        meses_contrato: true,
        costo_instalacion: true,
        plan: {
          select: {
            nombre: true,
            precio: true,
            velocidad_bajada: true,
            velocidad_subida: true,
            tipoPlan: {
              select: {
                tipoServicio: { select: { nombre: true } },
              },
            },
          },
        },
        ciclo: {
          select: {
            nombre: true,
            dia_corte: true,
            dia_vencimiento: true,
          },
        },
      },
      orderBy: { fecha_inicio_contrato: 'desc' },
    });

    return contratos.map((c) => ({
      idContrato: c.id_contrato,
      codigo: c.codigo,
      estado: c.estado,
      fechaInicioContrato: c.fecha_inicio_contrato?.toISOString() || null,
      fechaFinContrato: c.fecha_fin_contrato?.toISOString() || null,
      mesesContrato: c.meses_contrato,
      costoInstalacion: c.costo_instalacion ? Number(c.costo_instalacion) : null,
      plan: {
        nombre: c.plan.nombre,
        precio: Number(c.plan.precio),
        velocidadBajada: c.plan.velocidad_bajada,
        velocidadSubida: c.plan.velocidad_subida,
        tipoServicio: c.plan.tipoPlan.tipoServicio.nombre,
      },
      ciclo: {
        nombre: c.ciclo.nombre,
        diaCorte: c.ciclo.dia_corte,
        diaVencimiento: c.ciclo.dia_vencimiento,
      },
    }));
  }

  async obtenerContratoDetalle(idCliente: number, idContrato: number) {
    const contrato = await this.prisma.atcContrato.findFirst({
      where: {
        id_contrato: idContrato,
        id_cliente: idCliente,
      },
      select: {
        id_contrato: true,
        codigo: true,
        estado: true,
        fecha_venta: true,
        fecha_instalacion: true,
        fecha_inicio_contrato: true,
        fecha_fin_contrato: true,
        meses_contrato: true,
        costo_instalacion: true,
        plan: {
          select: {
            nombre: true,
            precio: true,
            velocidad_bajada: true,
            velocidad_subida: true,
            tipoPlan: {
              select: {
                nombre: true,
                tipoServicio: { select: { nombre: true } },
              },
            },
          },
        },
        ciclo: {
          select: {
            nombre: true,
            dia_corte: true,
            dia_vencimiento: true,
          },
        },
        instalacion: {
          select: {
            wifi_nombre: true,
            instalado: true,
            fecha_instalacion: true,
          },
        },
        direccionServicio: {
          select: {
            direccion: true,
            colonias: { select: { nombre: true } },
            municipio: { select: { nombre: true } },
            departamento: { select: { nombre: true } },
          },
        },
      },
    });

    if (!contrato) {
      throw new NotFoundException(`Contrato #${idContrato} no encontrado`);
    }

    return {
      idContrato: contrato.id_contrato,
      codigo: contrato.codigo,
      estado: contrato.estado,
      fechaVenta: contrato.fecha_venta?.toISOString() || null,
      fechaInstalacion: contrato.fecha_instalacion?.toISOString() || null,
      fechaInicioContrato: contrato.fecha_inicio_contrato?.toISOString() || null,
      fechaFinContrato: contrato.fecha_fin_contrato?.toISOString() || null,
      mesesContrato: contrato.meses_contrato,
      costoInstalacion: contrato.costo_instalacion ? Number(contrato.costo_instalacion) : null,
      plan: {
        nombre: contrato.plan.nombre,
        precio: Number(contrato.plan.precio),
        velocidadBajada: contrato.plan.velocidad_bajada,
        velocidadSubida: contrato.plan.velocidad_subida,
        tipoPlan: contrato.plan.tipoPlan.nombre,
        tipoServicio: contrato.plan.tipoPlan.tipoServicio.nombre,
      },
      ciclo: {
        nombre: contrato.ciclo.nombre,
        diaCorte: contrato.ciclo.dia_corte,
        diaVencimiento: contrato.ciclo.dia_vencimiento,
      },
      instalacion: contrato.instalacion
        ? {
            wifiNombre: contrato.instalacion.wifi_nombre,
            instalado: contrato.instalacion.instalado,
            fechaInstalacion: contrato.instalacion.fecha_instalacion?.toISOString() || null,
          }
        : null,
      direccionServicio: {
        direccion: contrato.direccionServicio.direccion,
        colonia: contrato.direccionServicio.colonias?.nombre || null,
        municipio: contrato.direccionServicio.municipio?.nombre || null,
        departamento: contrato.direccionServicio.departamento?.nombre || null,
      },
    };
  }

  async obtenerFacturasContrato(idCliente: number, idContrato: number) {
    // Validar que el contrato pertenece al cliente
    const contrato = await this.prisma.atcContrato.findFirst({
      where: {
        id_contrato: idContrato,
        id_cliente: idCliente,
      },
      select: { id_contrato: true },
    });

    if (!contrato) {
      throw new NotFoundException(`Contrato #${idContrato} no encontrado`);
    }

    const facturas = await this.prisma.facturaDirecta.findMany({
      where: { id_contrato: idContrato },
      include: {
        cuenta_por_cobrar: true,
        tipoFactura: { select: { codigo: true } },
      },
      orderBy: [{ es_instalacion: 'desc' }, { numero_cuota: 'asc' }],
    });

    const ahora = new Date();

    return facturas.map((f) => {
      const cxc = f.cuenta_por_cobrar;
      const montoAbonado = cxc ? Number(cxc.total_abonado) : 0;
      const saldoPendiente = cxc ? Number(cxc.saldo_pendiente) : Number(f.total);

      let estadoPago: string = f.estado_pago;
      if (
        f.estado_pago === 'PENDIENTE' &&
        f.fecha_vencimiento &&
        f.fecha_vencimiento < ahora
      ) {
        estadoPago = 'VENCIDA';
      }

      return {
        idFactura: f.id_factura_directa,
        numeroCuota: f.numero_cuota,
        totalCuotas: f.total_cuotas,
        periodoInicio: f.periodo_inicio?.toISOString() || null,
        periodoFin: f.periodo_fin?.toISOString() || null,
        fechaVencimiento: f.fecha_vencimiento?.toISOString() || null,
        total: Number(f.total),
        montoMora: Number(f.monto_mora),
        montoAbonado,
        saldoPendiente,
        estadoPago,
        estadoDte: f.estado_dte,
        esInstalacion: f.es_instalacion,
        numeroFactura: f.numero_factura || null,
        estado: f.estado,
      };
    });
  }
}
