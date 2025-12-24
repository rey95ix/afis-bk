import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  Res,
  Patch,
  Post,
  Body,
} from '@nestjs/common';
import type { Response } from 'express';
import { ItemsInventarioService } from './items-inventario.service';
import {
  QueryInventarioDto,
  QueryMovimientosDto,
  QuerySeriesDto,
} from './dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { Auth } from 'src/modules/auth/decorators';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';

@ApiTags('Inventario - Visualización')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('inventario/items')
@Auth()
export class ItemsInventarioController {
  constructor(
    private readonly itemsInventarioService: ItemsInventarioService,
  ) {}

  @RequirePermissions('inventario.items:ver')
  @Get()
  @ApiOperation({
    summary: 'Obtener lista de items del inventario con filtros',
    description:
      'Retorna una lista paginada de items del inventario con información de ubicación, categoría y disponibilidad. Permite filtrar por bodega, estante, categoría, estado y stock bajo.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Lista de items del inventario con paginación y datos relacionados.',
  })
  findAll(@Query() queryDto: QueryInventarioDto) {
    return this.itemsInventarioService.findAll(queryDto);
  }

  @RequirePermissions('inventario.items:ver')
  @Get('distribucion')
  @ApiOperation({
    summary: 'Obtener distribución del inventario',
    description:
      'Retorna la distribución del inventario agrupada por bodega y por categoría, con estadísticas generales de disponibilidad.',
  })
  @ApiResponse({
    status: 200,
    description: 'Distribución del inventario por bodega y categoría.',
  })
  getDistribucion() {
    return this.itemsInventarioService.getDistribucion();
  }

  @RequirePermissions('inventario.items:ver')
  @Get('alertas')
  @ApiOperation({
    summary: 'Obtener alertas de stock bajo',
    description:
      'Retorna los items del inventario que están por debajo de su cantidad mínima establecida, ordenados por nivel de criticidad.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de items con stock bajo ordenados por criticidad.',
  })
  getAlertas() {
    return this.itemsInventarioService.getAlertas();
  }

