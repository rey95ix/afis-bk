import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CotizacionesCompraService } from './cotizaciones-compra.service';
import { RegistrarCotizacionCompraDto } from './dto/registrar-cotizacion-compra.dto';
import { UpdateCotizacionCompraDto } from './dto/update-cotizacion-compra.dto';
import { SeleccionarCotizacionDto } from './dto/seleccionar-cotizacion.dto';
import { GenerarOcDesdeCotizacionDto } from './dto/generar-oc-desde-cotizacion.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { Auth, GetUser } from 'src/modules/auth/decorators';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import type { usuarios } from '@prisma/client';

@ApiTags('Inventario - Cotizaciones de Compra')
@Controller('inventario/cotizaciones-compra')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Auth()
export class CotizacionesCompraController {
  constructor(
    private readonly cotizacionesCompraService: CotizacionesCompraService,
  ) {}

  @RequirePermissions('inventario.cotizaciones_compra:crear')
  @Post()
  @ApiOperation({ summary: 'Registrar una nueva cotización de compra' })
  @ApiResponse({
    status: 201,
    description: 'Cotización de compra registrada exitosamente',
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos o estado incorrecto' })
  @ApiResponse({ status: 404, description: 'Solicitud o proveedor no encontrado' })
  registrar(
    @Body() registrarDto: RegistrarCotizacionCompraDto,
    @GetUser() user: usuarios,
  ) {
    return this.cotizacionesCompraService.registrar(registrarDto, user);
  }

  @RequirePermissions('inventario.cotizaciones_compra:ver')
  @Get('solicitud/:idSolicitud')
  @ApiOperation({ summary: 'Obtener cotizaciones por solicitud de compra' })
  @ApiResponse({
    status: 200,
    description: 'Lista de cotizaciones de la solicitud',
  })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  @ApiParam({ name: 'idSolicitud', description: 'ID de la solicitud de compra' })
  findBySolicitud(@Param('idSolicitud', ParseIntPipe) idSolicitud: number) {
    return this.cotizacionesCompraService.findBySolicitud(idSolicitud);
  }

  @RequirePermissions('inventario.cotizaciones_compra:ver')
  @Get('comparar/:idSolicitud')
  @ApiOperation({ summary: 'Comparar cotizaciones de una solicitud de compra' })
  @ApiResponse({
    status: 200,
    description: 'Matriz de comparación de cotizaciones',
  })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  @ApiParam({ name: 'idSolicitud', description: 'ID de la solicitud de compra' })
  comparar(@Param('idSolicitud', ParseIntPipe) idSolicitud: number) {
    return this.cotizacionesCompraService.comparar(idSolicitud);
  }

  @RequirePermissions('inventario.cotizaciones_compra:ver')
  @Get(':id')
  @ApiOperation({ summary: 'Obtener una cotización de compra por ID' })
  @ApiResponse({ status: 200, description: 'Cotización de compra encontrada' })
  @ApiResponse({ status: 404, description: 'Cotización de compra no encontrada' })
  @ApiParam({ name: 'id', description: 'ID de la cotización de compra' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.cotizacionesCompraService.findOne(id);
  }

  @RequirePermissions('inventario.cotizaciones_compra:editar')
  @Put(':id')
  @ApiOperation({
    summary: 'Actualizar una cotización de compra (solo PENDIENTE o REGISTRADA)',
  })
  @ApiResponse({
    status: 200,
    description: 'Cotización de compra actualizada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Solo se pueden modificar cotizaciones en estado PENDIENTE o REGISTRADA',
  })
  @ApiParam({ name: 'id', description: 'ID de la cotización de compra' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateCotizacionCompraDto,
    @GetUser() user: usuarios,
  ) {
    return this.cotizacionesCompraService.update(id, updateDto, user);
  }

  @RequirePermissions('inventario.cotizaciones_compra:eliminar')
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar una cotización de compra (solo PENDIENTE o REGISTRADA)',
  })
  @ApiResponse({
    status: 200,
    description: 'Cotización de compra eliminada exitosamente',
  })
  @ApiParam({ name: 'id', description: 'ID de la cotización de compra' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: usuarios,
  ) {
    return this.cotizacionesCompraService.remove(id, user);
  }

  // =============================================
  // Workflow endpoints
  // =============================================

  @RequirePermissions('inventario.cotizaciones_compra:seleccionar')
  @Post(':id/seleccionar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Seleccionar una cotización como ganadora' })
  @ApiResponse({
    status: 200,
    description: 'Cotización seleccionada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Estado incorrecto o condiciones no cumplidas',
  })
  @ApiParam({ name: 'id', description: 'ID de la cotización de compra' })
  seleccionar(
    @Param('id', ParseIntPipe) id: number,
    @Body() seleccionarDto: SeleccionarCotizacionDto,
    @GetUser() user: usuarios,
  ) {
    return this.cotizacionesCompraService.seleccionar(id, seleccionarDto, user);
  }

  @RequirePermissions('inventario.cotizaciones_compra:generar_oc')
  @Post(':id/generar-oc')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generar órdenes de compra desde la cotización seleccionada',
  })
  @ApiResponse({
    status: 200,
    description: 'Órdenes de compra generadas exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'La cotización debe estar en estado SELECCIONADA',
  })
  @ApiParam({ name: 'id', description: 'ID de la cotización de compra' })
  generarOc(
    @Param('id', ParseIntPipe) id: number,
    @Body() generarOcDto: GenerarOcDesdeCotizacionDto,
    @GetUser() user: usuarios,
  ) {
    return this.cotizacionesCompraService.generarOc(id, generarOcDto, user);
  }
}
