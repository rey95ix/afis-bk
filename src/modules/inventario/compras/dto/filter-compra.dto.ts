import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { estado } from '@prisma/client';

export class FilterCompraDto {
  @ApiPropertyOptional({
    description: 'Número de página',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de registros por página',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Búsqueda por número de factura o proveedor',
    example: 'F001',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de proveedor',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id_proveedor?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de sucursal',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id_sucursal?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de bodega',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id_bodega?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por estado',
    enum: estado,
    example: 'ACTIVO',
  })
  @IsOptional()
  @IsEnum(estado)
  estado?: estado;

  @ApiPropertyOptional({
    description: 'Fecha de inicio para filtrar (ISO 8601)',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsString()
  fecha_desde?: string;

  @ApiPropertyOptional({
    description: 'Fecha de fin para filtrar (ISO 8601)',
    example: '2025-01-31',
  })
  @IsOptional()
  @IsString()
  fecha_hasta?: string;
}
