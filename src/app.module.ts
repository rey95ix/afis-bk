import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { SeedModule } from './modules/seed/seed.module';
import { InventarioModule } from './modules/inventario/inventario.module';
import { AdministracionModule } from './modules/administracion/administracion.module';
import { AtencionAlClienteModule } from './modules/atencion-al-cliente/atencion-al-cliente.module';
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
    SeedModule,
    InventarioModule,
    AdministracionModule,
    AtencionAlClienteModule,
    // UtilidadesModule, //TODO Habilitar módulo de utilidades
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
