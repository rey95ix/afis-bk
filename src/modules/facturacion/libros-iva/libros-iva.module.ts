import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/modules/prisma/prisma.module';
import { LibrosIvaController } from './libros-iva.controller';
import { LibrosIvaService } from './libros-iva.service';
import { LibrosIvaExcelService } from './libros-iva-excel.service';
import { LibrosIvaPdfService } from './libros-iva-pdf.service';

@Module({
  imports: [PrismaModule],
  controllers: [LibrosIvaController],
  providers: [
    LibrosIvaService,
    LibrosIvaExcelService,
    LibrosIvaPdfService,
  ],
  exports: [LibrosIvaService],
})
export class LibrosIvaModule {}
