import { Controller, Post, Body, HttpCode, Patch } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateAuthDto } from './dto/create-auth.dto';
import { Auth, GetUser } from './decorators';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiExtraModels,
} from '@nestjs/swagger';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import type { usuarios } from '@prisma/client';
import { LOGIN_SUCCESS_EXAMPLE, LoginEnvelopeDto } from './dto/response-login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePassworDto } from './dto/change-password.dto';

@ApiTags('Auth')
@ApiExtraModels(LoginEnvelopeDto, CreateAuthDto)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('sign-in')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Iniciar sesión',
    description:
      'Valida credenciales y retorna un objeto con data (usuario + token), status y msg.',
  })
  @ApiBody({
    type: CreateAuthDto,
    examples: {
      valido: {
        summary: 'Credenciales válidas',
        value: {
          usuario: 'sysadmin@ixc.com',
          password: '1234',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Login exitoso',
    type: LoginEnvelopeDto,
    schema: {
      example: LOGIN_SUCCESS_EXAMPLE,
    },
  })
  @ApiBadRequestResponse({
    description:
      'Petición inválida. Revisa el esquema del DTO o que no haya campos vacíos.',
  })
  @ApiUnauthorizedResponse({
    description: 'Credenciales inválidas.',
  })
  loginUser(@Body() loginUserDto: CreateAuthDto) {
    return this.authService.login(loginUserDto);
  }

  @Post('forgot-password')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Solicitar restablecimiento de contraseña',
    description: 'Envía un correo electrónico con un enlace para restablecer la contraseña.',
  })
  @ApiOkResponse({ description: 'Si el correo existe, se enviará un enlace de restablecimiento.' })
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Restablecer la contraseña',
    description: 'Restablece la contraseña utilizando el token enviado al correo.',
  })
  @ApiOkResponse({ description: 'Contraseña restablecida exitosamente.' })
  @ApiBadRequestResponse({ description: 'El token es inválido o ha expirado.' })
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Patch('change-password')
  @Auth()
  @ApiBearerAuth(HEADER_API_BEARER_AUTH)
  @ApiOperation({
    summary: 'Cambiar la contraseña',
    description: 'Permite a un usuario autenticado cambiar su contraseña.',
  })
  @ApiOkResponse({ description: 'Contraseña cambiada exitosamente.' })
  @ApiUnauthorizedResponse({ description: 'La contraseña actual es incorrecta.' })
  changePassword(@GetUser() user: usuarios, @Body() changePasswordDto: ChangePassworDto) {
    return this.authService.changePassword(user, changePasswordDto);
  }

  @Post('sign-in-with-token')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Validar token y obtener estado de sesión',
    description:
      'Requiere un JWT válido en Authorization. Devuelve el mismo envoltorio con los datos del usuario.',
  })
  @Auth()
  @ApiBearerAuth(HEADER_API_BEARER_AUTH)
  @ApiOkResponse({
    description: 'Token válido. Devuelve estado de sesión.',
    type: LoginEnvelopeDto,
    schema: {
      example: LOGIN_SUCCESS_EXAMPLE,
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Token ausente o inválido.',
  })
  checkStatus(@GetUser() user: usuarios) {
    return this.authService.checkStatus(user);
  }
}