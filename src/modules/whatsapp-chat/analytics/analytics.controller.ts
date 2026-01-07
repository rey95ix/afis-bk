import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { Auth } from 'src/modules/auth/decorators';
import { RequirePermissions } from 'src/modules/auth/decorators/require-permissions.decorator';

@ApiTags('WhatsApp Analytics')
@Controller('api/atencion-al-cliente/whatsapp-chat/analytics')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Auth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @RequirePermissions('atencion_cliente.whatsapp_chat:ver')
  @Get('overview')
  @ApiOperation({
    summary: 'Obtener métricas generales',
    description: 'Obtiene un resumen de métricas de todos los chats.',
  })
  @ApiQuery({
    name: 'desde',
    required: false,
    description: 'Fecha de inicio (ISO string)',
  })
  @ApiQuery({
    name: 'hasta',
    required: false,
    description: 'Fecha de fin (ISO string)',
  })
  @ApiResponse({
    status: 200,
    description: 'Métricas generales',
  })
  getOverview(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.analyticsService.getOverview({ desde, hasta });
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:ver')
  @Get('agent-performance')
  @ApiOperation({
    summary: 'Rendimiento por agente',
    description: 'Obtiene estadísticas de rendimiento por cada agente.',
  })
  @ApiQuery({
    name: 'desde',
    required: false,
    description: 'Fecha de inicio (ISO string)',
  })
  @ApiQuery({
    name: 'hasta',
    required: false,
    description: 'Fecha de fin (ISO string)',
  })
  @ApiResponse({
    status: 200,
    description: 'Rendimiento por agente',
  })
  getAgentPerformance(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.analyticsService.getAgentPerformance({ desde, hasta });
  }

  @RequirePermissions('atencion_cliente.whatsapp_ia:ver')
  @Get('ia-stats')
  @ApiOperation({
    summary: 'Estadísticas de IA',
    description: 'Obtiene estadísticas de uso y rendimiento de la IA.',
  })
  @ApiQuery({
    name: 'desde',
    required: false,
    description: 'Fecha de inicio (ISO string)',
  })
  @ApiQuery({
    name: 'hasta',
    required: false,
    description: 'Fecha de fin (ISO string)',
  })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas de IA',
  })
  getIAStats(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.analyticsService.getIAStats({ desde, hasta });
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:ver')
  @Get('chat/:chatId')
  @ApiOperation({
    summary: 'Métricas de un chat',
    description: 'Obtiene las métricas detalladas de un chat específico.',
  })
  @ApiParam({
    name: 'chatId',
    description: 'ID del chat',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Métricas del chat',
  })
  getChatMetrics(@Param('chatId', ParseIntPipe) chatId: number) {
    return this.analyticsService.getChatMetrics(chatId);
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:ver')
  @Get('trends')
  @ApiOperation({
    summary: 'Tendencias de chats',
    description: 'Obtiene tendencias de chats por período de tiempo.',
  })
  @ApiQuery({
    name: 'periodo',
    required: false,
    enum: ['dia', 'semana', 'mes'],
    description: 'Período de análisis',
  })
  @ApiResponse({
    status: 200,
    description: 'Tendencias',
  })
  getTrends(@Query('periodo') periodo?: 'dia' | 'semana' | 'mes') {
    return this.analyticsService.getTrends(periodo);
  }
}
