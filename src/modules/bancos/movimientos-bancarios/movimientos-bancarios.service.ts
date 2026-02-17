import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateMovimientoBancarioDto } from './dto/create-movimiento-bancario.dto';
import { CreateAjusteDto } from './dto/create-ajuste.dto';
import { AnularMovimientoDto } from './dto/anular-movimiento.dto';
import { FilterMovimientoBancarioDto } from './dto/filter-movimiento-bancario.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class MovimientosBancariosService {
  constructor(private readonly prisma: PrismaService) {}

  async crearMovimiento(
    dto: CreateMovimientoBancarioDto,
    id_usuario: number,
  ) {
    // Validar método vs detalle
    if (dto.metodo === 'CHEQUE' && !dto.cheque) {
      throw new BadRequestException('El detalle de cheque es requerido para el método CHEQUE');
    }
    if (dto.metodo === 'TRANSFERENCIA' && !dto.transferencia) {
      throw new BadRequestException('El detalle de transferencia es requerido para el método TRANSFERENCIA');
    }
    if (dto.metodo === 'DEPOSITO' && !dto.deposito) {
      throw new BadRequestException('El detalle de depósito es requerido para el método DEPOSITO');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Obtener la cuenta con lock optimista
      const cuenta = await tx.cuenta_bancaria.findUnique({
        where: { id_cuenta_bancaria: dto.id_cuenta_bancaria },
      });

      if (!cuenta) {
        throw new NotFoundException(`Cuenta bancaria con ID ${dto.id_cuenta_bancaria} no encontrada`);
      }

      if (cuenta.estado !== 'ACTIVO') {
        throw new BadRequestException('La cuenta bancaria no está activa');
      }

      // 2. Calcular nuevo saldo
      const saldoActual = new Prisma.Decimal(cuenta.saldo_actual.toString());
      const monto = new Prisma.Decimal(dto.monto.toString());
      let nuevoSaldo: Prisma.Decimal;

      switch (dto.tipo_movimiento) {
        case 'ENTRADA':
          nuevoSaldo = saldoActual.add(monto);
          break;
        case 'SALIDA':
          nuevoSaldo = saldoActual.sub(monto);
          break;
        case 'AJUSTE':
          // Para ajustes desde este endpoint, el monto siempre es positivo
          nuevoSaldo = saldoActual.add(monto);
          break;
        default:
          throw new BadRequestException('Tipo de movimiento no válido');
      }

      // 3. Validar saldo negativo
      if (!cuenta.permite_saldo_negativo && nuevoSaldo.lessThan(0)) {
        throw new BadRequestException(
          `Saldo insuficiente. Saldo actual: ${saldoActual.toString()}, monto: ${monto.toString()}`,
        );
      }

      // 4. Crear movimiento
      const movimiento = await tx.movimiento_bancario.create({
        data: {
          id_cuenta_bancaria: dto.id_cuenta_bancaria,
          id_usuario,
          fecha_movimiento: dto.fecha_movimiento ? new Date(dto.fecha_movimiento) : new Date(),
          tipo_movimiento: dto.tipo_movimiento,
          metodo: dto.metodo,
          monto: dto.monto,
          saldo_resultante: nuevoSaldo,
          referencia_bancaria: dto.referencia_bancaria,
          documento_origen_id: dto.documento_origen_id,
          modulo_origen: dto.modulo_origen,
          descripcion: dto.descripcion,
        },
      });

      // 5. Crear detalle según método
      if (dto.metodo === 'CHEQUE' && dto.cheque) {
        await tx.cheque.create({
          data: {
            id_movimiento: movimiento.id_movimiento,
            numero_cheque: dto.cheque.numero_cheque,
            beneficiario: dto.cheque.beneficiario,
            fecha_emision: new Date(dto.cheque.fecha_emision),
          },
        });
      }

      if (dto.metodo === 'TRANSFERENCIA' && dto.transferencia) {
        await tx.transferencia_bancaria.create({
          data: {
            id_movimiento: movimiento.id_movimiento,
            banco_contraparte: dto.transferencia.banco_contraparte,
            cuenta_contraparte: dto.transferencia.cuenta_contraparte,
            codigo_autorizacion: dto.transferencia.codigo_autorizacion,
            fecha_transferencia: new Date(dto.transferencia.fecha_transferencia),
          },
        });
      }

      if (dto.metodo === 'DEPOSITO' && dto.deposito) {
        await tx.deposito_bancario.create({
          data: {
            id_movimiento: movimiento.id_movimiento,
            tipo_deposito: dto.deposito.tipo_deposito as any,
            numero_boleta: dto.deposito.numero_boleta,
            fecha_deposito: new Date(dto.deposito.fecha_deposito),
          },
        });
      }

      // 6. Actualizar saldo con optimistic locking
      const updated = await tx.cuenta_bancaria.updateMany({
        where: {
          id_cuenta_bancaria: dto.id_cuenta_bancaria,
          version: cuenta.version,
        },
        data: {
          saldo_actual: nuevoSaldo,
          version: cuenta.version + 1,
        },
      });

      if (updated.count === 0) {
        throw new ConflictException(
          'La cuenta fue modificada por otro proceso. Intente nuevamente.',
        );
      }

      // 7. Log de auditoría
      await tx.log.create({
        data: {
          accion: 'CREAR_MOVIMIENTO_BANCARIO',
          descripcion: `Movimiento ${dto.tipo_movimiento} por ${dto.monto} en cuenta ${cuenta.numero_cuenta}. Saldo: ${saldoActual.toString()} → ${nuevoSaldo.toString()}`,
          id_usuario,
          fecha_creacion: new Date(),
        },
      });

      // Retornar con relaciones
      return tx.movimiento_bancario.findUnique({
        where: { id_movimiento: movimiento.id_movimiento },
        include: {
          cuenta_bancaria: {
            select: { id_cuenta_bancaria: true, numero_cuenta: true, saldo_actual: true },
          },
          cheque: true,
          transferencia: true,
          deposito: true,
          usuario: { select: { id_usuario: true, nombres: true, apellidos: true } },
        },
      });
    });
  }

  async crearAjuste(
    id_cuenta: number,
    dto: CreateAjusteDto,
    id_usuario: number,
  ) {
    if (dto.monto === 0) {
      throw new BadRequestException('El monto del ajuste no puede ser cero');
    }

    return this.prisma.$transaction(async (tx) => {
      const cuenta = await tx.cuenta_bancaria.findUnique({
        where: { id_cuenta_bancaria: id_cuenta },
      });

      if (!cuenta) {
        throw new NotFoundException(`Cuenta bancaria con ID ${id_cuenta} no encontrada`);
      }

      if (cuenta.estado !== 'ACTIVO') {
        throw new BadRequestException('La cuenta bancaria no está activa');
      }

      const saldoActual = new Prisma.Decimal(cuenta.saldo_actual.toString());
      const montoAjuste = new Prisma.Decimal(dto.monto.toString());
      const nuevoSaldo = saldoActual.add(montoAjuste);

      if (!cuenta.permite_saldo_negativo && nuevoSaldo.lessThan(0)) {
        throw new BadRequestException(
          `Saldo insuficiente para el ajuste. Saldo actual: ${saldoActual.toString()}, ajuste: ${montoAjuste.toString()}`,
        );
      }

      const tipoMovimiento = dto.monto > 0 ? 'ENTRADA' : 'SALIDA';

      const movimiento = await tx.movimiento_bancario.create({
        data: {
          id_cuenta_bancaria: id_cuenta,
          id_usuario,
          fecha_movimiento: new Date(),
          tipo_movimiento: tipoMovimiento as any,
          metodo: 'AJUSTE_MANUAL',
          monto: Math.abs(dto.monto),
          saldo_resultante: nuevoSaldo,
          referencia_bancaria: dto.referencia_bancaria,
          modulo_origen: 'MANUAL',
          descripcion: dto.descripcion,
        },
      });

      const updated = await tx.cuenta_bancaria.updateMany({
        where: {
          id_cuenta_bancaria: id_cuenta,
          version: cuenta.version,
        },
        data: {
          saldo_actual: nuevoSaldo,
          version: cuenta.version + 1,
        },
      });

      if (updated.count === 0) {
        throw new ConflictException(
          'La cuenta fue modificada por otro proceso. Intente nuevamente.',
        );
      }

      await tx.log.create({
        data: {
          accion: 'AJUSTE_SALDO_BANCARIO',
          descripcion: `Ajuste de saldo en cuenta ${cuenta.numero_cuenta}: ${saldoActual.toString()} → ${nuevoSaldo.toString()} (${dto.monto > 0 ? '+' : ''}${dto.monto}). Motivo: ${dto.descripcion}`,
          id_usuario,
          fecha_creacion: new Date(),
        },
      });

      return tx.movimiento_bancario.findUnique({
        where: { id_movimiento: movimiento.id_movimiento },
        include: {
          cuenta_bancaria: {
            select: { id_cuenta_bancaria: true, numero_cuenta: true, saldo_actual: true },
          },
          usuario: { select: { id_usuario: true, nombres: true, apellidos: true } },
        },
      });
    });
  }

  async anularMovimiento(
    id_movimiento: number,
    dto: AnularMovimientoDto,
    id_usuario: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Obtener movimiento original
      const movimiento = await tx.movimiento_bancario.findUnique({
        where: { id_movimiento },
        include: { cuenta_bancaria: true },
      });

      if (!movimiento) {
        throw new NotFoundException(`Movimiento con ID ${id_movimiento} no encontrado`);
      }

      if (movimiento.estado_movimiento !== 'ACTIVO') {
        throw new BadRequestException('El movimiento ya se encuentra anulado');
      }

      const cuenta = movimiento.cuenta_bancaria;

      // 2. Calcular reversa del saldo
      const saldoActual = new Prisma.Decimal(cuenta.saldo_actual.toString());
      const montoOriginal = new Prisma.Decimal(movimiento.monto.toString());
      let saldoRevertido: Prisma.Decimal;

      switch (movimiento.tipo_movimiento) {
        case 'ENTRADA':
          saldoRevertido = saldoActual.sub(montoOriginal);
          break;
        case 'SALIDA':
          saldoRevertido = saldoActual.add(montoOriginal);
          break;
        default:
          throw new BadRequestException(`Tipo de movimiento inválido para anulación: ${movimiento.tipo_movimiento}`);
      }

      if (!cuenta.permite_saldo_negativo && saldoRevertido.lessThan(0)) {
        throw new BadRequestException(
          `La anulación dejaría un saldo negativo (${saldoRevertido.toString()}). No se puede anular.`,
        );
      }

      // 3. Marcar movimiento como ANULADO
      await tx.movimiento_bancario.update({
        where: { id_movimiento },
        data: {
          estado_movimiento: 'ANULADO',
          id_usuario_anula: id_usuario,
          motivo_anulacion: dto.motivo_anulacion,
          fecha_anulacion: new Date(),
        },
      });

      // 4. Crear movimiento de reversa
      const tipoReversa = movimiento.tipo_movimiento === 'ENTRADA' ? 'SALIDA' : 'ENTRADA';
      const movimientoReversa = await tx.movimiento_bancario.create({
        data: {
          id_cuenta_bancaria: movimiento.id_cuenta_bancaria,
          id_usuario,
          fecha_movimiento: new Date(),
          tipo_movimiento: tipoReversa as any,
          metodo: movimiento.metodo,
          monto: movimiento.monto,
          saldo_resultante: saldoRevertido,
          referencia_bancaria: movimiento.referencia_bancaria,
          modulo_origen: 'MANUAL',
          descripcion: `Reversa del movimiento #${id_movimiento}: ${dto.motivo_anulacion}`,
          metadata: { movimiento_original_id: id_movimiento },
        },
      });

      // 5. Actualizar saldo con optimistic locking
      const updated = await tx.cuenta_bancaria.updateMany({
        where: {
          id_cuenta_bancaria: movimiento.id_cuenta_bancaria,
          version: cuenta.version,
        },
        data: {
          saldo_actual: saldoRevertido,
          version: cuenta.version + 1,
        },
      });

      if (updated.count === 0) {
        throw new ConflictException(
          'La cuenta fue modificada por otro proceso. Intente nuevamente.',
        );
      }

      // 6. Log de auditoría
      await tx.log.create({
        data: {
          accion: 'ANULAR_MOVIMIENTO_BANCARIO',
          descripcion: `Movimiento #${id_movimiento} anulado en cuenta ${cuenta.numero_cuenta}. Saldo: ${saldoActual.toString()} → ${saldoRevertido.toString()}. Motivo: ${dto.motivo_anulacion}`,
          id_usuario,
          fecha_creacion: new Date(),
        },
      });

      return tx.movimiento_bancario.findUnique({
        where: { id_movimiento: movimientoReversa.id_movimiento },
        include: {
          cuenta_bancaria: {
            select: { id_cuenta_bancaria: true, numero_cuenta: true, saldo_actual: true },
          },
          usuario: { select: { id_usuario: true, nombres: true, apellidos: true } },
        },
      });
    });
  }

  async findAll(
    filterDto: FilterMovimientoBancarioDto,
  ) {
    const {
      page = 1,
      limit = 10,
      search = '',
      id_cuenta_bancaria,
      tipo_movimiento,
      metodo,
      modulo_origen,
      estado_movimiento,
      fecha_desde,
      fecha_hasta,
    } = filterDto;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (id_cuenta_bancaria) {
      where.id_cuenta_bancaria = id_cuenta_bancaria;
    }

    if (tipo_movimiento) {
      where.tipo_movimiento = tipo_movimiento;
    }

    if (metodo) {
      where.metodo = metodo;
    }

    if (modulo_origen) {
      where.modulo_origen = modulo_origen;
    }

    if (estado_movimiento) {
      where.estado_movimiento = estado_movimiento;
    }

    if (fecha_desde || fecha_hasta) {
      where.fecha_movimiento = {};
      if (fecha_desde) {
        where.fecha_movimiento.gte = new Date(fecha_desde);
      }
      if (fecha_hasta) {
        // Incluir todo el día de fecha_hasta
        const fechaFin = new Date(fecha_hasta);
        fechaFin.setHours(23, 59, 59, 999);
        where.fecha_movimiento.lte = fechaFin;
      }
    }

    if (search) {
      where.OR = [
        { referencia_bancaria: { contains: search, mode: 'insensitive' } },
        { descripcion: { contains: search, mode: 'insensitive' } },
        { cuenta_bancaria: { numero_cuenta: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.movimiento_bancario.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fecha_movimiento: 'desc' },
        include: {
          cuenta_bancaria: {
            select: {
              id_cuenta_bancaria: true,
              numero_cuenta: true,
              alias: true,
              banco: { select: { nombre: true } },
            },
          },
          usuario: { select: { id_usuario: true, nombres: true, apellidos: true } },
          usuario_anula: { select: { id_usuario: true, nombres: true, apellidos: true } },
          cheque: true,
          transferencia: true,
          deposito: true,
        },
      }),
      this.prisma.movimiento_bancario.count({ where }),
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

  async findOne(id: number) {
    const movimiento = await this.prisma.movimiento_bancario.findUnique({
      where: { id_movimiento: id },
      include: {
        cuenta_bancaria: {
          select: {
            id_cuenta_bancaria: true,
            numero_cuenta: true,
            alias: true,
            banco: { select: { id_banco: true, nombre: true } },
            tipo_cuenta: { select: { id_tipo_cuenta: true, nombre: true } },
          },
        },
        usuario: { select: { id_usuario: true, nombres: true, apellidos: true } },
        usuario_anula: { select: { id_usuario: true, nombres: true, apellidos: true } },
        cheque: true,
        transferencia: true,
        deposito: true,
      },
    });

    if (!movimiento) {
      throw new NotFoundException(`Movimiento con ID ${id} no encontrado`);
    }

    return movimiento;
  }
}
