import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class FilterCotizacionCompraDto {
  @ApiPropertyOptional({ description: 'Número de página', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @ApiPropertyOptional({ description: 'Cantidad por página', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @ApiPropertyOptional({ description: 'Filtrar por ID de solicitud de compra' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_solicitud_compra?: number;

  @ApiPropertyOptional({ description: 'Filtrar por ID de proveedor' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_proveedor?: number;

  @ApiPropertyOptional({ description: 'Filtrar por estado', example: 'REGISTRADA' })
  @IsOptional()
  @IsString()
  estado?: string;
}
