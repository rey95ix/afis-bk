import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { MinioModule } from '../minio/minio.module';
import { OpenaiModule } from '../openai/openai.module';
import { MigrationController } from './migration.controller';
import { MigrationService } from './migration.service';
import { MysqlConnectionService } from './services/mysql-connection.service';
import { CatalogosMigrationService } from './services/catalogos.migration';
import { ClientesMigrationService } from './services/clientes.migration';
import { ContratosMigrationService } from './services/contratos.migration';
import { DocumentosMigrationService } from './services/documentos.migration';
import { FacturacionMigrationService } from './services/facturacion.migration';

@Module({
  imports: [ConfigModule, PrismaModule, MinioModule, OpenaiModule],
  controllers: [MigrationController],
  providers: [
    MigrationService,
    MysqlConnectionService,
    CatalogosMigrationService,
    ClientesMigrationService,
    ContratosMigrationService,
    DocumentosMigrationService,
    FacturacionMigrationService,
  ],
  exports: [MigrationService],
})
export class MigrationModule {}
