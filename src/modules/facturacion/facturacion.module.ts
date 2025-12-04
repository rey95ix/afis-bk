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
import { AnulacionBuilderService } from './dte/builders/anulacion-builder.service';

// DTE Signer
import { DteSignerService } from './dte/signer/dte-signer.service';

// MH Transmitter
import { MhAuthService } from './dte/transmitter/mh-auth.service';
import { MhTransmitterService } from './dte/transmitter/mh-transmitter.service';

@Module({
  imports: [PrismaModule, AuthModule, ConfigModule],
  controllers: [
    CiclosController,
    CobrosController,
    AnulacionesController,
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
    AnulacionBuilderService,

    // Signing & Transmission
    DteSignerService,
    MhAuthService,
    MhTransmitterService,
  ],
  exports: [
    CiclosService,
    CobrosService,
    AnulacionesService,
    MoraService,
  ],
})
export class FacturacionModule {}
