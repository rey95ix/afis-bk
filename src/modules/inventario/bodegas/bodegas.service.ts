// src/modules/inventario/bodegas/bodegas.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateBodegaDto } from './dto/create-bodega.dto';
import { UpdateBodegaDto } from './dto/update-bodega.dto';
import { bodegas } from '@prisma/client';
import { PaginationDto, PaginatedResult } from 'src/common/dto';

@Injectable()
export class BodegasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createBodegaDto: CreateBodegaDto): Promise<bodegas> {
    const { id_sucursal, ...rest } = createBodegaDto;
    return this.prisma.bodegas.create({
      data: {
        ...rest,
        id_sucursal: +id_sucursal,
      },
    });
  }

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResult<bodegas>> {
    const { page = 1, limit = 10, search = '' } = paginationDto;
    const skip = (page - 1) * limit;

    // Construir el filtro de búsqueda
    const where: any = {
      estado: 'ACTIVO',
    };

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { descripcion: { contains: search, mode: 'insensitive' } },
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
    });
    if (!bodega) {
      throw new NotFoundException(`Bodega with ID ${id} not found`);
    }
    return bodega;
  }

  async update(id: number, updateBodegaDto: UpdateBodegaDto): Promise<bodegas> {
    await this.findOne(id); // check if exists
    const { id_sucursal, ...rest } = updateBodegaDto;
    return this.prisma.bodegas.update({
      where: { id_bodega: id },
      data: {
        ...rest,
        id_sucursal: id_sucursal ? +id_sucursal : undefined,
      },
    });
  }

  async remove(id: number): Promise<bodegas> {
    await this.findOne(id); // check if exists
    return this.prisma.bodegas.update({
      where: { id_bodega: id },
      data: { estado: 'INACTIVO' },
    });
  }
}
