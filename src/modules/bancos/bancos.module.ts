import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BancosCatalogosController } from './catalogos/bancos-catalogos.controller';
import { BancosCatalogosService } from './catalogos/bancos-catalogos.service';
import { CuentasBancariasController } from './cuentas-bancarias/cuentas-bancarias.controller';
import { CuentasBancariasService } from './cuentas-bancarias/cuentas-bancarias.service';
import { MovimientosBancariosController } from './movimientos-bancarios/movimientos-bancarios.controller';
import { MovimientosBancariosService } from './movimientos-bancarios/movimientos-bancarios.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [BancosCatalogosController, CuentasBancariasController, MovimientosBancariosController],
  providers: [BancosCatalogosService, CuentasBancariasService, MovimientosBancariosService],
  exports: [MovimientosBancariosService],
})
export class BancosModule {}