  @RequirePermissions('inventario.items:ver')
  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalle de un item del inventario',
    description:
      'Retorna información detallada de un item del inventario incluyendo ubicación, categoría, series y estadísticas de disponibilidad.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del item en el inventario',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Detalle del item del inventario.',
  })
  @ApiResponse({
    status: 404,
    description: 'Item del inventario no encontrado.',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.itemsInventarioService.findOne(id);
  }

  @RequirePermissions('inventario.items:ver')
  @Get(':id/series')
  @ApiOperation({
    summary: 'Obtener series de un item del inventario',
    description:
      'Retorna una lista paginada de todas las series (números de serie) asociadas a un item del inventario, con información de su estado y asignación.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del item en el inventario',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de series del item.',
  })
  @ApiResponse({
    status: 404,
    description: 'Item del inventario no encontrado.',
  })
  findSeries(
    @Param('id', ParseIntPipe) id: number,
    @Query() queryDto: QuerySeriesDto,
  ) {
    return this.itemsInventarioService.findSeries(id, queryDto);
  }

  @RequirePermissions('inventario.items:ver')
  @Get('catalogo/:id_catalogo/movimientos')
  @ApiOperation({
    summary: 'Obtener movimientos de un item del catálogo',
    description:
      'Retorna el historial de movimientos (entradas, salidas, transferencias) de un item del catálogo en el inventario.',
  })
  @ApiParam({
    name: 'id_catalogo',
    description: 'ID del item en el catálogo',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Historial de movimientos del item.',
  })
  findMovimientos(
    @Param('id_catalogo', ParseIntPipe) id_catalogo: number,
    @Query() queryDto: QueryMovimientosDto,
  ) {
    return this.itemsInventarioService.findMovimientos(id_catalogo, queryDto);
  }

  @RequirePermissions('inventario.items:ver')
  @Get('distribucion/pdf')
  @ApiOperation({
    summary: 'Generar PDF de existencias de inventario',
    description:
      'Genera un documento PDF con el reporte completo de existencias de inventario, incluyendo distribución por bodega, por categoría y alertas de stock bajo.',
  })
  @ApiResponse({
    status: 200,
    description: 'PDF generado exitosamente.',
    content: {
      'application/pdf': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Error al generar el PDF.',
  })
  @ApiResponse({
    status: 404,
    description: 'Plantilla de reporte no encontrada.',
  })
  async generateExistenciasPdf(@Res() res: Response) {
    const pdfBuffer = await this.itemsInventarioService.generateExistenciasPdf();

    // inline = abrir en navegador, attachment = descargar
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Existencias_Inventario_${new Date().getTime()}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @RequirePermissions('inventario.items:ver')
  @Get('distribucion/excel')
  @ApiOperation({
    summary: 'Generar Excel de existencias de inventario',
    description:
      'Genera un archivo Excel con el reporte completo de existencias de inventario, incluyendo distribución por bodega, por categoría y alertas de stock bajo. El archivo contiene múltiples hojas con datos formateados.',
  })
  @ApiResponse({
    status: 200,
    description: 'Excel generado exitosamente.',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Error al generar el Excel.',
  })
  async generateExistenciasExcel(@Res() res: Response) {
    const excelBuffer = await this.itemsInventarioService.generateExistenciasExcel();

    const fileName = `Existencias_Inventario_${new Date().getTime()}.xlsx`;

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': excelBuffer.length,
    });

    res.end(excelBuffer);
  }

  // ============================================
  // ENDPOINTS DE ROP (PUNTO DE REORDEN)
  // ============================================

  @RequirePermissions('inventario.items:ver')
  @Get('alertas-rop')
  @ApiOperation({
    summary: 'Obtener alertas de stock bajo según ROP',
    description:
      'Retorna los items del inventario que están por debajo de su Punto de Reorden (ROP) calculado, ' +
      'ordenados por urgencia. Incluye información de días cubiertos y si requiere pedido urgente.',
  })
  @ApiQuery({
    name: 'bodegaId',
    required: false,
    description: 'Filtrar por bodega específica',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de items con stock bajo según ROP.',
  })
  getAlertasROP(@Query('bodegaId') bodegaId?: number) {
    return this.itemsInventarioService.getAlertasROP(
      bodegaId ? Number(bodegaId) : undefined,
    );
  }

  @RequirePermissions('inventario.catalogo:editar')
  @Patch('catalogo/:id/calcular-rop')
  @ApiOperation({
    summary: 'Calcular y actualizar ROP de un producto',
    description:
      'Calcula el Punto de Reorden usando la fórmula: ROP = (Demanda Promedio Diaria × Lead Time) + Stock Seguridad. ' +
      'Requiere que el producto tenga configurados los parámetros de demanda y lead time.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del catálogo',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'ROP calculado y actualizado exitosamente.',
  })
  @ApiResponse({
    status: 404,
    description: 'Catálogo no encontrado.',
  })
  actualizarROPAutomatico(@Param('id', ParseIntPipe) id: number) {
    return this.itemsInventarioService.actualizarROPAutomatico(id);
  }

  @RequirePermissions('inventario.catalogo:editar')
  @Patch('catalogo/:id/parametros-rop')
  @ApiOperation({
    summary: 'Actualizar parámetros ROP de un producto',
    description:
      'Actualiza los parámetros usados para calcular el ROP (lead_time_dias, demanda_promedio_diaria, stock_seguridad) ' +
      'y recalcula automáticamente el punto de reorden.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del catálogo',
    type: Number,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        lead_time_dias: {
          type: 'integer',
          description: 'Días que tarda el proveedor en entregar',
          example: 15,
        },
        demanda_promedio_diaria: {
          type: 'number',
          description: 'Consumo promedio diario del producto',
          example: 2.5,
        },
        stock_seguridad: {
          type: 'integer',
          description: 'Unidades de buffer de seguridad',
          example: 10,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Parámetros actualizados y ROP recalculado.',
  })
  actualizarParametrosROP(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    params: {
      lead_time_dias?: number;
      demanda_promedio_diaria?: number;
      stock_seguridad?: number;
    },
  ) {
    return this.itemsInventarioService.actualizarParametrosROP(id, params);
  }

  @RequirePermissions('inventario.catalogo:editar')
  @Post('catalogo/recalcular-rop-masivo')
  @ApiOperation({
    summary: 'Recalcular ROP masivamente',
    description:
      'Recalcula el Punto de Reorden para todos los productos que tienen configurados los parámetros necesarios ' +
      '(demanda_promedio_diaria y lead_time_dias). Útil para actualización periódica.',
  })
  @ApiResponse({
    status: 200,
    description: 'Resumen del proceso de recálculo masivo.',
  })
  recalcularROPMasivo() {
    return this.itemsInventarioService.recalcularROPMasivo();
  }

  // ============================================
  // ALERTAS STOCK BAJO (cantidad_minima)
  // ============================================

  @RequirePermissions('inventario.items:ver')
  @Get('alertas-stock-bajo')
  @ApiOperation({
    summary: 'Obtener alertas de stock bajo (cantidad_minima)',
    description:
      'Retorna los items del inventario que están por debajo de su cantidad_minima establecida. ' +
      'Diferente del ROP, este es un umbral simple sin considerar lead time ni demanda.',
  })
  @ApiQuery({
    name: 'bodegaId',
    required: false,
    description: 'Filtrar por bodega específica',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de items con stock bajo ordenados por criticidad.',
  })
  getAlertasStockBajo(@Query('bodegaId') bodegaId?: number) {
    return this.itemsInventarioService.getAlertasStockBajo(
      bodegaId ? Number(bodegaId) : undefined,
    );
  }

  // ============================================
  // ITEMS OBSOLETOS (VIDA ÚTIL VENCIDA)
  // ============================================

  @RequirePermissions('inventario.items:ver')
  @Get('items-obsoletos')
  @ApiOperation({
    summary: 'Obtener series con vida útil vencida',
    description:
      'Retorna las series cuya vida útil ha vencido (fecha_ingreso + vida_util_meses < fecha_actual). ' +
      'Incluye recomendación de acción según días vencido: BAJA_INMEDIATA (>180 días), ' +
      'PROGRAMAR_BAJA (>90 días), EVALUAR_REEMPLAZO (≤90 días).',
  })
  @ApiQuery({
    name: 'bodegaId',
    required: false,
    description: 'Filtrar por bodega específica',
    type: Number,
  })
  @ApiQuery({
    name: 'categoriaId',
    required: false,
    description: 'Filtrar por categoría específica',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de series obsoletas ordenadas por días vencido (mayor primero).',
  })
  getItemsObsoletos(
    @Query('bodegaId') bodegaId?: string,
    @Query('categoriaId') categoriaId?: string,
  ) {
    return this.itemsInventarioService.getItemsObsoletos(
      bodegaId ? Number(bodegaId) : undefined,
      categoriaId ? Number(categoriaId) : undefined,
    );
  }

  @RequirePermissions('inventario.items:ver')
  @Get('items-obsoletos/resumen')
  @ApiOperation({
    summary: 'Obtener resumen de items obsoletos',
    description:
      'Retorna un resumen estadístico de items obsoletos agrupados por categoría, ' +
      'bodega y recomendación de acción.',
  })
  @ApiResponse({
    status: 200,
    description: 'Resumen de items obsoletos con agrupaciones.',
  })
  getResumenItemsObsoletos() {
    return this.itemsInventarioService.getResumenItemsObsoletos();
  }

  // ============================================
  // LOGICA FIFO PARA ASIGNACION DE SERIES
  // ============================================

  @RequirePermissions('inventario.items:ver')
  @Get('series-fifo/:idCatalogo/:idBodega')
  @ApiOperation({
    summary: 'Obtener series para asignación usando FIFO',
    description:
      'Retorna series disponibles ordenadas por fecha de ingreso (más antiguas primero). ' +
      'Implementa la política FIFO (First-In-First-Out) para evitar obsolescencia de equipos.',
  })
  @ApiParam({
    name: 'idCatalogo',
    description: 'ID del producto en catálogo',
    type: Number,
  })
  @ApiParam({
    name: 'idBodega',
    description: 'ID de la bodega',
    type: Number,
  })
  @ApiQuery({
    name: 'cantidad',
    required: true,
    description: 'Cantidad de series a obtener',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Series ordenadas por FIFO (más antiguas primero).',
  })
  @ApiResponse({
    status: 400,
    description: 'Stock insuficiente para la cantidad solicitada.',
  })
  @ApiResponse({
    status: 404,
    description: 'No existe inventario del producto en la bodega.',
  })
  getSeriesForAssignment(
    @Param('idCatalogo', ParseIntPipe) idCatalogo: number,
    @Param('idBodega', ParseIntPipe) idBodega: number,
    @Query('cantidad', ParseIntPipe) cantidad: number,
  ) {
    return this.itemsInventarioService.getSeriesForAssignment(
      idCatalogo,
      idBodega,
      cantidad,
    );
  }

  @RequirePermissions('inventario.items:ver')
  @Get('sugerir-series-fifo/:idCatalogo/:idBodega')
  @ApiOperation({
    summary: 'Sugerir series para asignación usando FIFO',
    description:
      'Sugiere series a asignar siguiendo FIFO sin validar cantidad. ' +
      'Útil para preview antes de confirmar una asignación.',
  })
  @ApiParam({
    name: 'idCatalogo',
    description: 'ID del producto en catálogo',
    type: Number,
  })
  @ApiParam({
    name: 'idBodega',
    description: 'ID de la bodega',
    type: Number,
  })
  @ApiQuery({
    name: 'cantidad',
    required: true,
    description: 'Cantidad de series deseadas',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Sugerencia de series con información de disponibilidad.',
  })
  sugerirSeriesFIFO(
    @Param('idCatalogo', ParseIntPipe) idCatalogo: number,
    @Param('idBodega', ParseIntPipe) idBodega: number,
    @Query('cantidad', ParseIntPipe) cantidad: number,
  ) {
    return this.itemsInventarioService.sugerirSeriesFIFO(
      idCatalogo,
      idBodega,
      cantidad,
    );
  }
}
