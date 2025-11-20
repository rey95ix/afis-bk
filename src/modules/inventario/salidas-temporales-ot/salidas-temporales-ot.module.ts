// src/modules/inventario/salidas-temporales-ot/salidas-temporales-ot.module.ts
import { Module } from '@nestjs/common';
import { SalidasTemporalesOtService } from './salidas-temporales-ot.service';
import { SalidasTemporalesOtController } from './salidas-temporales-ot.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SalidasTemporalesOtController],
  providers: [SalidasTemporalesOtService],
  exports: [SalidasTemporalesOtService],
})
export class SalidasTemporalesOtModule {}
