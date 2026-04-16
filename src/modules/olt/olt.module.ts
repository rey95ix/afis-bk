import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OltController } from './olt.controller';
import { OltEquipoController } from './olt-equipo.controller';
import { OltService } from './olt.service';
import { OltEquipoService } from './olt-equipo.service';
import { OltConnectionService } from './olt-connection.service';
import { OltCommandBuilderService } from './olt-command-builder.service';

@Module({
  imports: [AuthModule, PrismaModule, ConfigModule],
  controllers: [OltController, OltEquipoController],
  providers: [
    OltService,
    OltEquipoService,
    OltConnectionService,
    OltCommandBuilderService,
  ],
  exports: [OltService, OltEquipoService],
})
export class OltModule {}
