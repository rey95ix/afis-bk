import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { LogsPuntoxpressController } from './logs-puntoxpress.controller';
import { LogsPuntoxpressService } from './logs-puntoxpress.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [LogsPuntoxpressController],
  providers: [LogsPuntoxpressService],
})
export class LogsModule {}
