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
import { CobrosService } from '../services';
import { CrearCobroDto } from '../dto';
import { estado_dte } from '@prisma/client';

@ApiTags('Facturación - Cobros')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('facturacion/cobros')
export class CobrosController {
  constructor(private readonly cobrosService: CobrosService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear un nuevo cobro/factura',
    description: `
      Crea un nuevo DTE (Documento Tributario Electrónico) para un contrato.

      El proceso incluye:
      1. Validación de datos y contrato
      2. Determinación automática del tipo de DTE (FC o CCF)
      3. Cálculo de mora si aplica
      4. Firma con API_FIRMADOR
      5. Transmisión a Ministerio de Hacienda

      El tipo de DTE se determina automáticamente:
      - CCF (03): Si el receptor tiene NIT y NRC
      - Factura (01): En cualquier otro caso
    `,
  })
  @ApiResponse({
    status: 201,
    description: 'Cobro creado exitosamente',
    schema: {
      example: {
        success: true,
        idDte: 123,
        codigoGeneracion: 'A1B2C3D4-E5F6-G7H8-I9J0-K1L2M3N4O5P6',
        numeroControl: 'DTE-01-M001P001-000000000000001',
        estado: 'PROCESADO',
        selloRecibido: '20219E9D4DC0292F4681AD759B0B0F5CA99DC23G',
        totalPagar: 25.00,
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos o contrato no activo' })
  @ApiResponse({ status: 404, description: 'Contrato no encontrado' })
  @ApiResponse({ status: 409, description: 'Ya existe factura para este período' })
  async crearCobro(@Body() dto: CrearCobroDto, @Request() req: any) {
    return this.cobrosService.crearCobro(dto, req.user.id_usuario);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar cobros/facturas',
    description: 'Lista DTEs con filtros opcionales y paginación',
  })
  @ApiQuery({ name: 'idContrato', required: false, type: Number })
  @ApiQuery({ name: 'idCliente', required: false, type: Number })
  @ApiQuery({ name: 'tipoDte', required: false, enum: ['01', '03', '05', '06'] })
  @ApiQuery({
    name: 'estado',
    required: false,
    enum: ['BORRADOR', 'FIRMADO', 'TRANSMITIDO', 'PROCESADO', 'RECHAZADO', 'INVALIDADO'],
  })
  @ApiQuery({ name: 'fechaDesde', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'fechaHasta', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Página (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items por página (default: 20)' })
  async listar(
    @Query('idContrato') idContrato?: string,
    @Query('idCliente') idCliente?: string,
    @Query('tipoDte') tipoDte?: string,
    @Query('estado') estado?: estado_dte,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.cobrosService.listar({
      idContrato: idContrato ? parseInt(idContrato) : undefined,
      idCliente: idCliente ? parseInt(idCliente) : undefined,
      tipoDte: tipoDte as any,
      estado,
      fechaDesde: fechaDesde ? new Date(fechaDesde) : undefined,
      fechaHasta: fechaHasta ? new Date(fechaHasta) : undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener un cobro/factura por ID',
    description: 'Obtiene el detalle completo de un DTE incluyendo items y anulaciones',
  })
  @ApiResponse({ status: 200, description: 'DTE encontrado' })
  @ApiResponse({ status: 404, description: 'DTE no encontrado' })
  async obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.cobrosService.obtenerPorId(id);
  }
}
