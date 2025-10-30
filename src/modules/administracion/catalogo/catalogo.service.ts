// src/modules/inventario/catalogo/catalogo.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateCatalogoDto } from './dto/create-catalogo.dto';
import { UpdateCatalogoDto } from './dto/update-catalogo.dto';
import { catalogo } from '@prisma/client';

@Injectable()
export class CatalogoService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCatalogoDto: CreateCatalogoDto): Promise<catalogo> {
    return this.prisma.catalogo.create({ data: createCatalogoDto });
  }

  async findAll(): Promise<catalogo[]> {
    return this.prisma.catalogo.findMany({ where: { estado: 'ACTIVO' } });
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
