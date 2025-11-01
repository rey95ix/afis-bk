
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';

@Injectable()
export class CatalogosProveedoresService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllMunicipios() {
    return this.prisma.municipios.findMany({
      where: { estado: 'ACTIVO' },
      orderBy: { nombre: 'asc' },
    });
  }

  async findAllTiposDocumentos() {
    return this.prisma.dTETipoDocumentoIdentificacion.findMany({
      where: { estado: 'ACTIVO' },
      orderBy: { nombre: 'asc' },
    });
  }

  async findAllActividadesEconomicas() {
    return this.prisma.dTEActividadEconomica.findMany({
      where: { estado: 'ACTIVO' },
      orderBy: { nombre: 'asc' },
    });
  }
}
