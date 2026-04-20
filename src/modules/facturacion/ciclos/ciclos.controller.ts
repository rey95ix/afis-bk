// src/modules/facturacion/ciclos/ciclos.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  Patch,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { CiclosService } from './ciclos.service';
import {
  CreateCicloDto,
  UpdateCicloDto,
  QueryCicloDto,
  UpdateClienteContactoDto,
  QueryNotificacionesGlobalDto,
} from './dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Auth, GetUser } from 'src/modules/auth/decorators';
import { RequirePermissions } from 'src/modules/auth/decorators/require-permissions.decorator';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { PaginationDto } from 'src/common/dto';

@ApiTags('Facturación - Ciclos')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('facturacion/ciclos')
@Auth()
export class CiclosController {
  constructor(private readonly ciclosService: CiclosService) {}

  @Post()
  @RequirePermissions('facturacion.ciclos:crear')
  @ApiOperation({ summary: 'Crear un nuevo ciclo de facturación' })
  @ApiResponse({
    status: 201,
    description: 'El ciclo ha sido creado exitosamente.',
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos o ciclo duplicado.' })
  create(
    @Body() createCicloDto: CreateCicloDto,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.ciclosService.create(createCicloDto, id_usuario);
  }

  @Get()
  @RequirePermissions('facturacion.ciclos:ver')
  @ApiOperation({ summary: 'Obtener todos los ciclos con paginación y filtros' })
  @ApiResponse({
    status: 200,
    description: 'Lista de ciclos paginada con cantidad de contratos.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id_ciclo: { type: 'number' },
              nombre: { type: 'string' },
              dia_corte: { type: 'number' },
              dia_vencimiento: { type: 'number' },
              periodo_inicio: { type: 'number' },
              periodo_fin: { type: 'number' },
              estado: { type: 'string' },
              _count: {
                type: 'object',
                properties: {
                  contratos: { type: 'number' },
                },
              },
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
  findAll(@Query() queryDto: QueryCicloDto) {
    return this.ciclosService.findAll(queryDto);
  }

  @Get('all')
  @RequirePermissions('facturacion.ciclos:ver')
  @ApiOperation({ summary: 'Obtener todos los ciclos activos (para selects)' })
  @ApiResponse({ status: 200, description: 'Lista de todos los ciclos activos.' })
  findAllActive() {
    return this.ciclosService.findAllActive();
  }

  @Get('notificaciones/global')
  @RequirePermissions('facturacion.ciclos:notificar')
  @ApiOperation({
    summary:
      'Listado global de clientes con validacion de telefono/correo. Soporta filtro por ciclo, busqueda por nombre, filtro por validez y paginacion.',
  })
  @ApiResponse({
    status: 200,
    description: 'Resumen + clientes paginados con validacion.',
  })
  findNotificacionesGlobal(@Query() dto: QueryNotificacionesGlobalDto) {
    return this.ciclosService.findNotificacionesGlobal(dto);
  }

  @Patch('clientes/:clienteId/contacto')
  @RequirePermissions('facturacion.ciclos:editar')
  @ApiOperation({
    summary:
      'Actualizar telefono y/o correo de un cliente sin restriccion de ciclo (vista global)',
  })
  @ApiResponse({ status: 200, description: 'Contacto actualizado.' })
  @ApiResponse({ status: 400, description: 'Datos invalidos.' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado.' })
  updateClienteContactoGlobal(
    @Param('clienteId', ParseIntPipe) clienteId: number,
    @Body() dto: UpdateClienteContactoDto,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.ciclosService.updateClienteContactoGlobal(
      clienteId,
      dto,
      id_usuario,
    );
  }

  @Get(':id')
  @RequirePermissions('facturacion.ciclos:ver')
  @ApiOperation({ summary: 'Obtener un ciclo por ID' })
  @ApiResponse({ status: 200, description: 'Ciclo encontrado.' })
  @ApiResponse({ status: 404, description: 'Ciclo no encontrado.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ciclosService.findOne(id);
  }

  @Get(':id/contratos')
  @RequirePermissions('facturacion.ciclos:ver')
  @ApiOperation({ summary: 'Obtener los contratos de un ciclo' })
  @ApiResponse({
    status: 200,
    description: 'Información del ciclo con sus contratos paginados.',
    schema: {
      type: 'object',
      properties: {
        ciclo: {
          type: 'object',
          properties: {
            id_ciclo: { type: 'number' },
            nombre: { type: 'string' },
            dia_corte: { type: 'number' },
            dia_vencimiento: { type: 'number' },
          },
        },
        contratos: {
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
  @ApiResponse({ status: 404, description: 'Ciclo no encontrado.' })
  findContratosByCiclo(
    @Param('id', ParseIntPipe) id: number,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.ciclosService.findContratosByCiclo(id, paginationDto);
  }

  @Get(':id/notificaciones')
  @RequirePermissions('facturacion.ciclos:notificar')
  @ApiOperation({
    summary: 'Obtener clientes del ciclo con validacion de telefono y correo',
  })
  @ApiResponse({
    status: 200,
    description: 'Resumen de validacion y listado de clientes con su contacto.',
  })
  @ApiResponse({ status: 404, description: 'Ciclo no encontrado.' })
  findNotificaciones(@Param('id', ParseIntPipe) id: number) {
    return this.ciclosService.findNotificacionesByCiclo(id);
  }

  @Patch(':id/clientes/:clienteId/contacto')
  @RequirePermissions('facturacion.ciclos:editar')
  @ApiOperation({
    summary: 'Actualizar telefono y/o correo de un cliente del ciclo',
  })
  @ApiResponse({ status: 200, description: 'Contacto actualizado.' })
  @ApiResponse({ status: 400, description: 'Datos invalidos.' })
  @ApiResponse({
    status: 404,
    description: 'Ciclo o cliente no encontrado en el ciclo.',
  })
  updateClienteContacto(
    @Param('id', ParseIntPipe) id: number,
    @Param('clienteId', ParseIntPipe) clienteId: number,
    @Body() dto: UpdateClienteContactoDto,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.ciclosService.updateClienteContacto(
      id,
      clienteId,
      dto,
      id_usuario,
    );
  }

  @Put(':id')
  @RequirePermissions('facturacion.ciclos:editar')
  @ApiOperation({ summary: 'Actualizar un ciclo' })
  @ApiResponse({ status: 200, description: 'El ciclo ha sido actualizado.' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o ciclo duplicado.' })
  @ApiResponse({ status: 404, description: 'Ciclo no encontrado.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCicloDto: UpdateCicloDto,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.ciclosService.update(id, updateCicloDto, id_usuario);
  }

  @Delete(':id')
  @RequirePermissions('facturacion.ciclos:eliminar')
  @ApiOperation({ summary: 'Eliminar un ciclo (soft delete)' })
  @ApiResponse({ status: 200, description: 'El ciclo ha sido eliminado.' })
  @ApiResponse({
    status: 400,
    description: 'No se puede eliminar, tiene contratos asociados.',
  })
  @ApiResponse({ status: 404, description: 'Ciclo no encontrado.' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.ciclosService.remove(id, id_usuario);
  }
}
