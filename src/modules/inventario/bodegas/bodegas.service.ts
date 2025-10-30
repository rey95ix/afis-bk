// src/modules/inventario/bodegas/bodegas.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateBodegaDto } from './dto/create-bodega.dto';
import { UpdateBodegaDto } from './dto/update-bodega.dto';
import { bodegas } from '@prisma/client';

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

  async findAll(): Promise<bodegas[]> {
    return this.prisma.bodegas.findMany({ where: { estado: 'ACTIVO' } });
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
