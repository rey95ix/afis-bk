import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClienteAuthModule } from './modules/cliente-auth/cliente-auth.module';
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
// import { UtilidadesModule } from './modules/utilidades/utilidades.module';

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
    // UtilidadesModule, //TODO Habilitar módulo de utilidades
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
