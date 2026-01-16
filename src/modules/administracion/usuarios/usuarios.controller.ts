// src/modules/administracion/usuarios/usuarios.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { HEADER_API_BEARER_AUTH } from '../../../common/const';
import { Auth } from '../../auth/decorators/auth.decorator';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';

@ApiTags('Usuarios')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('administracion/usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  @Auth()
  @RequirePermissions('administracion.usuarios:ver')
  @ApiOperation({ summary: 'Obtener todos los usuarios con paginación' })
  @ApiResponse({ status: 200, description: 'Lista de usuarios paginada' })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.usuariosService.findAll(paginationDto);
  }

  @Get(':id')
  @Auth()
  @RequirePermissions('administracion.usuarios:ver')
  @ApiOperation({ summary: 'Obtener un usuario por ID' })
  @ApiResponse({ status: 200, description: 'Usuario encontrado' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.findOne(id);
  }

  @Post()
  @Auth()
  @RequirePermissions('administracion.usuarios:crear')
  @ApiOperation({
    summary: 'Crear un nuevo usuario',
    description: 'Crea un nuevo usuario sin contraseña. Se genera una contraseña temporal automáticamente que debe ser cambiada en el primer login.'
  })
  @ApiResponse({
    status: 201,
    description: 'Usuario creado exitosamente. Retorna los datos del usuario junto con la contraseña temporal generada.'
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  create(@Body() createUsuarioDto: CreateUsuarioDto) {
    return this.usuariosService.create(createUsuarioDto);
  }

  @Put(':id')
  @Auth()
  @RequirePermissions('administracion.usuarios:editar')
  @ApiOperation({
    summary: 'Actualizar un usuario',
    description: 'Actualiza los datos de un usuario (nombre, rol, etc.) sin modificar la contraseña. Para cambiar la contraseña use el endpoint /usuarios/:id/password'
  })
  @ApiResponse({ status: 200, description: 'Usuario actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUsuarioDto: UpdateUsuarioDto,
  ) {
    return this.usuariosService.update(id, updateUsuarioDto);
  }

  @Put(':id/password')
  @Auth()
  @RequirePermissions('administracion.usuarios:cambiar_password')
  @ApiOperation({
    summary: 'Cambiar contraseña de un usuario',
    description: 'Endpoint exclusivo para cambio de contraseña con validaciones de complejidad y verificación de contraseña actual (opcional)'
  })
  @ApiResponse({ status: 200, description: 'Contraseña actualizada exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o contraseñas no coinciden' })
  @ApiResponse({ status: 401, description: 'Contraseña actual incorrecta' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  changePassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.usuariosService.changePassword(id, changePasswordDto);
  }

  @Delete(':id')
  @Auth()
  @RequirePermissions('administracion.usuarios:eliminar')
  @ApiOperation({ summary: 'Eliminar (inactivar) un usuario' })
  @ApiResponse({ status: 200, description: 'Usuario eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.remove(id);
  }
}
