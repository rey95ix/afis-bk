import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { facturaDirecta, Prisma } from '@prisma/client';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { FacturaPuntoXpress } from './interfaces';
import { AplicarPagoDto, AnularPagoPuntoXpressDto } from './dto';

// Estados de CXC que se consideran "pendientes de pago"
const ESTADOS_CXC_PENDIENTES = ['PENDIENTE', 'PAGADA_PARCIAL', 'VENCIDA'] as const;

@Injectable()
export class PuntoXpressService {
  private readonly logger = new Logger(PuntoXpressService.name);
  private readonly portalSystemUserId: number;
  private readonly autoActivacion: boolean;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.portalSystemUserId = Number(
      this.configService.get<string>('PORTAL_SYSTEM_USER_ID', '1'),
    );
    this.autoActivacion =
      this.configService.get<string>('PUNTOXPRESS_AUTO_ACTIVACION', 'false') === 'true';
  }

  // ============= BÚSQUEDAS =============

  async buscarPorCorrelativo(correlativo: string): Promise<FacturaPuntoXpress[]> {
    const facturas = await this.prisma.facturaDirecta.findMany({
      where: {
        numero_factura: correlativo,
        estado: 'ACTIVO',
        cuenta_por_cobrar: {
          estado: { in: [...ESTADOS_CXC_PENDIENTES] },
        },
      },
      include: {
        cuenta_por_cobrar: true,
        cliente: { select: { id_cliente: true, titular: true } },
      },
    });

    const filtradas = this.filterFacturasRelevantes(facturas);
    return filtradas.map((f) => this.mapFactura(f));
  }

  async buscarPorCodigoCliente(idCliente: number): Promise<FacturaPuntoXpress[]> {
    const facturas = await this.prisma.facturaDirecta.findMany({
      where: {
        id_cliente: idCliente,
        estado: 'ACTIVO',
        cuenta_por_cobrar: {
          estado: { in: [...ESTADOS_CXC_PENDIENTES] },
        },
      },
      include: {
        cuenta_por_cobrar: true,
        cliente: { select: { id_cliente: true, titular: true } },
      },
      orderBy: { fecha_creacion: 'asc' },
    });

    const filtradas = this.filterFacturasRelevantes(facturas);
    return filtradas.map((f) => this.mapFactura(f));
  }

  async buscarPorDui(dui: string): Promise<FacturaPuntoXpress[]> {
    const clientes = await this.prisma.cliente.findMany({
      where: { dui },
      select: { id_cliente: true },
    });

    if (clientes.length === 0) return [];

    const clienteIds = clientes.map((c) => c.id_cliente);

    const facturas = await this.prisma.facturaDirecta.findMany({
      where: {
        id_cliente: { in: clienteIds },
        estado: 'ACTIVO',
        cuenta_por_cobrar: {
          estado: { in: [...ESTADOS_CXC_PENDIENTES] },
        },
      },
      include: {
        cuenta_por_cobrar: true,
        cliente: { select: { id_cliente: true, titular: true } },
      },
      orderBy: { fecha_creacion: 'asc' },
    });

    const filtradas = this.filterFacturasRelevantes(facturas);
    return filtradas.map((f) => this.mapFactura(f));
  }

  async buscarPorNombre(nombre: string): Promise<FacturaPuntoXpress[]> {
    const facturas = await this.prisma.facturaDirecta.findMany({
      where: {
        estado: 'ACTIVO',
        cliente: {
          titular: { 
            equals: nombre, mode: 'insensitive' 
          },
        },
        cuenta_por_cobrar: {
          estado: { in: [...ESTADOS_CXC_PENDIENTES] },
        },
      },
      include: {
        cuenta_por_cobrar: true,
        cliente: { select: { id_cliente: true, titular: true } },
      },
      orderBy: { fecha_creacion: 'asc' },
      take: 50,
    });

    const filtradas = this.filterFacturasRelevantes(facturas);
    return filtradas.map((f) => this.mapFactura(f));
  }

  // ============= PAGOS =============

  async aplicarPago(dto: AplicarPagoDto, idIntegrador: number) {
    // 1. Buscar CXC y validar
    const cxc = await this.prisma.cuenta_por_cobrar.findUnique({
      where: { id_factura_directa: dto.id_factura_directa },
      include: {
        facturaDirecta: {
          include: {
            cliente: { select: { id_cliente: true, titular: true, estado: true } },
          },
        },
      },
    });

    if (!cxc) {
      throw new NotFoundException(`Factura #${dto.id_factura_directa} no encontrada`);
    }

    if (!['PENDIENTE', 'PAGADA_PARCIAL', 'VENCIDA'].includes(cxc.estado)) {
      throw new BadRequestException(`Factura #${dto.id_factura_directa} no está pendiente de pago (estado: ${cxc.estado})`);
    }

    const idCliente = cxc.facturaDirecta.id_cliente;
    if (!idCliente) {
      throw new BadRequestException('La factura no tiene cliente asociado');
    }

    // 2. Validar monto (pre-check antes de transacción)
    const montoPago = new Prisma.Decimal(dto.monto.toFixed(2));
    const saldoPendientePreCheck = new Prisma.Decimal(cxc.saldo_pendiente.toString());

    if (montoPago.gt(saldoPendientePreCheck)) {
      throw new BadRequestException(
        `El monto ($${dto.monto}) excede el saldo pendiente ($${saldoPendientePreCheck})`,
      );
    }

    // 3. Transacción: validar regla + crear abono + caja_movimiento + actualizar CXC + factura
    const resultado = await this.prisma.$transaction(
      async (tx) => {
        // Re-validar regla "factura más antigua primero" dentro de la transacción
        const cxcMasAntigua = await tx.cuenta_por_cobrar.findFirst({
          where: {
            id_cliente: idCliente,
            estado: { in: ['PENDIENTE', 'PAGADA_PARCIAL', 'VENCIDA'] },
          },
          orderBy: { fecha_emision: 'asc' },
        });

        if (cxcMasAntigua && cxcMasAntigua.id_cxc !== cxc.id_cxc) {
          throw new BadRequestException(
            `Debe pagar primero la factura más antigua (CXC #${cxcMasAntigua.id_cxc})`,
          );
        }

        // Re-leer CXC dentro de la transacción para evitar datos stale
        const cxcActual = await tx.cuenta_por_cobrar.findUniqueOrThrow({
          where: { id_cxc: cxc.id_cxc },
        });

        const saldoPendiente = new Prisma.Decimal(cxcActual.saldo_pendiente.toString());

        if (montoPago.gt(saldoPendiente)) {
          throw new BadRequestException(
            `El monto ($${dto.monto}) excede el saldo pendiente ($${saldoPendiente})`,
          );
        }

        const saldoPosterior = saldoPendiente.minus(montoPago);
        const totalAbonado = new Prisma.Decimal(cxcActual.total_abonado.toString()).plus(montoPago);
        const nuevoEstadoCxc = saldoPosterior.lte(0) ? 'PAGADA_TOTAL' : 'PAGADA_PARCIAL';
        const estadoPagoFactura = saldoPosterior.lte(0) ? 'PAGADO' : 'PARCIAL';

        // Crear abono
        const abono = await tx.abono_cxc.create({
          data: {
            id_cxc: cxc.id_cxc,
            monto: montoPago,
            saldo_anterior: saldoPendiente,
            saldo_posterior: saldoPosterior,
            metodo_pago: 'PUNTOXPRESS',
            referencia: dto.referencia,
            fecha_pago: new Date(),
            id_usuario: this.portalSystemUserId,
            observaciones: `[PuntoXpress: ${dto.colector}]`,
          },
        });

        // Registrar movimiento de caja
        await tx.caja_movimiento.create({
          data: {
            id_usuario: this.portalSystemUserId,
            id_cliente: idCliente,
            monto: montoPago,
            metodo_pago: 'PUNTOXPRESS',
            id_abono_cxc: abono.id_abono,
          },
        });

        // Actualizar CXC
        await tx.cuenta_por_cobrar.update({
          where: { id_cxc: cxc.id_cxc },
          data: {
            saldo_pendiente: saldoPosterior,
            total_abonado: totalAbonado,
            estado: nuevoEstadoCxc,
          },
        });

        // Actualizar estado de pago de la factura
        await tx.facturaDirecta.update({
          where: { id_factura_directa: cxc.id_factura_directa },
          data: { estado_pago: estadoPagoFactura },
        });

        // Activación automática (si está habilitada)
        if (this.autoActivacion) {
          await this.verificarActivacionAutomatica(idCliente, tx);
        }

        return abono;
      },
      { timeout: 60000 },
    );

    await this.prisma.logAction(
      'PUNTOXPRESS_PAGO',
      this.portalSystemUserId,
      `Pago PuntoXpress: Abono #${resultado.id_abono} en CXC #${cxc.id_cxc}. Monto: $${montoPago}. Colector: ${dto.colector}. Integrador ID: ${idIntegrador}`,
    );

    this.logger.log(
      `Pago aplicado: Abono #${resultado.id_abono}, CXC #${cxc.id_cxc}, $${montoPago}`,
    );

    return {
      estado: 'OK',
      mensaje: 'Pago aplicado con éxito',
      id_pago: resultado.id_abono,
    };
  }

  async anularPago(idAbono: number, dto: AnularPagoPuntoXpressDto, idIntegrador: number) {
    // 1. Buscar abono
    const abono = await this.prisma.abono_cxc.findUnique({
      where: { id_abono: idAbono },
      include: {
        cuentaPorCobrar: {
          include: { facturaDirecta: true },
        },
      },
    });

    if (!abono) {
      throw new NotFoundException(`Pago #${idAbono} no encontrado`);
    }

    if (!abono.activo) {
      throw new BadRequestException('Este pago ya fue anulado');
    }

    // Verificar que fue un pago de PuntoXpress
    if (!abono.observaciones?.includes('[PuntoXpress:') &&
      !abono.observaciones?.includes('[Punto Express:')) {
      throw new BadRequestException('Este pago no fue realizado por PuntoXpress');
    }

    const idCxc = abono.cuentaPorCobrar.id_cxc;
    const idFactura = abono.cuentaPorCobrar.id_factura_directa;

    if (abono.cuentaPorCobrar.estado === 'ANULADA') {
      throw new BadRequestException('No se puede anular un pago de una cuenta ya anulada');
    }

    const montoAbono = new Prisma.Decimal(abono.monto.toString());

    await this.prisma.$transaction(async (tx) => {
      // Re-leer CXC dentro de la transacción para evitar datos stale
      const cxc = await tx.cuenta_por_cobrar.findUniqueOrThrow({
        where: { id_cxc: idCxc },
      });

      const nuevoSaldoPendiente = new Prisma.Decimal(cxc.saldo_pendiente.toString()).plus(montoAbono);
      const nuevoTotalAbonado = new Prisma.Decimal(cxc.total_abonado.toString()).minus(montoAbono);
      const nuevoEstado = nuevoTotalAbonado.eq(0) ? 'PENDIENTE' : 'PAGADA_PARCIAL';
      const estadoPagoFactura = nuevoTotalAbonado.eq(0) ? 'PENDIENTE' : 'PARCIAL';

      // 1. Marcar abono como inactivo
      await tx.abono_cxc.update({
        where: { id_abono: idAbono },
        data: { activo: false },
      });

      // 2. Recalcular CxC
      await tx.cuenta_por_cobrar.update({
        where: { id_cxc: idCxc },
        data: {
          saldo_pendiente: nuevoSaldoPendiente,
          total_abonado: nuevoTotalAbonado,
          estado: nuevoEstado,
        },
      });

      // 3. Actualizar estado de pago de la factura
      await tx.facturaDirecta.update({
        where: { id_factura_directa: idFactura },
        data: { estado_pago: estadoPagoFactura },
      });
    });

    await this.prisma.logAction(
      'PUNTOXPRESS_ANULAR_PAGO',
      this.portalSystemUserId,
      `Anulación PuntoXpress: Abono #${idAbono} en CxC #${idCxc}. Motivo: ${dto.motivo}. Monto revertido: $${montoAbono}. Integrador ID: ${idIntegrador}`,
    );

    this.logger.log(`Pago anulado: Abono #${idAbono}, CxC #${idCxc}`);

    return {
      estado: 'OK',
      mensaje: 'Pago anulado con éxito',
    };
  }

  // ============= ACTIVACIÓN AUTOMÁTICA =============

  private async verificarActivacionAutomatica(
    idCliente: number,
    tx: Prisma.TransactionClient,
  ) {
    const cliente = await tx.cliente.findUnique({
      where: { id_cliente: idCliente },
      select: { estado: true },
    });

    if (!cliente || cliente.estado !== 'SUSPENDIDO') return;

    // Verificar si tiene CXCs pendientes
    const cxcsPendientes = await tx.cuenta_por_cobrar.count({
      where: {
        id_cliente: idCliente,
        estado: { in: ['PENDIENTE', 'PAGADA_PARCIAL', 'VENCIDA'] },
      },
    });

    if (cxcsPendientes === 0) {
      await tx.cliente.update({
        where: { id_cliente: idCliente },
        data: { estado: 'ACTIVO' },
      });

      this.logger.log(
        `Cliente #${idCliente} activado automáticamente por pago completo vía PuntoXpress`,
      );
    }
  }

  // ============= HELPERS =============

  /**
   * Filtra facturas para mostrar solo las vencidas + la siguiente a vencer.
   * Evita mostrar facturas de meses futuros que aún no corresponde cobrar.
   */
  private filterFacturasRelevantes(facturas: any[]): any[] {
    const ahora = new Date();

    const vencidas: any[] = [];
    const noVencidas: any[] = [];

    for (const f of facturas) {
      const fechaVenc = f.cuenta_por_cobrar?.fecha_vencimiento
        ? new Date(f.cuenta_por_cobrar.fecha_vencimiento)
        : null;

      if (fechaVenc && ahora > fechaVenc) {
        vencidas.push(f);
      } else {
        noVencidas.push(f);
      }
    }

    // Ordenar no-vencidas por fecha_vencimiento ASC y tomar solo la primera
    noVencidas.sort((a, b) => {
      const fa = new Date(a.cuenta_por_cobrar?.fecha_vencimiento).getTime();
      const fb = new Date(b.cuenta_por_cobrar?.fecha_vencimiento).getTime();
      return fa - fb;
    });

    const siguienteAVencer = noVencidas.length > 0 ? [noVencidas[0]] : [];

    return [...vencidas, ...siguienteAVencer];
  }

  private mapFactura(factura: any): FacturaPuntoXpress {
    const cxc = factura.cuenta_por_cobrar;
    const ahora = new Date();
    const fechaVenc = cxc?.fecha_vencimiento ? new Date(cxc.fecha_vencimiento) : null;

    let periodoFacturado = '';
    if (factura.periodo_inicio && factura.periodo_fin) {
      const inicio = new Date(factura.periodo_inicio);
      const fin = new Date(factura.periodo_fin);
      periodoFacturado = `${inicio.toISOString().split('T')[0]} a ${fin.toISOString().split('T')[0]}`;
    }
    console.log('Mapeando factura:', factura);
    return {
      id_factura: factura.id_factura_directa,
      numero_factura: factura.codigo_generacion || '',
      fecha_vencimiento: fechaVenc ? fechaVenc.toISOString().split('T')[0] : '',
      periodo_facturado: periodoFacturado,
      monto: Number(cxc?.monto_total || factura.total),
      monto_mora: Number(cxc?.monto_mora || 0),
      saldo_pendiente: Number(cxc?.saldo_pendiente || 0),
      cliente: factura.cliente?.titular || factura.cliente_nombre || '',
      codigo_cliente: factura.cliente?.id_cliente || factura.id_cliente || 0,
      vencida: (fechaVenc ? ahora > fechaVenc : false) ? 1 : 0,
      estado_factura: cxc?.estado || factura.estado_pago,
      resolucion: "FACTURACION ELECTRONICA",
      serie: "FACTURACION ELECTRONICA"
    };
  }
}
