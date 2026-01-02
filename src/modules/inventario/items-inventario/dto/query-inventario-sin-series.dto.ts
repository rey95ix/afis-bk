import { IsOptional, IsString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryInventarioSinSeriesDto {
  @ApiPropertyOptional({ description: 'Número de página', example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Cantidad de registros por página', example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Búsqueda por nombre o código de producto', example: 'router' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filtrar por bodega', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_bodega?: number;

  @ApiPropertyOptional({ description: 'Filtrar por categoría', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_categoria?: number;
}
