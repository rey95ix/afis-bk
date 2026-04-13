import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { FacturacionModule } from '../facturacion/facturacion.module';
import { CajaCronService } from './caja-cron.service';
import { RegenerarCuotasAnuladasCronService } from './regenerar-cuotas-anuladas.cron.service';
import { CierreCobranzaPagadasCronService } from './cierre-cobranza-pagadas.cron.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule,
    FacturacionModule,
  ],
  providers: [
    CajaCronService,
    RegenerarCuotasAnuladasCronService,
    CierreCobranzaPagadasCronService,
  ],
})
export class ScheduledTasksModule {}
