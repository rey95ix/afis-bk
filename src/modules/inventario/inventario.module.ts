import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ScheduleModule } from '@nestjs/schedule';
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
import { SeriesController } from './items-inventario/series.controller';
import { RequisicionesController } from './requisiciones/requisiciones.controller';
import { RequisicionesService } from './requisiciones/requisiciones.service';
import { OrdenesSalidaController } from './ordenes-salida/ordenes-salida.controller';
import { OrdenesSalidaService } from './ordenes-salida/ordenes-salida.service';
import { ComprasController } from './compras/compras.controller';
import { ComprasService } from './compras/compras.service';
import { MovimientosInventarioController } from './movimientos-inventario/movimientos-inventario.controller';
import { MovimientosInventarioService } from './movimientos-inventario/movimientos-inventario.service';
import { AuditoriasInventarioController } from './auditorias-inventario/auditorias-inventario.controller';
import { AuditoriasInventarioService } from './auditorias-inventario/auditorias-inventario.service';
import { SalidasTemporalesOtController } from './salidas-temporales-ot/salidas-temporales-ot.controller';
import { SalidasTemporalesOtService } from './salidas-temporales-ot/salidas-temporales-ot.service';
import { MetricasInventarioController } from './metricas-inventario/metricas-inventario.controller';
import { MetricasInventarioService } from './metricas-inventario/metricas-inventario.service';
import { CargaInventarioController } from './carga-inventario/carga-inventario.controller';
import { CargaInventarioService } from './carga-inventario/carga-inventario.service';
import { MinioModule } from '../minio/minio.module';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    MinioModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [
    SucursalesController,
    BodegasController,
    ProveedoresController,
    CatalogosProveedoresController,
    ImportacionesController,
    EstantesController,
    ItemsInventarioController,
    SeriesController,
    RequisicionesController,
    OrdenesSalidaController,
    ComprasController,
    MovimientosInventarioController,
    AuditoriasInventarioController,
    SalidasTemporalesOtController,
    MetricasInventarioController,
    CargaInventarioController,
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
    OrdenesSalidaService,
    ComprasService,
    MovimientosInventarioService,
    AuditoriasInventarioService,
    SalidasTemporalesOtService,
    MetricasInventarioService,
    CargaInventarioService,
  ],
  exports: [MetricasInventarioService],
})
export class InventarioModule { }
