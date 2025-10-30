// src/modules/inventario/sucursales/sucursales.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateSucursalDto } from './dto/create-sucursal.dto';
import { UpdateSucursalDto } from './dto/update-sucursal.dto';
import { sucursales } from '@prisma/client';

@Injectable()
export class SucursalesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createSucursalDto: CreateSucursalDto): Promise<sucursales> {
    const { id_municipio, id_tipo_establecimiento, ...rest } =
      createSucursalDto;
    return this.prisma.sucursales.create({
      data: {
        ...rest,
        id_municipio: id_municipio ? +id_municipio : undefined,
        id_tipo_establecimiento: id_tipo_establecimiento ? +id_tipo_establecimiento : undefined,
      },
    });
  }

  async findAll(): Promise<sucursales[]> {
    return this.prisma.sucursales.findMany({ where: { estado: 'ACTIVO' } });
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
  ): Promise<sucursales> {
    await this.findOne(id); // check if exists
    const { id_municipio, id_tipo_establecimiento, ...rest } =
      updateSucursalDto;
    return this.prisma.sucursales.update({
      where: { id_sucursal: id },
      data: {
        ...rest,
        id_municipio: id_municipio ? +id_municipio : undefined,
        id_tipo_establecimiento: id_tipo_establecimiento
          ? +id_tipo_establecimiento
          : undefined,
      },
    });
  }

  async remove(id: number): Promise<sucursales> {
    await this.findOne(id); // check if exists
    return this.prisma.sucursales.update({
      where: { id_sucursal: id },
      data: { estado: 'INACTIVO' },
    });
  }
}
