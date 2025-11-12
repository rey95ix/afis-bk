// src/modules/inventario/importaciones/importaciones.controller.ts
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
  Patch,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ImportacionesService } from './importaciones.service';
import {
  CreateImportacionDto,
  UpdateImportacionDto,
  CreateImportacionGastoDto,
  UpdateEstadoImportacionDto,
  RecepcionarImportacionDto,
  CalcularRetaceoDto,
  AddSeriesToDetalleDto,
  UpdateImportacionSerieDto,
} from './dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Auth, GetUser } from 'src/modules/auth/decorators';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { PaginationDto } from 'src/common/dto';
import { estado_importacion } from '@prisma/client';

@ApiTags('Importaciones')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('inventario/importaciones')
@Auth()
export class ImportacionesController {
  constructor(private readonly importacionesService: ImportacionesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva orden de importación' })
  @ApiResponse({
    status: 201,
    description: 'La importación ha sido creada exitosamente.',
  })
  @ApiResponse({ status: 400, description: 'Petición inválida.' })
  create(@Body() createImportacionDto: CreateImportacionDto, @GetUser() user: any) {
    return this.importacionesService.create(
      createImportacionDto,
      user.id_usuario,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener todas las importaciones con paginación y búsqueda',
  })
  @ApiResponse({
    status: 200,
    description: 'Retorna las importaciones paginadas.',
  })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.importacionesService.findAll(paginationDto);
  }

  @Get('counts-by-estado')
  @ApiOperation({ summary: 'Obtener la cantidad de importaciones por cada estado' })
  @ApiResponse({
    status: 200,
    description: 'Retorna un arreglo con la cantidad de importaciones por estado.',
  })
  getCountsByEstado() {
    return this.importacionesService.getCountsByEstado();
  }

