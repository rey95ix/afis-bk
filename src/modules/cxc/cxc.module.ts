import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CxcController } from './cxc.controller';
import { CxcService } from './cxc.service';
import { CxcPdfService } from './cxc-pdf.service';

@Module({
  imports: [PrismaModule],
  controllers: [CxcController],
  providers: [CxcService, CxcPdfService],
  exports: [CxcService],
})
export class CxcModule {}
