import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ClientePortalController } from './cliente-portal.controller';
import { ClientePortalService } from './cliente-portal.service';
import { PayWayService } from './payway.service';
import { FacturacionModule } from '../../facturacion/facturacion.module';

@Module({
  imports: [ConfigModule, FacturacionModule, ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])],
  controllers: [ClientePortalController],
  providers: [ClientePortalService, PayWayService],
})
export class ClientePortalModule {}