  @Get('estado/:estado')
  @ApiOperation({ summary: 'Obtener importaciones por estado' })
  @ApiParam({
    name: 'estado',
    enum: estado_importacion,
    description: 'Estado de la importación',
  })
  @ApiResponse({
    status: 200,
    description: 'Retorna las importaciones filtradas por estado.',
  })
  findByEstado(
    @Param('estado') estado: estado_importacion,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.importacionesService.findByEstado(estado, paginationDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una importación por su ID' })
  @ApiResponse({ status: 200, description: 'Retorna la importación.' })
  @ApiResponse({ status: 404, description: 'Importación no encontrada.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.importacionesService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar una importación' })
  @ApiResponse({
    status: 200,
    description: 'La importación ha sido actualizada.',
  })
  @ApiResponse({ status: 404, description: 'Importación no encontrada.' })
  @ApiResponse({
    status: 400,
    description: 'Solo se pueden editar importaciones en estado COTIZACION u ORDEN_COLOCADA.',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateImportacionDto: UpdateImportacionDto,
    @GetUser() user: any,
  ) {
    return this.importacionesService.update(
      id,
      updateImportacionDto,
      user.id_usuario,
    );
  }

  @Patch(':id/estado')
  @ApiOperation({ summary: 'Actualizar el estado de una importación' })
  @ApiResponse({
    status: 200,
    description: 'El estado de la importación ha sido actualizado.',
  })
  @ApiResponse({ status: 404, description: 'Importación no encontrada.' })
  updateEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEstadoDto: UpdateEstadoImportacionDto,
    @GetUser() user: any,
  ) {
    return this.importacionesService.updateEstado(
      id,
      updateEstadoDto,
      user.id_usuario,
    );
  }

  @Post(':id/gastos')
  @ApiOperation({ summary: 'Agregar un gasto a una importación' })
  @ApiResponse({ status: 201, description: 'El gasto ha sido agregado.' })
  @ApiResponse({ status: 404, description: 'Importación no encontrada.' })
  addGasto(
    @Param('id', ParseIntPipe) id: number,
    @Body() createGastoDto: CreateImportacionGastoDto,
    @GetUser() user: any,
  ) {
    return this.importacionesService.addGasto(id, createGastoDto, user.id_usuario);
  }

  @Get(':id/gastos')
  @ApiOperation({ summary: 'Obtener todos los gastos de una importación' })
  @ApiResponse({ status: 200, description: 'Retorna los gastos de la importación.' })
  @ApiResponse({ status: 404, description: 'Importación no encontrada.' })
  getGastos(@Param('id', ParseIntPipe) id: number) {
    return this.importacionesService.getGastos(id);
  }

  @Delete(':id/gastos/:id_gasto')
  @ApiOperation({ summary: 'Eliminar un gasto de una importación' })
  @ApiParam({
    name: 'id',
    description: 'ID de la importación',
    type: Number,
  })
  @ApiParam({
    name: 'id_gasto',
    description: 'ID del gasto a eliminar',
    type: Number,
  })
  @ApiResponse({ status: 200, description: 'El gasto ha sido eliminado.' })
  @ApiResponse({ status: 404, description: 'Gasto o importación no encontrada.' })
  @ApiResponse({
    status: 400,
    description: 'Solo se pueden eliminar gastos de importaciones en estado COTIZACION u ORDEN_COLOCADA, o el gasto ya fue usado en un retaceo.',
  })
  deleteGasto(
    @Param('id', ParseIntPipe) id: number,
    @Param('id_gasto', ParseIntPipe) id_gasto: number,
    @GetUser() user: any,
  ) {
    return this.importacionesService.deleteGasto(id, id_gasto, user.id_usuario);
  }

  @Post(':id/recepcionar')
  @ApiOperation({ summary: 'Recepcionar una importación en bodega' })
  @ApiResponse({
    status: 200,
    description: 'La importación ha sido recepcionada exitosamente.',
  })
  @ApiResponse({ status: 404, description: 'Importación no encontrada.' })
  @ApiResponse({
    status: 400,
    description: 'Solo se pueden recepcionar importaciones en estado LIBERADA.',
  })
  recepcionar(
    @Param('id', ParseIntPipe) id: number,
    @Body() recepcionDto: RecepcionarImportacionDto,
    @GetUser() user: any,
  ) {
    return this.importacionesService.recepcionar(
      id,
      recepcionDto,
      user.id_usuario,
    );
  }

  @Post(':id/calcular-retaceo')
  @ApiOperation({
    summary: 'Calcular y aplicar el retaceo de gastos a los items de la importación',
  })
  @ApiResponse({
    status: 200,
    description: 'El retaceo ha sido calculado exitosamente.',
  })
  @ApiResponse({ status: 404, description: 'Importación no encontrada.' })
  @ApiResponse({
    status: 400,
    description:
      'No hay gastos con retaceo o ya existe un retaceo calculado.',
  })
  calcularRetaceo(
    @Param('id', ParseIntPipe) id: number,
    @Body() calcularRetaceoDto: CalcularRetaceoDto,
    @GetUser() user: any,
  ) {
    return this.importacionesService.calcularRetaceo(
      id,
      calcularRetaceoDto.forzar_recalculo || false,
      user.id_usuario,
    );
  }

  @Get('detalle/:id_detalle/series')
  @ApiOperation({
    summary: 'Obtener todas las series de un detalle de importación',
  })
  @ApiParam({
    name: 'id_detalle',
    description: 'ID del detalle de importación',
    type: Number,
  })
  @ApiResponse({ status: 200, description: 'Retorna las series del detalle.' })
  @ApiResponse({ status: 404, description: 'Detalle no encontrado.' })
  @ApiResponse({
    status: 400,
    description: 'El item no está configurado para manejar series.',
  })
  getSeriesByDetalle(@Param('id_detalle', ParseIntPipe) id_detalle: number) {
    return this.importacionesService.getSeriesByDetalle(id_detalle);
  }

  @Post('detalle/:id_detalle/series')
  @ApiOperation({ summary: 'Agregar series a un detalle de importación' })
  @ApiParam({
    name: 'id_detalle',
    description: 'ID del detalle de importación',
    type: Number,
  })
  @ApiResponse({
    status: 201,
    description: 'Las series han sido agregadas exitosamente.',
  })
  @ApiResponse({ status: 404, description: 'Detalle no encontrado.' })
  @ApiResponse({
    status: 400,
    description:
      'El item no está configurado para manejar series o se excede la cantidad ordenada.',
  })
  addSeriesToDetalle(
    @Param('id_detalle', ParseIntPipe) id_detalle: number,
    @Body() addSeriesDto: AddSeriesToDetalleDto,
    @GetUser() user: any,
  ) {
    return this.importacionesService.addSeriesToDetalle(
      id_detalle,
      addSeriesDto,
      user.id_usuario,
    );
  }

  @Put('series/:id_serie')
  @ApiOperation({ summary: 'Actualizar una serie específica' })
  @ApiParam({
    name: 'id_serie',
    description: 'ID de la serie a actualizar',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'La serie ha sido actualizada exitosamente.',
  })
  @ApiResponse({ status: 404, description: 'Serie no encontrada.' })
  @ApiResponse({
    status: 400,
    description:
      'Solo se pueden editar series de importaciones que no han sido recepcionadas.',
  })
  updateSerie(
    @Param('id_serie', ParseIntPipe) id_serie: number,
    @Body() updateSerieDto: UpdateImportacionSerieDto,
    @GetUser() user: any,
  ) {
    return this.importacionesService.updateSerie(
      id_serie,
      updateSerieDto,
      user.id_usuario,
    );
  }

  @Delete('series/:id_serie')
  @ApiOperation({ summary: 'Eliminar una serie específica' })
  @ApiParam({
    name: 'id_serie',
    description: 'ID de la serie a eliminar',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'La serie ha sido eliminada exitosamente.',
  })
  @ApiResponse({ status: 404, description: 'Serie no encontrada.' })
  @ApiResponse({
    status: 400,
    description:
      'Solo se pueden eliminar series de importaciones que no han sido recepcionadas o la serie ya fue recibida en inventario.',
  })
  deleteSerie(
    @Param('id_serie', ParseIntPipe) id_serie: number,
    @GetUser() user: any,
  ) {
    return this.importacionesService.deleteSerie(id_serie, user.id_usuario);
  }

  @Get(':id/pdf')
  @ApiOperation({
    summary: 'Generar PDF del reporte de retaceo de la importación',
    description:
      'Genera un documento PDF con el cuadro de prorrateo de gastos de la importación.',
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
  @ApiResponse({ status: 404, description: 'Importación no encontrada.' })
  @ApiResponse({
    status: 400,
    description: 'Error al generar el PDF o no existe retaceo calculado.',
  })
  async generatePdf(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.importacionesService.generatePdf(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Reporte_Retaceo_${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Cancelar una importación (cambia estado a CANCELADA)',
  })
  @ApiResponse({
    status: 200,
    description: 'La importación ha sido cancelada.',
  })
  @ApiResponse({ status: 404, description: 'Importación no encontrada.' })
  @ApiResponse({
    status: 400,
    description: 'Solo se pueden cancelar importaciones en estado COTIZACION.',
  })
  remove(@Param('id', ParseIntPipe) id: number, @GetUser() user: any) {
    return this.importacionesService.remove(id, user.id_usuario);
  }
}
