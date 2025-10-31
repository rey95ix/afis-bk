// src/modules/atencion-al-cliente/clientes/cliente-datos-facturacion.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateClienteDatosFacturacionDto } from './dto/create-cliente-datos-facturacion.dto';
import { UpdateClienteDatosFacturacionDto } from './dto/update-cliente-datos-facturacion.dto';
import { clienteDatosFacturacion } from '@prisma/client';

@Injectable()
export class ClienteDatosFacturacionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createClienteDatosFacturacionDto: CreateClienteDatosFacturacionDto,
    id_usuario?: number,
  ): Promise<clienteDatosFacturacion> {
    // Verificar que el cliente existe
    const cliente = await this.prisma.cliente.findUnique({
      where: { id_cliente: createClienteDatosFacturacionDto.id_cliente },
    });

    if (!cliente) {
      throw new NotFoundException(
        `Cliente con ID ${createClienteDatosFacturacionDto.id_cliente} no encontrado`,
      );
    }

    const {
      id_cliente,
      id_tipo_documento,
      id_actividad,
      id_municipio,
      id_departamento,
      ...rest
    } = createClienteDatosFacturacionDto;

    const datosFacturacion = await this.prisma.clienteDatosFacturacion.create({
      data: {
        ...rest,
        id_cliente: +id_cliente,
        id_tipo_documento: id_tipo_documento ? +id_tipo_documento : undefined,
        id_actividad: id_actividad ? +id_actividad : undefined,
        id_municipio: id_municipio ? +id_municipio : undefined,
        id_departamento: id_departamento ? +id_departamento : undefined,
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
        dTETipoDocumentoIdentificacion: true,
        dTEActividadEconomica: true,
      },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'CREAR_DATOS_FACTURACION_CLIENTE',
      id_usuario,
      `Datos de facturación creados para cliente: ${cliente.titular} - DUI: ${cliente.dui}`,
    );

    return datosFacturacion;
  }

  async findAllByCliente(id_cliente: number): Promise<clienteDatosFacturacion[]> {
    // Verificar que el cliente existe
    const cliente = await this.prisma.cliente.findUnique({
      where: { id_cliente },
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente con ID ${id_cliente} no encontrado`);
    }

    return this.prisma.clienteDatosFacturacion.findMany({
      where: {
        id_cliente,
        estado: 'ACTIVO',
      },
      include: {
        municipio: true,
        departamento: true,
        dTETipoDocumentoIdentificacion: true,
        dTEActividadEconomica: true,
      },
      orderBy: { fecha_creacion: 'desc' },
    });
  }

  async findOne(id: number) {
    const datosFacturacion = await this.prisma.clienteDatosFacturacion.findUnique({
      where: { id_cliente_datos_facturacion: id },
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
        dTETipoDocumentoIdentificacion: true,
        dTEActividadEconomica: true,
      },
    });

    if (!datosFacturacion) {
      throw new NotFoundException(
        `Datos de facturación con ID ${id} no encontrados`,
      );
    }

    return datosFacturacion;
  }

  async update(
    id: number,
    updateClienteDatosFacturacionDto: UpdateClienteDatosFacturacionDto,
    id_usuario?: number,
  ): Promise<clienteDatosFacturacion> {
    const datosExistentes = await this.findOne(id);

    const {
      id_cliente,
      id_tipo_documento,
      id_actividad,
      id_municipio,
      id_departamento,
      ...rest
    } = updateClienteDatosFacturacionDto;

    const datosFacturacion = await this.prisma.clienteDatosFacturacion.update({
      where: { id_cliente_datos_facturacion: id },
      data: {
        ...rest,
        id_cliente: id_cliente ? +id_cliente : undefined,
        id_tipo_documento: id_tipo_documento ? +id_tipo_documento : undefined,
        id_actividad: id_actividad ? +id_actividad : undefined,
        id_municipio: id_municipio ? +id_municipio : undefined,
        id_departamento: id_departamento ? +id_departamento : undefined,
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
        dTETipoDocumentoIdentificacion: true,
        dTEActividadEconomica: true,
      },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'ACTUALIZAR_DATOS_FACTURACION_CLIENTE',
      id_usuario,
      `Datos de facturación actualizados para cliente: ${datosExistentes.cliente.titular}`,
    );

    return datosFacturacion;
  }

  async remove(id: number, id_usuario?: number): Promise<clienteDatosFacturacion> {
    const datosExistentes = await this.findOne(id);

    const datosFacturacion = await this.prisma.clienteDatosFacturacion.update({
      where: { id_cliente_datos_facturacion: id },
      data: { estado: 'INACTIVO' },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'ELIMINAR_DATOS_FACTURACION_CLIENTE',
      id_usuario,
      `Datos de facturación eliminados para cliente: ${datosExistentes.cliente.titular}`,
    );

    return datosFacturacion;
  }
}
