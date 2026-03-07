import { Module } from '@nestjs/common';
import { ClientePortalController } from './cliente-portal.controller';
import { ClientePortalService } from './cliente-portal.service';

@Module({
  controllers: [ClientePortalController],
  providers: [ClientePortalService],
})
export class ClientePortalModule {}
