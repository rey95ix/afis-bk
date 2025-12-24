// src/modules/atencion-al-cliente/clientes/clientes.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
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
import { PaginationDto } from 'src/common/dto';

@ApiTags('Clientes')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('atencion-al-cliente/clientes')
@Auth()
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) { }

  // ============= CATÁLOGOS =============
  @Get('catalogos/estados-civiles')
  @RequirePermissions('atencion_cliente.catalogos:ver')
  @ApiOperation({ summary: 'Obtener catálogo de estados civiles' })
  @ApiResponse({
    status: 200,
    description: 'Retorna el listado de estados civiles activos.',
  })
  getEstadosCiviles() {
    return this.clientesService.getEstadosCiviles();
  }

  @Get('catalogos/estados-vivienda')
  @RequirePermissions('atencion_cliente.catalogos:ver')
  @ApiOperation({ summary: 'Obtener catálogo de estados de vivienda' })
  @ApiResponse({
    status: 200,
    description: 'Retorna el listado de estados de vivienda activos.',
  })
  getEstadosVivienda() {
    return this.clientesService.getEstadosVivienda();
  }

  @RequirePermissions('atencion_cliente.clientes:crear')
  @Post()
  @ApiOperation({ summary: 'Crear un nuevo cliente' })
  @ApiResponse({ status: 201, description: 'El cliente ha sido creado exitosamente.' })
  @ApiResponse({ status: 400, description: 'Petición inválida.' })
  @ApiResponse({ status: 409, description: 'Ya existe un cliente con ese DUI.' })
  create(@
    Body() createClienteDto: CreateClienteDto,
    @GetUser() usuario,
  ) {
    return this.clientesService.create(createClienteDto, usuario.id_usuario);
  }

  @RequirePermissions('atencion_cliente.clientes:ver')
  @Get()
  @ApiOperation({ summary: 'Obtener todos los clientes activos con paginación y búsqueda' })
  @ApiResponse({
    status: 200,
    description: 'Retorna los clientes paginados con sus relaciones.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { type: 'object' },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.clientesService.findAll(paginationDto);
  }

  @RequirePermissions('atencion_cliente.clientes:ver')
  @Get(':id')
  @ApiOperation({ summary: 'Obtener un cliente por su ID' })
  @ApiParam({ name: 'id', description: 'ID del cliente', type: Number })
  @ApiResponse({ status: 200, description: 'Retorna el cliente con sus relaciones.' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.clientesService.findOne(id);
  }

  @RequirePermissions('atencion_cliente.clientes:ver')
  @Get('verificar-dui/:dui')
  @ApiOperation({ summary: 'Verificar si existe un cliente con el DUI especificado' })
  @ApiParam({ name: 'dui', description: 'DUI a verificar', type: String })
  @ApiResponse({
    status: 200,
    description: 'Retorna si existe o no un cliente con ese DUI.',
    schema: {
      type: 'object',
      properties: {
        existe: { type: 'boolean' },
        clienteId: { type: 'number', nullable: true },
      },
    },
  })
  verificarDuiExiste(
    @Param('dui') dui: string,
    @Query('excludeId') excludeId?: string,
  ) {
    return this.clientesService.verificarDuiExiste(
      dui,
      excludeId ? parseInt(excludeId, 10) : undefined,
    );
  }

  @RequirePermissions('atencion_cliente.clientes:ver')
  @Get('buscar/dui/:dui')
  @ApiOperation({ summary: 'Buscar un cliente por su DUI' })
  @ApiParam({ name: 'dui', description: 'DUI del cliente', type: String })
  @ApiResponse({ status: 200, description: 'Retorna el cliente encontrado.' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado.' })
  findByDui(@Param('dui') dui: string) {
    return this.clientesService.findByDui(dui);
  }

  @RequirePermissions('atencion_cliente.clientes:editar')
  @Put(':id')
  @ApiOperation({ summary: 'Actualizar un cliente' })
  @ApiParam({ name: 'id', description: 'ID del cliente', type: Number })
  @ApiResponse({ status: 200, description: 'El cliente ha sido actualizado exitosamente.' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado.' })
  @ApiResponse({ status: 409, description: 'Ya existe otro cliente con ese DUI.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateClienteDto: UpdateClienteDto,
    @GetUser() usuario,
  ) {
    return this.clientesService.update(id, updateClienteDto, usuario.id_usuario);
  }

  @RequirePermissions('atencion_cliente.clientes:eliminar')
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un cliente (cambia estado a INACTIVO)' })
  @ApiParam({ name: 'id', description: 'ID del cliente', type: Number })
  @ApiResponse({ status: 200, description: 'El cliente ha sido inactivado exitosamente.' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado.' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() usuario,
  ) {
    return this.clientesService.remove(id, usuario.id_usuario);
  }
}
