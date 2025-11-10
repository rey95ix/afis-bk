import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { estado } from '@prisma/client';

export class QueryInventarioDto {
  @ApiPropertyOptional({
    description: 'Número de página',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de registros por página',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Búsqueda por nombre o código del item',
    example: 'ONU',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de bodega',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_bodega?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de estante',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_estante?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de categoría',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_categoria?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por estado',
    enum: estado,
    example: 'ACTIVO',
  })
  @IsOptional()
  @IsEnum(estado)
  estado?: estado;

  @ApiPropertyOptional({
    description: 'Mostrar solo items con stock bajo mínimo',
    example: 'true',
  })
  @IsOptional()
  @Type(() => Boolean)
  stock_bajo?: boolean;
}
