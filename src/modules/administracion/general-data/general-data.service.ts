// src/modules/administracion/general-data/general-data.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { UpdateGeneralDataDto } from './dto/update-general-data.dto';
import { GeneralData } from '@prisma/client';

@Injectable()
export class GeneralDataService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene la configuración general del sistema.
   * Si no existe, crea un registro por defecto.
   */
  async findOne(): Promise<GeneralData> {
    let generalData = await this.prisma.generalData.findFirst();

    if (!generalData) {
      generalData = await this.prisma.generalData.create({
        data: {
          nombre_sistema: 'AFIS',
        },
      });
    }

    return generalData;
  }

  /**
   * Actualiza la configuración general del sistema.
   * Solo actualiza los campos proporcionados (actualización parcial).
   */
  async update(
    updateGeneralDataDto: UpdateGeneralDataDto,
    id_usuario?: number,
  ): Promise<GeneralData> {
    const current = await this.findOne();

    const generalData = await this.prisma.generalData.update({
      where: { id_general: current.id_general },
      data: updateGeneralDataDto,
    });

    await this.prisma.logAction(
      'ACTUALIZAR_GENERAL_DATA',
      id_usuario,
      `Configuración general actualizada`,
    );

    return generalData;
  }
}
