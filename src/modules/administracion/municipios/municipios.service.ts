// src/modules/administracion/municipios/municipios.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { municipios } from '@prisma/client';

@Injectable()
export class MunicipiosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<municipios[]> {
    return this.prisma.municipios.findMany({
      where: { estado: 'ACTIVO' },
      include: {
        Departamento: {
          select: {
            id_departamento: true,
            nombre: true,
          },
        },
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async findOne(id: number): Promise<municipios> {
    const municipio = await this.prisma.municipios.findUnique({
      where: { id_municipio: id },
      include: {
        Departamento: {
          select: {
            id_departamento: true,
            nombre: true,
          },
        },
      },
    });

    if (!municipio) {
      throw new NotFoundException(`Municipio con ID ${id} no encontrado`);
    }

    return municipio;
  }

  async findByDepartamento(id_departamento: number): Promise<municipios[]> {
    return this.prisma.municipios.findMany({
      where: {
        id_departamento,
        estado: 'ACTIVO',
      },
      orderBy: { nombre: 'asc' },
    });
  }
}
