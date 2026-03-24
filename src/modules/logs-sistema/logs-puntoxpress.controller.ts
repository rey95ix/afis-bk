import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { Auth } from 'src/modules/auth/decorators';
import { RequirePermissions } from 'src/modules/auth/decorators/require-permissions.decorator';
import { LogsPuntoxpressService } from './logs-puntoxpress.service';
import { QueryPuntoxpressLegacyLogDto } from './dto';

@ApiTags('Logs')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('api/logs')
@Auth()
export class LogsPuntoxpressController {
  constructor(private readonly service: LogsPuntoxpressService) {}

  @Get('punto-xpress')
  @RequirePermissions('logs.punto_xpress:ver')
  @ApiOperation({
    summary: 'Obtener logs de PuntoXpress Legacy',
    description:
      'Retorna lista paginada de logs del endpoint legacy con filtros por método, código de respuesta, IP y rango de fechas',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de logs obtenida exitosamente',
  })
  findAll(@Query() queryDto: QueryPuntoxpressLegacyLogDto) {
    return this.service.findAll(queryDto);
  }
}
