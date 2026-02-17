
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';

@Injectable()
export class BancosCatalogosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllBancos() {
    return this.prisma.cat_banco.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async findAllTiposCuenta() {
    return this.prisma.cat_tipo_cuenta_banco.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    });
  }
}
