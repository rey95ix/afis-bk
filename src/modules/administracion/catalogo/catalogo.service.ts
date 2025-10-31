// src/modules/administracion/catalogo/catalogo.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateCatalogoDto } from './dto/create-catalogo.dto';
import { UpdateCatalogoDto } from './dto/update-catalogo.dto';
import { catalogo } from '@prisma/client';
import { PaginationDto, PaginatedResult } from 'src/common/dto';

@Injectable()
export class CatalogoService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCatalogoDto: CreateCatalogoDto): Promise<catalogo> {
    return this.prisma.catalogo.create({ data: createCatalogoDto });
  }

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResult<catalogo>> {
    const { page = 1, limit = 10, search = '' } = paginationDto;
    const skip = (page - 1) * limit;

    // Construir el filtro de búsqueda
    const where: any = {
      estado: 'ACTIVO',
    };

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { codigo: { contains: search, mode: 'insensitive' } },
        { codigo_proveedor: { contains: search, mode: 'insensitive' } },
        { descripcion: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Ejecutar consultas en paralelo
    const [data, total] = await Promise.all([
      this.prisma.catalogo.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fecha_creacion: 'desc' },
        include: {
          categoria: {
            select: {
              id_categoria: true,
              nombre: true,
            },
          },
        },
      }),
      this.prisma.catalogo.count({ where }),
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

  async findOne(id: number): Promise<catalogo> {
    const catalogo = await this.prisma.catalogo.findUnique({
      where: { id_catalogo: id },
    });
    if (!catalogo) {
      throw new NotFoundException(`Catalogo with ID ${id} not found`);
    }
    return catalogo;
  }

  async update(id: number, updateCatalogoDto: UpdateCatalogoDto): Promise<catalogo> {
    await this.findOne(id); // check if exists
    return this.prisma.catalogo.update({
      where: { id_catalogo: id },
      data: updateCatalogoDto,
    });
  }

  async remove(id: number): Promise<catalogo> {
    await this.findOne(id); // check if exists
    return this.prisma.catalogo.update({
      where: { id_catalogo: id },
      data: { estado: 'INACTIVO' },
    });
  }
}
