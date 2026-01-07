import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { IaConfigService } from './ia-config.service';
import { OpenAIChatService } from './openai-chat.service';
import { CreateIaConfigDto, UpdateIaConfigDto, TestIaDto } from './dto';
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

@ApiTags('WhatsApp IA Config')
@Controller('api/atencion-al-cliente/whatsapp-chat/ia-config')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Auth()
export class IaConfigController {
  constructor(
    private readonly iaConfigService: IaConfigService,
    private readonly openaiChatService: OpenAIChatService,
  ) {}

  @RequirePermissions('atencion_cliente.whatsapp_ia:configurar')
  @Post()
  @ApiOperation({
    summary: 'Crear configuración de IA',
    description: 'Crea una nueva configuración para el asistente de IA.',
  })
  @ApiResponse({
    status: 201,
    description: 'Configuración creada exitosamente',
  })
  create(@Body() createDto: CreateIaConfigDto, @Request() req) {
    return this.iaConfigService.create(createDto, req.user.id_usuario);
  }

  @RequirePermissions('atencion_cliente.whatsapp_ia:ver')
  @Get()
  @ApiOperation({
    summary: 'Listar configuraciones de IA',
    description: 'Obtiene todas las configuraciones de IA.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de configuraciones',
  })
  findAll() {
    return this.iaConfigService.findAll();
  }

  @RequirePermissions('atencion_cliente.whatsapp_ia:ver')
  @Get('active')
  @ApiOperation({
    summary: 'Obtener configuración activa',
    description: 'Obtiene la configuración de IA actualmente activa.',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuración activa',
  })
  @ApiResponse({
    status: 404,
    description: 'No hay configuración activa',
  })
  getActive() {
    return this.iaConfigService.getActive();
  }

  @RequirePermissions('atencion_cliente.whatsapp_ia:ver')
  @Get(':id')
  @ApiOperation({
    summary: 'Obtener configuración por ID',
    description: 'Obtiene los detalles de una configuración específica.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la configuración',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Configuración encontrada',
  })
  @ApiResponse({
    status: 404,
    description: 'Configuración no encontrada',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.iaConfigService.findOne(id);
  }

  @RequirePermissions('atencion_cliente.whatsapp_ia:configurar')
  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar configuración',
    description: 'Actualiza una configuración de IA existente.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la configuración',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Configuración actualizada',
  })
  @ApiResponse({
    status: 404,
    description: 'Configuración no encontrada',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateIaConfigDto,
    @Request() req,
  ) {
    return this.iaConfigService.update(id, updateDto, req.user.id_usuario);
  }

  @RequirePermissions('atencion_cliente.whatsapp_ia:configurar')
  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar configuración',
    description: 'Elimina una configuración de IA.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la configuración',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Configuración eliminada',
  })
  @ApiResponse({
    status: 400,
    description: 'No se puede eliminar configuración activa',
  })
  @ApiResponse({
    status: 404,
    description: 'Configuración no encontrada',
  })
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.iaConfigService.remove(id, req.user.id_usuario);
  }

  @RequirePermissions('atencion_cliente.whatsapp_ia:configurar')
  @Post(':id/activate')
  @ApiOperation({
    summary: 'Activar configuración',
    description: 'Activa una configuración y desactiva las demás.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la configuración',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Configuración activada',
  })
  activate(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.iaConfigService.activate(id, req.user.id_usuario);
  }

  @RequirePermissions('atencion_cliente.whatsapp_ia:configurar')
  @Post(':id/duplicate')
  @ApiOperation({
    summary: 'Duplicar configuración',
    description: 'Crea una copia de una configuración existente.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la configuración',
    example: 1,
  })
  @ApiResponse({
    status: 201,
    description: 'Configuración duplicada',
  })
  duplicate(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.iaConfigService.duplicate(id, req.user.id_usuario);
  }

  @RequirePermissions('atencion_cliente.whatsapp_ia:configurar')
  @Post('test')
  @ApiOperation({
    summary: 'Probar IA',
    description: 'Envía un mensaje de prueba a la IA y obtiene una respuesta.',
  })
  @ApiResponse({
    status: 200,
    description: 'Respuesta de la IA',
  })
  testIa(@Body() testDto: TestIaDto) {
    return this.openaiChatService.testConfiguration(
      testDto.mensaje,
      testDto.id_config,
      testDto.historial,
    );
  }
}
