// src/modules/facturacion/facturacion.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

// Ciclos (existente)
import { CiclosController } from './ciclos/ciclos.controller';
import { CiclosService } from './ciclos/ciclos.service';

// Controllers - Cobros y Anulaciones
import { CobrosController, AnulacionesController } from './controllers';

// Services - Cobros, Anulaciones y Mora
import { CobrosService, AnulacionesService, MoraService } from './services';

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

@Module({
  imports: [PrismaModule, AuthModule, ConfigModule, LibrosIvaModule],
  controllers: [
    CiclosController,
    CobrosController,
    AnulacionesController,
    // Nuevos controllers para facturación directa
    ClientesDirectosController,
    FacturaDirectaController,
  ],
  providers: [
    // Ciclos (existente)
    CiclosService,

    // Main Services - Cobros y Anulaciones
    CobrosService,
    AnulacionesService,
    MoraService,

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
  ],
  exports: [
    CiclosService,
    CobrosService,
    AnulacionesService,
    MoraService,
    // Nuevos exports
    ClientesDirectosService,
    FacturaDirectaService,
  ],
})
export class FacturacionModule {}
