// src/modules/inventario/categorias/categorias.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { categorias } from '@prisma/client';

@Injectable()
export class CategoriasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCategoriaDto: CreateCategoriaDto): Promise<categorias> {
    return this.prisma.categorias.create({ data: createCategoriaDto });
  }

  async findAll(): Promise<categorias[]> {
    return this.prisma.categorias.findMany({ where: { estado: 'ACTIVO' } });
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
