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

@ApiTags('Catálogos')
@Controller('api/catalogos')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Auth()
export class CatalogosController {
  constructor(private readonly catalogosService: CatalogosService) {}

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
}
