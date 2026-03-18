import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { Auth, GetUser } from 'src/modules/auth/decorators';
import { RequirePermissions } from 'src/modules/auth/decorators/require-permissions.decorator';
import { OltService } from './olt.service';
import { InstalarOntDto } from './dto/instalar-ont.dto';
import { CambiarEquipoDto } from './dto/cambiar-equipo.dto';
import { CambiarPlanOntDto } from './dto/cambiar-plan-ont.dto';

@ApiTags('Gestión OLT')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('olt')
@Auth()
export class OltController {
  constructor(private readonly oltService: OltService) {}

  @RequirePermissions('olt.gestion:reiniciar')
  @Post('clientes/:idCliente/reset')
  @ApiOperation({ summary: 'Reiniciar ONT de un cliente' })
  @ApiResponse({ status: 200, description: 'ONT reiniciado exitosamente' })
  resetOnt(
    @Param('idCliente', ParseIntPipe) idCliente: number,
    @GetUser('id_usuario') idUsuario: number,
  ) {
    return this.oltService.resetOnt(idCliente, idUsuario);
  }

  @RequirePermissions('olt.gestion:consultar')
  @Get('clientes/:idCliente/wan-info')
  @ApiOperation({ summary: 'Consultar info WAN del ONT (IP asignada)' })
  @ApiResponse({ status: 200, description: 'Información WAN del ONT' })
  getOntWanInfo(@Param('idCliente', ParseIntPipe) idCliente: number) {
    return this.oltService.getOntWanInfo(idCliente);
  }

  @RequirePermissions('olt.gestion:consultar')
  @Get('clientes/:idCliente/info')
  @ApiOperation({ summary: 'Obtener configuración OLT del cliente' })
  @ApiResponse({ status: 200, description: 'Configuración OLT del cliente' })
  getClienteOltInfo(@Param('idCliente', ParseIntPipe) idCliente: number) {
    return this.oltService.getClienteOltInfo(idCliente);
  }

  @RequirePermissions('olt.gestion:instalar')
  @Post('clientes/:idCliente/instalar')
  @ApiOperation({ summary: 'Instalar ONT nuevo para cliente' })
  @ApiResponse({ status: 201, description: 'ONT instalado exitosamente' })
  instalarOnt(
    @Param('idCliente', ParseIntPipe) idCliente: number,
    @Body() dto: InstalarOntDto,
    @GetUser('id_usuario') idUsuario: number,
  ) {
    dto.idCliente = idCliente;
    return this.oltService.instalarOnt(dto, idUsuario);
  }

  @RequirePermissions('olt.gestion:suspender')
  @Post('clientes/:idCliente/suspender')
  @ApiOperation({ summary: 'Suspender ONT (desactivar servicio)' })
  @ApiResponse({ status: 200, description: 'ONT suspendido exitosamente' })
  suspenderOnt(
    @Param('idCliente', ParseIntPipe) idCliente: number,
    @GetUser('id_usuario') idUsuario: number,
  ) {
    return this.oltService.suspenderOnt(idCliente, idUsuario);
  }

  @RequirePermissions('olt.gestion:activar')
  @Post('clientes/:idCliente/activar')
  @ApiOperation({ summary: 'Activar ONT (reactivar servicio)' })
  @ApiResponse({ status: 200, description: 'ONT activado exitosamente' })
  activarOnt(
    @Param('idCliente', ParseIntPipe) idCliente: number,
    @GetUser('id_usuario') idUsuario: number,
  ) {
    return this.oltService.activarOnt(idCliente, idUsuario);
  }

  @RequirePermissions('olt.gestion:cambiar_equipo')
  @Post('clientes/:idCliente/cambiar-equipo')
  @ApiOperation({ summary: 'Cambiar equipo ONT de un cliente' })
  @ApiResponse({ status: 200, description: 'Equipo cambiado exitosamente' })
  cambiarEquipo(
    @Param('idCliente', ParseIntPipe) idCliente: number,
    @Body() dto: CambiarEquipoDto,
    @GetUser('id_usuario') idUsuario: number,
  ) {
    dto.idCliente = idCliente;
    return this.oltService.cambiarEquipo(dto, idUsuario);
  }

  @RequirePermissions('olt.gestion:cambiar_plan')
  @Post('clientes/:idCliente/cambiar-plan')
  @ApiOperation({ summary: 'Cambiar plan de tráfico del ONT' })
  @ApiResponse({ status: 200, description: 'Plan cambiado exitosamente' })
  cambiarPlan(
    @Param('idCliente', ParseIntPipe) idCliente: number,
    @Body() dto: CambiarPlanOntDto,
    @GetUser('id_usuario') idUsuario: number,
  ) {
    dto.idCliente = idCliente;
    return this.oltService.cambiarPlan(dto, idUsuario);
  }

  @RequirePermissions('olt.gestion:consultar')
  @Get('clientes/:idCliente/historial')
  @ApiOperation({ summary: 'Obtener historial de comandos OLT de un cliente' })
  @ApiResponse({ status: 200, description: 'Historial de comandos' })
  getHistorialComandos(@Param('idCliente', ParseIntPipe) idCliente: number) {
    return this.oltService.getHistorialComandos(idCliente);
  }

  @RequirePermissions('olt.gestion:consultar')
  @Get('clientes/:idCliente/cambios-equipo')
  @ApiOperation({ summary: 'Obtener historial de cambios de equipo' })
  @ApiResponse({ status: 200, description: 'Historial de cambios de equipo' })
  getHistorialCambioEquipo(
    @Param('idCliente', ParseIntPipe) idCliente: number,
  ) {
    return this.oltService.getHistorialCambioEquipo(idCliente);
  }

  @RequirePermissions('olt.gestion:consultar')
  @Get('tarjetas')
  @ApiOperation({ summary: 'Listar tarjetas OLT' })
  @ApiResponse({ status: 200, description: 'Lista de tarjetas' })
  getTarjetas() {
    return this.oltService.getTarjetas();
  }

  @RequirePermissions('olt.gestion:consultar')
  @Get('modelos')
  @ApiOperation({ summary: 'Listar modelos de ONT' })
  @ApiResponse({ status: 200, description: 'Lista de modelos' })
  getModelos() {
    return this.oltService.getModelos();
  }

  @RequirePermissions('olt.gestion:consultar')
  @Get('perfiles-trafico')
  @ApiOperation({ summary: 'Listar perfiles de tráfico' })
  @ApiResponse({ status: 200, description: 'Lista de perfiles de tráfico' })
  getPerfilesTrafico() {
    return this.oltService.getPerfilesTrafico();
  }

  @RequirePermissions('olt.gestion:consultar')
  @Get('disponibles/:idTarjeta/:port')
  @ApiOperation({ summary: 'Obtener ONT IDs y service ports disponibles' })
  @ApiResponse({ status: 200, description: 'ONTs y service ports disponibles' })
  getDisponibles(
    @Param('idTarjeta', ParseIntPipe) idTarjeta: number,
    @Param('port', ParseIntPipe) port: number,
  ) {
    return this.oltService.getDisponibles(idTarjeta, port);
  }
}
