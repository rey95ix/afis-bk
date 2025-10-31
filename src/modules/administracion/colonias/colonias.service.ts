// src/modules/administracion/colonias/colonias.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { colonias } from '@prisma/client';

@Injectable()
export class ColoniasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<colonias[]> {
    return this.prisma.colonias.findMany({
      where: { estado: 'ACTIVO' },
      include: {
        Municipio: {
          select: {
            id_municipio: true,
            nombre: true,
          },
        },
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async findOne(id: number): Promise<colonias> {
    const colonia = await this.prisma.colonias.findUnique({
      where: { id_colonia: id },
      include: {
        Municipio: {
          select: {
            id_municipio: true,
            nombre: true,
          },
        },
      },
    });

    if (!colonia) {
      throw new NotFoundException(`Colonia con ID ${id} no encontrada`);
    }

    return colonia;
  }

  async findByMunicipio(id_municipio: number): Promise<colonias[]> {
    return this.prisma.colonias.findMany({
      where: {
        id_municipio,
        estado: 'ACTIVO',
      },
      orderBy: { nombre: 'asc' },
    });
  }
}
