// src/modules/inventario/bodegas/bodegas.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateBodegaDto } from './dto/create-bodega.dto';
import { UpdateBodegaDto } from './dto/update-bodega.dto';
import { FilterBodegaDto } from './dto/filter-bodega.dto';
import { bodegas } from '@prisma/client';
import { PaginatedResult } from 'src/common/dto';

@Injectable()
export class BodegasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createBodegaDto: CreateBodegaDto, id_usuario?: number): Promise<bodegas> {
    const { id_sucursal, id_responsable, ...rest } = createBodegaDto;
    const bodega = await this.prisma.bodegas.create({
      data: {
        ...rest,
        id_sucursal: +id_sucursal,
        id_responsable: id_responsable ? +id_responsable : undefined,
      },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'CREAR_BODEGA',
      id_usuario,
      `Bodega creada: ${bodega.nombre}`,
    );

    return bodega;
  }

  async findAll(filterDto: FilterBodegaDto): Promise<PaginatedResult<bodegas>> {
    const { page = 1, limit = 10, search = '', id_sucursal } = filterDto;
    const skip = (page - 1) * limit;

    // Construir el filtro de búsqueda
    const where: any = {
      estado: 'ACTIVO',
    };

    // Filtrar por sucursal si se proporciona
    if (id_sucursal) {
      where.id_sucursal = id_sucursal;
    }

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { descripcion: { contains: search, mode: 'insensitive' } },
        { tipo: { contains: search, mode: 'insensitive' } },
        { placa_vehiculo: { contains: search, mode: 'insensitive' } },
        { sucursal: { nombre: { contains: search, mode: 'insensitive' } } },
        { responsable: { nombres: { contains: search, mode: 'insensitive' } } },
        { responsable: { apellidos: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Ejecutar consultas en paralelo
    const [data, total] = await Promise.all([
      this.prisma.bodegas.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fecha_creacion: 'desc' },
        include: {
          sucursal: {
            select: {
              id_sucursal: true,
              nombre: true,
            },
          },
          responsable: {
            select: {
              id_usuario: true,
              nombres: true,
              apellidos: true,
            },
          },
          estantes: true,
        },
      }),
      this.prisma.bodegas.count({ where }),
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

  async findOne(id: number): Promise<bodegas> {
    const bodega = await this.prisma.bodegas.findUnique({
      where: { id_bodega: id },
      include: {
        sucursal: {
          select: {
            id_sucursal: true,
            nombre: true,
          },
        },
        responsable: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
    });
    if (!bodega) {
      throw new NotFoundException(`Bodega with ID ${id} not found`);
    }
    return bodega;
  }

  async update(id: number, updateBodegaDto: UpdateBodegaDto, id_usuario?: number): Promise<bodegas> {
    await this.findOne(id); // check if exists
    const { id_sucursal, id_responsable, ...rest } = updateBodegaDto;
    const bodega = await this.prisma.bodegas.update({
      where: { id_bodega: id },
      data: {
        ...rest,
        id_sucursal: id_sucursal ? +id_sucursal : undefined,
        id_responsable: id_responsable ? +id_responsable : undefined,
      },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'ACTUALIZAR_BODEGA',
      id_usuario,
      `Bodega actualizada: ${bodega.nombre}`,
    );

    return bodega;
  }

  async remove(id: number, id_usuario?: number): Promise<bodegas> {
    await this.findOne(id); // check if exists
    const bodega = await this.prisma.bodegas.update({
      where: { id_bodega: id },
      data: { estado: 'INACTIVO' },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'ELIMINAR_BODEGA',
      id_usuario,
      `Bodega eliminada: ${bodega.nombre}`,
    );

    return bodega;
  }
}
