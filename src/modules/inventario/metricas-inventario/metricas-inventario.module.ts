import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../../prisma/prisma.module';
import { MetricasInventarioController } from './metricas-inventario.controller';
import { MetricasInventarioService } from './metricas-inventario.service';

@Module({
  imports: [
    PrismaModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [MetricasInventarioController],
  providers: [MetricasInventarioService],
  exports: [MetricasInventarioService],
})
export class MetricasInventarioModule {}
