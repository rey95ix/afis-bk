// src/modules/facturacion/facturacion.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

// Ciclos (existente)
import { CiclosController } from './ciclos/ciclos.controller';
import { CiclosService } from './ciclos/ciclos.service';

// Controllers - Cobros, Anulaciones y Contrato Pagos
import { CobrosController, AnulacionesController, ContratoPagosController } from './controllers';

// Services - Cobros, Anulaciones, Mora y Contrato Pagos
import { CobrosService, AnulacionesService, MoraService, ContratoPagosService } from './services';

// DTE Builders
import { FcBuilderService } from './dte/builders/fc-builder.service';
import { CcfBuilderService } from './dte/builders/ccf-builder.service';
import { NcBuilderService } from './dte/builders/nc-builder.service';
import { NdBuilderService } from './dte/builders/nd-builder.service';
import { FexBuilderService } from './dte/builders/fex-builder.service';
import { FseBuilderService } from './dte/builders/fse-builder.service';
import { AnulacionBuilderService } from './dte/builders/anulacion-builder.service';

// DTE Signer
import { DteSignerService } from './dte/signer/dte-signer.service';

// MH Transmitter
import { MhAuthService } from './dte/transmitter/mh-auth.service';
import { MhTransmitterService } from './dte/transmitter/mh-transmitter.service';

// Clientes Directos (nuevo)
import { ClientesDirectosController } from './clientes-directos/clientes-directos.controller';
import { ClientesDirectosService } from './clientes-directos/clientes-directos.service';

// Factura Directa (nuevo)
import { FacturaDirectaController } from './factura-directa/factura-directa.controller';
import { FacturaDirectaService } from './factura-directa/factura-directa.service';

// Libros de IVA
import { LibrosIvaModule } from './libros-iva/libros-iva.module';

// Mail
import { MailModule } from '../mail/mail.module';

// Cuentas por Cobrar
import { CxcModule } from '../cxc/cxc.module';

// Bancos (movimientos bancarios para pagos no-efectivo)
import { BancosModule } from '../bancos/bancos.module';

// OpenAI + Comprobante Analyzer (reutilizado de whatsapp-chat)
import { OpenaiModule } from '../openai/openai.module';
import { ComprobanteAnalyzerService } from '../whatsapp-chat/validacion-comprobante/comprobante-analyzer.service';

@Module({
  imports: [PrismaModule, AuthModule, ConfigModule, LibrosIvaModule, MailModule, CxcModule, BancosModule, OpenaiModule],
  controllers: [
    CiclosController,
    CobrosController,
    AnulacionesController,
    ContratoPagosController,
    // Nuevos controllers para facturación directa
    ClientesDirectosController,
    FacturaDirectaController,
  ],
  providers: [
    // Ciclos (existente)
    CiclosService,

    // Main Services - Cobros, Anulaciones, Mora y Contrato Pagos
    CobrosService,
    AnulacionesService,
    MoraService,
    ContratoPagosService,

    // DTE Builders
    FcBuilderService,
    CcfBuilderService,
    NcBuilderService,
    NdBuilderService,
    FexBuilderService,
    FseBuilderService,
    AnulacionBuilderService,

    // Signing & Transmission
    DteSignerService,
    MhAuthService,
    MhTransmitterService,

    // Clientes Directos (nuevo)
    ClientesDirectosService,

    // Factura Directa (nuevo)
    FacturaDirectaService,

    // Comprobante Analyzer (reutilizado de whatsapp-chat)
    ComprobanteAnalyzerService,
  ],
  exports: [
    CiclosService,
    CobrosService,
    AnulacionesService,
    MoraService,
    ContratoPagosService,
    // Nuevos exports
    ClientesDirectosService,
    FacturaDirectaService,
  ],
})
export class FacturacionModule {}
