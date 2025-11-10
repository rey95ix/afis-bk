// src/modules/administracion/categorias/categorias.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { categorias } from '@prisma/client';
import { PaginationDto, PaginatedResult } from 'src/common/dto';

@Injectable()
export class CategoriasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCategoriaDto: CreateCategoriaDto, id_usuario?: number): Promise<categorias> {

    //agregar validacion que si ya exite una categoria con el mismo codigo y estado ACTIVO, no permita crearla
    const existingCategoria = await this.prisma.categorias.findFirst({
      where: {
        codigo: createCategoriaDto.codigo,
        estado: 'ACTIVO',
      },
    });
    if (existingCategoria) {
      throw new NotFoundException(`Ya existe una categoría con el código ${createCategoriaDto.codigo}`);
    }
    // Crear la categoría
    const categoria = await this.prisma.categorias.create({ data: createCategoriaDto });

    // Registrar en el log
    await this.prisma.logAction(
      'CREAR_CATEGORIA',
      id_usuario,
      `Categoría creada: ${categoria.nombre}`,
    );

    return categoria;
  }

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResult<categorias>> {
    const { page = 1, limit = 10, search = '' } = paginationDto;
    const skip = (page - 1) * limit;

    // Construir el filtro de búsqueda
    const where: any = {
      estado: 'ACTIVO',
      // Devolver solo categorías de nivel superior en la consulta principal
      id_categoria_padre: null,
    };

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { codigo: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Ejecutar consultas en paralelo
    const [data, total] = await Promise.all([
      this.prisma.categorias.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fecha_creacion: 'desc' },
        include: {
          sub_categorias: {
            where: { estado: 'ACTIVO' },
            orderBy: { nombre: 'asc' },
          },
        },
      }),
      this.prisma.categorias.count({ where }),
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

  async findOne(id: number): Promise<categorias> {
    const categoria = await this.prisma.categorias.findUnique({
      where: { id_categoria: id },
      include: {
        categoria_padre: true,
        sub_categorias: {
          where: { estado: 'ACTIVO' },
          orderBy: { nombre: 'asc' },
        },
      },
    });
    if (!categoria) {
      throw new NotFoundException(`Categoria with ID ${id} not found`);
    }
    return categoria;
  }

  async update(id: number, updateCategoriaDto: UpdateCategoriaDto, id_usuario?: number): Promise<categorias> {
    await this.findOne(id); // check if exists
    const categoria = await this.prisma.categorias.update({
      where: { id_categoria: id },
      data: updateCategoriaDto,
    });

    // Registrar en el log
    await this.prisma.logAction(
      'ACTUALIZAR_CATEGORIA',
      id_usuario,
      `Categoría actualizada: ${categoria.nombre}`,
    );

    return categoria;
  }

  async remove(id: number, id_usuario?: number): Promise<categorias> {
    await this.findOne(id); // check if exists
    const categoria = await this.prisma.categorias.update({
      where: { id_categoria: id },
      data: { estado: 'INACTIVO' },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'ELIMINAR_CATEGORIA',
      id_usuario,
      `Categoría eliminada: ${categoria.nombre}`,
    );

    return categoria;
  }

  async findAllSubcategories(): Promise<categorias[]> {
    return this.prisma.categorias.findMany({
      where: {
        estado: 'ACTIVO',
        id_categoria_padre: {
          not: null,
        },
      },
      include: {
        categoria_padre: true, // Incluir categoría padre para agrupación
      },
      orderBy: [
        { categoria_padre: { nombre: 'asc' } },
        { nombre: 'asc' },
      ],
    });
  }
}
