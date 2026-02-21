// src/modules/inventario/proveedores/proveedores.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';
import { DteEmisorDto } from './dto/dte-emisor.dto';
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

  async findOrCreateFromDte(emisorData: DteEmisorDto, id_usuario: number): Promise<proveedores> {
    // Buscar proveedor activo por NIT (numero_documento)
    const existing = await this.prisma.proveedores.findFirst({
      where: {
        numero_documento: emisorData.nit,
        estado: 'ACTIVO',
      },
    });

    if (existing) {
      return existing;
    }

    // Buscar actividad economica por codigo
    let id_actividad_economica: number | undefined;
    if (emisorData.codActividad) {
      const actividad = await this.prisma.dTEActividadEconomica.findFirst({
        where: { codigo: emisorData.codActividad, estado: 'ACTIVO' },
      });
      if (actividad) {
        id_actividad_economica = actividad.id_actividad;
      }
    }

    // Buscar municipio por codigos departamento + municipio
    let id_municipio: number | undefined;
    if (emisorData.direccion?.departamento && emisorData.direccion?.municipio) {
      const departamento = await this.prisma.departamentos.findFirst({
        where: { codigo: emisorData.direccion.departamento, estado: 'ACTIVO' },
      });
      if (departamento) {
        const municipio = await this.prisma.municipios.findFirst({
          where: {
            codigo: emisorData.direccion.municipio,
            id_departamento: departamento.id_departamento,
            estado: 'ACTIVO',
          },
        });
        if (municipio) {
          id_municipio = municipio.id_municipio;
        }
      }
    }

    // Crear proveedor
    const proveedor = await this.prisma.proveedores.create({
      data: {
        nombre_razon_social: emisorData.nombre,
        nombre_comercial: emisorData.nombreComercial || undefined,
        numero_documento: emisorData.nit,
        registro_nrc: emisorData.nrc || undefined,
        telefono: emisorData.telefono || undefined,
        correo: emisorData.correo?.toLowerCase() || undefined,
        direccion: emisorData.direccion?.complemento || undefined,
        id_actividad_economica: id_actividad_economica || undefined,
        id_municipio: id_municipio || undefined,
        id_usuario: id_usuario,
      },
    });

    // Registrar en el log
    await this.prisma.log.create({
      data: {
        accion: 'CREAR_PROVEEDOR_DTE',
        id_usuario: id_usuario,
        descripcion: `Proveedor creado desde DTE: ${proveedor.nombre_razon_social} (NIT: ${emisorData.nit})`,
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
