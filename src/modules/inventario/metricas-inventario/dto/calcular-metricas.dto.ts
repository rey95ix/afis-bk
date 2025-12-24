import { IsOptional, IsInt, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TipoPeriodo } from './query-metricas.dto';

export class CalcularMetricasDto {
  @ApiPropertyOptional({ description: 'Período en formato YYYY-MM' })
  @IsOptional()
  @IsString()
  periodo?: string;

  @ApiPropertyOptional({ description: 'Tipo de período', enum: TipoPeriodo })
  @IsOptional()
  @IsEnum(TipoPeriodo)
  tipo_periodo?: TipoPeriodo = TipoPeriodo.MENSUAL;

  @ApiPropertyOptional({ description: 'ID de bodega para calcular' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id_bodega?: number;

  @ApiPropertyOptional({ description: 'ID de categoría para calcular' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id_categoria?: number;
}
