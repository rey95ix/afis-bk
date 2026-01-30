// src/modules/facturacion/clientes-directos/clientes-directos.controller.ts
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
import { ClientesDirectosService } from './clientes-directos.service';
import {
  CreateClienteDirectoDto,
  UpdateClienteDirectoDto,
  BuscarClienteDirectoDto,
} from './dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Auth, GetUser } from 'src/modules/auth/decorators';
import { RequirePermissions } from 'src/modules/auth/decorators/require-permissions.decorator';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';

@ApiTags('Facturación - Clientes Directos')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('facturacion/clientes-directos')
@Auth()
export class ClientesDirectosController {
  constructor(private readonly clientesDirectosService: ClientesDirectosService) {}

  @Post()
  @RequirePermissions('facturacion.clientes_directos:crear')
  @ApiOperation({ summary: 'Crear un nuevo cliente directo' })
  @ApiResponse({
    status: 201,
    description: 'El cliente ha sido creado exitosamente.',
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos o cliente duplicado.' })
  create(
    @Body() createDto: CreateClienteDirectoDto,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.clientesDirectosService.create(createDto, id_usuario);
  }

  @Get()
  @RequirePermissions('facturacion.clientes_directos:ver')
  @ApiOperation({ summary: 'Listar clientes directos con paginación y filtros' })
  @ApiResponse({
    status: 200,
    description: 'Lista de clientes paginada.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id_cliente_directo: { type: 'number' },
              nombre: { type: 'string' },
              nit: { type: 'string' },
              dui: { type: 'string' },
              registro_nrc: { type: 'string' },
              telefono: { type: 'string' },
              correo: { type: 'string' },
              estado: { type: 'string' },
            },
          },
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
  findAll(@Query() queryDto: BuscarClienteDirectoDto) {
    return this.clientesDirectosService.findAll(queryDto);
  }

  @Get('buscar')
  @RequirePermissions('facturacion.clientes_directos:ver')
  @ApiOperation({ summary: 'Buscar clientes para autocomplete' })
  @ApiQuery({ name: 'q', required: true, description: 'Término de búsqueda (mínimo 2 caracteres)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Cantidad de resultados (default: 10)' })
  @ApiResponse({
    status: 200,
    description: 'Lista de clientes que coinciden con la búsqueda.',
  })
  buscar(
    @Query('q') q: string,
    @Query('limit') limit?: string,
  ) {
    return this.clientesDirectosService.buscar(q, limit ? parseInt(limit) : 10);
  }

  @Get('tipos')
  @RequirePermissions('facturacion.clientes_directos:ver')
  @ApiOperation({ summary: 'Obtener tipos de cliente disponibles' })
  @ApiResponse({
    status: 200,
    description: 'Lista de tipos de cliente.',
  })
  getTiposCliente() {
    return this.clientesDirectosService.getTiposCliente();
  }

  @Get(':id')
  @RequirePermissions('facturacion.clientes_directos:ver')
  @ApiOperation({ summary: 'Obtener un cliente por ID' })
  @ApiResponse({ status: 200, description: 'Cliente encontrado.' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.clientesDirectosService.findOne(id);
  }

  @Get(':id/facturas')
  @RequirePermissions('facturacion.clientes_directos:ver')
  @ApiOperation({ summary: 'Obtener historial de facturas de un cliente' })
  @ApiQuery({ name: 'page', required: false, description: 'Número de página' })
  @ApiQuery({ name: 'limit', required: false, description: 'Cantidad por página' })
  @ApiResponse({
    status: 200,
    description: 'Historial de facturas del cliente.',
    schema: {
      type: 'object',
      properties: {
        cliente: {
          type: 'object',
          properties: {
            id_cliente_directo: { type: 'number' },
            nombre: { type: 'string' },
            nit: { type: 'string' },
          },
        },
        facturas: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { type: 'object' } },
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
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado.' })
  findFacturas(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.clientesDirectosService.findFacturas(
      id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
    );
  }

  @Put(':id')
  @RequirePermissions('facturacion.clientes_directos:editar')
  @ApiOperation({ summary: 'Actualizar un cliente' })
  @ApiResponse({ status: 200, description: 'El cliente ha sido actualizado.' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o cliente duplicado.' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateClienteDirectoDto,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.clientesDirectosService.update(id, updateDto, id_usuario);
  }

  @Delete(':id')
  @RequirePermissions('facturacion.clientes_directos:eliminar')
  @ApiOperation({ summary: 'Desactivar un cliente (soft delete)' })
  @ApiResponse({ status: 200, description: 'El cliente ha sido desactivado.' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado.' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.clientesDirectosService.remove(id, id_usuario);
  }
}
