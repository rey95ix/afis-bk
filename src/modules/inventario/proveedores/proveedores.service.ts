// src/modules/inventario/proveedores/proveedores.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';
import { proveedores } from '@prisma/client';
import { PaginationDto, PaginatedResult } from 'src/common/dto';

@Injectable()
export class ProveedoresService {
  constructor(private readonly prisma: PrismaService) { }

  async create(createProveedorDto: CreateProveedorDto, id_user: number): Promise<proveedores> {
    const { ...rest } = createProveedorDto;
    const proveedor = await this.prisma.proveedores.create({
      data: {
        ...rest,
        id_usuario: id_user,
      },
    });

    // Registrar en el log
    await this.prisma.log.create({
      data: {
        accion: 'CREAR_PROVEEDOR',
        id_usuario: id_user,
        descripcion: `Proveedor creado: ${proveedor.nombre_razon_social}`,
      },
    });

    return proveedor;
  }

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResult<proveedores>> {
    const { page = 1, limit = 10, search = '' } = paginationDto;
    const skip = (page - 1) * limit;

    const where: any = {
      estado: 'ACTIVO',
    };

    if (search) {
      where.OR = [
        { nombre_razon_social: { contains: search, mode: 'insensitive' } },
        { nombre_comercial: { contains: search, mode: 'insensitive' } },
        { numero_documento: { contains: search, mode: 'insensitive' } },
        { correo: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.proveedores.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fecha_creacion: 'desc' },
      }),
      this.prisma.proveedores.count({ where }),
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

  async findOne(id: number): Promise<proveedores> {
    const proveedor = await this.prisma.proveedores.findUnique({
      where: { id_proveedor: id },
    });
    if (!proveedor) {
      throw new NotFoundException(`Proveedor with ID ${id} not found`);
    }
    return proveedor;
  }

  async update(id: number, updateProveedorDto: UpdateProveedorDto, id_usuario: number): Promise<proveedores> {
    await this.findOne(id); // check if exists
    const { ...rest } = updateProveedorDto;
    const proveedor = await this.prisma.proveedores.update({
      where: { id_proveedor: id },
      data: {
        ...rest,
      },
    });

    // Registrar en el log
    await this.prisma.log.create({
      data: {
        accion: 'ACTUALIZAR_PROVEEDOR',
        id_usuario: id_usuario,
        descripcion: `Proveedor actualizado: ${proveedor.nombre_razon_social}`,
      },
    });

    return proveedor;
  }

  async remove(id: number, id_usuario: number): Promise<proveedores> {
    await this.findOne(id); // check if exists
    const proveedor = await this.prisma.proveedores.update({
      where: { id_proveedor: id },
      data: { estado: 'INACTIVO' },
    });

    // Registrar en el log
    await this.prisma.log.create({
      data: {
        accion: 'ELIMINAR_PROVEEDOR',
        id_usuario: id_usuario,
        descripcion: `Proveedor eliminado: ${proveedor.nombre_razon_social}`,
      },
    });

    return proveedor;
  }
}
