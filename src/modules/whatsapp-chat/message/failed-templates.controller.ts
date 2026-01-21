import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
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
import { MessageService } from './message.service';
import { QueryFailedTemplatesDto, ResendTemplateDto } from './dto';

@ApiTags('WhatsApp Chat - Templates Fallidos')
@Controller('api/atencion-al-cliente/whatsapp-chat/failed-templates')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Auth()
export class FailedTemplatesController {
  constructor(private readonly messageService: MessageService) {}

  @RequirePermissions('atencion_cliente.whatsapp_failed_templates:ver')
  @Get()
  @ApiOperation({
    summary: 'Listar templates fallidos',
    description: 'Lista todos los mensajes de plantilla que fallaron al enviarse, con filtros y paginación.',
  })
  @ApiResponse({ status: 200, description: 'Lista de templates fallidos obtenida exitosamente' })
  findAll(@Query() query: QueryFailedTemplatesDto) {
    return this.messageService.getFailedTemplates(query);
  }

  @RequirePermissions('atencion_cliente.whatsapp_failed_templates:ver')
  @Get('stats')
  @ApiOperation({
    summary: 'Obtener estadísticas de templates fallidos',
    description: 'Obtiene estadísticas de templates fallidos (total, últimos 7 días, por código de error).',
  })
  @ApiResponse({ status: 200, description: 'Estadísticas obtenidas exitosamente' })
  getStats() {
    return this.messageService.getFailedTemplatesStats();
  }

  @RequirePermissions('atencion_cliente.whatsapp_failed_templates:reenviar')
  @Post(':id/resend')
  @ApiOperation({
    summary: 'Reenviar template fallido',
    description: 'Reintenta enviar un template que falló previamente. Opcionalmente permite sobrescribir los parámetros.',
  })
  @ApiParam({ name: 'id', description: 'ID del mensaje del template fallido' })
  @ApiResponse({ status: 201, description: 'Template reenviado exitosamente' })
  @ApiResponse({ status: 400, description: 'El mensaje no es un template fallido o ya fue reenviado' })
  @ApiResponse({ status: 404, description: 'Mensaje no encontrado' })
  resend(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResendTemplateDto,
    @Request() req,
  ) {
    return this.messageService.resendFailedTemplate(id, dto, req.user.id_usuario);
  }
}
