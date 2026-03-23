import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ClientePortalController } from './cliente-portal.controller';
import { ClientePortalService } from './cliente-portal.service';
import { PayWayService } from './payway.service';
import { FirmaContratoController } from './firma-contrato.controller';
import { FirmaContratoService } from './firma-contrato.service';
import { FacturacionModule } from '../../facturacion/facturacion.module';
import { MailModule } from '../../mail/mail.module';
import { AtencionAlClienteModule } from '../../atencion-al-cliente/atencion-al-cliente.module';

@Module({
  imports: [ConfigModule, FacturacionModule, MailModule, AtencionAlClienteModule, ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])],
  controllers: [ClientePortalController, FirmaContratoController],
  providers: [ClientePortalService, PayWayService, FirmaContratoService],
})
export class ClientePortalModule {}
