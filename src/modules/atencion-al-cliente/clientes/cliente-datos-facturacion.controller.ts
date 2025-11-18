// src/modules/atencion-al-cliente/clientes/cliente-datos-facturacion.controller.ts
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
import { ClienteDatosFacturacionService } from './cliente-datos-facturacion.service';
import { CreateClienteDatosFacturacionDto } from './dto/create-cliente-datos-facturacion.dto';
import { UpdateClienteDatosFacturacionDto } from './dto/update-cliente-datos-facturacion.dto';
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

@ApiTags('Cliente Datos Facturación')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('atencion-al-cliente/clientes/datos-facturacion')
@Auth()
export class ClienteDatosFacturacionController {
  constructor(
    private readonly clienteDatosFacturacionService: ClienteDatosFacturacionService,
  ) {}

  @RequirePermissions('atencion_cliente.clientes:gestionar_facturacion')
  @Post()
  @ApiOperation({
    summary: 'Crear nuevos datos de facturación para un cliente',
  })
  @ApiResponse({
    status: 201,
    description: 'Los datos de facturación han sido creados exitosamente.',
  })
  @ApiResponse({ status: 400, description: 'Petición inválida.' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado.' })
  create(
    @Body() createClienteDatosFacturacionDto: CreateClienteDatosFacturacionDto,
  ) {
    return this.clienteDatosFacturacionService.create(
      createClienteDatosFacturacionDto,
    );
  }

  @RequirePermissions('atencion_cliente.clientes:gestionar_facturacion')
  @Get('cliente/:id_cliente')
  @ApiOperation({
    summary: 'Obtener todos los datos de facturación activos de un cliente',
  })
  @ApiParam({ name: 'id_cliente', description: 'ID del cliente', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Retorna todos los datos de facturación activos del cliente.',
  })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado.' })
  findAllByCliente(@Param('id_cliente', ParseIntPipe) id_cliente: number) {
    return this.clienteDatosFacturacionService.findAllByCliente(id_cliente);
  }

  @RequirePermissions('atencion_cliente.clientes:gestionar_facturacion')
  @Get(':id')
  @ApiOperation({ summary: 'Obtener datos de facturación por su ID' })
  @ApiParam({
    name: 'id',
    description: 'ID de los datos de facturación',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Retorna los datos de facturación.',
  })
  @ApiResponse({
    status: 404,
    description: 'Datos de facturación no encontrados.',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.clienteDatosFacturacionService.findOne(id);
  }

  @RequirePermissions('atencion_cliente.clientes:gestionar_facturacion')
  @Put(':id')
  @ApiOperation({ summary: 'Actualizar datos de facturación' })
  @ApiParam({
    name: 'id',
    description: 'ID de los datos de facturación',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Los datos de facturación han sido actualizados exitosamente.',
  })
  @ApiResponse({
    status: 404,
    description: 'Datos de facturación no encontrados.',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateClienteDatosFacturacionDto: UpdateClienteDatosFacturacionDto,
  ) {
    return this.clienteDatosFacturacionService.update(
      id,
      updateClienteDatosFacturacionDto,
    );
  }

  @RequirePermissions('atencion_cliente.clientes:gestionar_facturacion')
  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar datos de facturación (cambia estado a INACTIVO)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de los datos de facturación',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Los datos de facturación han sido inactivados exitosamente.',
  })
  @ApiResponse({
    status: 404,
    description: 'Datos de facturación no encontrados.',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.clienteDatosFacturacionService.remove(id);
  }
}
