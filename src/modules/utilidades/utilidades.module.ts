import { Module } from '@nestjs/common';
import { UtilidadesController } from './utilidades.controller';
import { ImportDataService } from './import-data.service';
import { MysqlConnectionService } from './mysql-connection.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [UtilidadesController],
  providers: [ImportDataService, MysqlConnectionService],
  exports: [ImportDataService, MysqlConnectionService],
})
export class UtilidadesModule {}
