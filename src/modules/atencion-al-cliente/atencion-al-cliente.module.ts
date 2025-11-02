import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MinioModule } from '../minio/minio.module';
import { ClientesController } from './clientes/clientes.controller';
import { ClientesService } from './clientes/clientes.service';
import { ClienteDireccionesController } from './clientes/cliente-direcciones.controller';
import { ClienteDireccionesService } from './clientes/cliente-direcciones.service';
import { ClienteDatosFacturacionController } from './clientes/cliente-datos-facturacion.controller';
import { ClienteDatosFacturacionService } from './clientes/cliente-datos-facturacion.service';
import { ClienteDocumentosController } from './clientes/cliente-documentos.controller';
import { ClienteDocumentosService } from './clientes/cliente-documentos.service';

@Module({
  imports: [AuthModule, PrismaModule, MinioModule],
  controllers: [
    ClientesController,
    ClienteDireccionesController,
    ClienteDatosFacturacionController,
    ClienteDocumentosController,
  ],
  providers: [
    ClientesService,
    ClienteDireccionesService,
    ClienteDatosFacturacionService,
    ClienteDocumentosService,
  ],
})
export class AtencionAlClienteModule {}
