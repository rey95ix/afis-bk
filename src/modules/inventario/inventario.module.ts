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
import { ImportacionesController } from './importaciones/importaciones.controller';
import { ImportacionesService } from './importaciones/importaciones.service';
import { EstantesController } from './estantes/estantes.controller';
import { EstantesService } from './estantes/estantes.service';
import { ItemsInventarioController } from './items-inventario/items-inventario.controller';
import { ItemsInventarioService } from './items-inventario/items-inventario.service';
import { RequisicionesController } from './requisiciones/requisiciones.controller';
import { RequisicionesService } from './requisiciones/requisiciones.service';
import { OrdenesSalidaController } from './ordenes-salida/ordenes-salida.controller';
import { OrdenesSalidaService } from './ordenes-salida/ordenes-salida.service';

@Module({
  imports: [AuthModule, PrismaModule,],
  controllers: [
    SucursalesController,
    BodegasController,
    ProveedoresController,
    CatalogosProveedoresController,
    ImportacionesController,
    EstantesController,
    ItemsInventarioController,
    RequisicionesController,
    OrdenesSalidaController
  ],
  providers: [
    SucursalesService,
    BodegasService,
    ProveedoresService,
    CatalogosProveedoresService,
    ImportacionesService,
    EstantesService,
    ItemsInventarioService,
    RequisicionesService,
    OrdenesSalidaService
  ],
})
export class InventarioModule { }
