import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SmsService } from './sms.service';
import { SmsController } from './sms.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [SmsController],
  providers: [SmsService],
  exports: [SmsService], // Exportar para usar en otros módulos
})
export class SmsModule {}
