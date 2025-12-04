// src/modules/atencion-al-cliente/contratos/contrato-instalacion.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { ContratoInstalacionService } from './contrato-instalacion.service';
import { CreateContratoInstalacionDto } from './dto/create-contrato-instalacion.dto';
import { UpdateContratoInstalacionDto } from './dto/update-contrato-instalacion.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Auth, GetUser } from 'src/modules/auth/decorators';
import { RequirePermissions } from 'src/modules/auth/decorators/require-permissions.decorator';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';

@ApiTags('Contratos - Instalación')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('atencion-al-cliente/contratos/instalacion')
@Auth()
export class ContratoInstalacionController {
  constructor(
    private readonly contratoInstalacionService: ContratoInstalacionService,
  ) {}

  @RequirePermissions('atencion_cliente.contratos:gestionar_instalacion')
  @Post()
  @ApiOperation({ summary: 'Registrar datos de instalación de un contrato' })
  @ApiResponse({
    status: 201,
    description: 'La instalación ha sido registrada exitosamente.',
  })
  @ApiResponse({ status: 400, description: 'Petición inválida.' })
  @ApiResponse({ status: 404, description: 'Contrato no encontrado.' })
  @ApiResponse({
    status: 409,
    description: 'Ya existe una instalación para este contrato.',
  })
  create(
    @Body() createDto: CreateContratoInstalacionDto,
    @GetUser() usuario,
  ) {
    return this.contratoInstalacionService.create(createDto, usuario.id_usuario);
  }

  @RequirePermissions('atencion_cliente.contratos:ver')
  @Get('contrato/:id_contrato')
  @ApiOperation({ summary: 'Obtener la instalación de un contrato' })
  @ApiParam({
    name: 'id_contrato',
    description: 'ID del contrato',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Retorna los datos de instalación del contrato.',
  })
  @ApiResponse({ status: 404, description: 'Instalación no encontrada.' })
  findByContrato(@Param('id_contrato', ParseIntPipe) id_contrato: number) {
    return this.contratoInstalacionService.findByContrato(id_contrato);
  }

  @RequirePermissions('atencion_cliente.contratos:ver')
  @Get(':id')
  @ApiOperation({ summary: 'Obtener una instalación por su ID' })
  @ApiParam({ name: 'id', description: 'ID de la instalación', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Retorna los datos de instalación.',
  })
  @ApiResponse({ status: 404, description: 'Instalación no encontrada.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.contratoInstalacionService.findOne(id);
  }

  @RequirePermissions('atencion_cliente.contratos:gestionar_instalacion')
  @Put(':id')
  @ApiOperation({ summary: 'Actualizar datos de instalación' })
  @ApiParam({ name: 'id', description: 'ID de la instalación', type: Number })
  @ApiResponse({
    status: 200,
    description: 'La instalación ha sido actualizada exitosamente.',
  })
  @ApiResponse({ status: 404, description: 'Instalación no encontrada.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateContratoInstalacionDto,
    @GetUser() usuario,
  ) {
    return this.contratoInstalacionService.update(
      id,
      updateDto,
      usuario.id_usuario,
    );
  }

  @RequirePermissions('atencion_cliente.contratos:gestionar_instalacion')
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar datos de instalación' })
  @ApiParam({ name: 'id', description: 'ID de la instalación', type: Number })
  @ApiResponse({
    status: 200,
    description: 'La instalación ha sido eliminada exitosamente.',
  })
  @ApiResponse({ status: 404, description: 'Instalación no encontrada.' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() usuario,
  ) {
    return this.contratoInstalacionService.remove(id, usuario.id_usuario);
  }
}
