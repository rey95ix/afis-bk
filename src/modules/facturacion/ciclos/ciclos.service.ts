// src/modules/facturacion/ciclos/ciclos.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateCicloDto, UpdateCicloDto, QueryCicloDto } from './dto';
import { PaginationDto, PaginatedResult } from 'src/common/dto';
import { atcCicloFacturacion } from '@prisma/client';

@Injectable()
export class CiclosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crear un nuevo ciclo de facturación
   */
  async create(
    createCicloDto: CreateCicloDto,
    id_usuario: number,
  ): Promise<atcCicloFacturacion> {
    // Validar que no exista un ciclo con el mismo día de corte
    const existingCiclo = await this.prisma.atcCicloFacturacion.findFirst({
      where: {
        dia_corte: createCicloDto.dia_corte,
        estado: 'ACTIVO',
      },
    });

    if (existingCiclo) {
      throw new BadRequestException(
        `Ya existe un ciclo activo con día de corte ${createCicloDto.dia_corte}`,
      );
    }

    const ciclo = await this.prisma.atcCicloFacturacion.create({
      data: {
        nombre: createCicloDto.nombre,
        dia_corte: createCicloDto.dia_corte,
        dia_vencimiento: createCicloDto.dia_vencimiento,
        periodo_inicio: createCicloDto.periodo_inicio,
        periodo_fin: createCicloDto.periodo_fin,
      },
    });

    await this.prisma.logAction(
      'CREAR_CICLO_FACTURACION',
      id_usuario,
      `Ciclo creado: ${ciclo.nombre}`,
    );

    return ciclo;
  }

  /**
   * Listar ciclos con paginación y filtros
   */
  async findAll(
    queryDto: QueryCicloDto,
  ): Promise<PaginatedResult<atcCicloFacturacion & { _count: { contratos: number } }>> {
    const { page = 1, limit = 10, search, estado } = queryDto;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.nombre = { contains: search, mode: 'insensitive' };
    }

    if (estado) {
      where.estado = estado;
    }

    const [data, total] = await Promise.all([
      this.prisma.atcCicloFacturacion.findMany({
        where,
        skip,
        take: limit,
        include: {
          _count: {
            select: { contratos: true },
          },
        },
        orderBy: { dia_corte: 'asc' },
      }),
      this.prisma.atcCicloFacturacion.count({ where }),
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
   * Listar todos los ciclos activos (sin paginación, para dropdowns)
   */
  async findAllActive(): Promise<atcCicloFacturacion[]> {
    return this.prisma.atcCicloFacturacion.findMany({
      where: { estado: 'ACTIVO' },
      orderBy: { dia_corte: 'asc' },
    });
  }

  /**
   * Obtener un ciclo por ID
   */
  async findOne(id: number): Promise<atcCicloFacturacion> {
    const ciclo = await this.prisma.atcCicloFacturacion.findUnique({
      where: { id_ciclo: id },
      include: {
        _count: {
          select: { contratos: true },
        },
      },
    });

    if (!ciclo) {
      throw new NotFoundException(`Ciclo con ID ${id} no encontrado`);
    }

    return ciclo;
  }

  /**
   * Obtener los contratos de un ciclo con paginación
   */
  async findContratosByCiclo(id: number, paginationDto: PaginationDto) {
    const ciclo = await this.findOne(id);

    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const [contratos, total] = await Promise.all([
      this.prisma.atcContrato.findMany({
        where: { id_ciclo: id },
        skip,
        take: limit,
        include: {
          cliente: {
            select: {
              id_cliente: true,
              titular: true,
              telefono1: true,
              dui: true,
            },
          },
          plan: {
            select: {
              id_plan: true,
              nombre: true,
              precio: true,
            },
          },
          direccionServicio: {
            select: {
              direccion: true,
            },
          },
        },
        orderBy: { fecha_creacion: 'desc' },
      }),
      this.prisma.atcContrato.count({ where: { id_ciclo: id } }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      ciclo: {
        id_ciclo: ciclo.id_ciclo,
        nombre: ciclo.nombre,
        dia_corte: ciclo.dia_corte,
        dia_vencimiento: ciclo.dia_vencimiento,
        periodo_inicio: ciclo.periodo_inicio,
        periodo_fin: ciclo.periodo_fin,
      },
      contratos: {
        data: contratos,
        meta: {
          total,
          page,
          limit,
          totalPages,
        },
      },
    };
  }

  /**
   * Actualizar un ciclo
   */
  async update(
    id: number,
    updateCicloDto: UpdateCicloDto,
    id_usuario: number,
  ): Promise<atcCicloFacturacion> {
    const existingCiclo = await this.findOne(id);

    // Si se está cambiando el día de corte, validar que no exista otro ciclo con ese día
    if (
      updateCicloDto.dia_corte &&
      updateCicloDto.dia_corte !== existingCiclo.dia_corte
    ) {
      const duplicateCiclo = await this.prisma.atcCicloFacturacion.findFirst({
        where: {
          dia_corte: updateCicloDto.dia_corte,
          estado: 'ACTIVO',
          NOT: { id_ciclo: id },
        },
      });

      if (duplicateCiclo) {
        throw new BadRequestException(
          `Ya existe un ciclo activo con día de corte ${updateCicloDto.dia_corte}`,
        );
      }
    }

    const ciclo = await this.prisma.atcCicloFacturacion.update({
      where: { id_ciclo: id },
      data: updateCicloDto,
    });

    await this.prisma.logAction(
      'ACTUALIZAR_CICLO_FACTURACION',
      id_usuario,
      `Ciclo actualizado: ${ciclo.nombre}`,
    );

    return ciclo;
  }

  /**
   * Eliminar un ciclo (soft delete)
   */
  async remove(id: number, id_usuario: number): Promise<atcCicloFacturacion> {
    const ciclo = await this.findOne(id);

    // Verificar si tiene contratos asociados
    const contratosCount = await this.prisma.atcContrato.count({
      where: { id_ciclo: id },
    });

    if (contratosCount > 0) {
      throw new BadRequestException(
        `No se puede eliminar el ciclo porque tiene ${contratosCount} contrato(s) asociado(s)`,
      );
    }

    const updatedCiclo = await this.prisma.atcCicloFacturacion.update({
      where: { id_ciclo: id },
      data: { estado: 'INACTIVO' },
    });

    await this.prisma.logAction(
      'ELIMINAR_CICLO_FACTURACION',
      id_usuario,
      `Ciclo eliminado: ${ciclo.nombre}`,
    );

    return updatedCiclo;
  }
}
