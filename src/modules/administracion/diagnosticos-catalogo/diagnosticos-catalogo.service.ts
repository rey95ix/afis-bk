// src/modules/administracion/diagnosticos-catalogo/diagnosticos-catalogo.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateDiagnosticoDto } from './dto/create-diagnostico.dto';
import { UpdateDiagnosticoDto } from './dto/update-diagnostico.dto';
import { diagnostico_catalogo } from '@prisma/client';
import { PaginationDto, PaginatedResult } from 'src/common/dto';

@Injectable()
export class DiagnosticosCatalogoService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createDiagnosticoDto: CreateDiagnosticoDto,
    id_usuario?: number,
  ): Promise<diagnostico_catalogo> {
    // Validar que no exista un diagnóstico con el mismo código
    const existingDiagnostico = await this.prisma.diagnostico_catalogo.findFirst({
      where: {
        codigo: createDiagnosticoDto.codigo,
        activo: true,
      },
    });

    if (existingDiagnostico) {
      throw new ConflictException(
        `Ya existe un diagnóstico con el código ${createDiagnosticoDto.codigo}`,
      );
    }

    // Crear el diagnóstico
    const diagnostico = await this.prisma.diagnostico_catalogo.create({
      data: createDiagnosticoDto,
    });

    // Registrar en el log
    await this.prisma.logAction(
      'CREAR_DIAGNOSTICO',
      id_usuario,
      `Diagnóstico creado: ${diagnostico.nombre}`,
    );

    return diagnostico;
  }

  async findAll(
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<diagnostico_catalogo>> {
    const { page = 1, limit = 10, search = '' } = paginationDto;
    const skip = (page - 1) * limit;

    // Construir el filtro de búsqueda
    const where: any = {};

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { codigo: { contains: search, mode: 'insensitive' } },
        { descripcion: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Ejecutar consultas en paralelo
    const [data, total] = await Promise.all([
      this.prisma.diagnostico_catalogo.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.diagnostico_catalogo.count({ where }),
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

  async findOne(id: number): Promise<diagnostico_catalogo> {
    const diagnostico = await this.prisma.diagnostico_catalogo.findUnique({
      where: { id_diagnostico: id },
    });

    if (!diagnostico) {
      throw new NotFoundException(`Diagnóstico con ID ${id} no encontrado`);
    }

    return diagnostico;
  }

  async update(
    id: number,
    updateDiagnosticoDto: UpdateDiagnosticoDto,
    id_usuario?: number,
  ): Promise<diagnostico_catalogo> {
    // Verificar que exista
    await this.findOne(id);

    // Si se está actualizando el código, verificar que no exista otro con el mismo
    if (updateDiagnosticoDto.codigo) {
      const existingDiagnostico = await this.prisma.diagnostico_catalogo.findFirst({
        where: {
          codigo: updateDiagnosticoDto.codigo,
          activo: true,
          NOT: { id_diagnostico: id },
        },
      });

      if (existingDiagnostico) {
        throw new ConflictException(
          `Ya existe otro diagnóstico con el código ${updateDiagnosticoDto.codigo}`,
        );
      }
    }

    // Actualizar el diagnóstico
    const diagnostico = await this.prisma.diagnostico_catalogo.update({
      where: { id_diagnostico: id },
      data: updateDiagnosticoDto,
    });

    // Registrar en el log
    await this.prisma.logAction(
      'ACTUALIZAR_DIAGNOSTICO',
      id_usuario,
      `Diagnóstico actualizado: ${diagnostico.nombre}`,
    );

    return diagnostico;
  }

  async remove(id: number, id_usuario?: number): Promise<diagnostico_catalogo> {
    // Verificar que exista
    await this.findOne(id);

    // Soft delete (cambiar activo a false)
    const diagnostico = await this.prisma.diagnostico_catalogo.update({
      where: { id_diagnostico: id },
      data: { activo: false },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'ELIMINAR_DIAGNOSTICO',
      id_usuario,
      `Diagnóstico eliminado: ${diagnostico.nombre}`,
    );

    return diagnostico;
  }
}
