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
import { OrdenesCompraService } from './ordenes-compra.service';
import { CreateOrdenCompraDto } from './dto/create-orden-compra.dto';
import { UpdateOrdenCompraDto } from './dto/update-orden-compra.dto';
import { FilterOrdenCompraDto } from './dto/filter-orden-compra.dto';
import { AprobarOrdenCompraDto } from './dto/aprobar-orden-compra.dto';
import { RechazarOrdenCompraDto } from './dto/rechazar-orden-compra.dto';
import { EmitirOrdenCompraDto } from './dto/emitir-orden-compra.dto';
import { GenerarCompraOcDto } from './dto/generar-compra-oc.dto';
import { CerrarOrdenCompraDto } from './dto/cerrar-orden-compra.dto';
import { CancelarOrdenCompraDto } from './dto/cancelar-orden-compra.dto';
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

@ApiTags('Órdenes de Compra')
@Controller('inventario/ordenes-compra')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Auth()
export class OrdenesCompraController {
  constructor(
    private readonly ordenesCompraService: OrdenesCompraService,
  ) {}

  @RequirePermissions('inventario.ordenes_compra:crear')
  @Post()
  @ApiOperation({ summary: 'Crear una nueva orden de compra' })
  @ApiResponse({
    status: 201,
    description: 'Orden de compra creada exitosamente',
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Proveedor o producto no encontrado' })
  create(
    @Body() createDto: CreateOrdenCompraDto,
    @GetUser() user: usuarios,
  ) {
    return this.ordenesCompraService.create(createDto, user);
  }

  @RequirePermissions('inventario.ordenes_compra:ver')
  @Get()
  @ApiOperation({ summary: 'Listar órdenes de compra con filtros y paginación' })
  @ApiResponse({
    status: 200,
    description: 'Lista de órdenes de compra obtenida',
  })
  @ApiQuery({ type: FilterOrdenCompraDto })
  findAll(@Query() filters: FilterOrdenCompraDto) {
    return this.ordenesCompraService.findAll(filters);
  }

  @RequirePermissions('inventario.ordenes_compra:ver')
  @Get('estadisticas')
  @ApiOperation({ summary: 'Obtener estadísticas de órdenes de compra' })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas obtenidas exitosamente',
  })
  obtenerEstadisticas() {
    return this.ordenesCompraService.obtenerEstadisticas();
  }

  @RequirePermissions('inventario.ordenes_compra:ver')
  @Get(':id')
  @ApiOperation({ summary: 'Obtener una orden de compra por ID' })
  @ApiResponse({ status: 200, description: 'Orden de compra encontrada' })
  @ApiResponse({ status: 404, description: 'Orden de compra no encontrada' })
  @ApiParam({ name: 'id', description: 'ID de la orden de compra' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ordenesCompraService.findOne(id);
  }

  @RequirePermissions('inventario.ordenes_compra:editar')
  @Put(':id')
  @ApiOperation({
    summary: 'Actualizar una orden de compra (solo en estado BORRADOR)',
  })
  @ApiResponse({
    status: 200,
    description: 'Orden de compra actualizada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Solo se pueden modificar órdenes en estado BORRADOR',
  })
  @ApiParam({ name: 'id', description: 'ID de la orden de compra' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateOrdenCompraDto,
    @GetUser() user: usuarios,
  ) {
    return this.ordenesCompraService.update(id, updateDto, user);
  }

  @RequirePermissions('inventario.ordenes_compra:eliminar')
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar una orden de compra (solo BORRADOR o CANCELADA)',
  })
  @ApiResponse({
    status: 200,
    description: 'Orden de compra eliminada exitosamente',
  })
  @ApiParam({ name: 'id', description: 'ID de la orden de compra' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: usuarios,
  ) {
    return this.ordenesCompraService.remove(id, user);
  }

  // =============================================
  // Workflow endpoints
  // =============================================

  @RequirePermissions('inventario.ordenes_compra:enviar_aprobacion')
  @Post(':id/enviar-aprobacion')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enviar orden de compra a aprobación (BORRADOR → PENDIENTE)' })
  @ApiResponse({
    status: 200,
    description: 'Orden enviada a aprobación exitosamente',
  })
  @ApiParam({ name: 'id', description: 'ID de la orden de compra' })
  enviarAprobacion(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: usuarios,
  ) {
    return this.ordenesCompraService.enviarAprobacion(id, user);
  }

  @RequirePermissions('inventario.ordenes_compra:aprobar')
  @Post(':id/aprobar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aprobar una orden de compra (PENDIENTE → APROBADA)' })
  @ApiResponse({
    status: 200,
    description: 'Orden de compra aprobada exitosamente',
  })
  @ApiParam({ name: 'id', description: 'ID de la orden de compra' })
  aprobar(
    @Param('id', ParseIntPipe) id: number,
    @Body() aprobarDto: AprobarOrdenCompraDto,
    @GetUser() user: usuarios,
  ) {
    return this.ordenesCompraService.aprobar(id, aprobarDto, user);
  }

