import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ClientesController } from './clientes/clientes.controller';
import { ClientesService } from './clientes/clientes.service';
import { ClienteDireccionesController } from './clientes/cliente-direcciones.controller';
import { ClienteDireccionesService } from './clientes/cliente-direcciones.service';
import { ClienteDatosFacturacionController } from './clientes/cliente-datos-facturacion.controller';
import { ClienteDatosFacturacionService } from './clientes/cliente-datos-facturacion.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [
    ClientesController,
    ClienteDireccionesController,
    ClienteDatosFacturacionController,
  ],
  providers: [
    ClientesService,
    ClienteDireccionesService,
    ClienteDatosFacturacionService,
  ],
})
export class AtencionAlClienteModule {}
