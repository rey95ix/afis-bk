// src/modules/administracion/colonias/colonias.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateColoniaDto } from './dto/create-colonia.dto';
import { UpdateColoniaDto } from './dto/update-colonia.dto';
import { colonias } from '@prisma/client';
import { PaginationDto, PaginatedResult } from 'src/common/dto';

@Injectable()
export class ColoniasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createColoniaDto: CreateColoniaDto, id_usuario?: number): Promise<colonias> {
    const { id_municipio, ...rest } = createColoniaDto;
    const colonia = await this.prisma.colonias.create({
      data: {
        ...rest,
        id_municipio: +id_municipio,
      },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'CREAR_COLONIA',
      id_usuario,
      `Colonia creada: ${colonia.nombre}`,
    );

    return colonia;
  }

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResult<colonias>> {
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
      ];
    }

    // Ejecutar consultas en paralelo
    const [data, total] = await Promise.all([
      this.prisma.colonias.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fecha_creacion: 'desc' },
        include: {
          Municipio: {
            select: {
              id_municipio: true,
              nombre: true,
            },
          },
        },
      }),
      this.prisma.colonias.count({ where }),
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

  async findOne(id: number): Promise<colonias> {
    const colonia = await this.prisma.colonias.findUnique({
      where: { id_colonia: id },
      include: {
        Municipio: true
      }
    });
    if (!colonia) {
      throw new NotFoundException(`Colonia with ID ${id} not found`);
    }
    return colonia;
  }

  async update(id: number, updateColoniaDto: UpdateColoniaDto, id_usuario?: number): Promise<colonias> {
    await this.findOne(id); // check if exists
    const { id_municipio, ...rest } = updateColoniaDto;
    const colonia = await this.prisma.colonias.update({
      where: { id_colonia: id },
      data: {
        ...rest,
        id_municipio: id_municipio ? +id_municipio : undefined,
      },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'ACTUALIZAR_COLONIA',
      id_usuario,
      `Colonia actualizada: ${colonia.nombre}`,
    );

    return colonia;
  }

  async remove(id: number, id_usuario?: number): Promise<colonias> {
    await this.findOne(id); // check if exists
    const colonia = await this.prisma.colonias.update({
      where: { id_colonia: id },
      data: { estado: 'INACTIVO' },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'ELIMINAR_COLONIA',
      id_usuario,
      `Colonia eliminada: ${colonia.nombre}`,
    );

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
