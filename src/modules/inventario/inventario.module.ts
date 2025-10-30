import { Module } from '@nestjs/common'; 
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SucursalesController } from './sucursales/sucursales.controller';
import { SucursalesService } from './sucursales/sucursales.service';
import { BodegasController } from './bodegas/bodegas.controller';
import { BodegasService } from './bodegas/bodegas.service';

@Module({ 
  imports: [AuthModule, PrismaModule,  ],
  controllers: [SucursalesController, BodegasController, ],
  providers: [SucursalesService, BodegasService],
})
export class InventarioModule {}
