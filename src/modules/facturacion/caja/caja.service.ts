import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, metodo_pago_abono } from '@prisma/client';

@Injectable()
export class CajaService {
  constructor(private readonly prisma: PrismaService) {}

  async obtenerMovimientosPendientes(idUsuario: number) {
    const movimientos = await this.prisma.caja_movimiento.findMany({
      where: {
        id_usuario: idUsuario,
        id_cierre_usuario: null,
      },
      include: {
        cliente: { select: { id_cliente: true, titular: true } },
        abonoCxc: { select: { id_abono: true, referencia: true } },
      },
      orderBy: { fecha_hora: 'desc' },
    });

    const totales = this.calcularTotales(movimientos);

    return {
      movimientos: movimientos.map((m) => ({
        idMovimientoCaja: m.id_movimiento_caja,
        idUsuario: m.id_usuario,
        idCliente: m.id_cliente,
        cliente: m.cliente.titular,
        monto: Number(m.monto),
        metodoPago: m.metodo_pago,
        fechaHora: m.fecha_hora.toISOString(),
        idAbonoCxc: m.id_abono_cxc,
        referencia: m.abonoCxc.referencia,
      })),
      totales,
    };
  }

  async generarCierreUsuario(idUsuario: number) {
    return this.prisma.$transaction(async (tx) => {
      const movimientos = await tx.caja_movimiento.findMany({
        where: {
          id_usuario: idUsuario,
          id_cierre_usuario: null,
        },
      });

      if (movimientos.length === 0) {
        throw new BadRequestException('No hay movimientos pendientes de cierre');
      }

      const totales = this.calcularTotales(movimientos);

      const cierre = await tx.cierre_usuario.create({
        data: {
          id_usuario: idUsuario,
          total_efectivo: totales.totalEfectivo,
          total_cheque: totales.totalCheque,
          total_transferencia: totales.totalTransferencia,
          total_deposito: totales.totalDeposito,
          total_tarjeta: totales.totalTarjeta,
          total_otro: totales.totalOtro,
          total_general: totales.totalGeneral,
        },
      });

      await tx.caja_movimiento.updateMany({
        where: {
          id_movimiento_caja: { in: movimientos.map((m) => m.id_movimiento_caja) },
        },
        data: { id_cierre_usuario: cierre.id_cierre_usuario },
      });

      return {
        idCierreUsuario: cierre.id_cierre_usuario,
        fechaHora: cierre.fecha_hora.toISOString(),
        totalEfectivo: Number(cierre.total_efectivo),
        totalCheque: Number(cierre.total_cheque),
        totalTransferencia: Number(cierre.total_transferencia),
        totalDeposito: Number(cierre.total_deposito),
        totalTarjeta: Number(cierre.total_tarjeta),
        totalOtro: Number(cierre.total_otro),
        totalGeneral: Number(cierre.total_general),
        cantidadMovimientos: movimientos.length,
      };
    }, { timeout: 30000 });
  }

  async obtenerCierreUsuario(idCierre: number, idUsuarioSolicitante?: number) {
    const cierre = await this.prisma.cierre_usuario.findUnique({
      where: { id_cierre_usuario: idCierre },
      include: {
        usuario: { select: { id_usuario: true, nombres: true, apellidos: true } },
        movimientos: {
          include: {
            cliente: { select: { id_cliente: true, titular: true } },
            abonoCxc: { select: { id_abono: true, referencia: true } },
          },
          orderBy: { fecha_hora: 'asc' },
        },
      },
    });

    if (!cierre) {
      throw new BadRequestException('Cierre no encontrado');
    }

    if (idUsuarioSolicitante && cierre.id_usuario !== idUsuarioSolicitante) {
      throw new BadRequestException('No tiene acceso a este cierre');
    }

    return {
      idCierreUsuario: cierre.id_cierre_usuario,
      usuario: `${cierre.usuario.nombres} ${cierre.usuario.apellidos}`,
      idUsuario: cierre.id_usuario,
      fechaHora: cierre.fecha_hora.toISOString(),
      totalEfectivo: Number(cierre.total_efectivo),
      totalCheque: Number(cierre.total_cheque),
      totalTransferencia: Number(cierre.total_transferencia),
      totalDeposito: Number(cierre.total_deposito),
      totalTarjeta: Number(cierre.total_tarjeta),
      totalOtro: Number(cierre.total_otro),
      totalGeneral: Number(cierre.total_general),
      estado: cierre.estado,
      movimientos: cierre.movimientos.map((m) => ({
        idMovimientoCaja: m.id_movimiento_caja,
        idCliente: m.id_cliente,
        cliente: m.cliente.titular,
        monto: Number(m.monto),
        metodoPago: m.metodo_pago,
        fechaHora: m.fecha_hora.toISOString(),
        referencia: m.abonoCxc.referencia,
      })),
    };
  }

