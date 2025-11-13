import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsInt, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum TipoPeriodo {
  MENSUAL = 'MENSUAL',
  TRIMESTRAL = 'TRIMESTRAL',
  ANUAL = 'ANUAL',
}

export class QueryMetricasDto {
  @ApiProperty({
    description: 'Período en formato YYYY-MM',
    example: '2025-01',
  })
  @IsNotEmpty()
  @IsString()
  periodo: string;

  @ApiPropertyOptional({
    description: 'Tipo de período',
    enum: TipoPeriodo,
    example: 'MENSUAL',
    default: 'MENSUAL',
  })
  @IsOptional()
  @IsEnum(TipoPeriodo)
  tipo_periodo?: TipoPeriodo;

  @ApiPropertyOptional({
    description: 'Filtrar por bodega específica',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_bodega?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por categoría específica',
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_categoria?: number;
}
