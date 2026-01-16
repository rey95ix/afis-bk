import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  Max,
  Min,
} from 'class-validator';

export enum MigrationModule {
  CATALOGOS = 'catalogos',
  CLIENTES = 'clientes',
  CONTRATOS = 'contratos',
  DOCUMENTOS = 'documentos',
  FACTURACION = 'facturacion',
}

export class MigrationOptionsDto {
  @ApiPropertyOptional({
    description: 'Número de registros a procesar por lote',
    default: 100,
    minimum: 10,
    maximum: 500,
  })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(500)
  batchSize?: number = 100;

  @ApiPropertyOptional({
    description: 'Si es true, usa upsert para actualizar registros existentes',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  skipExisting?: boolean = true;

  @ApiPropertyOptional({
    description: 'Modo simulación - no realiza cambios reales',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean = false;

  @ApiPropertyOptional({
    description: 'Continuar migración aunque haya errores',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  continueOnError?: boolean = true;

  @ApiPropertyOptional({
    description: 'Número máximo de reintentos por registro',
    default: 3,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  maxRetries?: number = 3;
}

export class ExecuteModuleDto extends MigrationOptionsDto {
  @ApiProperty({
    description: 'Módulo a migrar',
    enum: MigrationModule,
    example: MigrationModule.CLIENTES,
  })
  @IsEnum(MigrationModule)
  module: MigrationModule;
}

export class ExecuteAllDto extends MigrationOptionsDto {
  @ApiPropertyOptional({
    description:
      'Lista de módulos a excluir de la migración completa',
    type: [String],
    enum: MigrationModule,
    isArray: true,
  })
  @IsOptional()
  excludeModules?: MigrationModule[];
}

export class MigrateClienteOptionsDto {
  @ApiPropertyOptional({
    description: 'Modo simulación - no realiza cambios reales',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean = false;

  @ApiPropertyOptional({
    description: 'Incluir contratos del cliente en la migración',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  includeContratos?: boolean = true;

  @ApiPropertyOptional({
    description: 'Incluir documentos del cliente en la migración (requiere contratos)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  includeDocumentos?: boolean = true;

  @ApiPropertyOptional({
    description: 'Incluir facturas del cliente en la migración',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  includeFacturas?: boolean = true;
}
