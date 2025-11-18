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
  UseInterceptors,
  UploadedFile,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { AuditoriasInventarioService } from './auditorias-inventario.service';
import {
  CreateAuditoriaDto,
  UpdateAuditoriaDto,
  FilterAuditoriaDto,
  IniciarConteoDto,
  RegistrarConteoDto,
  EscanearSerieDto,
  FinalizarAuditoriaDto,
  CreateAjusteDto,
  AutorizarAjusteDto,
  FilterAjusteDto,
  QueryMetricasDto,
  UploadEvidenciaDto,
} from './dto';
import { Auth, GetUser } from '../../auth/decorators';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { HEADER_API_BEARER_AUTH } from '../../../common/const';

@ApiTags('Auditorías de Inventario')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('inventario/auditorias-inventario')
@Auth()
export class AuditoriasInventarioController {
  constructor(
    private readonly auditoriasInventarioService: AuditoriasInventarioService,
  ) {}

  // ==================== CRUD de Auditorías ====================

  @RequirePermissions('inventario.auditorias:crear')
  @Post()
  @ApiOperation({
    summary: 'Crear/planificar una auditoría de inventario',
    description:
      'Crea una nueva auditoría en estado PLANIFICADA. Genera automáticamente el código AUD-YYYYMM-####',
  })
  @ApiResponse({
    status: 201,
    description: 'Auditoría creada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos',
  })
  @ApiResponse({
    status: 404,
    description: 'Bodega o estante no encontrado',
  })
  create(
    @Body() createAuditoriaDto: CreateAuditoriaDto,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.auditoriasInventarioService.create(
      createAuditoriaDto,
      id_usuario,
    );
  }

  @RequirePermissions('inventario.auditorias:ver')
  @Get()
  @ApiOperation({
    summary: 'Listar auditorías con filtros y paginación',
    description:
      'Obtiene lista paginada de auditorías con opciones de filtrado por tipo, estado, bodega, usuario, fechas, etc.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de auditorías obtenida exitosamente',
  })
  findAll(@Query() filterDto: FilterAuditoriaDto) {
    return this.auditoriasInventarioService.findAll(filterDto);
  }

