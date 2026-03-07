import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { MailService } from 'src/modules/mail/mail.service';
import { ClienteSessionService } from './services/cliente-session.service';
import {
  ClienteLoginDto,
  ClienteActivarCuentaDto,
  ClienteForgotPasswordDto,
  ClienteResetPasswordDto,
  ClienteChangePasswordDto,
} from './dto';
import {
  JwtClientePayload,
  LoginResponse,
  ClienteTokens,
  ClienteLogAccion,
} from './interfaces';

/**
 * Servicio principal de autenticación para clientes del portal
 *
 * Implementa medidas de seguridad:
 * - Rate limiting (en controller)
 * - Bloqueo de cuenta después de intentos fallidos
 * - Delay aleatorio para prevenir timing attacks
 * - Tokens con hash SHA256 para reset/activación
 * - Sesiones revocables
 * - Logging de todas las acciones
 */
@Injectable()
export class ClienteAuthService {
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MINUTES = 30;
  private readonly ACCESS_TOKEN_HOURS = 4;
  private readonly REFRESH_TOKEN_DAYS = 7;
  private readonly ACTIVATION_TOKEN_HOURS = 24;
  private readonly RESET_TOKEN_MINUTES = 30;
  private readonly BCRYPT_ROUNDS = 12;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
    private sessionService: ClienteSessionService,
  ) {}

  // ========================
  // LOGIN
  // ========================

  /**
   * Login de cliente con DUI o correo electrónico
   */
  async login(
    dto: ClienteLoginDto,
    ip: string | null,
    userAgent: string | null,
  ): Promise<LoginResponse> {
    const { identificador, password, fcm_token } = dto;

    // Normalizar identificador
    const identificadorNormalizado = this.normalizarIdentificador(identificador);

    // Buscar cliente por DUI o correo
    const cliente = await this.prisma.cliente.findFirst({
      where: {
        OR: [
          { dui: identificadorNormalizado },
          { correo_electronico: identificadorNormalizado.toLowerCase() },
        ],
        estado: 'ACTIVO',
      },
    });

    // Log del intento (siempre, incluso si no existe)
    await this.sessionService.registrarLog(
      cliente?.id_cliente ?? null,
      ClienteLogAccion.LOGIN_ATTEMPT,
      ip,
      userAgent,
      { identificador: identificadorNormalizado },
    );

    if (!cliente) {
      // Delay aleatorio para prevenir timing attacks
      await this.delay(1000 + Math.random() * 500);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Verificar si la cuenta está bloqueada
    if (cliente.cuenta_bloqueada) {
      const tiempoRestante = this.calcularTiempoDesbloqueo(cliente.fecha_bloqueo);
      if (tiempoRestante > 0) {
        throw new ForbiddenException(
          `Cuenta bloqueada. Intente nuevamente en ${tiempoRestante} minutos`,
        );
      }
      // Desbloquear automáticamente si ya pasó el tiempo
      await this.desbloquearCuenta(cliente.id_cliente);
    }

    // Verificar si la cuenta está activada
    if (!cliente.cuenta_activada || !cliente.password) {
      throw new ForbiddenException(
        'Cuenta no activada. Solicite la activación de su cuenta',
      );
    }

    // Validar contraseña
    const passwordValido = await bcrypt.compare(password, cliente.password);

    if (!passwordValido) {
      await this.incrementarIntentosFallidos(cliente.id_cliente, ip, userAgent);
      // Delay aleatorio
      await this.delay(1000 + Math.random() * 500);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Login exitoso - resetear intentos fallidos
    await this.prisma.cliente.update({
      where: { id_cliente: cliente.id_cliente },
      data: {
        intentos_fallidos: 0,
        ultimo_login: new Date(),
        fcm_token_cliente: fcm_token || cliente.fcm_token_cliente,
      },
    });

    // Generar tokens
    const tokens = await this.generarTokens(cliente.id_cliente, cliente.dui, ip, userAgent);

    // Log de éxito
    await this.sessionService.registrarLog(
      cliente.id_cliente,
      ClienteLogAccion.LOGIN_SUCCESS,
      ip,
      userAgent,
    );

    return {
      cliente: {
        id_cliente: cliente.id_cliente,
        titular: cliente.titular,
        dui: cliente.dui,
        correo_electronico: cliente.correo_electronico,
        telefono1: cliente.telefono1,
        ultimo_login: cliente.ultimo_login,
      },
      ...tokens,
    };
  }

  // ========================
  // ACTIVACIÓN DE CUENTA
  // ========================

  /**
   * Solicitar activación de cuenta (primer acceso)
   * El cliente ingresa su DUI y recibe un email con instrucciones
   */
  async solicitarActivacion(dui: string, ip: string | null, userAgent: string | null) {
    const duiNormalizado = this.normalizarIdentificador(dui);

    const cliente = await this.prisma.cliente.findFirst({
      where: { dui: duiNormalizado, estado: 'ACTIVO' },
    });

    // Respuesta genérica para no revelar información
    const respuestaGenerica = {
      message: 'Si el DUI está registrado, recibirá instrucciones por correo electrónico',
    };

    if (!cliente) {
      await this.delay(1000);
      return respuestaGenerica;
    }

    if (cliente.cuenta_activada) {
      throw new BadRequestException(
        'La cuenta ya está activada. Use "Olvidé mi contraseña" si lo necesita',
      );
    }

    // Verificar que tenga correo electrónico
    if (!cliente.correo_electronico) {
      throw new BadRequestException(
        'No hay correo electrónico registrado. Contacte al administrador',
      );
    }

    // Generar token de activación
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    const expiracion = new Date(
      Date.now() + this.ACTIVATION_TOKEN_HOURS * 60 * 60 * 1000,
    );

    await this.prisma.cliente.update({
      where: { id_cliente: cliente.id_cliente },
      data: {
        activation_token: tokenHash,
        activation_token_expires: expiracion,
      },
    });

    // Enviar correo
    const urlActivacion = `${this.configService.get('FRONTEND_CLIENTES_URL')}/auth/activar-cuenta?token=${token}`;

    await this.mailService.sendClienteActivacion(
      cliente.correo_electronico,
      cliente.titular,
      urlActivacion,
    );

    // Log
    await this.sessionService.registrarLog(
      cliente.id_cliente,
      ClienteLogAccion.ACTIVATION_REQUEST,
      ip,
      userAgent,
    );

    return respuestaGenerica;
  }

  /**
   * Activar cuenta con token y establecer contraseña
   */
  async activarCuenta(dto: ClienteActivarCuentaDto, ip: string | null, userAgent: string | null) {
    const { token, password, confirmar_password } = dto;

    if (password !== confirmar_password) {
      throw new BadRequestException('Las contraseñas no coinciden');
    }

    const tokenHash = this.hashToken(token);

    const cliente = await this.prisma.cliente.findFirst({
      where: {
        activation_token: tokenHash,
        activation_token_expires: { gte: new Date() },
        estado: 'ACTIVO',
      },
    });

    if (!cliente) {
      throw new BadRequestException('Token inválido o expirado');
    }

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(password, this.BCRYPT_ROUNDS);

    await this.prisma.cliente.update({
      where: { id_cliente: cliente.id_cliente },
      data: {
        password: passwordHash,
        cuenta_activada: true,
        fecha_activacion: new Date(),
        activation_token: null,
        activation_token_expires: null,
        intentos_fallidos: 0,
      },
    });

    // Log
    await this.sessionService.registrarLog(
      cliente.id_cliente,
      ClienteLogAccion.ACTIVATION_SUCCESS,
      ip,
      userAgent,
    );

    return { message: 'Cuenta activada exitosamente. Ya puede iniciar sesión' };
  }

  // ========================
  // RECUPERACIÓN DE CONTRASEÑA
  // ========================

  /**
   * Solicitar restablecimiento de contraseña
   */
  async forgotPassword(dto: ClienteForgotPasswordDto, ip: string | null, userAgent: string | null) {
    const { identificador } = dto;
    const normalizado = this.normalizarIdentificador(identificador);

    const cliente = await this.prisma.cliente.findFirst({
      where: {
        OR: [
          { dui: normalizado },
          { correo_electronico: normalizado.toLowerCase() },
        ],
        estado: 'ACTIVO',
        cuenta_activada: true,
      },
    });

    // Respuesta genérica
    const respuestaGenerica = {
      message:
        'Si el identificador está registrado, recibirá instrucciones para restablecer su contraseña',
    };

    if (!cliente) {
      await this.delay(1000);
      return respuestaGenerica;
    }

    if (!cliente.correo_electronico) {
      throw new BadRequestException(
        'No hay correo electrónico registrado. Contacte al administrador',
      );
    }

    // Generar token
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    const expiracion = new Date(Date.now() + this.RESET_TOKEN_MINUTES * 60 * 1000);

    await this.prisma.cliente.update({
      where: { id_cliente: cliente.id_cliente },
      data: {
        reset_password_token: tokenHash,
        reset_password_expires: expiracion,
      },
    });

    // Enviar correo
    const urlReset = `${this.configService.get('FRONTEND_CLIENTES_URL')}/auth/reset-password?token=${token}`;

    await this.mailService.sendClienteResetPassword(
      cliente.correo_electronico,
      cliente.titular,
      urlReset,
    );

    // Log
    await this.sessionService.registrarLog(
      cliente.id_cliente,
      ClienteLogAccion.PASSWORD_RESET_REQUEST,
      ip,
      userAgent,
    );

    return respuestaGenerica;
  }

  /**
   * Restablecer contraseña con token
   */
  async resetPassword(dto: ClienteResetPasswordDto, ip: string | null, userAgent: string | null) {
    const { token, password, confirmar_password } = dto;

    if (password !== confirmar_password) {
      throw new BadRequestException('Las contraseñas no coinciden');
    }

    const tokenHash = this.hashToken(token);

    const cliente = await this.prisma.cliente.findFirst({
      where: {
        reset_password_token: tokenHash,
        reset_password_expires: { gte: new Date() },
        estado: 'ACTIVO',
      },
    });

    if (!cliente) {
      throw new BadRequestException('Token inválido o expirado');
    }

    // Hash nueva contraseña
    const passwordHash = await bcrypt.hash(password, this.BCRYPT_ROUNDS);

    // Actualizar y revocar todas las sesiones existentes
    await this.prisma.$transaction([
      this.prisma.cliente.update({
        where: { id_cliente: cliente.id_cliente },
        data: {
          password: passwordHash,
          reset_password_token: null,
          reset_password_expires: null,
          intentos_fallidos: 0,
          cuenta_bloqueada: false,
          fecha_bloqueo: null,
        },
      }),
      this.prisma.cliente_sesiones.updateMany({
        where: { id_cliente: cliente.id_cliente, revocada: false },
        data: { revocada: true, fecha_revocacion: new Date() },
      }),
    ]);

    // Log
    await this.sessionService.registrarLog(
      cliente.id_cliente,
      ClienteLogAccion.PASSWORD_RESET_SUCCESS,
      ip,
      userAgent,
    );

    return {
      message: 'Contraseña restablecida exitosamente. Todas las sesiones han sido cerradas',
    };
  }

  // ========================
  // CAMBIO DE CONTRASEÑA
  // ========================

  /**
   * Cambiar contraseña estando autenticado
   */
  async changePassword(
    clienteId: number,
    dto: ClienteChangePasswordDto,
    ip: string | null,
    userAgent: string | null,
  ) {
    const { password_actual, password_nuevo, confirmar_password } = dto;

    if (password_nuevo !== confirmar_password) {
      throw new BadRequestException('Las contraseñas no coinciden');
    }

    const cliente = await this.prisma.cliente.findUnique({
      where: { id_cliente: clienteId },
      select: { password: true },
    });

    if (!cliente || !cliente.password) {
      throw new NotFoundException('Cliente no encontrado');
    }

    // Verificar contraseña actual
    const passwordValido = await bcrypt.compare(password_actual, cliente.password);
    if (!passwordValido) {
      throw new BadRequestException('Contraseña actual incorrecta');
    }

    // Hash nueva contraseña
    const passwordHash = await bcrypt.hash(password_nuevo, this.BCRYPT_ROUNDS);

    await this.prisma.cliente.update({
      where: { id_cliente: clienteId },
      data: { password: passwordHash },
    });

    // Log
    await this.sessionService.registrarLog(
      clienteId,
      ClienteLogAccion.PASSWORD_CHANGE,
      ip,
      userAgent,
    );

    return { message: 'Contraseña actualizada exitosamente' };
  }

  // ========================
  // TOKENS Y SESIONES
  // ========================

  /**
   * Renovar access token usando refresh token
   */
  async refreshToken(
    refreshToken: string,
    clienteId: number,
    ip: string | null,
    userAgent: string | null,
  ): Promise<ClienteTokens> {
    // Validar la sesión del refresh token
    const sesion = await this.sessionService.validarSesion(refreshToken, clienteId);

    if (!sesion) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    // Verificar que el cliente siga activo
    const cliente = await this.prisma.cliente.findFirst({
      where: {
        id_cliente: clienteId,
        estado: 'ACTIVO',
        cuenta_activada: true,
        cuenta_bloqueada: false,
      },
      select: { dui: true },
    });

    if (!cliente) {
      // Revocar la sesión si el cliente ya no es válido
      await this.sessionService.revocarSesion(sesion.id_sesion, clienteId);
      throw new UnauthorizedException('Cuenta desactivada o bloqueada');
    }

    // Generar nuevo refresh token (rotación)
    const nuevoRefreshToken = crypto.randomBytes(64).toString('hex');
    await this.sessionService.actualizarToken(sesion.id_sesion, nuevoRefreshToken);

    // Generar nuevo access token
    const accessPayload: JwtClientePayload = {
      id_cliente: clienteId,
      session_id: sesion.id_sesion,
      dui: cliente.dui,
      type: 'access',
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: this.configService.get('JWT_SECRET_CLIENTES') || this.configService.get('JWT_SECRET'),
      expiresIn: `${this.ACCESS_TOKEN_HOURS}h`,
    });

    // Log
    await this.sessionService.registrarLog(
      clienteId,
      ClienteLogAccion.TOKEN_REFRESH,
      ip,
      userAgent,
    );

    return {
      access_token: accessToken,
      refresh_token: nuevoRefreshToken,
      token_type: 'Bearer',
      expires_in: this.ACCESS_TOKEN_HOURS * 60 * 60,
    };
  }

  /**
   * Cerrar sesión actual
   */
  async logout(clienteId: number, sessionId: number, ip: string | null, userAgent: string | null) {
    await this.sessionService.revocarSesion(sessionId, clienteId);

    await this.sessionService.registrarLog(
      clienteId,
      ClienteLogAccion.LOGOUT,
      ip,
      userAgent,
    );

    return { message: 'Sesión cerrada exitosamente' };
  }

  /**
   * Cerrar todas las sesiones
   */
  async logoutAll(clienteId: number, ip: string | null, userAgent: string | null) {
    await this.sessionService.revocarTodasLasSesiones(clienteId);

    await this.sessionService.registrarLog(
      clienteId,
      ClienteLogAccion.LOGOUT_ALL,
      ip,
      userAgent,
    );

    return { message: 'Todas las sesiones han sido cerradas' };
  }

  /**
   * Obtener sesiones activas
   */
  async getSessions(clienteId: number, sessionIdActual: number) {
    const sesiones = await this.sessionService.obtenerSesionesActivas(
      clienteId,
      sessionIdActual,
    );
    return { sesiones };
  }

  /**
   * Revocar una sesión específica
   */
  async revokeSession(
    clienteId: number,
    sessionId: number,
    ip: string | null,
    userAgent: string | null,
  ) {
    const result = await this.sessionService.revocarSesion(sessionId, clienteId);

    if (result.count === 0) {
      throw new NotFoundException('Sesión no encontrada');
    }

    await this.sessionService.registrarLog(
      clienteId,
      ClienteLogAccion.SESSION_REVOKED,
      ip,
      userAgent,
      { session_revoked: sessionId },
    );

    return { message: 'Sesión revocada exitosamente' };
  }

  // ========================
  // PERFIL
  // ========================

  /**
   * Obtener perfil del cliente
   */
  async getProfile(clienteId: number) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id_cliente: clienteId },
      select: {
        id_cliente: true,
        titular: true,
        fecha_nacimiento: true,
        dui: true,
        nit: true,
        empresa_trabajo: true,
        correo_electronico: true,
        telefono1: true,
        telefono2: true,
        estado: true,
        fecha_creacion: true,
        ultimo_login: true,
        direcciones: {
          select: {
            id_cliente_direccion: true,
            direccion: true,
            usar_para_instalacion: true,
            usar_para_facturacion: true,
            municipio: { select: { nombre: true } },
            departamento: { select: { nombre: true } },
          },
        },
        datosfacturacion: {
          select: {
            id_cliente_datos_facturacion: true,
            tipo: true,
            nombre_empresa: true,
            nit: true,
            correo_electronico: true,
          },
        },
      },
    });

    if (!cliente) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return cliente;
  }

  // ========================
  // MÉTODOS PRIVADOS
  // ========================

  /**
   * Genera tokens de acceso y refresh
   */
  private async generarTokens(
    clienteId: number,
    dui: string,
    ip: string | null,
    userAgent: string | null,
  ): Promise<ClienteTokens> {
    // Generar refresh token
    const refreshToken = crypto.randomBytes(64).toString('hex');

    // Crear sesión
    const sesion = await this.sessionService.crearSesion(
      clienteId,
      refreshToken,
      ip,
      userAgent,
    );

    // Generar access token
    const accessPayload: JwtClientePayload = {
      id_cliente: clienteId,
      session_id: sesion.id_sesion,
      dui,
      type: 'access',
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: this.configService.get('JWT_SECRET_CLIENTES') || this.configService.get('JWT_SECRET'),
      expiresIn: `${this.ACCESS_TOKEN_HOURS}h`,
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: this.ACCESS_TOKEN_HOURS * 60 * 60,
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private normalizarIdentificador(identificador: string): string {
    return identificador.trim().replace(/\s+/g, '');
  }

  private async incrementarIntentosFallidos(
    clienteId: number,
    ip: string | null,
    userAgent: string | null,
  ) {
    const cliente = await this.prisma.cliente.update({
      where: { id_cliente: clienteId },
      data: { intentos_fallidos: { increment: 1 } },
    });

    await this.sessionService.registrarLog(
      clienteId,
      ClienteLogAccion.LOGIN_FAILED,
      ip,
      userAgent,
    );

    if (cliente.intentos_fallidos + 1 >= this.MAX_LOGIN_ATTEMPTS) {
      await this.prisma.cliente.update({
        where: { id_cliente: clienteId },
        data: {
          cuenta_bloqueada: true,
          fecha_bloqueo: new Date(),
        },
      });
      await this.sessionService.registrarLog(
        clienteId,
        ClienteLogAccion.ACCOUNT_LOCKED,
        ip,
        userAgent,
      );
    }
  }

  private calcularTiempoDesbloqueo(fechaBloqueo: Date | null): number {
    if (!fechaBloqueo) return 0;
    const tiempoTranscurrido = (Date.now() - fechaBloqueo.getTime()) / 60000;
    return Math.max(0, Math.ceil(this.LOCKOUT_DURATION_MINUTES - tiempoTranscurrido));
  }

  private async desbloquearCuenta(clienteId: number) {
    await this.prisma.cliente.update({
      where: { id_cliente: clienteId },
      data: {
        cuenta_bloqueada: false,
        fecha_bloqueo: null,
        intentos_fallidos: 0,
      },
    });

    await this.sessionService.registrarLog(
      clienteId,
      ClienteLogAccion.ACCOUNT_UNLOCKED,
      null,
      null,
    );
  }
}
