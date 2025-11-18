import {
  Controller,
  Get,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { AgendaService } from './agenda.service';
import { QueryAgendaDto } from './dto/query-agenda.dto';
import { UpdateAgendaDto } from './dto/update-agenda.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger'; 
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { Auth } from 'src/modules/auth/decorators';
import { RequirePermissions } from 'src/modules/auth/decorators/require-permissions.decorator';

@ApiTags('Agenda de Visitas')
@Controller('api/agenda')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Auth()
export class AgendaController {
  constructor(private readonly agendaService: AgendaService) {}

  @RequirePermissions('atencion_cliente.agenda:ver')
  @Get()
  @ApiOperation({
    summary: 'Obtener agendas con filtros',
    description:
      'Obtiene una lista de agendas de visitas técnicas con opciones de filtrado por técnico, rango de fechas y estado activo/inactivo.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de agendas obtenida exitosamente',
  })
  findAll(@Query() queryDto: QueryAgendaDto) {
    return this.agendaService.findAll(queryDto);
  }

  @RequirePermissions('atencion_cliente.agenda:editar')
  @Put(':id')
  @ApiOperation({
    summary: 'Modificar una agenda de visita',
    description:
      'Permite modificar fecha de inicio, fin, técnico asignado y agregar un motivo del cambio. Solo se pueden modificar agendas activas.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la agenda',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Agenda actualizada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'No se puede modificar una agenda inactiva o datos inválidos',
  })
  @ApiResponse({
    status: 404,
    description: 'Agenda no encontrada',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAgendaDto: UpdateAgendaDto,
    @Request() req,
  ) {
    return this.agendaService.update(id, updateAgendaDto, req.user.id_usuario);
  }
}
