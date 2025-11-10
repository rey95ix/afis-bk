// src/modules/inventario/estantes/estantes.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateEstanteDto } from './dto/create-estante.dto';
import { UpdateEstanteDto } from './dto/update-estante.dto';
import { estantes } from '@prisma/client';
import { PaginationDto, PaginatedResult } from 'src/common/dto';

@Injectable()
export class EstantesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createEstanteDto: CreateEstanteDto): Promise<estantes> {
    const { id_bodega, ...rest } = createEstanteDto;
    const estante = await this.prisma.estantes.create({
      data: {
        ...rest,
        id_bodega: +id_bodega,
      },
    });
    return estante;
  }

  async findAll(id_bodega: number, paginationDto: PaginationDto): Promise<PaginatedResult<estantes>> {
    const { page = 1, limit = 10, search = '' } = paginationDto;
    const skip = (page - 1) * limit;

    const where: any = {
      id_bodega: id_bodega,
      estado: 'ACTIVO',
    };

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.estantes.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fecha_creacion: 'desc' },
      }),
      this.prisma.estantes.count({ where }),
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

  async findOne(id: number): Promise<estantes> {
    const estante = await this.prisma.estantes.findUnique({
      where: { id_estante: id },
    });
    if (!estante) {
      throw new NotFoundException(`Estante with ID ${id} not found`);
    }
    return estante;
  }

  async update(id: number, updateEstanteDto: UpdateEstanteDto): Promise<estantes> {
    await this.findOne(id); // check if exists
    const { id_bodega, ...rest } = updateEstanteDto;
    const estante = await this.prisma.estantes.update({
      where: { id_estante: id },
      data: {
        ...rest,
        id_bodega: id_bodega ? +id_bodega : undefined,
      },
    });
    return estante;
  }

  async remove(id: number): Promise<estantes> {
    await this.findOne(id); // check if exists
    const estante = await this.prisma.estantes.update({
      where: { id_estante: id },
      data: { estado: 'INACTIVO' },
    });
    return estante;
  }
}
