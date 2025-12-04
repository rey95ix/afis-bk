// src/modules/atencion-al-cliente/contratos/contrato-instalacion.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateContratoInstalacionDto } from './dto/create-contrato-instalacion.dto';
import { UpdateContratoInstalacionDto } from './dto/update-contrato-instalacion.dto';
import { atcContratoInstalacion } from '@prisma/client';

@Injectable()
export class ContratoInstalacionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createDto: CreateContratoInstalacionDto,
    id_usuario: number,
  ): Promise<atcContratoInstalacion> {
    // Verificar que el contrato exista
    const contrato = await this.prisma.atcContrato.findUnique({
      where: { id_contrato: createDto.id_contrato },
      include: { cliente: true },
    });

    if (!contrato) {
      throw new NotFoundException(
        `Contrato con ID ${createDto.id_contrato} no encontrado`,
      );
    }

    // Verificar que no exista ya una instalación para este contrato
    const existingInstalacion =
      await this.prisma.atcContratoInstalacion.findUnique({
        where: { id_contrato: createDto.id_contrato },
      });

    if (existingInstalacion) {
      throw new ConflictException(
        `Ya existe una instalación registrada para el contrato ${contrato.codigo}`,
      );
    }

    const { tecnicos_instalacion, fecha_instalacion, ...rest } = createDto;

    const instalacion = await this.prisma.atcContratoInstalacion.create({
      data: {
        ...rest,
        fecha_instalacion: fecha_instalacion
          ? new Date(fecha_instalacion)
          : undefined,
        tecnicos_instalacion: tecnicos_instalacion
          ? JSON.stringify(tecnicos_instalacion)
          : undefined,
      },
      include: {
        contrato: {
          include: {
            cliente: {
              select: {
                id_cliente: true,
                titular: true,
              },
            },
            plan: true,
          },
        },
      },
    });

    // Si se marca como instalado, actualizar el estado del contrato
    if (createDto.instalado) {
      await this.prisma.atcContrato.update({
        where: { id_contrato: createDto.id_contrato },
        data: {
          estado: 'INSTALADO_ACTIVO',
          fecha_instalacion: fecha_instalacion
            ? new Date(fecha_instalacion)
            : new Date(),
          fecha_inicio_contrato: new Date(),
        },
      });
    }

    // Registrar en el log
    await this.prisma.logAction(
      'CREAR_INSTALACION_CONTRATO',
      id_usuario,
      `Instalación registrada para contrato: ${contrato.codigo} - Cliente: ${contrato.cliente.titular}`,
    );

    return instalacion;
  }

  async findByContrato(id_contrato: number): Promise<atcContratoInstalacion> {
    const instalacion = await this.prisma.atcContratoInstalacion.findUnique({
      where: { id_contrato },
      include: {
        contrato: {
          include: {
            cliente: {
              select: {
                id_cliente: true,
                titular: true,
                dui: true,
              },
            },
            plan: true,
            ciclo: true,
          },
        },
      },
    });

    if (!instalacion) {
      throw new NotFoundException(
        `Instalación para contrato con ID ${id_contrato} no encontrada`,
      );
    }

    return instalacion;
  }

  async findOne(id: number): Promise<atcContratoInstalacion> {
    const instalacion = await this.prisma.atcContratoInstalacion.findUnique({
      where: { id_instalacion: id },
      include: {
        contrato: {
          include: {
            cliente: {
              select: {
                id_cliente: true,
                titular: true,
                dui: true,
              },
            },
            plan: true,
            ciclo: true,
          },
        },
      },
    });

    if (!instalacion) {
      throw new NotFoundException(`Instalación con ID ${id} no encontrada`);
    }

    return instalacion;
  }

  async update(
    id: number,
    updateDto: UpdateContratoInstalacionDto,
    id_usuario: number,
  ): Promise<atcContratoInstalacion> {
    const existingInstalacion = await this.findOne(id);

    const { tecnicos_instalacion, fecha_instalacion, ...rest } = updateDto;

    const instalacion = await this.prisma.atcContratoInstalacion.update({
      where: { id_instalacion: id },
      data: {
        ...rest,
        fecha_instalacion: fecha_instalacion
          ? new Date(fecha_instalacion)
          : undefined,
        tecnicos_instalacion: tecnicos_instalacion
          ? JSON.stringify(tecnicos_instalacion)
          : undefined,
      },
      include: {
        contrato: {
          include: {
            cliente: {
              select: {
                id_cliente: true,
                titular: true,
              },
            },
            plan: true,
          },
        },
      },
    });

    // Si se marca como instalado y antes no lo estaba, actualizar el contrato
    if (updateDto.instalado && !existingInstalacion.instalado) {
      await this.prisma.atcContrato.update({
        where: { id_contrato: existingInstalacion.id_contrato },
        data: {
          estado: 'INSTALADO_ACTIVO',
          fecha_instalacion: fecha_instalacion
            ? new Date(fecha_instalacion)
            : new Date(),
          fecha_inicio_contrato: new Date(),
        },
      });
    }

    // Registrar en el log
    await this.prisma.logAction(
      'ACTUALIZAR_INSTALACION_CONTRATO',
      id_usuario,
      `Instalación actualizada para contrato: ${instalacion.contrato.codigo}`,
    );

    return instalacion;
  }

  async remove(id: number, id_usuario: number): Promise<atcContratoInstalacion> {
    const instalacion = await this.findOne(id);

    const deletedInstalacion = await this.prisma.atcContratoInstalacion.delete({
      where: { id_instalacion: id },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'ELIMINAR_INSTALACION_CONTRATO',
      id_usuario,
      `Instalación eliminada del contrato ID: ${instalacion.id_contrato}`,
    );

    return deletedInstalacion;
  }
}
