// src/modules/facturacion/cobranza/cobranza.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Auth, GetUser } from 'src/modules/auth/decorators';
import { RequirePermissions } from 'src/modules/auth/decorators/require-permissions.decorator';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { CobranzaService } from './cobranza.service';
import {
  CerrarAsignacionDto,
  CrearNotaDto,
  DistribuirAsignacionesDto,
  FacturasVencidasQueryDto,
  MisAsignacionesQueryDto,
  ReasignarDto,
} from './dto';

@ApiTags('Facturación - Cobranza')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('facturacion/cobranza')
@Auth()
export class CobranzaController {
  constructor(private readonly cobranzaService: CobranzaService) {}

  // ---------------------------------------------------------------------------
  // Resumen y listado
  // ---------------------------------------------------------------------------

  @Get('ciclos/:id/resumen-mora')
  @RequirePermissions('facturacion.cobranza:ver')
  @ApiOperation({
    summary: 'Resumen de facturas vencidas por bucket de antigüedad',
    description:
      'Devuelve cantidad de facturas, monto, clientes y asignaciones por cada bucket (1-30, 31-60, 61-90, 91+).',
  })
  @ApiResponse({ status: 200, description: 'Resumen calculado.' })
  @ApiResponse({ status: 404, description: 'Ciclo no encontrado.' })
  getResumenMora(@Param('id', ParseIntPipe) id: number) {
    return this.cobranzaService.getResumenMora(id);
  }

  @Get('ciclos/:id/facturas-vencidas')
  @RequirePermissions('facturacion.cobranza:ver')
  @ApiOperation({
    summary: 'Listar facturas vencidas de un ciclo (paginado)',
  })
  getFacturasVencidas(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: FacturasVencidasQueryDto,
  ) {
    return this.cobranzaService.getFacturasVencidas(id, query);
  }

  @Get('ciclos/:id/dashboard')
  @RequirePermissions('facturacion.cobranza:ver')
  @ApiOperation({
    summary: 'Dashboard de recuperación de mora del ciclo',
    description:
      'Métricas de mora total, recuperada, % recuperación, facturas por bucket y ranking de gestores.',
  })
  getDashboard(@Param('id', ParseIntPipe) id: number) {
    return this.cobranzaService.getDashboard(id);
  }

  // ---------------------------------------------------------------------------
  // Gestores
  // ---------------------------------------------------------------------------

  @Get('gestores')
  @RequirePermissions('facturacion.cobranza:ver')
  @ApiOperation({
    summary: 'Listar usuarios candidatos a gestor de cobro',
    description:
      'Por ahora devuelve todos los usuarios activos. Más adelante se filtrará por permiso/rol específico.',
  })
  getGestores() {
    return this.cobranzaService.getGestores();
  }

  // ---------------------------------------------------------------------------
  // Distribución y asignaciones
  // ---------------------------------------------------------------------------

  @Post('ciclos/:id/distribuir')
  @RequirePermissions('facturacion.cobranza:asignar')
  @ApiOperation({
    summary: 'Distribuir facturas vencidas entre gestores (Round Robin)',
    description:
      'Distribuye equitativamente las facturas vencidas del ciclo entre los gestores indicados.',
  })
  @ApiResponse({ status: 201, description: 'Distribución realizada.' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o gestores no válidos.' })
  distribuir(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DistribuirAsignacionesDto,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.cobranzaService.distribuir(id, dto, id_usuario);
  }

  @Post('asignaciones/:id/reasignar')
  @RequirePermissions('facturacion.cobranza:asignar')
  @ApiOperation({ summary: 'Reasignar una asignación a otro gestor' })
  reasignar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReasignarDto,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.cobranzaService.reasignar(id, dto, id_usuario);
  }

  @Post('asignaciones/:id/cerrar')
  @RequirePermissions('facturacion.cobranza:asignar')
  @ApiOperation({
    summary: 'Cerrar una asignación (PAGADA o INCOBRABLE)',
  })
  cerrar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CerrarAsignacionDto,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.cobranzaService.cerrar(id, dto, id_usuario);
  }

  // ---------------------------------------------------------------------------
  // Vista del gestor
  // ---------------------------------------------------------------------------

  @Get('mis-asignaciones')
  @RequirePermissions('facturacion.cobranza:ver_propias')
  @ApiOperation({
    summary: 'Asignaciones activas del usuario logueado',
  })
  getMisAsignaciones(
    @GetUser('id_usuario') id_usuario: number,
    @Query() query: MisAsignacionesQueryDto,
  ) {
    return this.cobranzaService.getMisAsignaciones(id_usuario, query);
  }

  @Get('asignaciones/:id')
  @RequirePermissions('facturacion.cobranza:ver')
  @ApiOperation({ summary: 'Detalle de una asignación con timeline de notas' })
  getAsignacionDetalle(@Param('id', ParseIntPipe) id: number) {
    return this.cobranzaService.getAsignacionDetalle(id);
  }

  @Get('asignaciones/:id/notas')
  @RequirePermissions('facturacion.cobranza:ver')
  @ApiOperation({ summary: 'Listar notas de una asignación' })
  getNotas(@Param('id', ParseIntPipe) id: number) {
    return this.cobranzaService.getNotas(id);
  }

  @Post('asignaciones/:id/notas')
  @RequirePermissions('facturacion.cobranza:gestionar')
  @ApiOperation({
    summary: 'Registrar una nota de seguimiento',
    description:
      'Tipos: CONTACTO_WHATSAPP, LLAMADA_REALIZADA, VISITA_TECNICA, PROMESA_PAGO, OTRO. PROMESA_PAGO requiere fecha_promesa y monto_promesa.',
  })
  crearNota(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CrearNotaDto,
    @GetUser('id_usuario') id_usuario: number,
  ) {
    return this.cobranzaService.crearNota(id, dto, id_usuario);
  }
}
