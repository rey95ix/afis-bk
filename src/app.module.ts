import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TransformInterceptor } from './common/intersectors';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClienteAuthModule } from './modules/clientes/cliente-auth/cliente-auth.module';
import { ClientePortalModule } from './modules/clientes/cliente-portal/cliente-portal.module';
import { SeedModule } from './modules/seed/seed.module';
import { InventarioModule } from './modules/inventario/inventario.module';
import { AdministracionModule } from './modules/administracion/administracion.module';
import { AtencionAlClienteModule } from './modules/atencion-al-cliente/atencion-al-cliente.module';
import { MailModule } from './modules/mail/mail.module';
import { SmsModule } from './modules/sms/sms.module';
import { FcmModule } from './modules/fcm/fcm.module';
import { FacturacionModule } from './modules/facturacion/facturacion.module';
import { WhatsAppChatModule } from './modules/whatsapp-chat/whatsapp-chat.module';
import { MigrationModule } from './modules/migration/migration.module';
import { BancosModule } from './modules/bancos/bancos.module';
import { CxcModule } from './modules/cxc/cxc.module';
import { CxpModule } from './modules/cxp/cxp.module';
import { PuntoXpressModule } from './modules/puntoxpress/puntoxpress.module';
import { OltModule } from './modules/olt/olt.module';
import { LogsModule } from './modules/logs/logs.module';


@Module({
  imports: [
    ConfigModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    ClienteAuthModule, // Portal de clientes
    ClientePortalModule, // Contratos y facturas del portal
    SeedModule,
    InventarioModule,
    AdministracionModule,
    AtencionAlClienteModule,
    MailModule,
    SmsModule,
    FcmModule,
    FacturacionModule,
    WhatsAppChatModule,
    MigrationModule, // Módulo de migración MySQL → PostgreSQL
    BancosModule, // Módulo de bancos y gestión financiera
    CxcModule, // Módulo de cuentas por cobrar
    CxpModule, // Módulo de cuentas por pagar
    PuntoXpressModule, // Módulo PuntoXpress (integradores externos)
    OltModule, // Módulo de gestión OLT/ONT
    LogsModule, // Módulo de logs del sistema
    // UtilidadesModule, //TODO Habilitar módulo de utilidades
  ],
  controllers: [],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}
