import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Headers,
  Ip,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ClienteAuthService } from './cliente-auth.service';
import {
  ClienteLoginDto,
  ClienteSolicitarActivacionDto,
  ClienteActivarCuentaDto,
  ClienteForgotPasswordDto,
  ClienteResetPasswordDto,
  ClienteChangePasswordDto,
  RefreshTokenDto,
} from './dto';
import { ClienteAuth, GetCliente } from './decorators';
import type { ClienteAutenticado } from './interfaces';

/**
 * Controlador de autenticación para el portal de clientes
 *
 * Endpoints públicos (sin autenticación):
 * - POST /login
 * - POST /solicitar-activacion
 * - POST /activar-cuenta
 * - POST /forgot-password
 * - POST /reset-password
 *
 * Endpoints protegidos (requieren JWT):
 * - POST /refresh-token
 * - POST /logout
 * - POST /logout-all
 * - GET /profile
 * - PATCH /change-password
 * - GET /sessions
 * - DELETE /sessions/:sessionId
 */
@ApiTags('Cliente Auth')
@Controller('cliente-auth')
@UseGuards(ThrottlerGuard)
export class ClienteAuthController {
  constructor(private readonly authService: ClienteAuthService) {}

  // ========================
  // ENDPOINTS PÚBLICOS
  // ========================

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión como cliente' })
  @ApiResponse({ status: 200, description: 'Login exitoso' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  @ApiResponse({ status: 403, description: 'Cuenta bloqueada o no activada' })
  @ApiResponse({ status: 429, description: 'Demasiados intentos' })
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 intentos por minuto
  async login(
    @Body() dto: ClienteLoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.login(dto, ip, userAgent);
  }

  @Post('solicitar-activacion')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicitar activación de cuenta (primer acceso)' })
  @ApiResponse({
    status: 200,
    description: 'Instrucciones enviadas si el DUI existe',
  })
  @ApiResponse({ status: 400, description: 'Cuenta ya activada' })
  @ApiResponse({ status: 429, description: 'Demasiados intentos' })
  @Throttle({ default: { limit: 3, ttl: 300000 } }) // 3 cada 5 minutos
  async solicitarActivacion(
    @Body() dto: ClienteSolicitarActivacionDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.solicitarActivacion(dto.dui, ip, userAgent);
  }

  @Post('activar-cuenta')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activar cuenta y establecer contraseña' })
  @ApiResponse({ status: 200, description: 'Cuenta activada exitosamente' })
  @ApiResponse({ status: 400, description: 'Token inválido o expirado' })
  @ApiResponse({ status: 429, description: 'Demasiados intentos' })
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  async activarCuenta(
    @Body() dto: ClienteActivarCuentaDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.activarCuenta(dto, ip, userAgent);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicitar restablecimiento de contraseña' })
  @ApiResponse({
    status: 200,
    description: 'Instrucciones enviadas si el identificador existe',
  })
  @ApiResponse({ status: 429, description: 'Demasiados intentos' })
  @Throttle({ default: { limit: 3, ttl: 300000 } }) // 3 cada 5 minutos
  async forgotPassword(
    @Body() dto: ClienteForgotPasswordDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.forgotPassword(dto, ip, userAgent);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restablecer contraseña con token' })
  @ApiResponse({
    status: 200,
    description: 'Contraseña restablecida exitosamente',
  })
  @ApiResponse({ status: 400, description: 'Token inválido o expirado' })
  @ApiResponse({ status: 429, description: 'Demasiados intentos' })
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  async resetPassword(
    @Body() dto: ClienteResetPasswordDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.resetPassword(dto, ip, userAgent);
  }

  // ========================
  // ENDPOINTS PROTEGIDOS
  // ========================

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ClienteAuth()
  @ApiOperation({ summary: 'Renovar access token' })
  @ApiResponse({ status: 200, description: 'Token renovado exitosamente' })
  @ApiResponse({ status: 401, description: 'Refresh token inválido' })
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 por minuto
  async refreshToken(
    @Body() dto: RefreshTokenDto,
    @GetCliente() cliente: ClienteAutenticado,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.refreshToken(
      dto.refresh_token,
      cliente.id_cliente,
      ip,
      userAgent,
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ClienteAuth()
  @ApiOperation({ summary: 'Cerrar sesión actual' })
  @ApiResponse({ status: 200, description: 'Sesión cerrada exitosamente' })
  async logout(
    @GetCliente() cliente: ClienteAutenticado,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.logout(
      cliente.id_cliente,
      cliente.session_id,
      ip,
      userAgent,
    );
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ClienteAuth()
  @ApiOperation({ summary: 'Cerrar todas las sesiones' })
  @ApiResponse({
    status: 200,
    description: 'Todas las sesiones cerradas exitosamente',
  })
  async logoutAll(
    @GetCliente() cliente: ClienteAutenticado,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.logoutAll(cliente.id_cliente, ip, userAgent);
  }

  @Get('profile')
  @ClienteAuth()
  @ApiOperation({ summary: 'Obtener perfil del cliente autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil del cliente' })
  async getProfile(@GetCliente() cliente: ClienteAutenticado) {
    return this.authService.getProfile(cliente.id_cliente);
  }

  @Patch('change-password')
  @ClienteAuth()
  @ApiOperation({ summary: 'Cambiar contraseña (autenticado)' })
  @ApiResponse({
    status: 200,
    description: 'Contraseña actualizada exitosamente',
  })
  @ApiResponse({ status: 400, description: 'Contraseña actual incorrecta' })
  @Throttle({ default: { limit: 3, ttl: 300000 } }) // 3 cada 5 minutos
  async changePassword(
    @GetCliente() cliente: ClienteAutenticado,
    @Body() dto: ClienteChangePasswordDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.changePassword(
      cliente.id_cliente,
      dto,
      ip,
      userAgent,
    );
  }

  @Get('sessions')
  @ClienteAuth()
  @ApiOperation({ summary: 'Listar sesiones activas' })
  @ApiResponse({ status: 200, description: 'Lista de sesiones activas' })
  async getSessions(@GetCliente() cliente: ClienteAutenticado) {
    return this.authService.getSessions(
      cliente.id_cliente,
      cliente.session_id,
    );
  }

  @Delete('sessions/:sessionId')
  @ClienteAuth()
  @ApiOperation({ summary: 'Revocar una sesión específica' })
  @ApiResponse({ status: 200, description: 'Sesión revocada exitosamente' })
  @ApiResponse({ status: 404, description: 'Sesión no encontrada' })
  async revokeSession(
    @GetCliente() cliente: ClienteAutenticado,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.revokeSession(
      cliente.id_cliente,
      sessionId,
      ip,
      userAgent,
    );
  }
}
