// src/modules/inventario/sucursales/sucursales.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateSucursalDto } from './dto/create-sucursal.dto';
import { UpdateSucursalDto } from './dto/update-sucursal.dto';
import { sucursales } from '@prisma/client';
import { PaginationDto, PaginatedResult } from 'src/common/dto';

@Injectable()
export class SucursalesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createSucursalDto: CreateSucursalDto, id_usuario?: number): Promise<sucursales> {
    const { id_municipio, id_tipo_establecimiento, ...rest } =
      createSucursalDto;
    const sucursal = await this.prisma.sucursales.create({
      data: {
        ...rest,
        id_municipio: id_municipio ? +id_municipio : undefined,
        id_tipo_establecimiento: id_tipo_establecimiento ? +id_tipo_establecimiento : undefined,
      },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'CREAR_SUCURSAL',
      id_usuario,
      `Sucursal creada: ${sucursal.nombre}`,
    );

    return sucursal;
  }

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResult<sucursales>> {
    const { page = 1, limit = 10, search = '' } = paginationDto;
    const skip = (page - 1) * limit;

    // Construir el filtro de búsqueda
    const where: any = {
      estado: 'ACTIVO',
    };

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { telefono: { contains: search, mode: 'insensitive' } },
        { correo: { contains: search, mode: 'insensitive' } },
        { complemento: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Ejecutar consultas en paralelo
    const [data, total] = await Promise.all([
      this.prisma.sucursales.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fecha_creacion: 'desc' },
      }),
      this.prisma.sucursales.count({ where }),
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

  async findOne(id: number): Promise<sucursales> {
    const sucursal = await this.prisma.sucursales.findUnique({
      where: { id_sucursal: id }, 
    });
    if (!sucursal) {
      throw new NotFoundException(`Sucursal with ID ${id} not found`);
    }
    return sucursal;
  }

  async update(
    id: number,
    updateSucursalDto: UpdateSucursalDto,
    id_usuario?: number,
  ): Promise<sucursales> {
    await this.findOne(id); // check if exists
    const { id_municipio, id_tipo_establecimiento, ...rest } =
      updateSucursalDto;
    const sucursal = await this.prisma.sucursales.update({
      where: { id_sucursal: id },
      data: {
        ...rest,
        id_municipio: id_municipio ? +id_municipio : undefined,
        id_tipo_establecimiento: id_tipo_establecimiento
          ? +id_tipo_establecimiento
          : undefined,
      },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'ACTUALIZAR_SUCURSAL',
      id_usuario,
      `Sucursal actualizada: ${sucursal.nombre}`,
    );

    return sucursal;
  }

  async remove(id: number, id_usuario?: number): Promise<sucursales> {
    await this.findOne(id); // check if exists
    const sucursal = await this.prisma.sucursales.update({
      where: { id_sucursal: id },
      data: { estado: 'INACTIVO' },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'ELIMINAR_SUCURSAL',
      id_usuario,
      `Sucursal eliminada: ${sucursal.nombre}`,
    );

    return sucursal;
  }
}
