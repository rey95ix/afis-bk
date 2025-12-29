import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ClienteAuthController } from './cliente-auth.controller';
import { ClienteAuthService } from './cliente-auth.service';
import { ClienteSessionService } from './services/cliente-session.service';
import { JwtClienteStrategy } from './strategies/jwt-cliente.strategy';
import { PrismaModule } from 'src/modules/prisma/prisma.module';
import { MailModule } from 'src/modules/mail/mail.module';

/**
 * Módulo de autenticación para el portal de clientes
 *
 * Proporciona:
 * - Login con DUI o correo electrónico
 * - Activación de cuenta por email
 * - Recuperación de contraseña
 * - Gestión de sesiones
 * - Rate limiting por endpoint
 *
 * Endpoints disponibles en /cliente-auth/*
 */
@Module({
  imports: [
    // Módulos de base de datos y mail
    PrismaModule,
    MailModule,

    // Passport para estrategia JWT
    PassportModule.register({ defaultStrategy: 'jwt-cliente' }),

    // JWT con configuración separada para clientes
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        // Usar secret separado para clientes, si no está definido usar el general
        secret:
          configService.get('JWT_SECRET_CLIENTES') ||
          configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRATION_CLIENTES') || '4h',
        },
      }),
      inject: [ConfigService],
    }),

    // Rate limiting global
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minuto
        limit: 100, // 100 requests por minuto como base
      },
    ]),
  ],
  controllers: [ClienteAuthController],
  providers: [
    ClienteAuthService,
    ClienteSessionService,
    JwtClienteStrategy,
  ],
  exports: [ClienteAuthService, ClienteSessionService],
})
export class ClienteAuthModule {}
