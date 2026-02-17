import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { ConsultarCxcDto, CrearAbonoDto, AnularAbonoDto } from './dto';
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
export class CxcService {
  private readonly logger = new Logger(CxcService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crear una cuenta por cobrar (llamado desde facturación al crear factura a crédito)
   */
  async crearCuentaPorCobrar(
    data: {
      id_factura_directa: number;
      id_cliente_directo: number;
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

    if (!data.id_cliente_directo) {
      throw new BadRequestException('Se requiere un cliente registrado para crear una CxC');
    }

    const montoTotal = new Prisma.Decimal(data.monto_total.toString());
    if (montoTotal.lte(0)) {
      throw new BadRequestException('El monto total debe ser mayor a 0');
    }

    const fechaEmision = new Date(data.fecha_emision);
    const fechaVencimiento = new Date(fechaEmision);
    fechaVencimiento.setDate(fechaVencimiento.getDate() + data.dias_credito);

    const cxc = await (client as any).cuenta_por_cobrar.create({
      data: {
        id_factura_directa: data.id_factura_directa,
        id_cliente_directo: data.id_cliente_directo,
        monto_total: montoTotal,
        saldo_pendiente: montoTotal,
        total_abonado: 0,
        fecha_emision: fechaEmision,
        fecha_vencimiento: fechaVencimiento,
        dias_credito: data.dias_credito,
        estado: 'PENDIENTE',
        id_sucursal: data.id_sucursal,
        id_usuario_crea: data.id_usuario,
        observaciones: data.observaciones,
      },
    });

    // Log fuera de la tx — best-effort audit
    await this.prisma.logAction(
      'CREAR_CXC',
      data.id_usuario,
      `CxC creada para factura #${data.id_factura_directa}, monto: $${montoTotal}, vence: ${fechaVencimiento.toISOString().split('T')[0]}`,
    );

    this.logger.log(`CxC #${cxc.id_cxc} creada para factura #${data.id_factura_directa}`);
    return cxc;
  }

  /**
   * Registrar un abono a una cuenta por cobrar
   */
  async registrarAbono(id_cxc: number, dto: CrearAbonoDto, id_usuario: number) {
    // Validar compatibilidad de método de pago con cuenta bancaria
    if (dto.id_cuenta_bancaria) {
      if (!(METODOS_PAGO_BANCARIOS as readonly string[]).includes(dto.metodo_pago)) {
        throw new BadRequestException(
          `El método de pago ${dto.metodo_pago} no es compatible con registro bancario. Use CHEQUE, TRANSFERENCIA o DEPOSITO.`,
        );
      }
    }

    const cxc = await this.prisma.cuenta_por_cobrar.findUnique({
      where: { id_cxc },
      include: { facturaDirecta: true },
    });

    if (!cxc) {
      throw new NotFoundException(`Cuenta por cobrar #${id_cxc} no encontrada`);
    }

    if (cxc.estado === 'PAGADA_TOTAL') {
      throw new BadRequestException('Esta cuenta ya fue pagada en su totalidad');
    }

    if (cxc.estado === 'ANULADA') {
      throw new BadRequestException('No se puede abonar a una cuenta anulada');
    }

    const montoAbono = new Prisma.Decimal(dto.monto.toString());
    const saldoPendiente = new Prisma.Decimal(cxc.saldo_pendiente.toString());

    if (montoAbono.gt(saldoPendiente)) {
      throw new BadRequestException(
        `El monto del abono ($${montoAbono}) excede el saldo pendiente ($${saldoPendiente})`,
      );
    }

    const saldoPosterior = saldoPendiente.minus(montoAbono);
    const totalAbonado = new Prisma.Decimal(cxc.total_abonado.toString()).plus(montoAbono);
    const nuevoEstado = saldoPosterior.eq(0) ? 'PAGADA_TOTAL' : 'PAGADA_PARCIAL';
    const estadoPagoFactura = saldoPosterior.eq(0) ? 'PAGADO' : 'PARCIAL';

    const resultado = await this.prisma.$transaction(async (tx) => {
      // 1. Crear abono
      const abono = await tx.abono_cxc.create({
        data: {
          id_cxc,
          monto: montoAbono,
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

      // 2. Actualizar CxC
      await tx.cuenta_por_cobrar.update({
        where: { id_cxc },
        data: {
          saldo_pendiente: saldoPosterior,
          total_abonado: totalAbonado,
          estado: nuevoEstado,
        },
      });

      // 3. Actualizar estado de pago de la factura
      await tx.facturaDirecta.update({
        where: { id_factura_directa: cxc.id_factura_directa },
        data: { estado_pago: estadoPagoFactura },
      });

      // 4. Si se proporcionó cuenta bancaria, crear movimiento bancario
      if (dto.id_cuenta_bancaria) {
        const cuenta = await tx.cuenta_bancaria.findUnique({
          where: { id_cuenta_bancaria: dto.id_cuenta_bancaria },
        });

        if (cuenta) {
          const nuevoSaldo = new Prisma.Decimal(cuenta.saldo_actual.toString()).plus(montoAbono);
          const metodoBancario = METODO_PAGO_A_BANCARIO[dto.metodo_pago];

          const movimiento = await tx.movimiento_bancario.create({
            data: {
              id_cuenta_bancaria: dto.id_cuenta_bancaria,
              id_usuario,
              tipo_movimiento: 'ENTRADA',
              metodo: metodoBancario as any,
              monto: montoAbono,
              saldo_resultante: nuevoSaldo,
              referencia_bancaria: dto.referencia,
              documento_origen_id: cxc.id_cxc,
              modulo_origen: 'CUENTAS_POR_COBRAR',
              descripcion: `Abono CxC #${id_cxc} - Factura #${cxc.facturaDirecta.numero_factura}`,
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

          await tx.abono_cxc.update({
            where: { id_abono: abono.id_abono },
            data: { id_movimiento_bancario: movimiento.id_movimiento },
          });
        }
      }

      return abono;
    });

    await this.prisma.logAction(
      'REGISTRAR_ABONO_CXC',
      id_usuario,
      `Abono de $${montoAbono} registrado en CxC #${id_cxc}. Saldo anterior: $${saldoPendiente}, saldo posterior: $${saldoPosterior}`,
    );

    this.logger.log(`Abono #${resultado.id_abono} registrado en CxC #${id_cxc}`);
    return resultado;
  }

  /**
   * Anular un abono (reversa)
   */
  async anularAbono(id_abono: number, dto: AnularAbonoDto, id_usuario: number) {
    const abono = await this.prisma.abono_cxc.findUnique({
      where: { id_abono },
      include: {
        cuentaPorCobrar: {
          include: { facturaDirecta: true },
        },
      },
    });

    if (!abono) {
      throw new NotFoundException(`Abono #${id_abono} no encontrado`);
    }

    if (!abono.activo) {
      throw new BadRequestException('Este abono ya fue anulado');
    }

    const cxc = abono.cuentaPorCobrar;

    if (cxc.estado === 'ANULADA') {
      throw new BadRequestException('No se puede anular un abono de una cuenta ya anulada');
    }

    const montoAbono = new Prisma.Decimal(abono.monto.toString());
    const nuevoSaldoPendiente = new Prisma.Decimal(cxc.saldo_pendiente.toString()).plus(montoAbono);
    const nuevoTotalAbonado = new Prisma.Decimal(cxc.total_abonado.toString()).minus(montoAbono);
    const nuevoEstado = nuevoTotalAbonado.eq(0) ? 'PENDIENTE' : 'PAGADA_PARCIAL';
    const estadoPagoFactura = nuevoTotalAbonado.eq(0) ? 'PENDIENTE' : 'PARCIAL';

    await this.prisma.$transaction(async (tx) => {
      // 1. Marcar abono como inactivo
      await tx.abono_cxc.update({
        where: { id_abono },
        data: { activo: false },
      });

      // 2. Recalcular CxC
      await tx.cuenta_por_cobrar.update({
        where: { id_cxc: cxc.id_cxc },
        data: {
          saldo_pendiente: nuevoSaldoPendiente,
          total_abonado: nuevoTotalAbonado,
          estado: nuevoEstado,
        },
      });

      // 3. Actualizar estado de pago de la factura
      await tx.facturaDirecta.update({
        where: { id_factura_directa: cxc.id_factura_directa },
        data: { estado_pago: estadoPagoFactura },
      });

      // 4. Revertir movimiento bancario si existe
      if (abono.id_movimiento_bancario) {
        const movOrig = await tx.movimiento_bancario.findUnique({
          where: { id_movimiento: abono.id_movimiento_bancario },
        });

        if (movOrig) {
          const cuentaBancaria = await tx.cuenta_bancaria.findUnique({
            where: { id_cuenta_bancaria: movOrig.id_cuenta_bancaria },
          });

          if (cuentaBancaria) {
            const saldoRevertido = new Prisma.Decimal(cuentaBancaria.saldo_actual.toString()).minus(montoAbono);

            await tx.movimiento_bancario.create({
              data: {
                id_cuenta_bancaria: movOrig.id_cuenta_bancaria,
                id_usuario,
                tipo_movimiento: 'SALIDA',
                metodo: movOrig.metodo,
                monto: montoAbono,
                saldo_resultante: saldoRevertido,
                documento_origen_id: cxc.id_cxc,
                modulo_origen: 'CUENTAS_POR_COBRAR',
                descripcion: `Reversa abono CxC #${cxc.id_cxc}. Motivo: ${dto.motivo}`,
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
      'ANULAR_ABONO_CXC',
      id_usuario,
      `Abono #${id_abono} anulado en CxC #${cxc.id_cxc}. Motivo: ${dto.motivo}. Monto revertido: $${montoAbono}`,
    );

    this.logger.log(`Abono #${id_abono} anulado en CxC #${cxc.id_cxc}`);
    return { message: 'Abono anulado exitosamente' };
  }

  /**
   * Listar cuentas por cobrar con filtros y paginación
   */
  async findAll(dto: ConsultarCxcDto): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 10, search = '' } = dto;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (dto.id_cliente_directo) {
      where.id_cliente_directo = dto.id_cliente_directo;
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
        { facturaDirecta: { numero_factura: { contains: search, mode: 'insensitive' } } },
        { facturaDirecta: { cliente_nombre: { contains: search, mode: 'insensitive' } } },
        { clienteDirecto: { nombre: { contains: search, mode: 'insensitive' } } },
        { clienteDirecto: { nit: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.cuenta_por_cobrar.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fecha_vencimiento: 'asc' },
        include: {
          facturaDirecta: {
            select: {
              id_factura_directa: true,
              numero_factura: true,
              cliente_nombre: true,
              total: true,
              estado_pago: true,
              condicion_operacion: true,
              fecha_creacion: true,
            },
          },
          clienteDirecto: {
            select: {
              id_cliente_directo: true,
              nombre: true,
              nit: true,
              telefono: true,
              correo: true,
            },
          },
          sucursal: {
            select: { id_sucursal: true, nombre: true },
          },
          _count: { select: { abonos: true } },
        },
      }),
      this.prisma.cuenta_por_cobrar.count({ where }),
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
   * Obtener detalle de una cuenta por cobrar
   */
  async findOne(id_cxc: number) {
    const cxc = await this.prisma.cuenta_por_cobrar.findUnique({
      where: { id_cxc },
      include: {
        facturaDirecta: {
          select: {
            id_factura_directa: true,
            numero_factura: true,
            cliente_nombre: true,
            total: true,
            estado_pago: true,
            condicion_operacion: true,
            fecha_creacion: true,
            codigo_generacion: true,
          },
        },
        clienteDirecto: {
          select: {
            id_cliente_directo: true,
            nombre: true,
            nit: true,
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
        abonos: {
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

    if (!cxc) {
      throw new NotFoundException(`Cuenta por cobrar #${id_cxc} no encontrada`);
    }

    return cxc;
  }

  /**
   * Obtener todas las CxC de un cliente con resumen
   */
  async obtenerCxcPorCliente(id_cliente_directo: number) {
    const cliente = await this.prisma.clienteDirecto.findUnique({
      where: { id_cliente_directo },
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente #${id_cliente_directo} no encontrado`);
    }

    const cuentas = await this.prisma.cuenta_por_cobrar.findMany({
      where: {
        id_cliente_directo,
        estado: { notIn: ['ANULADA'] },
      },
      orderBy: { fecha_vencimiento: 'asc' },
      include: {
        facturaDirecta: {
          select: {
            id_factura_directa: true,
            numero_factura: true,
            total: true,
            estado_pago: true,
            fecha_creacion: true,
          },
        },
        _count: { select: { abonos: true } },
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
      cliente: {
        id_cliente_directo: cliente.id_cliente_directo,
        nombre: cliente.nombre,
        nit: cliente.nit,
      },
      resumen: {
        total_deuda: totalDeuda,
        total_vencido: totalVencido,
        total_al_dia: totalAlDia,
        num_cxc_pendientes: numPendientes,
      },
      cuentas,
    };
  }

  /**
   * Obtener CxC vencidas con agrupación por antigüedad
   */
  async obtenerCxcVencidas(id_sucursal?: number) {
    const ahora = new Date();

    const where: any = {
      fecha_vencimiento: { lt: ahora },
      estado: { in: ['PENDIENTE', 'PAGADA_PARCIAL', 'VENCIDA'] },
    };

    if (id_sucursal) {
      where.id_sucursal = id_sucursal;
    }

    const cuentas = await this.prisma.cuenta_por_cobrar.findMany({
      where,
      orderBy: { fecha_vencimiento: 'asc' },
      include: {
        facturaDirecta: {
          select: {
            id_factura_directa: true,
            numero_factura: true,
            cliente_nombre: true,
            total: true,
          },
        },
        clienteDirecto: {
          select: {
            id_cliente_directo: true,
            nombre: true,
            nit: true,
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
   * Resumen general de CxC
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
    const pendientes = await this.prisma.cuenta_por_cobrar.aggregate({
      where: {
        ...where,
        estado: { in: ['PENDIENTE', 'PAGADA_PARCIAL', 'VENCIDA'] },
      },
      _count: true,
      _sum: { saldo_pendiente: true },
    });

    // Totales vencidas
    const vencidas = await this.prisma.cuenta_por_cobrar.aggregate({
      where: {
        ...where,
        estado: { in: ['PENDIENTE', 'PAGADA_PARCIAL', 'VENCIDA'] },
        fecha_vencimiento: { lt: ahora },
      },
      _count: true,
      _sum: { saldo_pendiente: true },
    });

    // Total cobrado (sum de abonos activos)
    const abonoWhere: any = { activo: true };
    if (id_sucursal) {
      abonoWhere.cuentaPorCobrar = { id_sucursal };
    }

    const cobrado = await this.prisma.abono_cxc.aggregate({
      where: abonoWhere,
      _sum: { monto: true },
    });

    // Pagadas total
    const pagadas = await this.prisma.cuenta_por_cobrar.aggregate({
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
      cobrado: {
        total: cobrado._sum.monto || 0,
      },
      pagadas: {
        count: pagadas._count,
        total: pagadas._sum.monto_total || 0,
      },
    };
  }

  /**
   * Anular CxC cuando se anula la factura asociada
   */
  async anularCxcPorFactura(id_factura_directa: number, tx?: Prisma.TransactionClient) {
    const client = tx || this.prisma;

    const cxc = await (client as any).cuenta_por_cobrar.findUnique({
      where: { id_factura_directa },
    });

    if (!cxc) {
      return; // No hay CxC asociada, no hacer nada
    }

    const totalAbonado = new Prisma.Decimal(cxc.total_abonado.toString());
    if (totalAbonado.gt(0)) {
      throw new BadRequestException(
        `La factura tiene una CxC (#${cxc.id_cxc}) con abonos registrados por $${totalAbonado}. Debe anular los abonos antes de anular la factura.`,
      );
    }

    await (client as any).cuenta_por_cobrar.update({
      where: { id_cxc: cxc.id_cxc },
      data: { estado: 'ANULADA' },
    });

    this.logger.log(`CxC #${cxc.id_cxc} anulada por anulación de factura #${id_factura_directa}`);
  }

  /**
   * Actualizar estados vencidos (batch update)
   */
  async actualizarEstadosVencidos() {
    const ahora = new Date();

    const resultado = await this.prisma.cuenta_por_cobrar.updateMany({
      where: {
        fecha_vencimiento: { lt: ahora },
        estado: { in: ['PENDIENTE', 'PAGADA_PARCIAL'] },
      },
      data: { estado: 'VENCIDA' },
    });

    this.logger.log(`${resultado.count} cuentas por cobrar marcadas como VENCIDA`);

    return {
      message: `${resultado.count} cuentas actualizadas a estado VENCIDA`,
      count: resultado.count,
    };
  }
}
