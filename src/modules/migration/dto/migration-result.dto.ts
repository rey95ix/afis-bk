import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MigrationErrorDto {
  @ApiProperty({ description: 'Tabla donde ocurrió el error' })
  table: string;

  @ApiProperty({ description: 'ID del registro que falló' })
  recordId: number;

  @ApiPropertyOptional({ description: 'Campo específico con error' })
  field?: string;

  @ApiProperty({ description: 'Mensaje de error' })
  message: string;
}

export class MigrationModuleResultDto {
  @ApiProperty({ description: 'Nombre del módulo migrado' })
  module: string;

  @ApiProperty({ description: 'Si la migración fue exitosa' })
  success: boolean;

  @ApiProperty({ description: 'Total de registros en origen' })
  totalRecords: number;

  @ApiProperty({ description: 'Registros migrados exitosamente' })
  migratedRecords: number;

  @ApiProperty({ description: 'Registros omitidos (ya existían)' })
  skippedRecords: number;

  @ApiProperty({
    description: 'Lista de errores',
    type: [MigrationErrorDto],
  })
  errors: MigrationErrorDto[];

  @ApiProperty({ description: 'Duración en milisegundos' })
  duration: number;

  @ApiProperty({ description: 'Fecha de inicio' })
  startedAt: Date;

  @ApiProperty({ description: 'Fecha de finalización' })
  completedAt: Date;
}

export class ClientProgressDto {
  @ApiProperty({ description: 'Índice del cliente actual (0-based)' })
  currentClientIndex: number;

  @ApiProperty({ description: 'Total de clientes a migrar' })
  totalClients: number;

  @ApiPropertyOptional({ description: 'ID MySQL del cliente actual' })
  currentMysqlId: number | null;

  @ApiProperty({ description: 'Clientes migrados exitosamente' })
  successCount: number;

  @ApiProperty({ description: 'Clientes con errores' })
  errorCount: number;
}

export class MigrationStatusDto {
  @ApiProperty({ description: 'Si hay una migración en curso' })
  isRunning: boolean;

  @ApiPropertyOptional({ description: 'Módulo actualmente en proceso' })
  currentModule: string | null;

  @ApiProperty({
    description: 'Módulos completados',
    type: [String],
  })
  completedModules: string[];

  @ApiProperty({
    description: 'Módulos pendientes',
    type: [String],
  })
  pendingModules: string[];

  @ApiProperty({
    description: 'Progreso total (0-100)',
    minimum: 0,
    maximum: 100,
  })
  totalProgress: number;

  @ApiPropertyOptional({ description: 'Fecha de inicio de migración' })
  startedAt: Date | null;

  @ApiPropertyOptional({ description: 'Última actualización' })
  lastUpdatedAt: Date | null;

  @ApiProperty({
    description: 'Resultados por módulo',
    type: [MigrationModuleResultDto],
  })
  results: MigrationModuleResultDto[];

  @ApiPropertyOptional({
    description: 'Progreso de migración por cliente (solo durante migración unificada)',
    type: ClientProgressDto,
  })
  clientProgress?: ClientProgressDto;
}

export class BulkClienteErrorDto {
  @ApiProperty({ description: 'ID MySQL del cliente con error' })
  mysqlId: number;

  @ApiProperty({ description: 'Errores del cliente', type: [MigrationErrorDto] })
  errors: MigrationErrorDto[];
}

export class BulkClienteMigrationResultDto {
  @ApiProperty({ description: 'Total de clientes procesados' })
  totalClients: number;

  @ApiProperty({ description: 'Clientes migrados exitosamente' })
  successCount: number;

  @ApiProperty({ description: 'Clientes con errores' })
  errorCount: number;

  @ApiProperty({ description: 'Errores por cliente', type: [BulkClienteErrorDto] })
  clientErrors: BulkClienteErrorDto[];

  @ApiProperty({ description: 'Duración en milisegundos' })
  duration: number;
}

export class ConnectionValidationDto {
  @ApiProperty({ description: 'Estado de conexión MySQL' })
  mysql: {
    connected: boolean;
    version?: string;
    database?: string;
    error?: string;
  };

  @ApiProperty({ description: 'Estado de conexión PostgreSQL' })
  postgres: {
    connected: boolean;
    version?: string;
    database?: string;
    error?: string;
  };

  @ApiProperty({ description: 'Tablas encontradas con sus conteos' })
  tablesFound: {
    table: string;
    count: number;
  }[];
}

export class MigrationPreviewDto {
  @ApiProperty({ description: 'Módulo consultado' })
  module: string;

  @ApiProperty({ description: 'Total de registros en origen' })
  totalSourceRecords: number;

  @ApiProperty({ description: 'Registros ya existentes en destino' })
  existingDestRecords: number;

  @ApiProperty({ description: 'Registros a crear' })
  toBeCreated: number;

  @ApiProperty({ description: 'Registros a actualizar' })
  toBeUpdated: number;

  @ApiPropertyOptional({
    description: 'Muestra de datos a migrar',
    type: 'array',
  })
  sampleData?: unknown[];
}

export class MigrationLogDto {
  @ApiProperty({ description: 'ID del log' })
  id: number;

  @ApiProperty({ description: 'Timestamp del log' })
  timestamp: Date;

  @ApiProperty({
    description: 'Nivel de log',
    enum: ['INFO', 'WARN', 'ERROR'],
  })
  level: 'INFO' | 'WARN' | 'ERROR';

  @ApiProperty({ description: 'Módulo relacionado' })
  module: string;

  @ApiProperty({ description: 'Mensaje del log' })
  message: string;

  @ApiPropertyOptional({ description: 'Detalles adicionales' })
  details?: unknown;
}

export class MigrationLogsResponseDto {
  @ApiProperty({ description: 'Lista de logs', type: [MigrationLogDto] })
  logs: MigrationLogDto[];

  @ApiProperty({ description: 'Total de logs' })
  total: number;
}
