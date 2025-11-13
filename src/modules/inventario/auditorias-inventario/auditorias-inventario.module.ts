// src/modules/inventario/auditorias-inventario/auditorias-inventario.module.ts
import { Module } from '@nestjs/common';
import { AuditoriasInventarioService } from './auditorias-inventario.service';
import { AuditoriasInventarioController } from './auditorias-inventario.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { MinioModule } from '../../minio/minio.module';

@Module({
  imports: [PrismaModule, MinioModule],
  controllers: [AuditoriasInventarioController],
  providers: [AuditoriasInventarioService],
  exports: [AuditoriasInventarioService],
})
export class AuditoriasInventarioModule {}
