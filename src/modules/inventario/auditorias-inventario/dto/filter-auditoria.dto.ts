import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsInt,
  IsEnum,
  IsDateString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { tipo_auditoria, estado_auditoria } from '@prisma/client';

export class FilterAuditoriaDto {
  @ApiPropertyOptional({
    description: 'Número de página',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Registros por página',
    example: 10,
    minimum: 1,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filtrar por tipo de auditoría',
    enum: tipo_auditoria,
    example: 'COMPLETA',
  })
  @IsOptional()
  @IsEnum(tipo_auditoria)
  tipo?: tipo_auditoria;

  @ApiPropertyOptional({
    description: 'Filtrar por estado',
    enum: estado_auditoria,
    example: 'COMPLETADA',
  })
  @IsOptional()
  @IsEnum(estado_auditoria)
  estado?: estado_auditoria;

  @ApiPropertyOptional({
    description: 'Filtrar por bodega',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_bodega?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por estante',
    example: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_estante?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por usuario que planificó',
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_usuario_planifica?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por usuario que ejecutó',
    example: 8,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_usuario_ejecuta?: number;

  @ApiPropertyOptional({
    description: 'Fecha desde (ISO 8601)',
    example: '2025-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @ApiPropertyOptional({
    description: 'Fecha hasta (ISO 8601)',
    example: '2025-01-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;
}
