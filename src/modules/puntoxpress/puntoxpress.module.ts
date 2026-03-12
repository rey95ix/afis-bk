import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from 'src/modules/prisma/prisma.module';
import { PuntoXpressController } from './puntoxpress.controller';
import { PuntoXpressLegacyController } from './puntoxpress-legacy.controller';
import { PuntoXpressService } from './puntoxpress.service';
import { PuntoXpressAuthService } from './puntoxpress-auth.service';
import { JwtPuntoXpressStrategy } from './strategies/jwt-puntoxpress.strategy';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt-puntoxpress' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret:
          configService.get('JWT_SECRET_PUNTOXPRESS') ||
          configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: '1h',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [PuntoXpressController, PuntoXpressLegacyController],
  providers: [
    PuntoXpressService,
    PuntoXpressAuthService,
    JwtPuntoXpressStrategy,
  ],
})
export class PuntoXpressModule {}
