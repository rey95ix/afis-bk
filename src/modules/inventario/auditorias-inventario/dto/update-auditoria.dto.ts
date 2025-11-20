import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsInt,
  IsEnum,
  IsBoolean,
  IsDateString,
  IsArray,
  IsString,
} from 'class-validator';
import { tipo_auditoria, estado_auditoria } from '@prisma/client';

export class UpdateAuditoriaDto {
  @ApiPropertyOptional({
    description: 'Tipo de auditoría',
    enum: tipo_auditoria,
    example: 'COMPLETA',
  })
  @IsOptional()
  @IsEnum(tipo_auditoria)
  tipo?: tipo_auditoria;

  @ApiPropertyOptional({
    description: 'Estado de la auditoría',
    enum: estado_auditoria,
    example: 'EN_PROGRESO',
  })
  @IsOptional()
  @IsEnum(estado_auditoria)
  estado?: estado_auditoria;

  @ApiPropertyOptional({
    description: 'ID del estante específico',
    example: 3,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  id_bodega?: number;

  @ApiPropertyOptional({
    description: 'ID del estante específico',
    example: 3,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  id_estante?: number;

  @ApiPropertyOptional({
    description: 'Incluir todas las categorías',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  incluir_todas_categorias?: boolean;

  @ApiPropertyOptional({
    description: 'Array de IDs de categorías específicas',
    example: [1, 2, 5],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  categorias_a_auditar?: number[];

  @ApiPropertyOptional({
    description: 'Fecha planificada (ISO 8601)',
    example: '2025-01-20T10:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  fecha_planificada?: string;

  @ApiPropertyOptional({
    description: 'Observaciones',
    example: 'Actualizada fecha de auditoría',
  })
  @IsOptional()
  @IsString()
  observaciones?: string;
}
