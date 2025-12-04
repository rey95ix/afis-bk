import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AnulacionesService } from '../services';
import { AnularCobroDto } from '../dto';
import { estado_anulacion } from '@prisma/client';

@ApiTags('Facturación - Anulaciones')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('facturacion/anulaciones')
export class AnulacionesController {
  constructor(private readonly anulacionesService: AnulacionesService) {}

  @Post()
  @ApiOperation({
    summary: 'Anular un DTE existente',
    description: `
      Crea y procesa un evento de invalidación/anulación para un DTE.

      Tipos de anulación:
      - 1: Error en información del DTE (requiere DTE de reemplazo)
      - 2: Rescindir la operación
      - 3: Otro (requiere especificar motivo)

      Plazos de anulación:
      - Factura (01), FEXE (11), FSEE (14): 3 meses
      - CCF (03), NC (05), ND (06): 1 día hábil siguiente

      Validaciones:
      - El DTE debe estar en estado PROCESADO
      - Debe tener sello de recepción de MH
      - No debe haber sido anulado previamente
      - Debe estar dentro del plazo permitido
    `,
  })
  @ApiResponse({
    status: 201,
    description: 'DTE anulado exitosamente',
    schema: {
      example: {
        success: true,
        idAnulacion: 45,
        codigoGeneracionAnulacion: 'X1Y2Z3W4-A5B6-C7D8-E9F0-G1H2I3J4K5L6',
        estado: 'PROCESADA',
        selloRecibido: '20219E9D4DC0292F4681AD759B0B0F5CA99DC23G',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos o fuera de plazo' })
  @ApiResponse({ status: 404, description: 'DTE no encontrado' })
  @ApiResponse({ status: 409, description: 'DTE ya fue anulado' })
  async anularCobro(@Body() dto: AnularCobroDto, @Request() req: any) {
    return this.anulacionesService.anularCobro(dto, req.user.id_usuario);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar anulaciones',
    description: 'Lista eventos de anulación con filtros opcionales y paginación',
  })
  @ApiQuery({ name: 'idDte', required: false, type: Number })
  @ApiQuery({
    name: 'estado',
    required: false,
    enum: ['PENDIENTE', 'FIRMADA', 'TRANSMITIDA', 'PROCESADA', 'RECHAZADA'],
  })
  @ApiQuery({ name: 'fechaDesde', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'fechaHasta', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listar(
    @Query('idDte') idDte?: string,
    @Query('estado') estado?: estado_anulacion,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.anulacionesService.listar({
      idDte: idDte ? parseInt(idDte) : undefined,
      estado,
      fechaDesde: fechaDesde ? new Date(fechaDesde) : undefined,
      fechaHasta: fechaHasta ? new Date(fechaHasta) : undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener una anulación por ID',
    description: 'Obtiene el detalle completo de un evento de anulación',
  })
  @ApiResponse({ status: 200, description: 'Anulación encontrada' })
  @ApiResponse({ status: 404, description: 'Anulación no encontrada' })
  async obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.anulacionesService.obtenerPorId(id);
  }
}
