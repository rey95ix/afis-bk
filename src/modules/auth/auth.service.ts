import { Injectable, InternalServerErrorException, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CreateAuthDto } from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from './interfaces';
import { usuarios } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger('AuthService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) { }

  async login(createUserDto: CreateAuthDto): Promise<any> {
    const { usuario, password } = createUserDto;
    const usuarioDB = await this.prisma.usuarios.findFirst({
      where: {
        usuario,
        estado: "ACTIVO",
      },
    });

    if (!usuarioDB) {
      this.prisma.logAction('LOGIN_FAILED', undefined, `Intento fallido de inicio de sesión para el usuario: ${usuario}`);
      throw new NotFoundException('El usuario o clave son incorrectos');
    }

    const validarPass = bcrypt.compareSync(password, usuarioDB.password);
    if (!validarPass) {
      this.prisma.logAction('LOGIN_FAILED', undefined, `Intento fallido de inicio de sesión para el usuario: ${usuario}`);
      throw new NotFoundException('El email o clave no existe');
    }

    try {
      const token = await this.getJwtToken({ id_usuario: usuarioDB.id_usuario, id_sucursal: usuarioDB.id_sucursal });
      const dataGeneral = await this.prisma.generalData.findFirst({
        select: { id_general: true, nombre_sistema: true, direccion: true, razon: true, nit: true, nrc: true, cod_actividad: true, desc_actividad: true, nombre_comercial: true, contactos: true, correo: true, cod_estable_MH: true, cod_estable: true, cod_punto_venta_MH: true, cod_punto_venta: true, impuesto: true, icono_sistema: true, icono_factura: true }
      });
      dataGeneral!.id_general = 0;

      // Registrar el inicio de sesión exitoso en la bitácora
      this.prisma.logAction('LOGIN_SUCCESS', usuarioDB.id_usuario, `Usuario ${usuario} inició sesión exitosamente`);

      return { ...usuarioDB, token, ...dataGeneral };
    } catch (error) {
      this.logger.error(error);
      throw new InternalServerErrorException("Error revise logs");
    }
  }

  async checkStatus(user: usuarios) {
    const usuarioDB = await this.prisma.usuarios.findFirst({
      where: {
        id_usuario: user.id_usuario,
        estado: "ACTIVO",
      },
    });

    if (!usuarioDB) throw new NotFoundException('Error al renovar el Token');

    const token = await this.getJwtToken({ id_usuario: usuarioDB.id_usuario, id_sucursal: usuarioDB.id_sucursal });
    const dataGeneral = await this.prisma.generalData.findFirst({
      select: { id_general: true, nombre_sistema: true, direccion: true, razon: true, nit: true, nrc: true, cod_actividad: true, desc_actividad: true, nombre_comercial: true, contactos: true, correo: true, cod_estable_MH: true, cod_estable: true, cod_punto_venta_MH: true, cod_punto_venta: true, impuesto: true, icono_sistema: true, icono_factura: true }
    });
    dataGeneral!.id_general = 0;

    // Registrar la renovación del token en la bitácora
    this.prisma.logAction('TOKEN_RENEWAL', usuarioDB.id_usuario, `Token renovado para el usuario: ${usuarioDB.usuario}`);

    return { ...usuarioDB, token, ...dataGeneral };
  }

  private getJwtToken(payload: JwtPayload) {
    const token = this.jwtService.sign(payload);
    return token;
  }
}
