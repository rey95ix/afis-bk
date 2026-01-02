// src/modules/administracion/modelos/modelos.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateModeloDto } from './dto/create-modelo.dto';
import { UpdateModeloDto } from './dto/update-modelo.dto';
import { modelos } from '@prisma/client';
import { PaginationDto, PaginatedResult } from 'src/common/dto';

@Injectable()
export class ModelosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createModeloDto: CreateModeloDto, id_usuario?: number): Promise<modelos> {
    const modelo = await this.prisma.modelos.create({ data: createModeloDto });

    await this.prisma.logAction(
      'CREAR_MODELO',
      id_usuario,
      `Modelo creado: ${modelo.nombre}`,
    );

    return modelo;
  }

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResult<modelos>> {
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
      this.prisma.modelos.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nombre: 'asc' },
        include: {
          marca: {
            select: {
              id_marca: true,
              nombre: true,
            },
          },
        },
      }),
      this.prisma.modelos.count({ where }),
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

  async findAllActive(): Promise<modelos[]> {
    return this.prisma.modelos.findMany({
      where: { estado: 'ACTIVO' },
      orderBy: { nombre: 'asc' },
      include: {
        marca: {
          select: {
            id_marca: true,
            nombre: true,
          },
        },
      },
    });
  }

  async findByMarca(idMarca: number): Promise<modelos[]> {
    return this.prisma.modelos.findMany({
      where: {
        id_marca: idMarca,
        estado: 'ACTIVO',
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async findOne(id: number): Promise<modelos> {
    const modelo = await this.prisma.modelos.findUnique({
      where: { id_modelo: id },
      include: {
        marca: {
          select: {
            id_marca: true,
            nombre: true,
          },
        },
      },
    });
    if (!modelo) {
      throw new NotFoundException(`Modelo con ID ${id} no encontrado`);
    }
    return modelo;
  }

  async update(id: number, updateModeloDto: UpdateModeloDto, id_usuario?: number): Promise<modelos> {
    await this.findOne(id);
    const modelo = await this.prisma.modelos.update({
      where: { id_modelo: id },
      data: updateModeloDto,
    });

    await this.prisma.logAction(
      'ACTUALIZAR_MODELO',
      id_usuario,
      `Modelo actualizado: ${modelo.nombre}`,
    );

    return modelo;
  }

  async remove(id: number, id_usuario?: number): Promise<modelos> {
    const modeloAntes = await this.findOne(id);
    const modelo = await this.prisma.modelos.update({
      where: { id_modelo: id },
      data: { estado: 'INACTIVO' },
    });

    await this.prisma.logAction(
      'ELIMINAR_MODELO',
      id_usuario,
      `Modelo eliminado: ${modeloAntes.nombre}`,
    );

    return modelo;
  }
}
