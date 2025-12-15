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
  Query,
} from '@nestjs/common';
import { IaRuleService } from './ia-rule.service';
import { RuleEngineService } from './rule-engine.service';
import { CreateIaRuleDto, UpdateIaRuleDto, TestRuleDto } from './dto';
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

@ApiTags('WhatsApp IA Rules')
@Controller('api/atencion-al-cliente/whatsapp-chat/ia-rules')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Auth()
export class IaRuleController {
  constructor(
    private readonly iaRuleService: IaRuleService,
    private readonly ruleEngineService: RuleEngineService,
  ) {}

  @RequirePermissions('atencion_cliente.whatsapp_ia:configurar')
  @Post()
  @ApiOperation({
    summary: 'Crear regla de IA',
    description: 'Crea una nueva regla para el motor de IA.',
  })
  @ApiResponse({
    status: 201,
    description: 'Regla creada exitosamente',
  })
  create(@Body() createDto: CreateIaRuleDto, @Request() req) {
    return this.iaRuleService.create(createDto, req.user.id_usuario);
  }

  @RequirePermissions('atencion_cliente.whatsapp_ia:ver')
  @Get()
  @ApiOperation({
    summary: 'Listar reglas de una configuración',
    description: 'Obtiene todas las reglas de una configuración específica.',
  })
  @ApiQuery({
    name: 'config_id',
    required: true,
    description: 'ID de la configuración',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de reglas',
  })
  findAllByConfig(@Query('config_id', ParseIntPipe) configId: number) {
    return this.iaRuleService.findAllByConfig(configId);
  }

  @RequirePermissions('atencion_cliente.whatsapp_ia:ver')
  @Get('active')
  @ApiOperation({
    summary: 'Listar reglas activas',
    description: 'Obtiene todas las reglas activas de configuraciones activas.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de reglas activas',
  })
  findAllActive() {
    return this.iaRuleService.findAllActive();
  }

  @RequirePermissions('atencion_cliente.whatsapp_ia:ver')
  @Get(':id')
  @ApiOperation({
    summary: 'Obtener regla por ID',
    description: 'Obtiene los detalles de una regla específica.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la regla',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Regla encontrada',
  })
  @ApiResponse({
    status: 404,
    description: 'Regla no encontrada',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.iaRuleService.findOne(id);
  }

  @RequirePermissions('atencion_cliente.whatsapp_ia:configurar')
  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar regla',
    description: 'Actualiza una regla de IA existente.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la regla',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Regla actualizada',
  })
  @ApiResponse({
    status: 404,
    description: 'Regla no encontrada',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateIaRuleDto,
    @Request() req,
  ) {
    return this.iaRuleService.update(id, updateDto, req.user.id_usuario);
  }

  @RequirePermissions('atencion_cliente.whatsapp_ia:configurar')
  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar regla',
    description: 'Elimina una regla de IA.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la regla',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Regla eliminada',
  })
  @ApiResponse({
    status: 404,
    description: 'Regla no encontrada',
  })
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.iaRuleService.remove(id, req.user.id_usuario);
  }

  @RequirePermissions('atencion_cliente.whatsapp_ia:configurar')
  @Post('reorder')
  @ApiOperation({
    summary: 'Reordenar reglas',
    description: 'Actualiza las prioridades de las reglas según el orden dado.',
  })
  @ApiResponse({
    status: 200,
    description: 'Reglas reordenadas',
  })
  reorder(
    @Body() body: { config_id: number; rule_ids: number[] },
    @Request() req,
  ) {
    return this.iaRuleService.reorder(
      body.config_id,
      body.rule_ids,
      req.user.id_usuario,
    );
  }

  @RequirePermissions('atencion_cliente.whatsapp_ia:configurar')
  @Post(':id/duplicate')
  @ApiOperation({
    summary: 'Duplicar regla',
    description: 'Crea una copia de una regla existente.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la regla',
    example: 1,
  })
  @ApiResponse({
    status: 201,
    description: 'Regla duplicada',
  })
  duplicate(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.iaRuleService.duplicate(id, req.user.id_usuario);
  }

  @RequirePermissions('atencion_cliente.whatsapp_ia:configurar')
  @Post('test')
  @ApiOperation({
    summary: 'Probar reglas',
    description: 'Evalúa un mensaje contra las reglas activas.',
  })
  @ApiResponse({
    status: 200,
    description: 'Resultado de la evaluación',
  })
  async testRules(@Body() testDto: TestRuleDto) {
    const result = await this.ruleEngineService.evaluateMessage({
      contenido: testDto.mensaje,
      chatId: testDto.id_chat || 0,
    });

    return {
      match: result !== null,
      rule: result
        ? {
            id: result.ruleId,
            name: result.ruleName,
            actions: result.actions,
          }
        : null,
    };
  }
}
