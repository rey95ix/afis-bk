import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { TemplateService } from './template.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { CreateMetaTemplateDto } from './dto/create-meta-template.dto';
import { UpdateMetaTemplateDto } from './dto/update-meta-template.dto';
import { Auth } from '../../../auth/decorators';
import { RequirePermissions } from '../../../auth/decorators/require-permissions.decorator';
import { HEADER_API_BEARER_AUTH } from '../../../../common/const';

@ApiTags('WhatsApp Templates')
@Controller('api/atencion-al-cliente/whatsapp-chat/templates')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Auth()
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @RequirePermissions('atencion_cliente.whatsapp_chat:crear')
  @Post()
  @ApiOperation({
    summary: 'Crear una nueva plantilla',
    description: 'Registra manualmente una plantilla aprobada por Meta.',
  })
  @ApiResponse({ status: 201, description: 'Plantilla creada exitosamente' })
  @ApiResponse({ status: 400, description: 'Ya existe una plantilla con ese nombre' })
  create(@Body() createTemplateDto: CreateTemplateDto) {
    return this.templateService.create(createTemplateDto);
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:ver')
  @Get()
  @ApiOperation({
    summary: 'Listar todas las plantillas',
    description: 'Obtiene todas las plantillas registradas con opciones de filtrado.',
  })
  @ApiQuery({ name: 'categoria', required: false, description: 'Filtrar por categoría' })
  @ApiQuery({ name: 'estado', required: false, description: 'Filtrar por estado' })
  @ApiQuery({ name: 'activo', required: false, description: 'Filtrar por estado activo' })
  @ApiResponse({ status: 200, description: 'Lista de plantillas' })
  findAll(
    @Query('categoria') categoria?: string,
    @Query('estado') estado?: string,
    @Query('activo') activo?: string,
  ) {
    return this.templateService.findAll({
      categoria,
      estado,
      activo: activo !== undefined ? activo === 'true' : undefined,
    });
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:ver')
  @Get('approved')
  @ApiOperation({
    summary: 'Listar plantillas aprobadas',
    description: 'Obtiene solo las plantillas aprobadas y activas para uso en chats.',
  })
  @ApiResponse({ status: 200, description: 'Lista de plantillas aprobadas' })
  findApproved() {
    return this.templateService.findApproved();
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:ver')
  @Get(':id')
  @ApiOperation({
    summary: 'Obtener una plantilla',
    description: 'Obtiene los detalles de una plantilla por su ID.',
  })
  @ApiParam({ name: 'id', description: 'ID de la plantilla' })
  @ApiResponse({ status: 200, description: 'Plantilla encontrada' })
  @ApiResponse({ status: 404, description: 'Plantilla no encontrada' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.templateService.findOne(id);
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:editar')
  @Put(':id')
  @ApiOperation({
    summary: 'Actualizar una plantilla',
    description: 'Actualiza los datos de una plantilla existente.',
  })
  @ApiParam({ name: 'id', description: 'ID de la plantilla' })
  @ApiResponse({ status: 200, description: 'Plantilla actualizada' })
  @ApiResponse({ status: 404, description: 'Plantilla no encontrada' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTemplateDto: UpdateTemplateDto,
  ) {
    return this.templateService.update(id, updateTemplateDto);
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:eliminar')
  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar una plantilla',
    description: 'Elimina una plantilla del sistema.',
  })
  @ApiParam({ name: 'id', description: 'ID de la plantilla' })
  @ApiResponse({ status: 200, description: 'Plantilla eliminada' })
  @ApiResponse({ status: 404, description: 'Plantilla no encontrada' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.templateService.remove(id);
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:ver')
  @Post(':id/preview')
  @ApiOperation({
    summary: 'Preview de plantilla',
    description: 'Genera una vista previa de cómo se verá la plantilla con los parámetros dados.',
  })
  @ApiParam({ name: 'id', description: 'ID de la plantilla' })
  @ApiResponse({ status: 200, description: 'Preview generado' })
  @ApiResponse({ status: 404, description: 'Plantilla no encontrada' })
  async preview(
    @Param('id', ParseIntPipe) id: number,
    @Body('parametros') parametros: Record<string, string>,
  ) {
    const template = await this.templateService.findOne(id);
    return this.templateService.previewTemplate(template, parametros || {});
  }

  // ==================== META API ENDPOINTS ====================

  @RequirePermissions('atencion_cliente.whatsapp_chat:crear')
  @Post('meta')
  @ApiOperation({
    summary: 'Crear plantilla en Meta',
    description: 'Crea una nueva plantilla directamente en Meta WhatsApp Business API y la guarda localmente.',
  })
  @ApiResponse({ status: 201, description: 'Plantilla creada en Meta' })
  @ApiResponse({ status: 400, description: 'Error de validación o Meta API' })
  createInMeta(@Body() dto: CreateMetaTemplateDto) {
    return this.templateService.createInMeta(dto);
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:editar')
  @Put(':id/meta')
  @ApiOperation({
    summary: 'Editar plantilla en Meta',
    description: 'Actualiza una plantilla existente en Meta. Solo se pueden modificar los componentes, no el nombre ni la categoría.',
  })
  @ApiParam({ name: 'id', description: 'ID de la plantilla local' })
  @ApiResponse({ status: 200, description: 'Plantilla actualizada en Meta' })
  @ApiResponse({ status: 400, description: 'Error de validación o Meta API' })
  @ApiResponse({ status: 404, description: 'Plantilla no encontrada' })
  updateInMeta(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMetaTemplateDto,
  ) {
    return this.templateService.updateInMeta(id, dto);
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:eliminar')
  @Delete(':id/meta')
  @ApiOperation({
    summary: 'Eliminar plantilla de Meta',
    description: 'Elimina una plantilla de Meta WhatsApp Business API y de la base de datos local.',
  })
  @ApiParam({ name: 'id', description: 'ID de la plantilla' })
  @ApiResponse({ status: 200, description: 'Plantilla eliminada de Meta' })
  @ApiResponse({ status: 404, description: 'Plantilla no encontrada' })
  deleteFromMeta(@Param('id', ParseIntPipe) id: number) {
    return this.templateService.deleteFromMeta(id);
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:ver')
  @Get('sync')
  @ApiOperation({
    summary: 'Sincronizar plantillas desde Meta',
    description: 'Obtiene todas las plantillas de Meta WhatsApp Business API y las sincroniza con la base de datos local.',
  })
  @ApiResponse({
    status: 200,
    description: 'Resultado de la sincronización',
    schema: {
      type: 'object',
      properties: {
        created: { type: 'number', description: 'Plantillas creadas' },
        updated: { type: 'number', description: 'Plantillas actualizadas' },
        errors: { type: 'array', items: { type: 'string' }, description: 'Errores encontrados' },
      },
    },
  })
  syncFromMeta() {
    return this.templateService.syncFromMeta();
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:ver')
  @Get(':id/sync')
  @ApiOperation({
    summary: 'Sincronizar una plantilla desde Meta',
    description: 'Actualiza el estado y componentes de una plantilla específica desde Meta.',
  })
  @ApiParam({ name: 'id', description: 'ID de la plantilla' })
  @ApiResponse({ status: 200, description: 'Plantilla sincronizada' })
  @ApiResponse({ status: 400, description: 'La plantilla no tiene ID de Meta' })
  @ApiResponse({ status: 404, description: 'Plantilla no encontrada' })
  syncOneFromMeta(@Param('id', ParseIntPipe) id: number) {
    return this.templateService.syncOneFromMeta(id);
  }
}
