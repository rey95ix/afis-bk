import { Module } from '@nestjs/common';
import { CotizacionesCompraController } from './cotizaciones-compra.controller';
import { CotizacionesCompraService } from './cotizaciones-compra.service';

@Module({
  controllers: [CotizacionesCompraController],
  providers: [CotizacionesCompraService],
  exports: [CotizacionesCompraService],
})
export class CotizacionesCompraModule {}
