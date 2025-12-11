import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MinioModule } from '../minio/minio.module';
import { SmsModule } from '../sms/sms.module';
import { OpenaiModule } from '../openai/openai.module';
import { ClientesController } from './clientes/clientes.controller';
import { ClientesService } from './clientes/clientes.service';
import { ClienteDireccionesController } from './clientes/cliente-direcciones.controller';
import { ClienteDireccionesService } from './clientes/cliente-direcciones.service';
import { ClienteDatosFacturacionController } from './clientes/cliente-datos-facturacion.controller';
import { ClienteDatosFacturacionService } from './clientes/cliente-datos-facturacion.service';
import { ClienteDocumentosController } from './clientes/cliente-documentos.controller';
import { ClienteDocumentosService } from './clientes/cliente-documentos.service';
import { AgendaController } from './agenda/agenda.controller';
import { AgendaService } from './agenda/agenda.service';
import { CatalogosController } from './catalogos/catalogos.controller';
import { CatalogosService } from './catalogos/catalogos.service';
import { OrdenesTrabajoController } from './ordenes-trabajo/ordenes-trabajo.controller';
import { OrdenesTrabajoService } from './ordenes-trabajo/ordenes-trabajo.service';
import { ReportesController } from './reportes/reportes.controller';
import { ReportesService } from './reportes/reportes.service';
import { TicketsController } from './tickets/tickets.controller';
import { TicketsService } from './tickets/tickets.service';
import { ContratosController } from './contratos/contratos.controller';
import { ContratosService } from './contratos/contratos.service';
import { ContratoInstalacionController } from './contratos/contrato-instalacion.controller';
import { ContratoInstalacionService } from './contratos/contrato-instalacion.service';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    MinioModule,
    SmsModule,
    OpenaiModule,
  ],
  controllers: [
    ClientesController,
    ClienteDireccionesController,
    ClienteDatosFacturacionController,
    ClienteDocumentosController,
    AgendaController,
    CatalogosController,
    OrdenesTrabajoController,
    ReportesController,
    TicketsController,
    ContratosController,
    ContratoInstalacionController,
  ],
  providers: [
    ClientesService,
    ClienteDireccionesService,
    ClienteDatosFacturacionService,
    ClienteDocumentosService,
    AgendaService,
    CatalogosService,
    OrdenesTrabajoService,
    ReportesService,
    TicketsService,
    ContratosService,
    ContratoInstalacionService,
  ],
})
export class AtencionAlClienteModule { }








