// src/modules/atencion-al-cliente/contratos/contratos.controller.ts
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
import { ContratosService } from './contratos.service';
import { CreateContratoDto } from './dto/create-contrato.dto';
import { UpdateContratoDto } from './dto/update-contrato.dto';
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

@ApiTags('Contratos')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('atencion-al-cliente/contratos')
@Auth()
export class ContratosController {
  constructor(private readonly contratosService: ContratosService) {}

  @RequirePermissions('atencion_cliente.contratos:crear')
  @Post()
  @ApiOperation({ summary: 'Crear un nuevo contrato' })
  @ApiResponse({
    status: 201,
    description: 'El contrato ha sido creado exitosamente.',
  })
  @ApiResponse({ status: 400, description: 'Petición inválida.' })
  @ApiResponse({ status: 404, description: 'Cliente, plan o ciclo no encontrado.' })
  create(
    @Body() createContratoDto: CreateContratoDto,
    @GetUser() usuario,
  ) {
    return this.contratosService.create(createContratoDto, usuario.id_usuario);
  }

  @RequirePermissions('atencion_cliente.contratos:ver')
  @Get()
  @ApiOperation({
    summary: 'Obtener todos los contratos con paginación y búsqueda',
  })
  @ApiResponse({
    status: 200,
    description: 'Retorna los contratos paginados con sus relaciones.',
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
    return this.contratosService.findAll(paginationDto);
  }

  @RequirePermissions('atencion_cliente.contratos:ver')
  @Get(':id')
  @ApiOperation({ summary: 'Obtener un contrato por su ID' })
  @ApiParam({ name: 'id', description: 'ID del contrato', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Retorna el contrato con sus relaciones.',
  })
  @ApiResponse({ status: 404, description: 'Contrato no encontrado.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.contratosService.findOne(id);
  }

  @RequirePermissions('atencion_cliente.contratos:ver')
  @Get('cliente/:id_cliente')
  @ApiOperation({ summary: 'Obtener todos los contratos de un cliente' })
  @ApiParam({ name: 'id_cliente', description: 'ID del cliente', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Retorna los contratos del cliente.',
  })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado.' })
  findByCliente(@Param('id_cliente', ParseIntPipe) id_cliente: number) {
    return this.contratosService.findByCliente(id_cliente);
  }

  @RequirePermissions('atencion_cliente.contratos:ver')
  @Get('buscar/codigo/:codigo')
  @ApiOperation({ summary: 'Buscar un contrato por su código' })
  @ApiParam({
    name: 'codigo',
    description: 'Código del contrato (ej: CTR-202501-00001)',
    type: String,
  })
  @ApiResponse({ status: 200, description: 'Retorna el contrato encontrado.' })
  findByCodigo(@Param('codigo') codigo: string) {
    return this.contratosService.findByCodigo(codigo);
  }

  @RequirePermissions('atencion_cliente.contratos:editar')
  @Put(':id')
  @ApiOperation({ summary: 'Actualizar un contrato' })
  @ApiParam({ name: 'id', description: 'ID del contrato', type: Number })
  @ApiResponse({
    status: 200,
    description: 'El contrato ha sido actualizado exitosamente.',
  })
  @ApiResponse({ status: 404, description: 'Contrato no encontrado.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateContratoDto: UpdateContratoDto,
    @GetUser() usuario,
  ) {
    return this.contratosService.update(id, updateContratoDto, usuario.id_usuario);
  }

  @RequirePermissions('atencion_cliente.contratos:eliminar')
  @Delete(':id')
  @ApiOperation({ summary: 'Cancelar un contrato (cambia estado a CANCELADO)' })
  @ApiParam({ name: 'id', description: 'ID del contrato', type: Number })
  @ApiResponse({
    status: 200,
    description: 'El contrato ha sido cancelado exitosamente.',
  })
  @ApiResponse({ status: 404, description: 'Contrato no encontrado.' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() usuario,
  ) {
    return this.contratosService.remove(id, usuario.id_usuario);
  }
}
