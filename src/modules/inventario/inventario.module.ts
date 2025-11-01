import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SucursalesController } from './sucursales/sucursales.controller';
import { SucursalesService } from './sucursales/sucursales.service';
import { BodegasController } from './bodegas/bodegas.controller';
import { BodegasService } from './bodegas/bodegas.service';
import { ProveedoresController } from './proveedores/proveedores.controller';
import { ProveedoresService } from './proveedores/proveedores.service';
import { CatalogosProveedoresController } from './catalogos-proveedores/catalogos-proveedores.controller';
import { CatalogosProveedoresService } from './catalogos-proveedores/catalogos-proveedores.service';

@Module({
  imports: [AuthModule, PrismaModule,],
  controllers: [SucursalesController, BodegasController, ProveedoresController, CatalogosProveedoresController,],
  providers: [SucursalesService, BodegasService, ProveedoresService, CatalogosProveedoresService],
})
export class InventarioModule { }
