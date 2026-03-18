import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OltController } from './olt.controller';
import { OltService } from './olt.service';
import { OltConnectionService } from './olt-connection.service';
import { OltCommandBuilderService } from './olt-command-builder.service';

@Module({
  imports: [AuthModule, PrismaModule, ConfigModule],
  controllers: [OltController],
  providers: [OltService, OltConnectionService, OltCommandBuilderService],
  exports: [OltService],
})
export class OltModule {}
