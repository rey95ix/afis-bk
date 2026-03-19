import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import { MigrationService } from './migration.service';
import {
  MigrationModule,
  MigrationOptionsDto,
  ExecuteAllDto,
  MigrateClienteOptionsDto,
} from './dto/migration-config.dto';
import { SingleClienteMigrationResult, IdCollisionCheckResult, CleanupAllResult } from './interfaces/mapping.interface';
import {
  MigrationStatusDto,
  ConnectionValidationDto,
  MigrationModuleResultDto,
  MigrationPreviewDto,
  MigrationLogsResponseDto,
  BulkClienteMigrationResultDto,
} from './dto/migration-result.dto';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';

@ApiTags('Migration')
@Controller('migration')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
export class MigrationController {
  constructor(private readonly migrationService: MigrationService) {}

  @Post('validate')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validar conexiones',
    description: 'Valida las conexiones a MySQL (origen) y PostgreSQL (destino)',
  })
  @ApiResponse({
    status: 200,
    description: 'Resultado de validación',
    type: ConnectionValidationDto,
  })
  async validate(): Promise<ConnectionValidationDto> {
    return this.migrationService.validateConnections();
  }

  @Get('status')
  @Auth()
  @ApiOperation({
    summary: 'Estado de migración',
    description: 'Obtiene el estado actual de la migración',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado actual',
    type: MigrationStatusDto,
  })
  getStatus(): MigrationStatusDto {
    return this.migrationService.getStatus() as MigrationStatusDto;
  }

  @Get('logs')
  @Auth()
  @ApiOperation({
    summary: 'Logs de migración',
    description: 'Obtiene los logs de la migración',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Límite de logs' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Offset para paginación' })
  @ApiResponse({
    status: 200,
    description: 'Logs de migración',
    type: MigrationLogsResponseDto,
  })
  getLogs(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): MigrationLogsResponseDto {
    return this.migrationService.getLogs(
      limit || 100,
      offset || 0,
    ) as MigrationLogsResponseDto;
  }

  @Get('mapping-stats')
  @Auth()
  @ApiOperation({
    summary: 'Estadísticas de mapeo',
    description: 'Obtiene estadísticas de los IDs mapeados',
  })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas de mapeo',
  })
  getMappingStats(): Record<string, number> {
    return this.migrationService.getMappingStats();
  }

  @Get('preview/:module')
  @Auth()
  @ApiOperation({
    summary: 'Preview de módulo',
    description: 'Obtiene un preview de los datos a migrar en un módulo',
  })
  @ApiParam({
    name: 'module',
    enum: MigrationModule,
    description: 'Módulo a previsualizar',
  })
  @ApiResponse({
    status: 200,
    description: 'Preview del módulo',
    type: MigrationPreviewDto,
  })
  async getPreview(
    @Param('module') module: MigrationModule,
  ): Promise<unknown> {
    return {
      module,
      data: await this.migrationService.getPreview(module),
    };
  }

  @Post('execute/:module')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ejecutar migración de módulo',
    description: 'Ejecuta la migración de un módulo específico',
  })
  @ApiParam({
    name: 'module',
    enum: MigrationModule,
    description: 'Módulo a migrar',
  })
  @ApiResponse({
    status: 200,
    description: 'Resultado de migración',
    type: MigrationModuleResultDto,
  })
  async executeModule(
    @Param('module') module: MigrationModule,
    @Body() options: MigrationOptionsDto,
  ): Promise<MigrationModuleResultDto> {
    // Módulos que ahora se ejecutan dentro del pipeline unificado de clientes
    const deprecatedModules = [MigrationModule.CONTRATOS, MigrationModule.DOCUMENTOS, MigrationModule.FACTURACION];
    if (deprecatedModules.includes(module)) {
      return {
        module,
        success: true,
        totalRecords: 0,
        migratedRecords: 0,
        skippedRecords: 0,
        errors: [],
        duration: 0,
        startedAt: new Date(),
        completedAt: new Date(),
        warning: 'Este módulo se ejecuta automáticamente con la migración de clientes. Use el módulo "clientes" para ejecutar el pipeline completo.',
      } as any;
    }

    const result = await this.migrationService.executeModule(module, {
      batchSize: options.batchSize || 100,
      skipExisting: options.skipExisting ?? true,
      dryRun: options.dryRun ?? false,
      continueOnError: options.continueOnError ?? true,
      maxRetries: options.maxRetries || 3,
      concurrency: options.concurrency,
      cleanBeforeMigration: options.cleanBeforeMigration,
    });
    return result as unknown as MigrationModuleResultDto;
  }

  @Post('execute-all')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ejecutar migración completa',
    description: 'Ejecuta la migración de todos los módulos en orden de dependencias',
  })
  @ApiResponse({
    status: 200,
    description: 'Resultados de migración',
    type: [MigrationModuleResultDto],
  })
  async executeAll(
    @Body() options: ExecuteAllDto,
  ): Promise<MigrationModuleResultDto[]> {
    const results = await this.migrationService.executeAll(
      {
        batchSize: options.batchSize || 100,
        skipExisting: options.skipExisting ?? true,
        dryRun: options.dryRun ?? false,
        continueOnError: options.continueOnError ?? true,
        maxRetries: options.maxRetries || 3,
        concurrency: options.concurrency,
        cleanBeforeMigration: options.cleanBeforeMigration,
      },
      options.excludeModules,
    );
    return results as unknown as MigrationModuleResultDto[];
  }

  @Post('reset')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resetear estado',
    description: 'Resetea el estado de la migración y los mapeos',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado reseteado',
  })
  resetStatus(): { message: string } {
    this.migrationService.resetStatus();
    return { message: 'Estado de migración reseteado' };
  }

  @Get('clientes/collision-check')
  @Auth()
  @ApiOperation({
    summary: 'Pre-check de colisiones de IDs',
    description: 'Detecta colisiones entre IDs de MySQL y PostgreSQL antes de migrar con IDs preservados',
  })
  @ApiResponse({
    status: 200,
    description: 'Resultado del análisis de colisiones',
  })
  async checkClienteIdCollisions(): Promise<IdCollisionCheckResult> {
    return this.migrationService.checkClienteIdCollisions();
  }

  @Post('cleanup-clientes')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Limpiar todos los datos de clientes',
    description: 'Elimina todos los clientes y sus datos dependientes de PostgreSQL. Operación destructiva que requiere confirmación.',
  })
  @ApiResponse({
    status: 200,
    description: 'Resultado de la limpieza masiva',
  })
  async cleanupAllClientes(
    @Body() body: { confirm: boolean; concurrency?: number },
  ): Promise<CleanupAllResult> {
    if (!body.confirm) {
      throw new BadRequestException('Debe enviar confirm=true para ejecutar la limpieza masiva');
    }
    return this.migrationService.cleanupAllClientes(body.concurrency);
  }

  @Post('cliente/:idCustomer')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Migrar cliente individual',
    description: 'Migra un cliente específico desde MySQL hacia PostgreSQL por su ID. Incluye opcionalmente contratos, documentos y facturas.',
  })
  @ApiParam({
    name: 'idCustomer',
    description: 'ID del cliente en MySQL (tbl_customers.id_customers)',
    type: Number,
    example: 123,
  })
  @ApiResponse({
    status: 200,
    description: 'Resultado de la migración del cliente',
  })
  @ApiResponse({
    status: 404,
    description: 'Cliente no encontrado en MySQL',
  })
  async migrateCliente(
    @Param('idCustomer', ParseIntPipe) idCustomer: number,
    @Body() options: MigrateClienteOptionsDto,
  ): Promise<SingleClienteMigrationResult> {
    return this.migrationService.migrateClienteById(idCustomer, options);
  }
}
