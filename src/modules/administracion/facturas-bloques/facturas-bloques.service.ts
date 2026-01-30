import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateFacturasBloqueDto, UpdateFacturasBloqueDto } from './dto';
import { facturasBloques, Prisma } from '@prisma/client';
import { PaginatedResult } from 'src/common/dto';

@Injectable()
export class FacturasBloquesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateFacturasBloqueDto, id_usuario?: number): Promise<facturasBloques> {
    // Validar que desde < hasta
    if (createDto.desde >= createDto.hasta) {
      throw new BadRequestException('El número inicial debe ser menor que el número final');
    }

    // Validar que actual esté en el rango
    if (createDto.actual < createDto.desde - 1 || createDto.actual > createDto.hasta) {
      throw new BadRequestException('El número actual debe estar dentro del rango del bloque');
    }

    // Validar que el tipo de factura existe
    const tipoFactura = await this.prisma.facturasTipos.findUnique({
      where: { id_tipo_factura: createDto.id_tipo_factura },
    });
    if (!tipoFactura) {
      throw new NotFoundException(`Tipo de factura ${createDto.id_tipo_factura} no encontrado`);
    }

    // Validar que la sucursal existe si se proporciona
    if (createDto.id_sucursal) {
      const sucursal = await this.prisma.sucursales.findUnique({
        where: { id_sucursal: createDto.id_sucursal },
      });
      if (!sucursal) {
        throw new NotFoundException(`Sucursal ${createDto.id_sucursal} no encontrada`);
      }
    }

    const bloque = await this.prisma.facturasBloques.create({
      data: {
        tira: createDto.tira,
        autorizacion: createDto.autorizacion || '',
        resolucion: createDto.resolucion || '',
        desde: createDto.desde,
        hasta: createDto.hasta,
        actual: createDto.actual,
        serie: createDto.serie,
        id_tipo_factura: createDto.id_tipo_factura,
        id_sucursal: createDto.id_sucursal,
      },
      include: {
        Tipo: true,
        Sucursal: true,
      },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'CREAR_BLOQUE_FACTURA',
      id_usuario,
      `Bloque de facturas creado: ${bloque.serie} (${bloque.desde}-${bloque.hasta})`,
    );

    return bloque;
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
    id_tipo_factura?: number,
    id_sucursal?: number,
    estado?: string,
  ): Promise<PaginatedResult<facturasBloques>> {
    const skip = (page - 1) * limit;

    const where: Prisma.facturasBloquesFindManyArgs['where'] = {};

    if (search) {
      where.OR = [
        { serie: { contains: search, mode: 'insensitive' } },
        { tira: { contains: search, mode: 'insensitive' } },
        { autorizacion: { contains: search, mode: 'insensitive' } },
        { resolucion: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (id_tipo_factura) {
      where.id_tipo_factura = id_tipo_factura;
    }

    if (id_sucursal) {
      where.id_sucursal = id_sucursal;
    }

    if (estado) {
      where.estado = estado as any;
    }

    const [data, total] = await Promise.all([
      this.prisma.facturasBloques.findMany({
        where,
        skip,
        take: limit,
        include: {
          Tipo: true,
          Sucursal: {
            select: { id_sucursal: true, nombre: true },
          },
        },
        orderBy: { fecha_creacion: 'desc' },
      }),
      this.prisma.facturasBloques.count({ where }),
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

  async findOne(id: number): Promise<facturasBloques> {
    const bloque = await this.prisma.facturasBloques.findUnique({
      where: { id_bloque: id },
      include: {
        Tipo: true,
        Sucursal: true,
      },
    });

    if (!bloque) {
      throw new NotFoundException(`Bloque con ID ${id} no encontrado`);
    }

    return bloque;
  }

  async update(id: number, updateDto: UpdateFacturasBloqueDto, id_usuario?: number): Promise<facturasBloques> {
    await this.findOne(id); // Verificar que existe

    // Validar rango si se actualizan desde/hasta
    if (updateDto.desde !== undefined && updateDto.hasta !== undefined) {
      if (updateDto.desde >= updateDto.hasta) {
        throw new BadRequestException('El número inicial debe ser menor que el número final');
      }
    }

    // Validar tipo de factura si se actualiza
    if (updateDto.id_tipo_factura) {
      const tipoFactura = await this.prisma.facturasTipos.findUnique({
        where: { id_tipo_factura: updateDto.id_tipo_factura },
      });
      if (!tipoFactura) {
        throw new NotFoundException(`Tipo de factura ${updateDto.id_tipo_factura} no encontrado`);
      }
    }

    // Validar sucursal si se actualiza
    if (updateDto.id_sucursal) {
      const sucursal = await this.prisma.sucursales.findUnique({
        where: { id_sucursal: updateDto.id_sucursal },
      });
      if (!sucursal) {
        throw new NotFoundException(`Sucursal ${updateDto.id_sucursal} no encontrada`);
      }
    }

    const bloque = await this.prisma.facturasBloques.update({
      where: { id_bloque: id },
      data: updateDto,
      include: {
        Tipo: true,
        Sucursal: true,
      },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'ACTUALIZAR_BLOQUE_FACTURA',
      id_usuario,
      `Bloque de facturas actualizado: ${bloque.serie}`,
    );

    return bloque;
  }

  async remove(id: number, id_usuario?: number): Promise<facturasBloques> {
    const bloqueAntes = await this.findOne(id);

    // Soft delete - cambiar estado a INACTIVO
    const bloque = await this.prisma.facturasBloques.update({
      where: { id_bloque: id },
      data: { estado: 'INACTIVO' },
      include: {
        Tipo: true,
        Sucursal: true,
      },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'ELIMINAR_BLOQUE_FACTURA',
      id_usuario,
      `Bloque de facturas eliminado: ${bloqueAntes.serie}`,
    );

    return bloque;
  }

  /**
   * Obtener tipos de factura para el selector
   */
  async getTiposFactura() {
    return this.prisma.facturasTipos.findMany({
      where: { estado: 'ACTIVO' },
      orderBy: { nombre: 'asc' },
    });
  }

  /**
   * Obtener sucursales para el selector
   */
  async getSucursales() {
    return this.prisma.sucursales.findMany({
      where: { estado: 'ACTIVO' },
      select: { id_sucursal: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
  }
}
