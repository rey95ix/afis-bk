// src/modules/atencion-al-cliente/clientes/cliente-direcciones.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateClienteDireccionDto } from './dto/create-cliente-direccion.dto';
import { UpdateClienteDireccionDto } from './dto/update-cliente-direccion.dto';
import { clienteDirecciones } from '@prisma/client';

@Injectable()
export class ClienteDireccionesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createClienteDireccionDto: CreateClienteDireccionDto,
    id_usuario?: number,
  ): Promise<clienteDirecciones> {
    // Verificar que el cliente existe
    const cliente = await this.prisma.cliente.findUnique({
      where: { id_cliente: createClienteDireccionDto.id_cliente },
    });

    if (!cliente) {
      throw new NotFoundException(
        `Cliente con ID ${createClienteDireccionDto.id_cliente} no encontrado`,
      );
    }

    const { id_cliente, id_municipio, id_departamento, id_colonia, ...rest } =
      createClienteDireccionDto;

    const direccion = await this.prisma.clienteDirecciones.create({
      data: {
        ...rest,
        id_cliente: +id_cliente,
        id_municipio: +id_municipio,
        id_departamento: +id_departamento,
        id_colonia: id_colonia ? +id_colonia : undefined,
      },
      include: {
        cliente: {
          select: {
            id_cliente: true,
            titular: true,
            dui: true,
          },
        },
        municipio: true,
        departamento: true,
        colonias: true,
      },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'CREAR_DIRECCION_CLIENTE',
      id_usuario,
      `Dirección creada para cliente: ${cliente.titular} - DUI: ${cliente.dui}`,
    );

    return direccion;
  }

  async findAllByCliente(id_cliente: number): Promise<clienteDirecciones[]> {
    // Verificar que el cliente existe
    const cliente = await this.prisma.cliente.findUnique({
      where: { id_cliente },
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente con ID ${id_cliente} no encontrado`);
    }

    return this.prisma.clienteDirecciones.findMany({
      where: {
        id_cliente,
        estado: 'ACTIVO',
      },
      include: {
        municipio: true,
        departamento: true,
        colonias: true,
      },
      orderBy: { fecha_creacion: 'desc' },
    });
  }

  async findOne(id: number) {
    const direccion = await this.prisma.clienteDirecciones.findUnique({
      where: { id_cliente_direccion: id },
      include: {
        cliente: {
          select: {
            id_cliente: true,
            titular: true,
            dui: true,
          },
        },
        municipio: true,
        departamento: true,
        colonias: true,
      },
    });

    if (!direccion) {
      throw new NotFoundException(`Dirección con ID ${id} no encontrada`);
    }

    return direccion;
  }

  async update(
    id: number,
    updateClienteDireccionDto: UpdateClienteDireccionDto,
    id_usuario?: number,
  ): Promise<clienteDirecciones> {
    const direccionExistente = await this.findOne(id);

    const { id_cliente, id_municipio, id_departamento, id_colonia, ...rest } =
      updateClienteDireccionDto;

    const direccion = await this.prisma.clienteDirecciones.update({
      where: { id_cliente_direccion: id },
      data: {
        ...rest,
        id_cliente: id_cliente ? +id_cliente : undefined,
        id_municipio: id_municipio ? +id_municipio : undefined,
        id_departamento: id_departamento ? +id_departamento : undefined,
        id_colonia: id_colonia ? +id_colonia : undefined,
      },
      include: {
        cliente: {
          select: {
            id_cliente: true,
            titular: true,
            dui: true,
          },
        },
        municipio: true,
        departamento: true,
        colonias: true,
      },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'ACTUALIZAR_DIRECCION_CLIENTE',
      id_usuario,
      `Dirección actualizada para cliente: ${direccionExistente.cliente.titular}`,
    );

    return direccion;
  }

  async remove(id: number, id_usuario?: number): Promise<clienteDirecciones> {
    const direccionExistente = await this.findOne(id);

    const direccion = await this.prisma.clienteDirecciones.update({
      where: { id_cliente_direccion: id },
      data: { estado: 'INACTIVO' },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'ELIMINAR_DIRECCION_CLIENTE',
      id_usuario,
      `Dirección eliminada para cliente: ${direccionExistente.cliente.titular}`,
    );

    return direccion;
  }
}
