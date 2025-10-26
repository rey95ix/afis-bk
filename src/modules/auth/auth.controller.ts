import { Controller, Post, Body, HttpCode } from '@nestjs/common';
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