import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

import { MailModule } from '../mail/mail.module';
import { PermissionsService } from './services/permissions.service';
import { PoliciesService } from './services/policies.service';
import { PermissionsGuard } from './guards/permissions.guard';
import { PermissionsController } from './controllers/permissions.controller';
import { PoliciesController } from './controllers/policies.controller';
import { UserPermissionsController } from './controllers/user-permissions.controller';

@Module({
  controllers: [
    AuthController,
    PermissionsController,
    PoliciesController,
    UserPermissionsController,
  ],
  providers: [
    AuthService,
    JwtStrategy,
    PermissionsService,
    PoliciesService,
    PermissionsGuard,
  ],
  imports: [
    ConfigModule,
    MailModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return {
          secret: configService.get('JWT_SECRET'),
          signOptions: {
            expiresIn: '8h',
          },
        };
      },
    }),
  ],
  exports: [
    JwtStrategy,
    PassportModule,
    JwtModule,
    AuthService,
    PermissionsService,
    PoliciesService,
    PermissionsGuard,
  ],
})
export class AuthModule { }
