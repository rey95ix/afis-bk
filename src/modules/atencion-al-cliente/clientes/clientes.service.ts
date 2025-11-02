// src/modules/atencion-al-cliente/clientes/clientes.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { cliente } from '@prisma/client';
import { PaginationDto, PaginatedResult } from 'src/common/dto';

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) { }

  async create(createClienteDto: CreateClienteDto, id_usuario: number): Promise<cliente> {
    // Verificar si el DUI ya existe
    const existingCliente = await this.prisma.cliente.findUnique({
      where: { dui: createClienteDto.dui },
    });

    if (existingCliente) {
      throw new ConflictException(`Ya existe un cliente con el DUI ${createClienteDto.dui}`);
    }

    const { fecha_nacimiento, ...rest } = createClienteDto;

    const cliente = await this.prisma.cliente.create({
      data: {
        ...rest,
        id_usuario,
        fecha_nacimiento: new Date(fecha_nacimiento),
      },
      include: {
        usuario: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'CREAR_CLIENTE',
      id_usuario || id_usuario,
      `Cliente creado: ${cliente.titular} - DUI: ${cliente.dui}`,
    );

    return cliente;
  }

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResult<cliente>> {
    const { page = 1, limit = 10, search = '' } = paginationDto;
    const skip = (page - 1) * limit;

    // Construir el filtro de búsqueda
    const where: any = {
      estado: 'ACTIVO',
    };

    if (search) {
      where.OR = [
        { titular: { contains: search, mode: 'insensitive' } },
        { dui: { contains: search, mode: 'insensitive' } },
        { nit: { contains: search, mode: 'insensitive' } },
        { correo_electronico: { contains: search, mode: 'insensitive' } },
        { telefono1: { contains: search, mode: 'insensitive' } },
        { telefono2: { contains: search, mode: 'insensitive' } },
        { empresa_trabajo: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Ejecutar consultas en paralelo
    const [data, total] = await Promise.all([
      this.prisma.cliente.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fecha_creacion: 'desc' },
        include: {
          usuario: {
            select: {
              id_usuario: true,
              nombres: true,
              apellidos: true,
            },
          },
          direcciones: {
            where: { estado: 'ACTIVO' },
            include: {
              municipio: true,
              departamento: true,
              colonias: true,
            },
          },
          datosfacturacion: {
            where: { estado: 'ACTIVO' },
            include: {
              municipio: true,
              departamento: true,
              dTETipoDocumentoIdentificacion: true,
              dTEActividadEconomica: true,
            },
          },
          documentos: {
            where: { estado: 'ACTIVO' },
            select: {
              id_cliente_documento: true,
              tipo_documento: true,
              nombre_archivo: true,
              fecha_creacion: true,
              ruta_archivo: true,
            },
          },
        },
      }),
      this.prisma.cliente.count({ where }),
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

  async findOne(id: number): Promise<cliente> {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id_cliente: id },
      include: {
        usuario: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
        direcciones: {
          where: { estado: 'ACTIVO' },
          include: {
            municipio: true,
            departamento: true,
            colonias: true,
          },
        },
        datosfacturacion: {
          where: { estado: 'ACTIVO' },
          include: {
            municipio: true,
            departamento: true,
            dTETipoDocumentoIdentificacion: true,
            dTEActividadEconomica: true,
          },
        },
        documentos: {
          where: { estado: 'ACTIVO' },
          select: {
            id_cliente_documento: true,
            tipo_documento: true,
            nombre_archivo: true,
            fecha_creacion: true,
            ruta_archivo: true,
          },
        },
      },
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado`);
    }

    return cliente;
  }

  async findByDui(dui: string): Promise<cliente | null> {
    return this.prisma.cliente.findUnique({
      where: { dui },
      include: {
        usuario: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
        direcciones: {
          where: { estado: 'ACTIVO' },
        },
        datosfacturacion: {
          where: { estado: 'ACTIVO' },
        },
      },
    });
  }

  async update(
    id: number,
    updateClienteDto: UpdateClienteDto,
    id_usuario: number,
  ): Promise<cliente> {
    await this.findOne(id); // Verificar si existe

    // Si se está actualizando el DUI, verificar que no exista otro cliente con ese DUI
    if (updateClienteDto.dui) {
      const existingCliente = await this.prisma.cliente.findFirst({
        where: {
          dui: updateClienteDto.dui,
          id_cliente: { not: id },
        },
      });

      if (existingCliente) {
        throw new ConflictException(`Ya existe otro cliente con el DUI ${updateClienteDto.dui}`);
      }
    }

    const { fecha_nacimiento, ...rest } = updateClienteDto;

    const cliente = await this.prisma.cliente.update({
      where: { id_cliente: id },
      data: {
        ...rest,
        id_usuario,
        fecha_nacimiento: fecha_nacimiento ? new Date(fecha_nacimiento) : undefined,
      },
      include: {
        usuario: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'ACTUALIZAR_CLIENTE',
      id_usuario,
      `Cliente actualizado: ${cliente.titular} - DUI: ${cliente.dui}`,
    );

    return cliente;
  }

  async remove(id: number, id_usuario: number): Promise<cliente> {
    await this.findOne(id); // Verificar si existe

    const cliente = await this.prisma.cliente.update({
      where: { id_cliente: id },
      data: { estado: 'INACTIVO' },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'ELIMINAR_CLIENTE',
      id_usuario,
      `Cliente eliminado: ${cliente.titular} - DUI: ${cliente.dui}`,
    );

    return cliente;
  }
}
