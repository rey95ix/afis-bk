import { Injectable, InternalServerErrorException, Logger, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { CreateAuthDto } from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { JwtPayload } from './interfaces';
import { usuarios } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePassworDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger('AuthService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) { }

  async login(createUserDto: CreateAuthDto): Promise<any> {

    //agregar un delay de 2 segundos para evitar ataques de fuerza bruta
    // await new Promise(resolve => setTimeout(resolve, 2000));

    const { usuario, password, fcm_token } = createUserDto;
    const usuarioDB = await this.prisma.usuarios.findFirst({
      where: {
        usuario,
        estado: "ACTIVO",
      },
      include: {
        roles: true
      }
    });
    if (!usuarioDB) {
      this.prisma.logAction('LOGIN_FAILED', undefined, `Intento fallido de inicio de sesión para el usuario: ${usuario}`);
      console.log('Usuario no encontrado o inactivo');
      throw new NotFoundException('El usuario o clave son incorrectos');
    }

    const validarPass = bcrypt.compareSync(password, usuarioDB.password);
    if (!validarPass) {
      this.prisma.logAction('LOGIN_FAILED', undefined, `Intento fallido de inicio de sesión para el usuario: ${usuario}`);
      throw new NotFoundException('El email o clave no existe');
    }

    // Actualizar FCM token solo si viene y no está vacío (para notificaciones push móviles)
    if (fcm_token && fcm_token.trim() !== '') {
      await this.prisma.usuarios.update({
        where: { id_usuario: usuarioDB.id_usuario },
        data: { fcm_token },
      });
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

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<void> {
    const { email } = forgotPasswordDto;
    const user = await this.prisma.usuarios.findFirst({ where: { usuario: email } });

    if (!user) {
      throw new NotFoundException('No existe un usuario con ese correo electrónico.');
    } 
    const resetToken = crypto.randomBytes(32).toString('hex');
    const passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
 
    await this.prisma.usuarios.update({
      where: { id_usuario: user.id_usuario },
      data: {
        reset_password_token: passwordResetToken,
        reset_password_expires: passwordResetExpires,
      },
    }); 

    try { 
      await this.mailService.sendPasswordResetEmail({ nombres: user.nombres, correo_electronico: user.usuario }, resetToken);
    } catch (error) {
      this.logger.error(error);
      await this.prisma.usuarios.update({
        where: { id_usuario: user.id_usuario },
        data: {
          reset_password_token: null,
          reset_password_expires: null,
        },
      });
      throw new InternalServerErrorException('No se pudo enviar el correo de recuperación. Inténtelo de nuevo más tarde.');
    }
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<void> {
    const { token, password } = resetPasswordDto;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await this.prisma.usuarios.findFirst({
      where: {
        reset_password_token: hashedToken,
        reset_password_expires: { gte: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('El token es inválido o ha expirado.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await this.prisma.usuarios.update({
      where: { id_usuario: user.id_usuario },
      data: {
        password: hashedPassword,
        reset_password_token: null,
        reset_password_expires: null,
      },
    });
  }

  async changePassword(user: usuarios, changePasswordDto: ChangePassworDto): Promise<void> {
    const { oldPassword, newPassword } = changePasswordDto;

    const usuarioDB = await this.prisma.usuarios.findUnique({ where: { id_usuario: user.id_usuario } });

    if (!usuarioDB) {
      throw new NotFoundException('El usuario no fue encontrado.');
    }

    const isMatch = await bcrypt.compare(oldPassword, usuarioDB.password);
    if (!isMatch) {
      throw new UnauthorizedException('La contraseña actual es incorrecta.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.usuarios.update({
      where: { id_usuario: user.id_usuario },
      data: { password: hashedPassword },
    });
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

