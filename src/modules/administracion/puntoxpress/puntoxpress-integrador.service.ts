import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreatePuntoxpressIntegradorDto } from './dto/create-puntoxpress-integrador.dto';
import { UpdatePuntoxpressIntegradorDto } from './dto/update-puntoxpress-integrador.dto';
import { PaginationDto, PaginatedResult } from 'src/common/dto';

const SELECT_WITHOUT_PASSWORD = {
  id_integrador: true,
  nombre: true,
  usuario: true,
  activo: true,
  fecha_creacion: true,
  fecha_actualizacion: true,
};

@Injectable()
export class PuntoxpressIntegradorService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePuntoxpressIntegradorDto, id_usuario?: number) {
    const { contrasena, ...rest } = dto;
    const password_hash = await bcrypt.hash(contrasena, 10);

    const integrador = await this.prisma.puntoxpress_integrador.create({
      data: { ...rest, password_hash },
      select: SELECT_WITHOUT_PASSWORD,
    });

    await this.prisma.logAction(
      'CREAR_PUNTOXPRESS_INTEGRADOR',
      id_usuario,
      `Integrador creado: ${integrador.nombre}`,
    );

    return integrador;
  }

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 10, search = '' } = paginationDto;
    const skip = (page - 1) * limit;

    const where: any = {
      activo: true,
    };

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { usuario: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.puntoxpress_integrador.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nombre: 'asc' },
        select: SELECT_WITHOUT_PASSWORD,
      }),
      this.prisma.puntoxpress_integrador.count({ where }),
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

  async findAllActive() {
    return this.prisma.puntoxpress_integrador.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      select: SELECT_WITHOUT_PASSWORD,
    });
  }

  async findOne(id: number) {
    const integrador = await this.prisma.puntoxpress_integrador.findUnique({
      where: { id_integrador: id },
      select: SELECT_WITHOUT_PASSWORD,
    });
    if (!integrador) {
      throw new NotFoundException(`Integrador con ID ${id} no encontrado`);
    }
    return integrador;
  }

  async update(id: number, dto: UpdatePuntoxpressIntegradorDto, id_usuario?: number) {
    await this.findOne(id);

    const { contrasena, ...rest } = dto;
    const data: any = { ...rest };

    if (contrasena) {
      data.password_hash = await bcrypt.hash(contrasena, 10);
    }

    const integrador = await this.prisma.puntoxpress_integrador.update({
      where: { id_integrador: id },
      data,
      select: SELECT_WITHOUT_PASSWORD,
    });

    await this.prisma.logAction(
      'ACTUALIZAR_PUNTOXPRESS_INTEGRADOR',
      id_usuario,
      `Integrador actualizado: ${integrador.nombre}`,
    );

    return integrador;
  }

  async remove(id: number, id_usuario?: number) {
    const antes = await this.findOne(id);

    const integrador = await this.prisma.puntoxpress_integrador.update({
      where: { id_integrador: id },
      data: { activo: false },
      select: SELECT_WITHOUT_PASSWORD,
    });

    await this.prisma.logAction(
      'ELIMINAR_PUNTOXPRESS_INTEGRADOR',
      id_usuario,
      `Integrador eliminado: ${antes.nombre}`,
    );

    return integrador;
  }
}
