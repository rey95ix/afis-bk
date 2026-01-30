// src/modules/facturacion/factura-directa/factura-directa.module.ts
import { Module } from '@nestjs/common';
import { FacturaDirectaService } from './factura-directa.service';
import { FacturaDirectaController } from './factura-directa.controller';
import { PrismaModule } from 'src/modules/prisma/prisma.module';

// DTE Builders
import { FcBuilderService } from '../dte/builders/fc-builder.service';
import { CcfBuilderService } from '../dte/builders/ccf-builder.service';
import { NcBuilderService } from '../dte/builders/nc-builder.service';
import { NdBuilderService } from '../dte/builders/nd-builder.service';
import { FexBuilderService } from '../dte/builders/fex-builder.service';
import { FseBuilderService } from '../dte/builders/fse-builder.service';
import { AnulacionBuilderService } from '../dte/builders/anulacion-builder.service';

// DTE Signer
import { DteSignerService } from '../dte/signer/dte-signer.service';

// MH Transmitter
import { MhAuthService } from '../dte/transmitter/mh-auth.service';
import { MhTransmitterService } from '../dte/transmitter/mh-transmitter.service';
import { LibrosIvaModule } from '../libros-iva';

// Mail
import { MailModule } from '../../mail/mail.module';

@Module({
  imports: [PrismaModule, LibrosIvaModule, MailModule],
  controllers: [FacturaDirectaController],
  providers: [
    FacturaDirectaService,
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
  ],
  exports: [FacturaDirectaService],
})
export class FacturaDirectaModule {}
