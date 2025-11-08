import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, IsEnum, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { estado_inventario } from '@prisma/client';

export class QuerySeriesDto {
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
    description: 'Filtrar por estado del inventario',
    enum: estado_inventario,
    example: 'DISPONIBLE',
  })
  @IsOptional()
  @IsEnum(estado_inventario)
  estado?: estado_inventario;

  @ApiPropertyOptional({
    description: 'Búsqueda por número de serie o MAC address',
    example: 'SN123456',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