  @RequirePermissions('inventario.ordenes_compra:rechazar')
  @Post(':id/rechazar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rechazar una orden de compra (PENDIENTE → RECHAZADA)' })
  @ApiResponse({
    status: 200,
    description: 'Orden de compra rechazada exitosamente',
  })
  @ApiParam({ name: 'id', description: 'ID de la orden de compra' })
  rechazar(
    @Param('id', ParseIntPipe) id: number,
    @Body() rechazarDto: RechazarOrdenCompraDto,
    @GetUser() user: usuarios,
  ) {
    return this.ordenesCompraService.rechazar(id, rechazarDto, user);
  }

  @RequirePermissions('inventario.ordenes_compra:editar')
  @Post(':id/reabrir')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reabrir una orden de compra rechazada (RECHAZADA → BORRADOR)' })
  @ApiResponse({
    status: 200,
    description: 'Orden de compra reabierta exitosamente',
  })
  @ApiParam({ name: 'id', description: 'ID de la orden de compra' })
  reabrir(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: usuarios,
  ) {
    return this.ordenesCompraService.reabrir(id, user);
  }

  @RequirePermissions('inventario.ordenes_compra:emitir')
  @Post(':id/emitir')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Emitir una orden de compra al proveedor (APROBADA → EMITIDA)' })
  @ApiResponse({
    status: 200,
    description: 'Orden de compra emitida exitosamente',
  })
  @ApiParam({ name: 'id', description: 'ID de la orden de compra' })
  emitir(
    @Param('id', ParseIntPipe) id: number,
    @Body() emitirDto: EmitirOrdenCompraDto,
    @GetUser() user: usuarios,
  ) {
    return this.ordenesCompraService.emitir(id, emitirDto, user);
  }

  @RequirePermissions('inventario.ordenes_compra:generar_compra')
  @Post(':id/generar-compra')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generar una compra desde la orden de compra (EMITIDA → RECEPCION)',
  })
  @ApiResponse({
    status: 200,
    description: 'Compra generada exitosamente desde la orden de compra',
  })
  @ApiParam({ name: 'id', description: 'ID de la orden de compra' })
  generarCompra(
    @Param('id', ParseIntPipe) id: number,
    @Body() generarCompraDto: GenerarCompraOcDto,
    @GetUser() user: usuarios,
  ) {
    return this.ordenesCompraService.generarCompra(
      id,
      generarCompraDto,
      user,
    );
  }

  @RequirePermissions('inventario.ordenes_compra:cerrar')
  @Post(':id/cerrar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cerrar manualmente una orden de compra (RECEPCION_PARCIAL → CERRADA)' })
  @ApiResponse({
    status: 200,
    description: 'Orden de compra cerrada exitosamente',
  })
  @ApiParam({ name: 'id', description: 'ID de la orden de compra' })
  cerrar(
    @Param('id', ParseIntPipe) id: number,
    @Body() cerrarDto: CerrarOrdenCompraDto,
    @GetUser() user: usuarios,
  ) {
    return this.ordenesCompraService.cerrar(id, cerrarDto, user);
  }

  @RequirePermissions('inventario.ordenes_compra:cancelar')
  @Post(':id/cancelar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar una orden de compra' })
  @ApiResponse({
    status: 200,
    description: 'Orden de compra cancelada exitosamente',
  })
  @ApiParam({ name: 'id', description: 'ID de la orden de compra' })
  cancelar(
    @Param('id', ParseIntPipe) id: number,
    @Body() cancelarDto: CancelarOrdenCompraDto,
    @GetUser() user: usuarios,
  ) {
    return this.ordenesCompraService.cancelar(id, cancelarDto, user);
  }
}
