import { IsOptional, IsString, IsInt, IsEnum, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum TipoPeriodo {
  DIARIO = 'DIARIO',
  SEMANAL = 'SEMANAL',
  MENSUAL = 'MENSUAL',
  TRIMESTRAL = 'TRIMESTRAL',
  ANUAL = 'ANUAL',
}

export class QueryMetricasKPIDto {
  @ApiPropertyOptional({ description: 'ID de bodega para filtrar métricas' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id_bodega?: number;

  @ApiPropertyOptional({ description: 'ID de categoría para filtrar métricas' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id_categoria?: number;
}

export class QueryMetricasHistoricasDto {
  @ApiPropertyOptional({ description: 'Fecha inicio del rango (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  fecha_inicio?: string;

  @ApiPropertyOptional({ description: 'Fecha fin del rango (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  fecha_fin?: string;

  @ApiPropertyOptional({ description: 'ID de bodega para filtrar' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id_bodega?: number;

  @ApiPropertyOptional({ description: 'ID de categoría para filtrar' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id_categoria?: number;

  @ApiPropertyOptional({ description: 'Tipo de período', enum: TipoPeriodo })
  @IsOptional()
  @IsEnum(TipoPeriodo)
  tipo_periodo?: TipoPeriodo;

  @ApiPropertyOptional({ description: 'Número de página', default: 1 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Elementos por página', default: 12 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit?: number = 12;
}

export class QueryTasaRotacionDto {
  @ApiPropertyOptional({ description: 'Fecha inicio del período (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  fecha_inicio?: string;

  @ApiPropertyOptional({ description: 'Fecha fin del período (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  fecha_fin?: string;

  @ApiPropertyOptional({ description: 'ID de bodega para filtrar' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id_bodega?: number;

  @ApiPropertyOptional({ description: 'ID de categoría para filtrar' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id_categoria?: number;
}

export class QueryStockOutRateDto {
  @ApiPropertyOptional({ description: 'Fecha inicio del período (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  fecha_inicio?: string;

  @ApiPropertyOptional({ description: 'Fecha fin del período (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  fecha_fin?: string;

  @ApiPropertyOptional({ description: 'ID de bodega para filtrar' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id_bodega?: number;
}

export class QueryItemsBajoMinimoDto {
  @ApiPropertyOptional({ description: 'ID de bodega para filtrar' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id_bodega?: number;

  @ApiPropertyOptional({ description: 'ID de categoría para filtrar' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id_categoria?: number;

  @ApiPropertyOptional({ description: 'Solo mostrar críticos (por debajo del stock de seguridad)', default: false })
  @IsOptional()
  solo_criticos?: boolean;

  @ApiPropertyOptional({ description: 'Número de página', default: 1 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Elementos por página', default: 20 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit?: number = 20;
}
