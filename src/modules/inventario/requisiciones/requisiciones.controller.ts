// src/modules/inventario/requisiciones/requisiciones.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { RequisicionesService } from './requisiciones.service';
import {
  CreateRequisicionDto,
  UpdateRequisicionDto,
  AuthorizeRequisicionDto,
  ProcessRequisicionDto,
} from './dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Auth, GetUser } from 'src/modules/auth/decorators';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { PaginationDto } from 'src/common/dto';

@ApiTags('Requisiciones de Inventario')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('inventario/requisiciones')
@Auth()
export class RequisicionesController {
  constructor(private readonly requisicionesService: RequisicionesService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear una nueva requisición de inventario',
    description:
      'Crea una solicitud de transferencia de inventario entre bodegas, sucursales o estantes',
  })
  @ApiResponse({
    status: 201,
    description: 'La requisición ha sido creada exitosamente.',
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Token JWT inválido o ausente.',
  })
  create(
    @Body() createRequisicionDto: CreateRequisicionDto,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.requisicionesService.create(createRequisicionDto, id_usuario);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar todas las requisiciones',
    description:
      'Obtiene una lista paginada de requisiciones con filtros opcionales por estado, tipo y usuario',
  })
  @ApiResponse({
    status: 200,
    description: 'Retorna las requisiciones paginadas.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Número de página',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Cantidad de items por página',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Buscar por código o motivo',
  })
  @ApiQuery({
    name: 'estado',
    required: false,
    enum: ['PENDIENTE', 'APROBADA', 'RECHAZADA', 'PROCESADA', 'CANCELADA'],
    description: 'Filtrar por estado',
  })
  @ApiQuery({
    name: 'tipo',
    required: false,
    enum: [
      'TRANSFERENCIA_BODEGA',
      'TRANSFERENCIA_SUCURSAL',
      'CAMBIO_ESTANTE',
    ],
    description: 'Filtrar por tipo',
  })
  @ApiQuery({
    name: 'id_usuario_solicita',
    required: false,
    type: Number,
    description: 'Filtrar por usuario que solicitó',
  })
  findAll(
    @Query()
    paginationDto: PaginationDto & {
      estado?: string;
      tipo?: string;
      id_usuario_solicita?: number;
    },
  ) {
    return this.requisicionesService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener una requisición por ID',
    description:
      'Obtiene los detalles completos de una requisición incluyendo items y usuarios',
  })
  @ApiResponse({ status: 200, description: 'Retorna la requisición.' })
  @ApiResponse({ status: 404, description: 'Requisición no encontrada.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.requisicionesService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Actualizar una requisición',
    description:
      'Actualiza una requisición en estado PENDIENTE. No se pueden actualizar requisiciones aprobadas o procesadas.',
  })
  @ApiResponse({
    status: 200,
    description: 'La requisición ha sido actualizada.',
  })
  @ApiResponse({ status: 404, description: 'Requisición no encontrada.' })
  @ApiResponse({
    status: 409,
    description:
      'Conflicto - Solo se pueden actualizar requisiciones PENDIENTES.',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRequisicionDto: UpdateRequisicionDto,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.requisicionesService.update(id, updateRequisicionDto, id_usuario);
  }

  @Patch(':id/autorizar')
  @ApiOperation({
    summary: 'Autorizar o rechazar una requisición',
    description:
      'Aprueba o rechaza una requisición pendiente. Al aprobar se pueden especificar cantidades autorizadas diferentes a las solicitadas.',
  })
  @ApiResponse({
    status: 200,
    description: 'La requisición ha sido autorizada/rechazada.',
  })
  @ApiResponse({ status: 404, description: 'Requisición no encontrada.' })
  @ApiResponse({
    status: 409,
    description:
      'Conflicto - Solo se pueden autorizar requisiciones PENDIENTES.',
  })
  authorize(
    @Param('id', ParseIntPipe) id: number,
    @Body() authorizeDto: AuthorizeRequisicionDto,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.requisicionesService.authorize(id, authorizeDto, id_usuario);
  }

  @Patch(':id/procesar')
  @ApiOperation({
    summary: 'Procesar una requisición aprobada',
    description:
      'Ejecuta la transferencia de inventario para una requisición aprobada. Este proceso mueve el stock físicamente entre ubicaciones.',
  })
  @ApiResponse({
    status: 200,
    description:
      'La requisición ha sido procesada y el inventario transferido.',
  })
  @ApiResponse({ status: 404, description: 'Requisición no encontrada.' })
  @ApiResponse({
    status: 400,
    description: 'Stock insuficiente o datos inválidos.',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflicto - Solo se pueden procesar requisiciones APROBADAS.',
  })
  process(
    @Param('id', ParseIntPipe) id: number,
    @Body() processDto: ProcessRequisicionDto,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.requisicionesService.process(id, processDto, id_usuario);
  }

  @Patch(':id/cancelar')
  @ApiOperation({
    summary: 'Cancelar una requisición',
    description:
      'Cancela una requisición que no ha sido procesada. Las requisiciones procesadas no se pueden cancelar.',
  })
  @ApiResponse({ status: 200, description: 'La requisición ha sido cancelada.' })
  @ApiResponse({ status: 404, description: 'Requisición no encontrada.' })
  @ApiResponse({
    status: 409,
    description:
      'Conflicto - No se pueden cancelar requisiciones procesadas.',
  })
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.requisicionesService.cancel(id, id_usuario);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar una requisición',
    description:
      'Elimina (cancela) una requisición que no ha sido procesada.',
  })
  @ApiResponse({ status: 200, description: 'La requisición ha sido eliminada.' })
  @ApiResponse({ status: 404, description: 'Requisición no encontrada.' })
  @ApiResponse({
    status: 409,
    description:
      'Conflicto - No se pueden eliminar requisiciones procesadas.',
  })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.requisicionesService.remove(id, id_usuario);
  }
}
