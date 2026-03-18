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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SolicitudesCompraService } from './solicitudes-compra.service';
import { CreateSolicitudCompraDto } from './dto/create-solicitud-compra.dto';
import { UpdateSolicitudCompraDto } from './dto/update-solicitud-compra.dto';
import { FilterSolicitudCompraDto } from './dto/filter-solicitud-compra.dto';
import { AutorizarSolicitudCompraDto } from './dto/autorizar-solicitud-compra.dto';
import { RechazarSolicitudCompraDto } from './dto/rechazar-solicitud-compra.dto';
import { CancelarSolicitudCompraDto } from './dto/cancelar-solicitud-compra.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { Auth, GetUser } from 'src/modules/auth/decorators';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import type { usuarios } from '@prisma/client';

@ApiTags('Inventario - Solicitudes de Compra')
@Controller('inventario/solicitudes-compra')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Auth()
export class SolicitudesCompraController {
  constructor(
    private readonly solicitudesCompraService: SolicitudesCompraService,
  ) {}

  @RequirePermissions('inventario.solicitudes_compra:crear')
  @Post()
  @ApiOperation({ summary: 'Crear una nueva solicitud de compra' })
  @ApiResponse({
    status: 201,
    description: 'Solicitud de compra creada exitosamente',
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  create(
    @Body() createDto: CreateSolicitudCompraDto,
    @GetUser() user: usuarios,
  ) {
    return this.solicitudesCompraService.create(createDto, user);
  }

  @RequirePermissions('inventario.solicitudes_compra:ver')
  @Get()
  @ApiOperation({ summary: 'Listar solicitudes de compra con filtros y paginación' })
  @ApiResponse({
    status: 200,
    description: 'Lista de solicitudes de compra obtenida',
  })
  @ApiQuery({ type: FilterSolicitudCompraDto })
  findAll(@Query() filters: FilterSolicitudCompraDto) {
    return this.solicitudesCompraService.findAll(filters);
  }

  @RequirePermissions('inventario.solicitudes_compra:ver')
  @Get('estadisticas')
  @ApiOperation({ summary: 'Obtener estadísticas de solicitudes de compra' })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas obtenidas exitosamente',
  })
  getEstadisticas() {
    return this.solicitudesCompraService.getEstadisticas();
  }

  @RequirePermissions('inventario.solicitudes_compra:ver')
  @Get(':id')
  @ApiOperation({ summary: 'Obtener una solicitud de compra por ID' })
  @ApiResponse({ status: 200, description: 'Solicitud de compra encontrada' })
  @ApiResponse({ status: 404, description: 'Solicitud de compra no encontrada' })
  @ApiParam({ name: 'id', description: 'ID de la solicitud de compra' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.solicitudesCompraService.findOne(id);
  }

  @RequirePermissions('inventario.solicitudes_compra:editar')
  @Put(':id')
  @ApiOperation({
    summary: 'Actualizar una solicitud de compra (solo en estado BORRADOR)',
  })
  @ApiResponse({
    status: 200,
    description: 'Solicitud de compra actualizada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Solo se pueden modificar solicitudes en estado BORRADOR',
  })
  @ApiParam({ name: 'id', description: 'ID de la solicitud de compra' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateSolicitudCompraDto,
    @GetUser() user: usuarios,
  ) {
    return this.solicitudesCompraService.update(id, updateDto, user);
  }

  @RequirePermissions('inventario.solicitudes_compra:eliminar')
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar una solicitud de compra (solo BORRADOR o CANCELADA)',
  })
  @ApiResponse({
    status: 200,
    description: 'Solicitud de compra eliminada exitosamente',
  })
  @ApiParam({ name: 'id', description: 'ID de la solicitud de compra' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: usuarios,
  ) {
    return this.solicitudesCompraService.remove(id, user);
  }

  // =============================================
  // Workflow endpoints
  // =============================================

  @RequirePermissions('inventario.solicitudes_compra:enviar_revision')
  @Post(':id/enviar-revision')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enviar solicitud a revisión (BORRADOR → PENDIENTE_REVISION)' })
  @ApiResponse({
    status: 200,
    description: 'Solicitud enviada a revisión exitosamente',
  })
  @ApiParam({ name: 'id', description: 'ID de la solicitud de compra' })
  enviarRevision(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: usuarios,
  ) {
    return this.solicitudesCompraService.enviarRevision(id, user);
  }

  @RequirePermissions('inventario.solicitudes_compra:autorizar')
  @Post(':id/autorizar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autorizar una solicitud de compra (PENDIENTE_REVISION → AUTORIZADA)' })
  @ApiResponse({
    status: 200,
    description: 'Solicitud de compra autorizada exitosamente',
  })
  @ApiParam({ name: 'id', description: 'ID de la solicitud de compra' })
  autorizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() autorizarDto: AutorizarSolicitudCompraDto,
    @GetUser() user: usuarios,
  ) {
    return this.solicitudesCompraService.autorizar(id, autorizarDto, user);
  }

  @RequirePermissions('inventario.solicitudes_compra:rechazar')
  @Post(':id/rechazar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rechazar una solicitud de compra (PENDIENTE_REVISION → RECHAZADA)' })
  @ApiResponse({
    status: 200,
    description: 'Solicitud de compra rechazada exitosamente',
  })
  @ApiParam({ name: 'id', description: 'ID de la solicitud de compra' })
  rechazar(
    @Param('id', ParseIntPipe) id: number,
    @Body() rechazarDto: RechazarSolicitudCompraDto,
    @GetUser() user: usuarios,
  ) {
    return this.solicitudesCompraService.rechazar(id, rechazarDto, user);
  }

  @RequirePermissions('inventario.solicitudes_compra:editar')
  @Post(':id/reabrir')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reabrir una solicitud rechazada (RECHAZADA → BORRADOR)' })
  @ApiResponse({
    status: 200,
    description: 'Solicitud de compra reabierta exitosamente',
  })
  @ApiParam({ name: 'id', description: 'ID de la solicitud de compra' })
  reabrir(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: usuarios,
  ) {
    return this.solicitudesCompraService.reabrir(id, user);
  }

  @RequirePermissions('inventario.solicitudes_compra:iniciar_cotizacion')
  @Post(':id/iniciar-cotizacion')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar proceso de cotización (AUTORIZADA → EN_COTIZACION)' })
  @ApiResponse({
    status: 200,
    description: 'Proceso de cotización iniciado exitosamente',
  })
  @ApiParam({ name: 'id', description: 'ID de la solicitud de compra' })
  iniciarCotizacion(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: usuarios,
  ) {
    return this.solicitudesCompraService.iniciarCotizacion(id, user);
  }

  @RequirePermissions('inventario.solicitudes_compra:cancelar')
  @Post(':id/cancelar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar una solicitud de compra' })
  @ApiResponse({
    status: 200,
    description: 'Solicitud de compra cancelada exitosamente',
  })
  @ApiParam({ name: 'id', description: 'ID de la solicitud de compra' })
  cancelar(
    @Param('id', ParseIntPipe) id: number,
    @Body() cancelarDto: CancelarSolicitudCompraDto,
    @GetUser() user: usuarios,
  ) {
    return this.solicitudesCompraService.cancelar(id, cancelarDto, user);
  }
}
