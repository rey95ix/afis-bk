import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CxpController } from './cxp.controller';
import { CxpService } from './cxp.service';

@Module({
  imports: [PrismaModule],
  controllers: [CxpController],
  providers: [CxpService],
  exports: [CxpService],
})
export class CxpModule {}
