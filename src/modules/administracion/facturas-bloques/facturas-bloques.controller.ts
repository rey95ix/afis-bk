import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { FacturasBloquesService } from './facturas-bloques.service';
import { CreateFacturasBloqueDto, UpdateFacturasBloqueDto } from './dto';
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

@ApiTags('Administración - Bloques de Facturas')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('administracion/facturas-bloques')
@Auth()
export class FacturasBloquesController {
  constructor(private readonly facturasBloquesService: FacturasBloquesService) {}

  @Post()
  @RequirePermissions('administracion.facturas_bloques:crear')
  @ApiOperation({ summary: 'Crear un nuevo bloque de facturas' })
  @ApiResponse({ status: 201, description: 'Bloque creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  create(
    @Body() createDto: CreateFacturasBloqueDto,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.facturasBloquesService.create(createDto, id_usuario);
  }

  @Get()
  @RequirePermissions('administracion.facturas_bloques:ver')
  @ApiOperation({ summary: 'Listar bloques de facturas con paginación' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'id_tipo_factura', required: false, type: Number })
  @ApiQuery({ name: 'id_sucursal', required: false, type: Number })
  @ApiQuery({ name: 'estado', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Lista de bloques paginada' })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('id_tipo_factura') id_tipo_factura?: number,
    @Query('id_sucursal') id_sucursal?: number,
    @Query('estado') estado?: string,
  ) {
    return this.facturasBloquesService.findAll(
      page ? +page : 1,
      limit ? +limit : 10,
      search,
      id_tipo_factura ? +id_tipo_factura : undefined,
      id_sucursal ? +id_sucursal : undefined,
      estado,
    );
  }

  @Get('tipos-factura')
  @RequirePermissions('administracion.facturas_bloques:ver')
  @ApiOperation({ summary: 'Obtener tipos de factura para selector' })
  @ApiResponse({ status: 200, description: 'Lista de tipos de factura' })
  getTiposFactura() {
    return this.facturasBloquesService.getTiposFactura();
  }

  @Get('sucursales')
  @RequirePermissions('administracion.facturas_bloques:ver')
  @ApiOperation({ summary: 'Obtener sucursales para selector' })
  @ApiResponse({ status: 200, description: 'Lista de sucursales' })
  getSucursales() {
    return this.facturasBloquesService.getSucursales();
  }

  @Get(':id')
  @RequirePermissions('administracion.facturas_bloques:ver')
  @ApiOperation({ summary: 'Obtener un bloque por ID' })
  @ApiResponse({ status: 200, description: 'Bloque encontrado' })
  @ApiResponse({ status: 404, description: 'Bloque no encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.facturasBloquesService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('administracion.facturas_bloques:editar')
  @ApiOperation({ summary: 'Actualizar un bloque' })
  @ApiResponse({ status: 200, description: 'Bloque actualizado' })
  @ApiResponse({ status: 404, description: 'Bloque no encontrado' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateFacturasBloqueDto,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.facturasBloquesService.update(id, updateDto, id_usuario);
  }

  @Delete(':id')
  @RequirePermissions('administracion.facturas_bloques:eliminar')
  @ApiOperation({ summary: 'Eliminar un bloque (soft delete)' })
  @ApiResponse({ status: 200, description: 'Bloque eliminado' })
  @ApiResponse({ status: 404, description: 'Bloque no encontrado' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.facturasBloquesService.remove(id, id_usuario);
  }
}
