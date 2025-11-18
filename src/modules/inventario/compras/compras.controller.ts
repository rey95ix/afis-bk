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
import { ComprasService } from './compras.service';
import { CreateCompraDto } from './dto/create-compra.dto';
import { UpdateCompraDto } from './dto/update-compra.dto';
import { FilterCompraDto } from './dto/filter-compra.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Auth, GetUser } from 'src/modules/auth/decorators';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';

@ApiTags('Compras')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('inventario/compras')
@Auth()
export class ComprasController {
  constructor(private readonly comprasService: ComprasService) {}

  @RequirePermissions('inventario.compras:crear')
  @Post()
  @ApiOperation({
    summary: 'Crear una nueva compra',
    description:
      'Registra una nueva compra de inventario con sus detalles. Calcula automáticamente impuestos (IVA, retenciones, FOVIAL, etc.). El estante es obligatorio.',
  })
  @ApiResponse({
    status: 201,
    description: 'La compra ha sido creada exitosamente.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Datos inválidos o el estante no pertenece a la bodega seleccionada.',
  })
  create(@Body() createCompraDto: CreateCompraDto, @GetUser() user: any) {
    return this.comprasService.create(createCompraDto, user.id_usuario);
  }

  @RequirePermissions('inventario.compras:ver')
  @Get()
  @ApiOperation({
    summary: 'Listar todas las compras',
    description:
      'Obtiene todas las compras con paginación, filtros por proveedor, sucursal, bodega, estado y rango de fechas.',
  })
  @ApiResponse({
    status: 200,
    description: 'Retorna las compras paginadas con sus relaciones.',
  })
  findAll(@Query() filterDto: FilterCompraDto) {
    return this.comprasService.findAll(filterDto);
  }

  @RequirePermissions('inventario.compras:ver')
  @Get(':id')
  @ApiOperation({
    summary: 'Obtener una compra por ID',
    description:
      'Obtiene el detalle completo de una compra incluyendo detalles, proveedor, bodega, sucursal y series asociadas.',
  })
  @ApiResponse({
    status: 200,
    description: 'Retorna la compra con todos sus detalles.',
  })
  @ApiResponse({ status: 404, description: 'Compra no encontrada.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.comprasService.findOne(id);
  }

  @RequirePermissions('inventario.compras:editar')
  @Put(':id')
  @ApiOperation({
    summary: 'Actualizar una compra',
    description:
      'Actualiza los datos de una compra y/o sus detalles. Recalcula totales automáticamente.',
  })
  @ApiResponse({
    status: 200,
    description: 'La compra ha sido actualizada exitosamente.',
  })
  @ApiResponse({ status: 404, description: 'Compra no encontrada.' })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o compra ya recepcionada.',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCompraDto: UpdateCompraDto,
    @GetUser() user: any,
  ) {
    return this.comprasService.update(id, updateCompraDto, user.id_usuario);
  }

  @RequirePermissions('inventario.compras:eliminar')
  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar una compra',
    description:
      'Inactiva una compra cambiando su estado a INACTIVO (soft delete).',
  })
  @ApiResponse({ status: 200, description: 'La compra ha sido inactivada.' })
  @ApiResponse({ status: 404, description: 'Compra no encontrada.' })
  remove(@Param('id', ParseIntPipe) id: number, @GetUser() user: any) {
    return this.comprasService.remove(id, user.id_usuario);
  }

  @RequirePermissions('inventario.compras:recepcionar')
  @Post(':id/recepcionar')
  @ApiOperation({
    summary: 'Recepcionar una compra',
    description:
      'Recepciona una compra generando los movimientos de inventario correspondientes. Actualiza el stock en la bodega/estante especificados. Si los productos tienen series, se deben proporcionar en el body.',
  })
  @ApiResponse({
    status: 200,
    description:
      'La compra ha sido recepcionada y el inventario actualizado exitosamente.',
  })
  @ApiResponse({ status: 404, description: 'Compra no encontrada.' })
  @ApiResponse({
    status: 400,
    description: 'No se encontró un estante activo para la bodega.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        series: {
          type: 'object',
          description:
            'Objeto con id_compras_detalle como clave y array de números de serie como valor',
          example: {
            '1': ['SN001', 'SN002'],
            '2': ['SN003', 'SN004', 'SN005'],
          },
        },
      },
    },
  })
  recepcionar(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { series?: { [key: number]: string[] } },
    @GetUser() user: any,
  ) {
    return this.comprasService.recepcionar(id, user.id_usuario, body.series);
  }

  @RequirePermissions('inventario.compras:ver')
  @Get('catalogos/tipos-factura')
  @ApiOperation({
    summary: 'Obtener tipos de factura',
    description: 'Lista todos los tipos de factura disponibles para compras.',
  })
  @ApiResponse({
    status: 200,
    description: 'Retorna los tipos de factura activos.',
  })
  getTiposFactura() {
    return this.comprasService.getTiposFactura();
  }
}
