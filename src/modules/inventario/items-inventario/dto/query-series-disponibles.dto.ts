import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, IsEnum, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { estado_inventario } from '@prisma/client';

export class QuerySeriesDisponiblesDto {
  @ApiProperty({
    description: 'ID del catálogo del producto',
    example: 1,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_catalogo: number;

  @ApiProperty({
    description: 'ID de la bodega',
    example: 1,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_bodega: number;

  @ApiPropertyOptional({
    description: 'ID del estante (opcional)',
    example: 1,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_estante?: number;

  @ApiProperty({
    description: 'Estado de las series a filtrar',
    enum: estado_inventario,
    example: 'DISPONIBLE',
  })
  @IsEnum(estado_inventario)
  estado: estado_inventario;

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
    example: 100,
    default: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number = 100;

  @ApiPropertyOptional({
    description: 'Búsqueda por número de serie o MAC address',
    example: 'SN123456',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
