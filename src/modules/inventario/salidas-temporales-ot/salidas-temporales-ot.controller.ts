// src/modules/inventario/salidas-temporales-ot/salidas-temporales-ot.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Patch,
  ParseBoolPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { SalidasTemporalesOtService } from './salidas-temporales-ot.service';
import { CreateSalidaTemporalDto } from './dto/create-salida-temporal.dto';
import { QuerySalidaTemporalDto } from './dto/query-salida-temporal.dto';
import {
  ProcesarInspeccionDto,
  ProcesarInspeccionBulkDto,
} from './dto/procesar-inspeccion.dto';
import type { usuarios } from '@prisma/client';
import { Auth, GetUser } from 'src/modules/auth/decorators';

@ApiTags('Salidas Temporales OT')
@Controller('inventario/salidas-temporales-ot')
export class SalidasTemporalesOtController {
  constructor(private readonly service: SalidasTemporalesOtService) {}

  @Post()
  @Auth()
  @UseInterceptors(
    FileInterceptor('foto', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB
      },
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|pdf)$/)) {
          return callback(
            new BadRequestException(
              'Solo se permiten archivos JPG, JPEG, PNG o PDF',
            ),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  @ApiOperation({
    summary: 'Crear salida temporal de inventario para OT',
    description:
      'Crea una salida temporal de materiales de la bodega asignada al usuario. ' +
      'Descarga automáticamente el inventario y asigna los materiales a la OT especificada. ' +
      'Requiere foto del formulario físico de salida.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['id_orden_trabajo', 'detalle', 'foto'],
      properties: {
        id_orden_trabajo: {
          type: 'integer',
          description: 'ID de la orden de trabajo',
          example: 123,
        },
        observaciones: {
          type: 'string',
          description: 'Observaciones generales',
          example: 'Materiales para instalación de fibra',
        },
        detalle: {
          type: 'string',
          description:
            'Array JSON con los items a descargar. ' +
            'Cada item debe tener: id_catalogo (requerido), ' +
            'cantidad (si no es serializado) o id_serie (si es serializado)',
          example: JSON.stringify([
            { id_catalogo: 45, id_serie: 789 },
            { id_catalogo: 12, cantidad: 5 },
          ]),
        },
        foto: {
          type: 'string',
          format: 'binary',
          description: 'Foto del formulario de salida (JPG, PNG o PDF)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Salida temporal creada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos, stock insuficiente o serie no disponible',
  })
  @ApiResponse({ status: 403, description: 'Usuario sin bodega asignada' })
  @ApiResponse({ status: 404, description: 'OT o producto no encontrado' })
  async create(
    @Body() createDto: any, // Se parsea el JSON del campo 'detalle'
    @UploadedFile() foto: Express.Multer.File,
    @GetUser() user: usuarios,
  ) {
    // Parsear el campo 'detalle' que viene como string JSON
    if (typeof createDto.detalle === 'string') {
      try {
        createDto.detalle = JSON.parse(createDto.detalle);
      } catch (error) {
        throw new BadRequestException(
          'El campo "detalle" debe ser un JSON válido',
        );
      }
    }

    // Convertir id_orden_trabajo a número
    createDto.id_orden_trabajo = parseInt(createDto.id_orden_trabajo);

    // Validar con el DTO
    const dto = Object.assign(new CreateSalidaTemporalDto(), createDto);

    return this.service.create(dto, foto, user);
  }

  @Get()
  @Auth()
  @ApiOperation({
    summary: 'Listar salidas temporales',
    description:
      'Obtiene lista paginada de salidas temporales con filtros opcionales',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de salidas temporales obtenida exitosamente',
  })
  findAll(@Query() query: QuerySalidaTemporalDto, @GetUser() user: usuarios) {
    return this.service.findAll(query, user);
  }

  @Get('series-disponibles/:idCatalogo')
  @Auth()
  @ApiOperation({
    summary: 'Obtener series disponibles de un producto',
    description:
      'Lista las series disponibles de un producto específico en la bodega asignada al usuario',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de series disponibles',
  })
  @ApiResponse({
    status: 403,
    description: 'Usuario sin bodega asignada',
  })
  async getSeriesDisponibles(
    @Param('idCatalogo', ParseIntPipe) idCatalogo: number,
    @GetUser() user: usuarios,
  ) {
    return this.service.getSeriesDisponibles(idCatalogo, user);
  }

  @Get('stock-disponible/:idCatalogo')
  @Auth()
  @ApiOperation({
    summary: 'Obtener stock disponible de un producto',
    description:
      'Obtiene el stock disponible de un producto en la bodega asignada al usuario',
  })
  @ApiResponse({
    status: 200,
    description: 'Stock disponible obtenido exitosamente',
  })
  @ApiResponse({ 
    status: 403,
    description: 'Usuario sin bodega asignada',
  })
  async getStockDisponible(
    @Param('idCatalogo', ParseIntPipe) idCatalogo: number,
    @GetUser() user: usuarios,
  ) {
    return this.service.getStockDisponible(idCatalogo, user);
  }

  @Get(':id')
  @Auth()
  @ApiOperation({
    summary: 'Obtener detalle de salida temporal',
    description: 'Obtiene información completa de una salida temporal específica',
  })
  @ApiResponse({
    status: 200,
    description: 'Detalle de salida temporal obtenido exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Salida temporal no encontrada',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post(':id/cancelar')
  @Auth()
  @ApiOperation({
    summary: 'Cancelar salida temporal',
    description:
      'Cancela una salida temporal y envía los equipos serializados a inspección post-devolución',
  })
  @ApiResponse({
    status: 200,
    description: 'Salida temporal cancelada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'La salida ya está cancelada',
  })
  @ApiResponse({
    status: 404,
    description: 'Salida temporal no encontrada',
  })
  cancel(@Param('id', ParseIntPipe) id: number, @GetUser() user: usuarios) {
    return this.service.cancel(id, user);
  }

  // ============================================
  // ENDPOINTS DE INSPECCIÓN POST-DEVOLUCIÓN
  // ============================================

  @Get('inspeccion/pendientes')
  @Auth()
  @ApiOperation({
    summary: 'Obtener series pendientes de inspección',
    description:
      'Lista todas las series en estado EN_INSPECCION que requieren revisión post-devolución',
  })
  @ApiQuery({
    name: 'bodegaId',
    required: false,
    description: 'Filtrar por bodega específica',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de series pendientes de inspección',
  })
  getSeriesEnInspeccion(
    @GetUser() user: usuarios,
    @Query('bodegaId') bodegaId?: number,
  ) {
    return this.service.getSeriesEnInspeccion(
      user,
      bodegaId ? Number(bodegaId) : undefined,
    );
  }

  @Post('inspeccion/procesar')
  @Auth()
  @ApiOperation({
    summary: 'Procesar resultado de inspección',
    description:
      'Registra el resultado de la inspección y transiciona la serie al estado correspondiente: ' +
      'APROBADO → DISPONIBLE, REQUIERE_REPARACION → EN_REPARACION, DANO_PERMANENTE → DEFECTUOSO',
  })
  @ApiResponse({
    status: 200,
    description: 'Inspección procesada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'La serie no está en estado EN_INSPECCION',
  })
  @ApiResponse({
    status: 404,
    description: 'Serie no encontrada',
  })
  procesarInspeccion(
    @Body() dto: ProcesarInspeccionDto,
    @GetUser() user: usuarios,
  ) {
    return this.service.procesarInspeccion(dto, user);
  }

  @Post('inspeccion/procesar-lote')
  @Auth()
  @ApiOperation({
    summary: 'Procesar múltiples inspecciones en lote',
    description: 'Procesa varias inspecciones de una sola vez',
  })
  @ApiResponse({
    status: 200,
    description: 'Inspecciones procesadas (puede incluir errores parciales)',
  })
  procesarInspeccionBulk(
    @Body() dto: ProcesarInspeccionBulkDto,
    @GetUser() user: usuarios,
  ) {
    return this.service.procesarInspeccionBulk(dto.inspecciones, user);
  }

  @Patch('reparacion/:idSerie/completar')
  @Auth()
  @ApiOperation({
    summary: 'Completar reparación de serie',
    description:
      'Registra el resultado de la reparación: exitosa → DISPONIBLE, fallida → DEFECTUOSO',
  })
  @ApiQuery({
    name: 'exitosa',
    required: true,
    description: 'Indica si la reparación fue exitosa',
    type: Boolean,
  })
  @ApiQuery({
    name: 'observaciones',
    required: false,
    description: 'Observaciones sobre la reparación',
  })
  @ApiResponse({
    status: 200,
    description: 'Reparación completada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'La serie no está en estado EN_REPARACION',
  })
  completarReparacion(
    @Param('idSerie', ParseIntPipe) idSerie: number,
    @Query('exitosa', ParseBoolPipe) exitosa: boolean,
    @Query('observaciones') observaciones: string,
    @GetUser() user: usuarios,
  ) {
    return this.service.completarReparacion(idSerie, exitosa, observaciones, user);
  }
}
