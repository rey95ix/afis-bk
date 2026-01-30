// src/modules/facturacion/clientes-directos/clientes-directos.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import {
  CreateClienteDirectoDto,
  UpdateClienteDirectoDto,
  BuscarClienteDirectoDto,
} from './dto';
import { clienteDirecto, Prisma } from '@prisma/client';

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class ClientesDirectosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crear un nuevo cliente directo
   */
  async create(
    createDto: CreateClienteDirectoDto,
    id_usuario: number,
  ): Promise<clienteDirecto> {
    // Validar NIT único si se proporciona
    if (createDto.nit) {
      const existingNit = await this.prisma.clienteDirecto.findFirst({
        where: { nit: createDto.nit, estado: 'ACTIVO' },
      });
      if (existingNit) {
        throw new BadRequestException(`Ya existe un cliente con NIT ${createDto.nit}`);
      }
    }

    // Validar DUI único si se proporciona
    if (createDto.dui) {
      const existingDui = await this.prisma.clienteDirecto.findFirst({
        where: { dui: createDto.dui, estado: 'ACTIVO' },
      });
      if (existingDui) {
        throw new BadRequestException(`Ya existe un cliente con DUI ${createDto.dui}`);
      }
    }

    const cliente = await this.prisma.clienteDirecto.create({
      data: {
        nombre: createDto.nombre,
        razon_social: createDto.razon_social,
        registro_nrc: createDto.registro_nrc,
        nit: createDto.nit,
        dui: createDto.dui,
        id_tipo_documento: createDto.id_tipo_documento,
        id_actividad_economica: createDto.id_actividad_economica,
        id_pais: createDto.id_pais,
        id_municipio: createDto.id_municipio,
        direccion: createDto.direccion,
        contacto: createDto.contacto,
        telefono: createDto.telefono,
        correo: createDto.correo,
        retencion: createDto.retencion ?? false,
        id_tipo_cliente: createDto.id_tipo_cliente,
        id_sucursal: createDto.id_sucursal,
      },
      include: {
        tipoDocumento: true,
        actividadEconomica: true,
        pais: true,
        municipio: {
          include: { Departamento: true },
        },
        tipoCliente: true,
        sucursal: true,
      },
    });

    await this.prisma.logAction(
      'CREAR_CLIENTE_DIRECTO',
      id_usuario,
      `Cliente directo creado: ${cliente.nombre} (ID: ${cliente.id_cliente_directo})`,
    );

    return cliente;
  }

  /**
   * Listar clientes directos con paginación y filtros
   */
  async findAll(
    queryDto: BuscarClienteDirectoDto,
  ): Promise<PaginatedResult<clienteDirecto>> {
    const { page = 1, limit = 10, q, nit, dui, registro_nrc, id_sucursal, estado } = queryDto;
    const skip = (page - 1) * limit;

    const where: Prisma.clienteDirectoWhereInput = {};

    // Búsqueda general por nombre, NIT, DUI o NRC
    if (q) {
      where.OR = [
        { nombre: { contains: q, mode: 'insensitive' } },
        { nit: { contains: q, mode: 'insensitive' } },
        { dui: { contains: q, mode: 'insensitive' } },
        { registro_nrc: { contains: q, mode: 'insensitive' } },
        { razon_social: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Filtros específicos
    if (nit) {
      where.nit = { contains: nit, mode: 'insensitive' };
    }
    if (dui) {
      where.dui = { contains: dui, mode: 'insensitive' };
    }
    if (registro_nrc) {
      where.registro_nrc = { contains: registro_nrc, mode: 'insensitive' };
    }
    if (id_sucursal) {
      where.id_sucursal = id_sucursal;
    }
    if (estado) {
      where.estado = estado;
    }

    const [data, total] = await Promise.all([
      this.prisma.clienteDirecto.findMany({
        where,
        skip,
        take: limit,
        include: {
          tipoDocumento: true,
          actividadEconomica: true,
          municipio: {
            include: { Departamento: true },
          },
          tipoCliente: true,
          sucursal: {
            select: { id_sucursal: true, nombre: true },
          },
          _count: {
            select: { facturasDirectas: true },
          },
        },
        orderBy: { fecha_creacion: 'desc' },
      }),
      this.prisma.clienteDirecto.count({ where }),
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

  /**
   * Buscar clientes para autocomplete
   */
  async buscar(q: string, limit: number = 10): Promise<clienteDirecto[]> {
    if (!q || q.length < 2) {
      return [];
    }

    return this.prisma.clienteDirecto.findMany({
      where: {
        estado: 'ACTIVO',
        OR: [
          { nombre: { contains: q, mode: 'insensitive' } },
          { nit: { contains: q, mode: 'insensitive' } },
          { dui: { contains: q, mode: 'insensitive' } },
          { registro_nrc: { contains: q, mode: 'insensitive' } },
          { razon_social: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: limit,
      include: {
        tipoDocumento: true,
        actividadEconomica: true,
        municipio: {
          include: { Departamento: true },
        },
      },
      orderBy: { nombre: 'asc' },
    });
  }

  /**
   * Obtener un cliente por ID
   */
  async findOne(id: number): Promise<clienteDirecto> {
    const cliente = await this.prisma.clienteDirecto.findUnique({
      where: { id_cliente_directo: id },
      include: {
        tipoDocumento: true,
        actividadEconomica: true,
        pais: true,
        municipio: {
          include: { Departamento: true },
        },
        tipoCliente: true,
        sucursal: true,
        _count: {
          select: { facturasDirectas: true },
        },
      },
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente directo con ID ${id} no encontrado`);
    }

    return cliente;
  }

  /**
   * Obtener historial de facturas de un cliente
   */
  async findFacturas(id: number, page: number = 1, limit: number = 10) {
    const cliente = await this.findOne(id);

    const skip = (page - 1) * limit;

    const [facturas, total] = await Promise.all([
      this.prisma.facturaDirecta.findMany({
        where: { id_cliente_directo: id },
        skip,
        take: limit,
        include: {
          tipoFactura: true,
          sucursal: {
            select: { id_sucursal: true, nombre: true },
          },
          usuario: {
            select: { id_usuario: true, nombres: true, apellidos: true },
          },
        },
        orderBy: { fecha_creacion: 'desc' },
      }),
      this.prisma.facturaDirecta.count({ where: { id_cliente_directo: id } }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      cliente: {
        id_cliente_directo: cliente.id_cliente_directo,
        nombre: cliente.nombre,
        nit: cliente.nit,
        dui: cliente.dui,
        registro_nrc: cliente.registro_nrc,
      },
      facturas: {
        data: facturas,
        meta: {
          total,
          page,
          limit,
          totalPages,
        },
      },
    };
  }

  /**
   * Actualizar un cliente
   */
  async update(
    id: number,
    updateDto: UpdateClienteDirectoDto,
    id_usuario: number,
  ): Promise<clienteDirecto> {
    const existingCliente = await this.findOne(id);

    // Validar NIT único si se está cambiando
    if (updateDto.nit && updateDto.nit !== existingCliente.nit) {
      const duplicateNit = await this.prisma.clienteDirecto.findFirst({
        where: {
          nit: updateDto.nit,
          estado: 'ACTIVO',
          NOT: { id_cliente_directo: id },
        },
      });
      if (duplicateNit) {
        throw new BadRequestException(`Ya existe un cliente con NIT ${updateDto.nit}`);
      }
    }

    // Validar DUI único si se está cambiando
    if (updateDto.dui && updateDto.dui !== existingCliente.dui) {
      const duplicateDui = await this.prisma.clienteDirecto.findFirst({
        where: {
          dui: updateDto.dui,
          estado: 'ACTIVO',
          NOT: { id_cliente_directo: id },
        },
      });
      if (duplicateDui) {
        throw new BadRequestException(`Ya existe un cliente con DUI ${updateDto.dui}`);
      }
    }

    const cliente = await this.prisma.clienteDirecto.update({
      where: { id_cliente_directo: id },
      data: updateDto,
      include: {
        tipoDocumento: true,
        actividadEconomica: true,
        pais: true,
        municipio: {
          include: { Departamento: true },
        },
        tipoCliente: true,
        sucursal: true,
      },
    });

    await this.prisma.logAction(
      'ACTUALIZAR_CLIENTE_DIRECTO',
      id_usuario,
      `Cliente directo actualizado: ${cliente.nombre} (ID: ${cliente.id_cliente_directo})`,
    );

    return cliente;
  }

  /**
   * Desactivar un cliente (soft delete)
   */
  async remove(id: number, id_usuario: number): Promise<clienteDirecto> {
    const cliente = await this.findOne(id);

    const updatedCliente = await this.prisma.clienteDirecto.update({
      where: { id_cliente_directo: id },
      data: { estado: 'INACTIVO' },
    });

    await this.prisma.logAction(
      'ELIMINAR_CLIENTE_DIRECTO',
      id_usuario,
      `Cliente directo desactivado: ${cliente.nombre} (ID: ${cliente.id_cliente_directo})`,
    );

    return updatedCliente;
  }

  /**
   * Obtener tipos de cliente disponibles
   */
  async getTiposCliente() {
    return this.prisma.tipoClienteDirecto.findMany({
      where: { estado: 'ACTIVO' },
      orderBy: { nombre: 'asc' },
    });
  }
}