  @RequirePermissions('inventario.auditorias:ver')
  @Get(':id')
  @ApiOperation({
    summary: 'Obtener auditoría por ID con todos los detalles',
    description:
      'Obtiene auditoría completa incluyendo bodega, estante, usuarios, detalle de productos, evidencias, ajustes y snapshot',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la auditoría',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Auditoría encontrada',
  })
  @ApiResponse({
    status: 404,
    description: 'Auditoría no encontrada',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.auditoriasInventarioService.findOne(id);
  }

  @RequirePermissions('inventario.auditorias:editar')
  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar auditoría',
    description:
      'Actualiza datos de auditoría. Solo disponible en estado PLANIFICADA',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la auditoría',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Auditoría actualizada exitosamente',
  })
  @ApiResponse({
    status: 403,
    description: 'No se puede editar en este estado',
  })
  @ApiResponse({
    status: 404,
    description: 'Auditoría no encontrada',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAuditoriaDto: UpdateAuditoriaDto,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.auditoriasInventarioService.update(
      id,
      updateAuditoriaDto,
      id_usuario,
    );
  }

  @RequirePermissions('inventario.auditorias:eliminar')
  @Delete(':id')
  @ApiOperation({
    summary: 'Cancelar auditoría',
    description:
      'Cambia el estado de la auditoría a CANCELADA. No se puede cancelar si ya está COMPLETADA o CANCELADA',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la auditoría',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Auditoría cancelada exitosamente',
  })
  @ApiResponse({
    status: 403,
    description: 'No se puede cancelar en este estado',
  })
  @ApiResponse({
    status: 404,
    description: 'Auditoría no encontrada',
  })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.auditoriasInventarioService.remove(id, id_usuario);
  }

  // ==================== Workflow de Conteo ====================

  @RequirePermissions('inventario.auditorias:ejecutar')
  @Post(':id/iniciar-conteo')
  @ApiOperation({
    summary: 'Iniciar conteo físico',
    description:
      'Inicia el conteo físico. Crea registros de detalle con el stock actual del sistema. Cambia estado a EN_PROGRESO',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la auditoría',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Conteo iniciado exitosamente',
  })
  @ApiResponse({
    status: 403,
    description: 'Solo se puede iniciar desde estado PLANIFICADA',
  })
  @ApiResponse({
    status: 404,
    description: 'Auditoría no encontrada',
  })
  iniciarConteo(
    @Param('id', ParseIntPipe) id: number,
    @Body() iniciarConteoDto: IniciarConteoDto,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.auditoriasInventarioService.iniciarConteo(
      id,
      iniciarConteoDto,
      id_usuario,
    );
  }

  @RequirePermissions('inventario.auditorias:ejecutar')
  @Post(':id/registrar-conteo')
  @ApiOperation({
    summary: 'Registrar conteos físicos de productos',
    description:
      'Registra las cantidades físicas contadas. Calcula automáticamente discrepancias, tipo (FALTANTE/SOBRANTE/CONFORME) y porcentaje',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la auditoría',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Conteos registrados exitosamente',
  })
  @ApiResponse({
    status: 403,
    description: 'Solo disponible en estado EN_PROGRESO',
  })
  @ApiResponse({
    status: 400,
    description: 'Productos no pertenecen a la auditoría',
  })
  registrarConteo(
    @Param('id', ParseIntPipe) id: number,
    @Body() registrarConteoDto: RegistrarConteoDto,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.auditoriasInventarioService.registrarConteo(
      id,
      registrarConteoDto,
      id_usuario,
    );
  }

  @RequirePermissions('inventario.auditorias:ejecutar')
  @Post(':id/escanear-serie')
  @ApiOperation({
    summary: 'Escanear serie individual',
    description:
      'Registra el escaneo de una serie específica. Valida existencia en sistema, ubicación y estado',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la auditoría',
    example: 1,
  })
  @ApiResponse({
    status: 201,
    description: 'Serie escaneada y registrada exitosamente',
  })
  @ApiResponse({
    status: 403,
    description: 'Solo disponible en estado EN_PROGRESO',
  })
  @ApiResponse({
    status: 400,
    description: 'Producto no pertenece a la auditoría',
  })
  escanearSerie(
    @Param('id', ParseIntPipe) id: number,
    @Body() escanearSerieDto: EscanearSerieDto,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.auditoriasInventarioService.escanearSerie(
      id,
      escanearSerieDto,
      id_usuario,
    );
  }

  @RequirePermissions('inventario.auditorias:ejecutar')
  @Post(':id/evidencia')
  @ApiOperation({
    summary: 'Subir evidencia fotográfica',
    description:
      'Sube una foto como evidencia de la auditoría. Tipos: ESTANTE, PRODUCTO, GENERAL, DISCREPANCIA',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la auditoría',
    example: 1,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Archivo de imagen',
        },
        tipo: {
          type: 'string',
          enum: ['ESTANTE', 'PRODUCTO', 'GENERAL', 'DISCREPANCIA'],
          description: 'Tipo de evidencia',
        },
        titulo: {
          type: 'string',
          description: 'Título de la evidencia',
        },
        descripcion: {
          type: 'string',
          description: 'Descripción de la evidencia',
        },
        id_catalogo: {
          type: 'number',
          description: 'ID del producto relacionado (opcional)',
        },
      },
      required: ['file', 'tipo'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Evidencia subida exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Archivo inválido o datos incorrectos',
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadEvidencia(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadEvidenciaDto: UploadEvidenciaDto,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    if (!file) {
      throw new BadRequestException('El archivo es requerido');
    }

    return this.auditoriasInventarioService.uploadEvidencia(
      id,
      file,
      uploadEvidenciaDto,
      id_usuario,
    );
  }

  @RequirePermissions('inventario.auditorias:finalizar')
  @Post(':id/finalizar')
  @ApiOperation({
    summary: 'Finalizar auditoría',
    description:
      'Finaliza la auditoría, calcula totales, porcentaje de accuracy y crea snapshot automáticamente. Cambia estado a PENDIENTE_REVISION',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la auditoría',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Auditoría finalizada exitosamente',
  })
  @ApiResponse({
    status: 403,
    description: 'Solo disponible en estado EN_PROGRESO',
  })
  @ApiResponse({
    status: 400,
    description: 'Debe haber al menos un producto contado',
  })
  finalizarAuditoria(
    @Param('id', ParseIntPipe) id: number,
    @Body() finalizarAuditoriaDto: FinalizarAuditoriaDto,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.auditoriasInventarioService.finalizarAuditoria(
      id,
      finalizarAuditoriaDto,
      id_usuario,
    );
  }

  // ==================== Análisis y Ajustes ====================

  @RequirePermissions('inventario.auditorias:ver')
  @Get(':id/discrepancias')
  @ApiOperation({
    summary: 'Obtener discrepancias de la auditoría',
    description:
      'Retorna resumen y detalle de discrepancias (faltantes, sobrantes, conformes) con valores monetarios',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la auditoría',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Discrepancias obtenidas exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Auditoría no encontrada',
  })
  getDiscrepancias(@Param('id', ParseIntPipe) id: number) {
    return this.auditoriasInventarioService.getDiscrepancias(id);
  }

  @RequirePermissions('inventario.auditorias:generar_ajustes')
  @Post(':id/generar-ajustes')
  @ApiOperation({
    summary: 'Generar ajustes de inventario desde discrepancias',
    description:
      'Crea ajustes de inventario en estado PENDIENTE_AUTORIZACION. Solo disponible en estados PENDIENTE_REVISION o COMPLETADA',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la auditoría',
    example: 1,
  })
  @ApiResponse({
    status: 201,
    description: 'Ajustes generados exitosamente',
  })
  @ApiResponse({
    status: 403,
    description: 'No se pueden generar ajustes en este estado',
  })
  @ApiResponse({
    status: 400,
    description: 'Detalles no pertenecen a la auditoría',
  })
  generarAjustes(
    @Param('id', ParseIntPipe) id: number,
    @Body() createAjusteDto: CreateAjusteDto,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.auditoriasInventarioService.generarAjustes(
      id,
      createAjusteDto,
      id_usuario,
    );
  }

  @RequirePermissions('inventario.auditorias:exportar')
  @Get(':id/pdf')
  @ApiOperation({
    summary: 'Generar reporte PDF de la auditoría',
    description:
      'Genera un documento PDF completo con todos los detalles de la auditoría incluyendo discrepancias y evidencias',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la auditoría',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'PDF generado exitosamente',
    headers: {
      'Content-Type': { description: 'application/pdf' },
      'Content-Disposition': {
        description: 'inline; filename="Auditoria_{id}.pdf"',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Auditoría no encontrada',
  })
  async generarReportePdf(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const pdfBuffer =
      await this.auditoriasInventarioService.generarReportePdf(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Auditoria_${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  // ==================== Ajustes ====================

  @RequirePermissions('inventario.ajustes:ver')
  @Get('ajustes/listar')
  @ApiOperation({
    summary: 'Listar ajustes con filtros y paginación',
    description:
      'Obtiene lista paginada de ajustes con opciones de filtrado por estado, auditoría, producto, bodega, etc.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de ajustes obtenida exitosamente',
  })
  getAjustes(@Query() filterDto: FilterAjusteDto) {
    return this.auditoriasInventarioService.getAjustes(filterDto);
  }

  @RequirePermissions('inventario.ajustes:aprobar')
  @Post('ajustes/:id/autorizar')
  @ApiOperation({
    summary: 'Autorizar o rechazar ajuste',
    description:
      'Permite a un supervisor autorizar o rechazar un ajuste. Solo disponible en estado PENDIENTE_AUTORIZACION',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del ajuste',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Ajuste autorizado/rechazado exitosamente',
  })
  @ApiResponse({
    status: 403,
    description: 'Solo disponible en estado PENDIENTE_AUTORIZACION',
  })
  @ApiResponse({
    status: 400,
    description: 'Si se rechaza, motivo_rechazo es requerido',
  })
  autorizarAjuste(
    @Param('id', ParseIntPipe) id: number,
    @Body() autorizarAjusteDto: AutorizarAjusteDto,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.auditoriasInventarioService.autorizarAjuste(
      id,
      autorizarAjusteDto,
      id_usuario,
    );
  }

  @RequirePermissions('inventario.ajustes:aplicar')
  @Post('ajustes/:id/aplicar')
  @ApiOperation({
    summary: 'Aplicar ajuste autorizado al inventario',
    description:
      'Ejecuta el ajuste: actualiza cantidad en inventario y crea movimiento. Solo disponible en estado AUTORIZADO',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del ajuste',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Ajuste aplicado exitosamente al inventario',
  })
  @ApiResponse({
    status: 403,
    description: 'Solo disponible en estado AUTORIZADO',
  })
  @ApiResponse({
    status: 400,
    description: 'La aplicación del ajuste resulta en cantidad negativa',
  })
  aplicarAjuste(
    @Param('id', ParseIntPipe) id: number,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.auditoriasInventarioService.aplicarAjuste(id, id_usuario);
  }

  // ==================== Métricas ====================

  @RequirePermissions('inventario.auditorias:ver')
  @Get('metricas/dashboard')
  @ApiOperation({
    summary: 'Obtener métricas de auditorías por período',
    description:
      'Retorna métricas agregadas: total de auditorías, items auditados, accuracy %, valor de discrepancias, ajustes, etc. Si no existe, las calcula automáticamente',
  })
  @ApiResponse({
    status: 200,
    description: 'Métricas obtenidas exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Parámetros de consulta inválidos',
  })
  getMetricas(@Query() queryDto: QueryMetricasDto) {
    return this.auditoriasInventarioService.getMetricas(queryDto);
  }
}
