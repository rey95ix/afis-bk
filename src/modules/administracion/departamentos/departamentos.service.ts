// src/modules/administracion/departamentos/departamentos.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { departamentos } from '@prisma/client';

@Injectable()
export class DepartamentosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<departamentos[]> {
    return this.prisma.departamentos.findMany({
      where: { estado: 'ACTIVO' },
      orderBy: { nombre: 'asc' },
    });
  }

  async findOne(id: number): Promise<departamentos> {
    const departamento = await this.prisma.departamentos.findUnique({
      where: { id_departamento: id },
    });

    if (!departamento) {
      throw new NotFoundException(`Departamento con ID ${id} no encontrado`);
    }

    return departamento;
  }
}
