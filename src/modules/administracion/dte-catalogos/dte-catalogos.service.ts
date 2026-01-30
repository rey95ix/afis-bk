// src/modules/administracion/dte-catalogos/dte-catalogos.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import {
  dTETipoDocumentoIdentificacion,
  dTEActividadEconomica,
  dTETipoEstablecimiento,
  dTETipoItem,
} from '@prisma/client';

@Injectable()
export class DteCatalogosService {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== TIPOS DE DOCUMENTO ====================

  async findAllTiposDocumento(): Promise<dTETipoDocumentoIdentificacion[]> {
    return this.prisma.dTETipoDocumentoIdentificacion.findMany({
      where: { estado: 'ACTIVO' },
      orderBy: { codigo: 'asc' },
    });
  }

  async findOneTipoDocumento(id: number): Promise<dTETipoDocumentoIdentificacion> {
    const tipoDocumento = await this.prisma.dTETipoDocumentoIdentificacion.findUnique({
      where: { id_tipo_documento: id },
    });

    if (!tipoDocumento) {
      throw new NotFoundException(`Tipo de documento con ID ${id} no encontrado`);
    }

    return tipoDocumento;
  }

  // ==================== ACTIVIDADES ECONÓMICAS ====================

  async findAllActividadesEconomicas(): Promise<dTEActividadEconomica[]> {
    return this.prisma.dTEActividadEconomica.findMany({
      where: { estado: 'ACTIVO' },
      orderBy: { codigo: 'asc' },
    });
  }

  async findOneActividadEconomica(id: number): Promise<dTEActividadEconomica> {
    const actividad = await this.prisma.dTEActividadEconomica.findUnique({
      where: { id_actividad: id },
    });

    if (!actividad) {
      throw new NotFoundException(`Actividad económica con ID ${id} no encontrada`);
    }

    return actividad;
  }

  // ==================== TIPOS DE ESTABLECIMIENTO ====================

  async findAllTiposEstablecimiento(): Promise<dTETipoEstablecimiento[]> {
    return this.prisma.dTETipoEstablecimiento.findMany({
      where: { estado: 'ACTIVO' },
      orderBy: { codigo: 'asc' },
    });
  }

  async findOneTipoEstablecimiento(id: number): Promise<dTETipoEstablecimiento> {
    const tipoEstablecimiento = await this.prisma.dTETipoEstablecimiento.findUnique({
      where: { id_tipo_establecimiento: id },
    });

    if (!tipoEstablecimiento) {
      throw new NotFoundException(
        `Tipo de establecimiento con ID ${id} no encontrado`,
      );
    }

    return tipoEstablecimiento;
  }

  // ==================== TIPOS DE ITEM ====================

  async findAllTiposItem(): Promise<dTETipoItem[]> {
    return this.prisma.dTETipoItem.findMany({
      orderBy: { codigo: 'asc' },
    });
  }

  async findOneTipoItem(id: number): Promise<dTETipoItem> {
    const tipoItem = await this.prisma.dTETipoItem.findUnique({
      where: { id_dte_tipo_item: id },
    });

    if (!tipoItem) {
      throw new NotFoundException(`Tipo de item con ID ${id} no encontrado`);
    }

    return tipoItem;
  }
}
