import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CxcController } from './cxc.controller';
import { CxcService } from './cxc.service';

@Module({
  imports: [PrismaModule],
  controllers: [CxcController],
  providers: [CxcService],
  exports: [CxcService],
})
export class CxcModule {}
