import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateCuentaBancariaDto } from './dto/create-cuenta-bancaria.dto';
import { UpdateCuentaBancariaDto } from './dto/update-cuenta-bancaria.dto';
import { FilterCuentaBancariaDto } from './dto/filter-cuenta-bancaria.dto';
import { cuenta_bancaria } from '@prisma/client';
import { PaginatedResult } from 'src/common/dto';

@Injectable()
export class CuentasBancariasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    dto: CreateCuentaBancariaDto,
    id_usuario: number,
  ): Promise<cuenta_bancaria> {
    // Validar que el banco existe y está activo
    const banco = await this.prisma.cat_banco.findUnique({
      where: { id_banco: dto.id_banco },
    });
    if (!banco || !banco.activo) {
      throw new BadRequestException('El banco seleccionado no existe o no está activo');
    }

    // Validar que el tipo de cuenta existe y está activo
    const tipoCuenta = await this.prisma.cat_tipo_cuenta_banco.findUnique({
      where: { id_tipo_cuenta: dto.id_tipo_cuenta },
    });
    if (!tipoCuenta || !tipoCuenta.activo) {
      throw new BadRequestException('El tipo de cuenta seleccionado no existe o no está activo');
    }

    // Validar que el número de cuenta no existe
    const existente = await this.prisma.cuenta_bancaria.findUnique({
      where: { numero_cuenta: dto.numero_cuenta },
    });
    if (existente) {
      throw new ConflictException('Ya existe una cuenta con ese número');
    }

    const cuenta = await this.prisma.cuenta_bancaria.create({
      data: {
        id_banco: dto.id_banco,
        id_tipo_cuenta: dto.id_tipo_cuenta,
        id_sucursal: dto.id_sucursal,
        id_usuario_crea: id_usuario,
        numero_cuenta: dto.numero_cuenta,
        alias: dto.alias,
        moneda: dto.moneda ?? 'USD',
        saldo_actual: dto.saldo_actual ?? 0,
        permite_saldo_negativo: dto.permite_saldo_negativo ?? false,
        fecha_apertura: dto.fecha_apertura ? new Date(dto.fecha_apertura) : null,
      },
      include: {
        banco: { select: { id_banco: true, nombre: true } },
        tipo_cuenta: { select: { id_tipo_cuenta: true, nombre: true } },
        sucursal: { select: { id_sucursal: true, nombre: true } },
      },
    });

    await this.prisma.logAction(
      'CREAR_CUENTA_BANCARIA',
      id_usuario,
      `Cuenta bancaria creada: ${cuenta.numero_cuenta} (${banco.nombre})`,
    );

    return cuenta;
  }

  async findAll(
    filterDto: FilterCuentaBancariaDto,
  ): Promise<PaginatedResult<cuenta_bancaria>> {
    const { page = 1, limit = 10, search = '', id_banco, id_sucursal, estado } = filterDto;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (estado) {
      where.estado = estado;
    } else {
      where.estado = 'ACTIVO';
    }

    if (id_banco) {
      where.id_banco = id_banco;
    }

    if (id_sucursal) {
      where.id_sucursal = id_sucursal;
    }

    if (search) {
      where.OR = [
        { numero_cuenta: { contains: search, mode: 'insensitive' } },
        { alias: { contains: search, mode: 'insensitive' } },
        { banco: { nombre: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.cuenta_bancaria.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fecha_creacion: 'desc' },
        include: {
          banco: { select: { id_banco: true, nombre: true, codigo: true } },
          tipo_cuenta: { select: { id_tipo_cuenta: true, nombre: true } },
          sucursal: { select: { id_sucursal: true, nombre: true } },
          usuario_crea: { select: { id_usuario: true, nombres: true, apellidos: true } },
        },
      }),
      this.prisma.cuenta_bancaria.count({ where }),
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

  async findOne(id: number): Promise<cuenta_bancaria> {
    const cuenta = await this.prisma.cuenta_bancaria.findUnique({
      where: { id_cuenta_bancaria: id },
      include: {
        banco: { select: { id_banco: true, nombre: true, codigo: true } },
        tipo_cuenta: { select: { id_tipo_cuenta: true, nombre: true } },
        sucursal: { select: { id_sucursal: true, nombre: true } },
        usuario_crea: { select: { id_usuario: true, nombres: true, apellidos: true } },
      },
    });

    if (!cuenta) {
      throw new NotFoundException(`Cuenta bancaria con ID ${id} no encontrada`);
    }

    return cuenta;
  }

  async update(
    id: number,
    dto: UpdateCuentaBancariaDto,
    id_usuario: number,
  ): Promise<cuenta_bancaria> {
    const cuenta = await this.prisma.cuenta_bancaria.findUnique({
      where: { id_cuenta_bancaria: id },
    });

    if (!cuenta) {
      throw new NotFoundException(`Cuenta bancaria con ID ${id} no encontrada`);
    }

    // Validar que no se deshabilite saldo negativo con saldo actual negativo
    if (dto.permite_saldo_negativo === false && cuenta.saldo_actual.lessThan(0)) {
      throw new BadRequestException(
        `No se puede deshabilitar saldo negativo cuando el saldo actual es ${cuenta.saldo_actual.toString()}`,
      );
    }

    // Si cambia el número de cuenta, validar unicidad
    if (dto.numero_cuenta && dto.numero_cuenta !== cuenta.numero_cuenta) {
      const existente = await this.prisma.cuenta_bancaria.findUnique({
        where: { numero_cuenta: dto.numero_cuenta },
      });
      if (existente) {
        throw new ConflictException('Ya existe una cuenta con ese número');
      }
    }

    const updated = await this.prisma.cuenta_bancaria.update({
      where: { id_cuenta_bancaria: id },
      data: {
        ...(dto.id_banco !== undefined && { id_banco: dto.id_banco }),
        ...(dto.id_tipo_cuenta !== undefined && { id_tipo_cuenta: dto.id_tipo_cuenta }),
        ...(dto.id_sucursal !== undefined && { id_sucursal: dto.id_sucursal }),
        ...(dto.numero_cuenta !== undefined && { numero_cuenta: dto.numero_cuenta }),
        ...(dto.alias !== undefined && { alias: dto.alias }),
        ...(dto.moneda !== undefined && { moneda: dto.moneda }),
        ...(dto.permite_saldo_negativo !== undefined && { permite_saldo_negativo: dto.permite_saldo_negativo }),
        ...(dto.fecha_apertura !== undefined && { fecha_apertura: new Date(dto.fecha_apertura) }),
      },
      include: {
        banco: { select: { id_banco: true, nombre: true } },
        tipo_cuenta: { select: { id_tipo_cuenta: true, nombre: true } },
        sucursal: { select: { id_sucursal: true, nombre: true } },
      },
    });

    await this.prisma.logAction(
      'ACTUALIZAR_CUENTA_BANCARIA',
      id_usuario,
      `Cuenta bancaria actualizada: ${updated.numero_cuenta} (ID: ${id})`,
    );

    return updated;
  }

  async remove(id: number, id_usuario: number): Promise<cuenta_bancaria> {
    const cuenta = await this.prisma.cuenta_bancaria.findUnique({
      where: { id_cuenta_bancaria: id },
    });

    if (!cuenta) {
      throw new NotFoundException(`Cuenta bancaria con ID ${id} no encontrada`);
    }

    if (cuenta.estado === 'INACTIVO') {
      throw new BadRequestException('La cuenta ya se encuentra inactiva');
    }

    const updated = await this.prisma.cuenta_bancaria.update({
      where: { id_cuenta_bancaria: id },
      data: { estado: 'INACTIVO' },
    });

    await this.prisma.logAction(
      'DESACTIVAR_CUENTA_BANCARIA',
      id_usuario,
      `Cuenta bancaria desactivada: ${cuenta.numero_cuenta} (ID: ${id})`,
    );

    return updated;
  }

  async getSaldo(id: number): Promise<{ id_cuenta_bancaria: number; saldo_actual: number; moneda: string }> {
    const cuenta = await this.prisma.cuenta_bancaria.findUnique({
      where: { id_cuenta_bancaria: id },
      select: { id_cuenta_bancaria: true, saldo_actual: true, moneda: true },
    });

    if (!cuenta) {
      throw new NotFoundException(`Cuenta bancaria con ID ${id} no encontrada`);
    }

    return {
      id_cuenta_bancaria: cuenta.id_cuenta_bancaria,
      saldo_actual: Number(cuenta.saldo_actual),
      moneda: cuenta.moneda,
    };
  }
}
