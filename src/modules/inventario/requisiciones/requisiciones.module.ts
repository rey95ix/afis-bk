// src/modules/inventario/requisiciones/requisiciones.module.ts
import { Module } from '@nestjs/common';
import { RequisicionesService } from './requisiciones.service';
import { RequisicionesController } from './requisiciones.controller';
import { PrismaModule } from 'src/modules/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RequisicionesController],
  providers: [RequisicionesService],
  exports: [RequisicionesService],
})
export class RequisicionesModule {}
