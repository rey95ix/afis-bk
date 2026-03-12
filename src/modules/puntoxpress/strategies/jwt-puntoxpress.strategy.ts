import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { JwtPuntoXpressPayload } from '../interfaces';

@Injectable()
export class JwtPuntoXpressStrategy extends PassportStrategy(Strategy, 'jwt-puntoxpress') {
  constructor(
    private prisma: PrismaService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get('JWT_SECRET_PUNTOXPRESS') || configService.get('JWT_SECRET'),
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPuntoXpressPayload) {
    const { id_integrador, type } = payload;

    if (type !== 'puntoxpress') {
      throw new UnauthorizedException('Token inválido');
    }

    const integrador = await this.prisma.puntoxpress_integrador.findUnique({
      where: { id_integrador },
    });

    if (!integrador || !integrador.activo) {
      throw new UnauthorizedException('Integrador no autorizado o inactivo');
    }

    return {
      id_integrador: integrador.id_integrador,
      nombre: integrador.nombre,
    };
  }
}