  async listarMisCierres(idUsuario: number, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.cierre_usuario.findMany({
        where: { id_usuario: idUsuario },
        include: {
          _count: { select: { movimientos: true } },
        },
        orderBy: { fecha_hora: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.cierre_usuario.count({ where: { id_usuario: idUsuario } }),
    ]);

    return {
      data: data.map((c) => ({
        idCierreUsuario: c.id_cierre_usuario,
        fechaHora: c.fecha_hora.toISOString(),
        totalEfectivo: Number(c.total_efectivo),
        totalCheque: Number(c.total_cheque),
        totalTransferencia: Number(c.total_transferencia),
        totalDeposito: Number(c.total_deposito),
        totalTarjeta: Number(c.total_tarjeta),
        totalOtro: Number(c.total_otro),
        totalGeneral: Number(c.total_general),
        estado: c.estado,
        cantidadMovimientos: c._count.movimientos,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async listarCierresUsuarios(page: number = 1, limit: number = 10, idUsuarioFilter?: number) {
    const skip = (page - 1) * limit;
    const where: Prisma.cierre_usuarioWhereInput = idUsuarioFilter
      ? { id_usuario: idUsuarioFilter }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.cierre_usuario.findMany({
        where,
        include: {
          usuario: { select: { id_usuario: true, nombres: true, apellidos: true } },
          _count: { select: { movimientos: true } },
        },
        orderBy: { fecha_hora: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.cierre_usuario.count({ where }),
    ]);

    return {
      data: data.map((c) => ({
        idCierreUsuario: c.id_cierre_usuario,
        usuario: `${c.usuario.nombres} ${c.usuario.apellidos}`,
        idUsuario: c.id_usuario,
        fechaHora: c.fecha_hora.toISOString(),
        totalEfectivo: Number(c.total_efectivo),
        totalCheque: Number(c.total_cheque),
        totalTransferencia: Number(c.total_transferencia),
        totalDeposito: Number(c.total_deposito),
        totalTarjeta: Number(c.total_tarjeta),
        totalOtro: Number(c.total_otro),
        totalGeneral: Number(c.total_general),
        estado: c.estado,
        cantidadMovimientos: c._count.movimientos,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async obtenerMovimientosPendientesDiario() {
    const movimientos = await this.prisma.caja_movimiento.findMany({
      where: { id_cierre_diario: null },
      include: {
        usuario: { select: { id_usuario: true, nombres: true, apellidos: true } },
        cliente: { select: { id_cliente: true, titular: true } },
        abonoCxc: { select: { id_abono: true, referencia: true } },
      },
      orderBy: { fecha_hora: 'desc' },
    });

    const totales = this.calcularTotales(movimientos);

    return {
      movimientos: movimientos.map((m) => ({
        idMovimientoCaja: m.id_movimiento_caja,
        usuario: `${m.usuario.nombres} ${m.usuario.apellidos}`,
        idUsuario: m.id_usuario,
        idCliente: m.id_cliente,
        cliente: m.cliente.titular,
        monto: Number(m.monto),
        metodoPago: m.metodo_pago,
        fechaHora: m.fecha_hora.toISOString(),
        referencia: m.abonoCxc.referencia,
      })),
      totales,
    };
  }

  async generarCierreDiario(idUsuarioCreador: number) {
    return this.prisma.$transaction(async (tx) => {
      const movimientos = await tx.caja_movimiento.findMany({
        where: { id_cierre_diario: null },
      });

      if (movimientos.length === 0) {
        throw new BadRequestException('No hay movimientos pendientes de cierre diario');
      }

      const totales = this.calcularTotales(movimientos);

      const cierre = await tx.cierre_diario.create({
        data: {
          id_creado_por: idUsuarioCreador,
          total_efectivo: totales.totalEfectivo,
          total_cheque: totales.totalCheque,
          total_transferencia: totales.totalTransferencia,
          total_deposito: totales.totalDeposito,
          total_tarjeta: totales.totalTarjeta,
          total_otro: totales.totalOtro,
          total_general: totales.totalGeneral,
        },
      });

      await tx.caja_movimiento.updateMany({
        where: {
          id_movimiento_caja: { in: movimientos.map((m) => m.id_movimiento_caja) },
        },
        data: { id_cierre_diario: cierre.id_cierre_diario },
      });

      return {
        idCierreDiario: cierre.id_cierre_diario,
        fechaHora: cierre.fecha_hora.toISOString(),
        totalEfectivo: Number(cierre.total_efectivo),
        totalCheque: Number(cierre.total_cheque),
        totalTransferencia: Number(cierre.total_transferencia),
        totalDeposito: Number(cierre.total_deposito),
        totalTarjeta: Number(cierre.total_tarjeta),
        totalOtro: Number(cierre.total_otro),
        totalGeneral: Number(cierre.total_general),
        cantidadMovimientos: movimientos.length,
      };
    }, { timeout: 30000 });
  }

  async listarCierresDiarios(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.cierre_diario.findMany({
        include: {
          creadoPor: { select: { id_usuario: true, nombres: true, apellidos: true } },
          _count: { select: { movimientos: true } },
        },
        orderBy: { fecha_hora: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.cierre_diario.count(),
    ]);

    return {
      data: data.map((c) => ({
        idCierreDiario: c.id_cierre_diario,
        creadoPor: `${c.creadoPor.nombres} ${c.creadoPor.apellidos}`,
        idCreadoPor: c.id_creado_por,
        fechaHora: c.fecha_hora.toISOString(),
        totalEfectivo: Number(c.total_efectivo),
        totalCheque: Number(c.total_cheque),
        totalTransferencia: Number(c.total_transferencia),
        totalDeposito: Number(c.total_deposito),
        totalTarjeta: Number(c.total_tarjeta),
        totalOtro: Number(c.total_otro),
        totalGeneral: Number(c.total_general),
        estado: c.estado,
        cantidadMovimientos: c._count.movimientos,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async obtenerCierreDiario(idCierre: number) {
    const cierre = await this.prisma.cierre_diario.findUnique({
      where: { id_cierre_diario: idCierre },
      include: {
        creadoPor: { select: { id_usuario: true, nombres: true, apellidos: true } },
        movimientos: {
          include: {
            usuario: { select: { id_usuario: true, nombres: true, apellidos: true } },
            cliente: { select: { id_cliente: true, titular: true } },
            abonoCxc: { select: { id_abono: true, referencia: true } },
          },
          orderBy: { fecha_hora: 'asc' },
        },
      },
    });

    if (!cierre) {
      throw new BadRequestException('Cierre diario no encontrado');
    }

    return {
      idCierreDiario: cierre.id_cierre_diario,
      creadoPor: `${cierre.creadoPor.nombres} ${cierre.creadoPor.apellidos}`,
      idCreadoPor: cierre.id_creado_por,
      fechaHora: cierre.fecha_hora.toISOString(),
      totalEfectivo: Number(cierre.total_efectivo),
      totalCheque: Number(cierre.total_cheque),
      totalTransferencia: Number(cierre.total_transferencia),
      totalDeposito: Number(cierre.total_deposito),
      totalTarjeta: Number(cierre.total_tarjeta),
      totalOtro: Number(cierre.total_otro),
      totalGeneral: Number(cierre.total_general),
      estado: cierre.estado,
      movimientos: cierre.movimientos.map((m) => ({
        idMovimientoCaja: m.id_movimiento_caja,
        usuario: `${m.usuario.nombres} ${m.usuario.apellidos}`,
        idUsuario: m.id_usuario,
        idCliente: m.id_cliente,
        cliente: m.cliente.titular,
        monto: Number(m.monto),
        metodoPago: m.metodo_pago,
        fechaHora: m.fecha_hora.toISOString(),
        referencia: m.abonoCxc.referencia,
      })),
    };
  }

  private calcularTotales(movimientos: Array<{ monto: any; metodo_pago: metodo_pago_abono }>) {
    const totales = {
      totalEfectivo: 0,
      totalCheque: 0,
      totalTransferencia: 0,
      totalDeposito: 0,
      totalTarjeta: 0,
      totalOtro: 0,
      totalGeneral: 0,
    };

    for (const m of movimientos) {
      const monto = Number(m.monto);
      totales.totalGeneral += monto;

      switch (m.metodo_pago) {
        case 'EFECTIVO': totales.totalEfectivo += monto; break;
        case 'CHEQUE': totales.totalCheque += monto; break;
        case 'TRANSFERENCIA': totales.totalTransferencia += monto; break;
        case 'DEPOSITO': totales.totalDeposito += monto; break;
        case 'TARJETA': totales.totalTarjeta += monto; break;
        case 'OTRO': totales.totalOtro += monto; break;
      }
    }

    // Round all values
    for (const key of Object.keys(totales) as Array<keyof typeof totales>) {
      totales[key] = Math.round(totales[key] * 100) / 100;
    }

    return totales;
  }
}
