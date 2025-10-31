// src/modules/administracion/categorias/categorias.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { categorias } from '@prisma/client';
import { PaginationDto, PaginatedResult } from 'src/common/dto';

@Injectable()
export class CategoriasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCategoriaDto: CreateCategoriaDto): Promise<categorias> {
    return this.prisma.categorias.create({ data: createCategoriaDto });
  }

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResult<categorias>> {
    const { page = 1, limit = 10, search = '' } = paginationDto;
    const skip = (page - 1) * limit;

    // Construir el filtro de búsqueda
    const where: any = {
      estado: 'ACTIVO',
    };

    if (search) {
      where.nombre = { contains: search, mode: 'insensitive' };
    }

    // Ejecutar consultas en paralelo
    const [data, total] = await Promise.all([
      this.prisma.categorias.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fecha_creacion: 'desc' },
      }),
      this.prisma.categorias.count({ where }),
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

  async findOne(id: number): Promise<categorias> {
    const categoria = await this.prisma.categorias.findUnique({
      where: { id_categoria: id },
    });
    if (!categoria) {
      throw new NotFoundException(`Categoria with ID ${id} not found`);
    }
    return categoria;
  }

  async update(id: number, updateCategoriaDto: UpdateCategoriaDto): Promise<categorias> {
    await this.findOne(id); // check if exists
    return this.prisma.categorias.update({
      where: { id_categoria: id },
      data: updateCategoriaDto,
    });
  }

  async remove(id: number): Promise<categorias> {
    await this.findOne(id); // check if exists
    return this.prisma.categorias.update({
      where: { id_categoria: id },
      data: { estado: 'INACTIVO' },
    });
  }
}
