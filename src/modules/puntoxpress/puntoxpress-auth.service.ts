import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { JwtPuntoXpressPayload } from './interfaces';

@Injectable()
export class PuntoXpressAuthService {
  private readonly logger = new Logger(PuntoXpressAuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(usuario: string, contrasena: string) {
    const integrador = await this.prisma.puntoxpress_integrador.findUnique({
      where: { usuario },
    });

    if (!integrador) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!integrador.activo) {
      throw new UnauthorizedException('Integrador deshabilitado');
    }

    const passwordValid = await bcrypt.compare(contrasena, integrador.password_hash);
    if (!passwordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload: JwtPuntoXpressPayload = {
      id_integrador: integrador.id_integrador,
      nombre: integrador.nombre,
      type: 'puntoxpress',
    };

    const token = this.jwtService.sign(payload, { expiresIn: '1h' });

    this.logger.log(`Integrador "${integrador.nombre}" autenticado exitosamente`);

    return { 
      token,
      duracion: 3600,
    };
  }
}
