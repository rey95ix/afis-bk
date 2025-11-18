// src/modules/atencion-al-cliente/clientes/cliente-direcciones.controller.ts
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
import { ClienteDireccionesService } from './cliente-direcciones.service';
import { CreateClienteDireccionDto } from './dto/create-cliente-direccion.dto';
import { UpdateClienteDireccionDto } from './dto/update-cliente-direccion.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Auth } from 'src/modules/auth/decorators';
import { RequirePermissions } from 'src/modules/auth/decorators/require-permissions.decorator';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';

@ApiTags('Cliente Direcciones')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('atencion-al-cliente/clientes/direcciones')
@Auth()
export class ClienteDireccionesController {
  constructor(
    private readonly clienteDireccionesService: ClienteDireccionesService,
  ) {}

  @RequirePermissions('atencion_cliente.clientes:gestionar_direcciones')
  @Post()
  @ApiOperation({ summary: 'Crear una nueva dirección para un cliente' })
  @ApiResponse({
    status: 201,
    description: 'La dirección ha sido creada exitosamente.',
  })
  @ApiResponse({ status: 400, description: 'Petición inválida.' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado.' })
  create(@Body() createClienteDireccionDto: CreateClienteDireccionDto) {
    return this.clienteDireccionesService.create(createClienteDireccionDto);
  }

  @RequirePermissions('atencion_cliente.clientes:gestionar_direcciones')
  @Get('cliente/:id_cliente')
  @ApiOperation({ summary: 'Obtener todas las direcciones activas de un cliente' })
  @ApiParam({ name: 'id_cliente', description: 'ID del cliente', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Retorna todas las direcciones activas del cliente.',
  })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado.' })
  findAllByCliente(@Param('id_cliente', ParseIntPipe) id_cliente: number) {
    return this.clienteDireccionesService.findAllByCliente(id_cliente);
  }

  @RequirePermissions('atencion_cliente.clientes:gestionar_direcciones')
  @Get(':id')
  @ApiOperation({ summary: 'Obtener una dirección por su ID' })
  @ApiParam({ name: 'id', description: 'ID de la dirección', type: Number })
  @ApiResponse({ status: 200, description: 'Retorna la dirección.' })
  @ApiResponse({ status: 404, description: 'Dirección no encontrada.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.clienteDireccionesService.findOne(id);
  }

  @RequirePermissions('atencion_cliente.clientes:gestionar_direcciones')
  @Put(':id')
  @ApiOperation({ summary: 'Actualizar una dirección' })
  @ApiParam({ name: 'id', description: 'ID de la dirección', type: Number })
  @ApiResponse({
    status: 200,
    description: 'La dirección ha sido actualizada exitosamente.',
  })
  @ApiResponse({ status: 404, description: 'Dirección no encontrada.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateClienteDireccionDto: UpdateClienteDireccionDto,
  ) {
    return this.clienteDireccionesService.update(id, updateClienteDireccionDto);
  }

  @RequirePermissions('atencion_cliente.clientes:gestionar_direcciones')
  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar una dirección (cambia estado a INACTIVO)',
  })
  @ApiParam({ name: 'id', description: 'ID de la dirección', type: Number })
  @ApiResponse({
    status: 200,
    description: 'La dirección ha sido inactivada exitosamente.',
  })
  @ApiResponse({ status: 404, description: 'Dirección no encontrada.' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.clienteDireccionesService.remove(id);
  }
}
