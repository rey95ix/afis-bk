import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsInt,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import { tipo_auditoria } from '@prisma/client';

export class CreateAuditoriaDto {
  @ApiProperty({
    description: 'Tipo de auditoría',
    enum: tipo_auditoria,
    example: 'COMPLETA',
  })
  @IsNotEmpty()
  @IsEnum(tipo_auditoria)
  tipo: tipo_auditoria;

  @ApiProperty({
    description: 'ID de la bodega a auditar',
    example: 1,
  })
  @IsNotEmpty()
  @IsInt()
  id_bodega: number;

  @ApiPropertyOptional({
    description: 'ID del estante específico (opcional, null para toda la bodega)',
    example: 3,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  id_estante?: number;

  @ApiPropertyOptional({
    description: 'Incluir todas las categorías',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  incluir_todas_categorias?: boolean;

  @ApiPropertyOptional({
    description: 'Array de IDs de categorías específicas a auditar',
    example: [1, 2, 5],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @ArrayMinSize(1)
  categorias_a_auditar?: number[];

  @ApiPropertyOptional({
    description: 'Fecha planificada para la auditoría (ISO 8601)',
    example: '2025-01-20T10:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  fecha_planificada?: string;

  @ApiPropertyOptional({
    description: 'Observaciones generales de la auditoría',
    example: 'Auditoría completa de bodega central - trimestral',
  })
  @IsOptional()
  observaciones?: string;
}
