// src/modules/administracion/marcas/marcas.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateMarcaDto } from './dto/create-marca.dto';
import { UpdateMarcaDto } from './dto/update-marca.dto';
import { marcas } from '@prisma/client';
import { PaginationDto, PaginatedResult } from 'src/common/dto';

@Injectable()
export class MarcasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createMarcaDto: CreateMarcaDto, id_usuario?: number): Promise<marcas> {
    const marca = await this.prisma.marcas.create({ data: createMarcaDto });

    await this.prisma.logAction(
      'CREAR_MARCA',
      id_usuario,
      `Marca creada: ${marca.nombre}`,
    );

    return marca;
  }

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResult<marcas>> {
    const { page = 1, limit = 10, search = '' } = paginationDto;
    const skip = (page - 1) * limit;

    const where: any = {
      estado: 'ACTIVO',
    };

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { descripcion: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.marcas.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.marcas.count({ where }),
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

  async findAllActive(): Promise<marcas[]> {
    return this.prisma.marcas.findMany({
      where: { estado: 'ACTIVO' },
      orderBy: { nombre: 'asc' },
    });
  }

  async findOne(id: number): Promise<marcas> {
    const marca = await this.prisma.marcas.findUnique({
      where: { id_marca: id },
      include: {
        modelos: {
          where: { estado: 'ACTIVO' },
          orderBy: { nombre: 'asc' },
        },
      },
    });
    if (!marca) {
      throw new NotFoundException(`Marca con ID ${id} no encontrada`);
    }
    return marca;
  }

  async update(id: number, updateMarcaDto: UpdateMarcaDto, id_usuario?: number): Promise<marcas> {
    await this.findOne(id);
    const marca = await this.prisma.marcas.update({
      where: { id_marca: id },
      data: updateMarcaDto,
    });

    await this.prisma.logAction(
      'ACTUALIZAR_MARCA',
      id_usuario,
      `Marca actualizada: ${marca.nombre}`,
    );

    return marca;
  }

  async remove(id: number, id_usuario?: number): Promise<marcas> {
    const marcaAntes = await this.findOne(id);
    const marca = await this.prisma.marcas.update({
      where: { id_marca: id },
      data: { estado: 'INACTIVO' },
    });

    await this.prisma.logAction(
      'ELIMINAR_MARCA',
      id_usuario,
      `Marca eliminada: ${marcaAntes.nombre}`,
    );

    return marca;
  }
}
