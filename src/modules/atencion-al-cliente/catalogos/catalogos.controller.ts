import { Controller, Get, UseGuards } from '@nestjs/common';
import { CatalogosService } from './catalogos.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger'; 
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { Auth } from 'src/modules/auth/decorators';
import { RequirePermissions } from 'src/modules/auth/decorators/require-permissions.decorator';

@ApiTags('Catálogos')
@Controller('api/catalogos')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Auth()
export class CatalogosController {
  constructor(private readonly catalogosService: CatalogosService) {}

  @RequirePermissions('atencion_cliente.catalogos:ver')
  @Get('diagnosticos')
  @ApiOperation({
    summary: 'Obtener catálogo de diagnósticos',
    description:
      'Obtiene la lista de diagnósticos estandarizados disponibles para clasificar problemas técnicos (ej: LOS_ROJO, POTENCIA_BAJA, CPE_SIN_IP).',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de diagnósticos obtenida exitosamente',
  })
  getDiagnosticos() {
    return this.catalogosService.getDiagnosticos();
  }

  @RequirePermissions('atencion_cliente.catalogos:ver')
  @Get('soluciones')
  @ApiOperation({
    summary: 'Obtener catálogo de soluciones',
    description:
      'Obtiene la lista de soluciones estandarizadas aplicables en visitas técnicas (ej: REEMPLAZO_ONU, RECONECTOR, AJUSTE_POTENCIA).',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de soluciones obtenida exitosamente',
  })
  getSoluciones() {
    return this.catalogosService.getSoluciones();
  }

  @RequirePermissions('atencion_cliente.catalogos:ver')
  @Get('motivos-cierre')
  @ApiOperation({
    summary: 'Obtener catálogo de motivos de cierre',
    description:
      'Obtiene la lista de motivos estandarizados para cerrar órdenes de trabajo (ej: resuelto, reprogramado, cliente ausente).',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de motivos de cierre obtenida exitosamente',
  })
  getMotivosCierre() {
    return this.catalogosService.getMotivosCierre();
  }

  @RequirePermissions('atencion_cliente.catalogos:ver')
  @Get('tecnicos')
  @ApiOperation({
    summary: 'Obtener lista de técnicos disponibles',
    description:
      'Obtiene la lista de usuarios activos que pueden ser asignados como técnicos a órdenes de trabajo.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de técnicos obtenida exitosamente',
  })
  getTecnicos() {
    return this.catalogosService.getTecnicos();
  }

  @RequirePermissions('atencion_cliente.catalogos:ver')
  @Get('tipos-orden')
  @ApiOperation({
    summary: 'Obtener tipos de orden de trabajo',
    description:
      'Obtiene la lista de tipos de orden disponibles (INCIDENCIA, INSTALACION, MANTENIMIENTO, REUBICACION, RETIRO, MEJORA).',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de tipos de orden obtenida exitosamente',
  })
  getTiposOrden() {
    return this.catalogosService.getTiposOrden();
  }

  @RequirePermissions('atencion_cliente.catalogos:ver')
  @Get('estados-orden')
  @ApiOperation({
    summary: 'Obtener estados de orden de trabajo',
    description:
      'Obtiene la lista de estados posibles de una orden de trabajo (PENDIENTE_ASIGNACION, ASIGNADA, AGENDADA, etc.).',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de estados obtenida exitosamente',
  })
  getEstadosOrden() {
    return this.catalogosService.getEstadosOrden();
  }

  // ============= CATÁLOGOS DE CONTRATOS =============

  @RequirePermissions('atencion_cliente.catalogos:ver')
  @Get('tipos-servicio')
  @ApiOperation({
    summary: 'Obtener tipos de servicio',
    description:
      'Obtiene la lista de tipos de servicio disponibles (Residencial, Corporativo, Otro).',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de tipos de servicio obtenida exitosamente',
  })
  getTiposServicio() {
    return this.catalogosService.getTiposServicio();
  }

  @RequirePermissions('atencion_cliente.catalogos:ver')
  @Get('tipos-plan')
  @ApiOperation({
    summary: 'Obtener tipos de plan',
    description:
      'Obtiene la lista de tipos de plan disponibles (Internet Residencial, CATV Corporativo, etc.).',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de tipos de plan obtenida exitosamente',
  })
  getTiposPlan() {
    return this.catalogosService.getTiposPlan();
  }

  @RequirePermissions('atencion_cliente.catalogos:ver')
  @Get('planes')
  @ApiOperation({
    summary: 'Obtener planes de servicio',
    description:
      'Obtiene la lista de planes de servicio activos con precios, velocidades y tipo de plan.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de planes obtenida exitosamente',
  })
  getPlanes() {
    return this.catalogosService.getPlanes();
  }

  @RequirePermissions('atencion_cliente.catalogos:ver')
  @Get('ciclos-facturacion')
  @ApiOperation({
    summary: 'Obtener ciclos de facturación',
    description:
      'Obtiene la lista de ciclos de facturación disponibles con días de corte y vencimiento.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de ciclos de facturación obtenida exitosamente',
  })
  getCiclosFacturacion() {
    return this.catalogosService.getCiclosFacturacion();
  }

  @RequirePermissions('atencion_cliente.catalogos:ver')
  @Get('estados-contrato')
  @ApiOperation({
    summary: 'Obtener estados de contrato',
    description:
      'Obtiene la lista de estados posibles de un contrato (PENDIENTE_INSTALACION, INSTALADO_ACTIVO, SUSPENDIDO, etc.).',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de estados de contrato obtenida exitosamente',
  })
  getEstadosContrato() {
    return this.catalogosService.getEstadosContrato();
  }
}
