// src/modules/facturacion/clientes-directos/clientes-directos.module.ts
import { Module } from '@nestjs/common';
import { ClientesDirectosService } from './clientes-directos.service';
import { ClientesDirectosController } from './clientes-directos.controller';
import { PrismaModule } from 'src/modules/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ClientesDirectosController],
  providers: [ClientesDirectosService],
  exports: [ClientesDirectosService],
})
export class ClientesDirectosModule {}
