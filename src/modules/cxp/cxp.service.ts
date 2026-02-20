import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { ConsultarCxpDto, CrearPagoDto, AnularPagoDto } from './dto';
import { Prisma } from '@prisma/client';
import { PaginatedResult } from 'src/common/dto';

/** Métodos de pago compatibles con registro bancario */
const METODOS_PAGO_BANCARIOS = ['CHEQUE', 'TRANSFERENCIA', 'DEPOSITO'] as const;

/** Mapeo de metodo_pago_abono a metodo_movimiento_bancario */
const METODO_PAGO_A_BANCARIO: Record<string, string> = {
  CHEQUE: 'CHEQUE',
  TRANSFERENCIA: 'TRANSFERENCIA',
  DEPOSITO: 'DEPOSITO',
};

@Injectable()
export class CxpService {
  private readonly logger = new Logger(CxpService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crear una cuenta por pagar (llamado desde compras al crear compra a crédito)
   */
  async crearCuentaPorPagar(
    data: {
      id_compras: number;
      id_proveedor: number;
      monto_total: number | Prisma.Decimal;
      dias_credito: number;
      fecha_emision: Date;
      id_sucursal: number;
      id_usuario: number;
      observaciones?: string;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;

    if (!data.id_proveedor) {
      throw new BadRequestException('Se requiere un proveedor registrado para crear una CxP');
    }

    if (!data.id_sucursal) {
      throw new BadRequestException('Se requiere una sucursal para crear una CxP');
    }

    const montoTotal = new Prisma.Decimal(data.monto_total.toString());
    if (montoTotal.lte(0)) {
      throw new BadRequestException('El monto total debe ser mayor a 0');
    }

    const fechaEmision = new Date(data.fecha_emision);
    const fechaVencimiento = new Date(fechaEmision);
    fechaVencimiento.setDate(fechaVencimiento.getDate() + data.dias_credito);

    const cxp = await (client as any).cuenta_por_pagar.create({
      data: {
        id_compras: data.id_compras,
        id_proveedor: data.id_proveedor,
        monto_total: montoTotal,
        saldo_pendiente: montoTotal,
        total_pagado: 0,
        fecha_emision: fechaEmision,
        fecha_vencimiento: fechaVencimiento,
        dias_credito: data.dias_credito,
        estado: 'PENDIENTE',
        id_sucursal: data.id_sucursal,
        id_usuario_crea: data.id_usuario,
        observaciones: data.observaciones,
      },
    });

    await this.prisma.logAction(
      'CREAR_CXP',
      data.id_usuario,
      `CxP creada para compra #${data.id_compras}, monto: $${montoTotal}, vence: ${fechaVencimiento.toISOString().split('T')[0]}`,
    );

    this.logger.log(`CxP #${cxp.id_cxp} creada para compra #${data.id_compras}`);
    return cxp;
  }

  /**
   * Registrar un pago a una cuenta por pagar
   */
  async registrarPago(id_cxp: number, dto: CrearPagoDto, id_usuario: number) {
    if (dto.id_cuenta_bancaria) {
      if (!(METODOS_PAGO_BANCARIOS as readonly string[]).includes(dto.metodo_pago)) {
        throw new BadRequestException(
          `El método de pago ${dto.metodo_pago} no es compatible con registro bancario. Use CHEQUE, TRANSFERENCIA o DEPOSITO.`,
        );
      }
    }

    const cxp = await this.prisma.cuenta_por_pagar.findUnique({
      where: { id_cxp },
      include: { compra: true },
    });

    if (!cxp) {
      throw new NotFoundException(`Cuenta por pagar #${id_cxp} no encontrada`);
    }

    if (cxp.estado === 'PAGADA_TOTAL') {
      throw new BadRequestException('Esta cuenta ya fue pagada en su totalidad');
    }

    if (cxp.estado === 'ANULADA') {
      throw new BadRequestException('No se puede pagar una cuenta anulada');
    }

    const montoPago = new Prisma.Decimal(dto.monto.toString());
    const saldoPendiente = new Prisma.Decimal(cxp.saldo_pendiente.toString());

    if (montoPago.gt(saldoPendiente)) {
      throw new BadRequestException(
        `El monto del pago ($${montoPago}) excede el saldo pendiente ($${saldoPendiente})`,
      );
    }

    const saldoPosterior = saldoPendiente.minus(montoPago);
    const totalPagado = new Prisma.Decimal(cxp.total_pagado.toString()).plus(montoPago);
    const nuevoEstado = saldoPosterior.eq(0) ? 'PAGADA_TOTAL' : 'PAGADA_PARCIAL';

    const resultado = await this.prisma.$transaction(async (tx) => {
      // 1. Crear pago
      const pago = await tx.pago_cxp.create({
        data: {
          id_cxp,
          monto: montoPago,
          saldo_anterior: saldoPendiente,
          saldo_posterior: saldoPosterior,
          metodo_pago: dto.metodo_pago,
          referencia: dto.referencia,
          fecha_pago: dto.fecha_pago ? new Date(dto.fecha_pago) : new Date(),
          id_movimiento_bancario: null,
          id_usuario,
          observaciones: dto.observaciones,
        },
      });

      // 2. Actualizar CxP
      await tx.cuenta_por_pagar.update({
        where: { id_cxp },
        data: {
          saldo_pendiente: saldoPosterior,
          total_pagado: totalPagado,
          estado: nuevoEstado,
        },
      });

      // 3. Si se proporcionó cuenta bancaria, crear movimiento bancario (SALIDA)
      if (dto.id_cuenta_bancaria) {
        const cuenta = await tx.cuenta_bancaria.findUnique({
          where: { id_cuenta_bancaria: dto.id_cuenta_bancaria },
        });

        if (!cuenta) {
          throw new NotFoundException(
            `Cuenta bancaria #${dto.id_cuenta_bancaria} no encontrada`,
          );
        }

        const nuevoSaldo = new Prisma.Decimal(cuenta.saldo_actual.toString()).minus(montoPago);

        if (!cuenta.permite_saldo_negativo && nuevoSaldo.lt(0)) {
          throw new BadRequestException(
            `Fondos insuficientes en cuenta bancaria #${dto.id_cuenta_bancaria}. Saldo disponible: $${cuenta.saldo_actual}`,
          );
        }

        const metodoBancario = METODO_PAGO_A_BANCARIO[dto.metodo_pago];

        const movimiento = await tx.movimiento_bancario.create({
          data: {
            id_cuenta_bancaria: dto.id_cuenta_bancaria,
            id_usuario,
            tipo_movimiento: 'SALIDA',
            metodo: metodoBancario as any,
            monto: montoPago,
            saldo_resultante: nuevoSaldo,
            referencia_bancaria: dto.referencia,
            documento_origen_id: cxp.id_cxp,
            modulo_origen: 'CUENTAS_POR_PAGAR',
            descripcion: `Pago CxP #${id_cxp} - Compra Factura #${cxp.compra.numero_factura}`,
          },
        });

        // Optimistic locking: version check
        const updateResult = await tx.cuenta_bancaria.updateMany({
          where: {
            id_cuenta_bancaria: dto.id_cuenta_bancaria,
            version: cuenta.version,
          },
          data: {
            saldo_actual: nuevoSaldo,
            version: { increment: 1 },
          },
        });

        if (updateResult.count === 0) {
          throw new ConflictException(
            'Conflicto de concurrencia al actualizar saldo bancario. Intente nuevamente.',
          );
        }

        await tx.pago_cxp.update({
          where: { id_pago: pago.id_pago },
          data: { id_movimiento_bancario: movimiento.id_movimiento },
        });
      }

      return pago;
    });

    await this.prisma.logAction(
      'REGISTRAR_PAGO_CXP',
      id_usuario,
      `Pago de $${montoPago} registrado en CxP #${id_cxp}. Saldo anterior: $${saldoPendiente}, saldo posterior: $${saldoPosterior}`,
    );

    this.logger.log(`Pago #${resultado.id_pago} registrado en CxP #${id_cxp}`);
    return resultado;
  }

  /**
   * Anular un pago (reversa)
   */
  async anularPago(id_pago: number, dto: AnularPagoDto, id_usuario: number) {
    const pago = await this.prisma.pago_cxp.findUnique({
      where: { id_pago },
      include: {
        cuentaPorPagar: {
          include: { compra: true },
        },
      },
    });

    if (!pago) {
      throw new NotFoundException(`Pago #${id_pago} no encontrado`);
    }

    if (!pago.activo) {
      throw new BadRequestException('Este pago ya fue anulado');
    }

    const cxp = pago.cuentaPorPagar;

    if (cxp.estado === 'ANULADA') {
      throw new BadRequestException('No se puede anular un pago de una cuenta ya anulada');
    }

    const montoPago = new Prisma.Decimal(pago.monto.toString());
    const nuevoSaldoPendiente = new Prisma.Decimal(cxp.saldo_pendiente.toString()).plus(montoPago);
    const nuevoTotalPagado = new Prisma.Decimal(cxp.total_pagado.toString()).minus(montoPago);
    const nuevoEstado = nuevoTotalPagado.eq(0) ? 'PENDIENTE' : 'PAGADA_PARCIAL';

    await this.prisma.$transaction(async (tx) => {
      // 1. Marcar pago como inactivo
      await tx.pago_cxp.update({
        where: { id_pago },
        data: { activo: false },
      });

      // 2. Recalcular CxP
      await tx.cuenta_por_pagar.update({
        where: { id_cxp: cxp.id_cxp },
        data: {
          saldo_pendiente: nuevoSaldoPendiente,
          total_pagado: nuevoTotalPagado,
          estado: nuevoEstado,
        },
      });

      // 3. Revertir movimiento bancario si existe (ENTRADA para reversar la SALIDA)
      if (pago.id_movimiento_bancario) {
        const movOrig = await tx.movimiento_bancario.findUnique({
          where: { id_movimiento: pago.id_movimiento_bancario },
        });

        if (movOrig) {
          const cuentaBancaria = await tx.cuenta_bancaria.findUnique({
            where: { id_cuenta_bancaria: movOrig.id_cuenta_bancaria },
          });

          if (cuentaBancaria) {
            const saldoRevertido = new Prisma.Decimal(cuentaBancaria.saldo_actual.toString()).plus(montoPago);

            await tx.movimiento_bancario.create({
              data: {
                id_cuenta_bancaria: movOrig.id_cuenta_bancaria,
                id_usuario,
                tipo_movimiento: 'ENTRADA',
                metodo: movOrig.metodo,
                monto: montoPago,
                saldo_resultante: saldoRevertido,
                documento_origen_id: cxp.id_cxp,
                modulo_origen: 'CUENTAS_POR_PAGAR',
                descripcion: `Reversa pago CxP #${cxp.id_cxp}. Motivo: ${dto.motivo}`,
              },
            });

            const updateResult = await tx.cuenta_bancaria.updateMany({
              where: {
                id_cuenta_bancaria: movOrig.id_cuenta_bancaria,
                version: cuentaBancaria.version,
              },
              data: {
                saldo_actual: saldoRevertido,
                version: { increment: 1 },
              },
            });

            if (updateResult.count === 0) {
              throw new ConflictException(
                'Conflicto de concurrencia al revertir saldo bancario. Intente nuevamente.',
              );
            }
          }
        }
      }
    });

    await this.prisma.logAction(
      'ANULAR_PAGO_CXP',
      id_usuario,
      `Pago #${id_pago} anulado en CxP #${cxp.id_cxp}. Motivo: ${dto.motivo}. Monto revertido: $${montoPago}`,
    );

    this.logger.log(`Pago #${id_pago} anulado en CxP #${cxp.id_cxp}`);
    return { message: 'Pago anulado exitosamente' };
  }

  /**
   * Listar cuentas por pagar con filtros y paginación
   */
  async findAll(dto: ConsultarCxpDto): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 10, search = '' } = dto;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (dto.id_proveedor) {
      where.id_proveedor = dto.id_proveedor;
    }

    if (dto.id_sucursal) {
      where.id_sucursal = dto.id_sucursal;
    }

    if (dto.fecha_vencimiento_desde || dto.fecha_vencimiento_hasta) {
      where.fecha_vencimiento = {};
      if (dto.fecha_vencimiento_desde) {
        where.fecha_vencimiento.gte = new Date(dto.fecha_vencimiento_desde);
      }
      if (dto.fecha_vencimiento_hasta) {
        where.fecha_vencimiento.lte = new Date(dto.fecha_vencimiento_hasta + 'T23:59:59.999Z');
      }
    }

    if (dto.fecha_emision_desde || dto.fecha_emision_hasta) {
      where.fecha_emision = {};
      if (dto.fecha_emision_desde) {
        where.fecha_emision.gte = new Date(dto.fecha_emision_desde);
      }
      if (dto.fecha_emision_hasta) {
        where.fecha_emision.lte = new Date(dto.fecha_emision_hasta + 'T23:59:59.999Z');
      }
    }

    // solo_vencidas takes precedence over explicit estado filter
    if (dto.solo_vencidas) {
      where.fecha_vencimiento = { ...where.fecha_vencimiento, lt: new Date() };
      where.estado = { in: ['PENDIENTE', 'PAGADA_PARCIAL', 'VENCIDA'] };
    } else if (dto.estado) {
      where.estado = dto.estado;
    }

    if (search) {
      where.OR = [
        { compra: { numero_factura: { contains: search, mode: 'insensitive' } } },
        { proveedor: { nombre_razon_social: { contains: search, mode: 'insensitive' } } },
        { proveedor: { numero_documento: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.cuenta_por_pagar.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fecha_vencimiento: 'asc' },
        include: {
          compra: {
            select: {
              id_compras: true,
              numero_factura: true,
              nombre_proveedor: true,
              total: true,
              fecha_creacion: true,
            },
          },
          proveedor: {
            select: {
              id_proveedor: true,
              nombre_razon_social: true,
              numero_documento: true,
              telefono: true,
              correo: true,
            },
          },
          sucursal: {
            select: { id_sucursal: true, nombre: true },
          },
          _count: { select: { pagos: true } },
        },
      }),
      this.prisma.cuenta_por_pagar.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Obtener detalle de una cuenta por pagar
   */
  async findOne(id_cxp: number) {
    const cxp = await this.prisma.cuenta_por_pagar.findUnique({
      where: { id_cxp },
      include: {
        compra: {
          select: {
            id_compras: true,
            numero_factura: true,
            nombre_proveedor: true,
            total: true,
            fecha_creacion: true,
            numero_quedan: true,
          },
        },
        proveedor: {
          select: {
            id_proveedor: true,
            nombre_razon_social: true,
            numero_documento: true,
            telefono: true,
            correo: true,
            direccion: true,
          },
        },
        sucursal: {
          select: { id_sucursal: true, nombre: true },
        },
        usuarioCrea: {
          select: { id_usuario: true, nombres: true, apellidos: true },
        },
        pagos: {
          where: { activo: true },
          orderBy: { fecha_pago: 'desc' },
          include: {
            usuario: {
              select: { id_usuario: true, nombres: true, apellidos: true },
            },
          },
        },
      },
    });

    if (!cxp) {
      throw new NotFoundException(`Cuenta por pagar #${id_cxp} no encontrada`);
    }

    return cxp;
  }

  /**
   * Obtener todas las CxP de un proveedor con resumen
   */
  async obtenerCxpPorProveedor(id_proveedor: number) {
    const proveedor = await this.prisma.proveedores.findUnique({
      where: { id_proveedor },
    });

    if (!proveedor) {
      throw new NotFoundException(`Proveedor #${id_proveedor} no encontrado`);
    }

    const cuentas = await this.prisma.cuenta_por_pagar.findMany({
      where: {
        id_proveedor,
        estado: { notIn: ['ANULADA'] },
      },
      orderBy: { fecha_vencimiento: 'asc' },
      include: {
        compra: {
          select: {
            id_compras: true,
            numero_factura: true,
            total: true,
            fecha_creacion: true,
          },
        },
        _count: { select: { pagos: true } },
      },
    });

    const ahora = new Date();
    let totalDeuda = new Prisma.Decimal(0);
    let totalVencido = new Prisma.Decimal(0);
    let totalAlDia = new Prisma.Decimal(0);
    let numPendientes = 0;

    for (const cuenta of cuentas) {
      if (cuenta.estado === 'PAGADA_TOTAL') continue;

      const saldo = new Prisma.Decimal(cuenta.saldo_pendiente.toString());
      totalDeuda = totalDeuda.plus(saldo);
      numPendientes++;

      if (cuenta.fecha_vencimiento < ahora) {
        totalVencido = totalVencido.plus(saldo);
      } else {
        totalAlDia = totalAlDia.plus(saldo);
      }
    }

    return {
      proveedor: {
        id_proveedor: proveedor.id_proveedor,
        nombre_razon_social: proveedor.nombre_razon_social,
        numero_documento: proveedor.numero_documento,
      },
      resumen: {
        total_deuda: totalDeuda,
        total_vencido: totalVencido,
        total_al_dia: totalAlDia,
        num_cxp_pendientes: numPendientes,
      },
      cuentas,
    };
  }

  /**
   * Obtener CxP vencidas con agrupación por antigüedad
   */
  async obtenerCxpVencidas(id_sucursal?: number) {
    const ahora = new Date();

    const where: any = {
      fecha_vencimiento: { lt: ahora },
      estado: { in: ['PENDIENTE', 'PAGADA_PARCIAL', 'VENCIDA'] },
    };

    if (id_sucursal) {
      where.id_sucursal = id_sucursal;
    }

    const cuentas = await this.prisma.cuenta_por_pagar.findMany({
      where,
      orderBy: { fecha_vencimiento: 'asc' },
      include: {
        compra: {
          select: {
            id_compras: true,
            numero_factura: true,
            nombre_proveedor: true,
            total: true,
          },
        },
        proveedor: {
          select: {
            id_proveedor: true,
            nombre_razon_social: true,
            numero_documento: true,
          },
        },
        sucursal: {
          select: { id_sucursal: true, nombre: true },
        },
      },
    });

    // Agrupar por buckets de antigüedad
    const buckets = {
      '1-30': { count: 0, total: new Prisma.Decimal(0), cuentas: [] as any[] },
      '31-60': { count: 0, total: new Prisma.Decimal(0), cuentas: [] as any[] },
      '61-90': { count: 0, total: new Prisma.Decimal(0), cuentas: [] as any[] },
      '90+': { count: 0, total: new Prisma.Decimal(0), cuentas: [] as any[] },
    };

    let totalVencido = new Prisma.Decimal(0);

    for (const cuenta of cuentas) {
      const diasVencida = Math.floor(
        (ahora.getTime() - cuenta.fecha_vencimiento.getTime()) / (1000 * 60 * 60 * 24),
      );
      const saldo = new Prisma.Decimal(cuenta.saldo_pendiente.toString());
      totalVencido = totalVencido.plus(saldo);

      const item = { ...cuenta, dias_vencida: diasVencida };

      if (diasVencida <= 30) {
        buckets['1-30'].count++;
        buckets['1-30'].total = buckets['1-30'].total.plus(saldo);
        buckets['1-30'].cuentas.push(item);
      } else if (diasVencida <= 60) {
        buckets['31-60'].count++;
        buckets['31-60'].total = buckets['31-60'].total.plus(saldo);
        buckets['31-60'].cuentas.push(item);
      } else if (diasVencida <= 90) {
        buckets['61-90'].count++;
        buckets['61-90'].total = buckets['61-90'].total.plus(saldo);
        buckets['61-90'].cuentas.push(item);
      } else {
        buckets['90+'].count++;
        buckets['90+'].total = buckets['90+'].total.plus(saldo);
        buckets['90+'].cuentas.push(item);
      }
    }

    return {
      total_vencido: totalVencido,
      total_cuentas: cuentas.length,
      buckets,
    };
  }

  /**
   * Resumen general de CxP
   */
  async obtenerResumenGeneral(id_sucursal?: number) {
    const where: any = {
      estado: { notIn: ['ANULADA'] },
    };

    if (id_sucursal) {
      where.id_sucursal = id_sucursal;
    }

    const ahora = new Date();

    // Totales pendientes (incluye vencidas)
    const pendientes = await this.prisma.cuenta_por_pagar.aggregate({
      where: {
        ...where,
        estado: { in: ['PENDIENTE', 'PAGADA_PARCIAL', 'VENCIDA'] },
      },
      _count: true,
      _sum: { saldo_pendiente: true },
    });

    // Totales vencidas
    const vencidas = await this.prisma.cuenta_por_pagar.aggregate({
      where: {
        ...where,
        estado: { in: ['PENDIENTE', 'PAGADA_PARCIAL', 'VENCIDA'] },
        fecha_vencimiento: { lt: ahora },
      },
      _count: true,
      _sum: { saldo_pendiente: true },
    });

    // Total pagado (sum de pagos activos)
    const pagoWhere: any = { activo: true };
    if (id_sucursal) {
      pagoWhere.cuentaPorPagar = { id_sucursal };
    }

    const pagado = await this.prisma.pago_cxp.aggregate({
      where: pagoWhere,
      _sum: { monto: true },
    });

    // Pagadas total
    const pagadas = await this.prisma.cuenta_por_pagar.aggregate({
      where: {
        ...where,
        estado: 'PAGADA_TOTAL',
      },
      _count: true,
      _sum: { monto_total: true },
    });

    return {
      pendientes: {
        count: pendientes._count,
        total_saldo: pendientes._sum.saldo_pendiente || 0,
      },
      vencidas: {
        count: vencidas._count,
        total_saldo: vencidas._sum.saldo_pendiente || 0,
      },
      pagado: {
        total: pagado._sum.monto || 0,
      },
      pagadas: {
        count: pagadas._count,
        total: pagadas._sum.monto_total || 0,
      },
    };
  }

  /**
   * Anular CxP cuando se elimina/inactiva la compra asociada
   */
  async anularCxpPorCompra(id_compras: number, tx?: Prisma.TransactionClient) {
    const client = tx || this.prisma;

    const cxp = await (client as any).cuenta_por_pagar.findUnique({
      where: { id_compras },
    });

    if (!cxp) {
      return; // No hay CxP asociada, no hacer nada
    }

    const totalPagado = new Prisma.Decimal(cxp.total_pagado.toString());
    if (totalPagado.gt(0)) {
      throw new BadRequestException(
        `La compra tiene una CxP (#${cxp.id_cxp}) con pagos registrados por $${totalPagado}. Debe anular los pagos antes de eliminar la compra.`,
      );
    }

    await (client as any).cuenta_por_pagar.update({
      where: { id_cxp: cxp.id_cxp },
      data: { estado: 'ANULADA' },
    });

    this.logger.log(`CxP #${cxp.id_cxp} anulada por eliminación de compra #${id_compras}`);
  }

  /**
   * Actualizar estados vencidos (batch update)
   */
  async actualizarEstadosVencidos() {
    const ahora = new Date();

    const resultado = await this.prisma.cuenta_por_pagar.updateMany({
      where: {
        fecha_vencimiento: { lt: ahora },
        estado: { in: ['PENDIENTE', 'PAGADA_PARCIAL'] },
      },
      data: { estado: 'VENCIDA' },
    });

    this.logger.log(`${resultado.count} cuentas por pagar marcadas como VENCIDA`);

    return {
      message: `${resultado.count} cuentas actualizadas a estado VENCIDA`,
      count: resultado.count,
    };
  }
}
