import { IsOptional, IsString, IsInt, IsEnum, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * DTO para buscar/filtrar clientes directos
 */
export class BuscarClienteDirectoDto {
  @ApiPropertyOptional({ description: 'Término de búsqueda (nombre, NIT, DUI, NRC)' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Filtrar por NIT' })
  @IsOptional()
  @IsString()
  nit?: string;

  @ApiPropertyOptional({ description: 'Filtrar por DUI' })
  @IsOptional()
  @IsString()
  dui?: string;

  @ApiPropertyOptional({ description: 'Filtrar por NRC' })
  @IsOptional()
  @IsString()
  registro_nrc?: string;

  @ApiPropertyOptional({ description: 'Filtrar por ID de sucursal' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id_sucursal?: number;

  @ApiPropertyOptional({ description: 'Filtrar por estado', enum: ['ACTIVO', 'INACTIVO'] })
  @IsOptional()
  @IsEnum(['ACTIVO', 'INACTIVO'])
  estado?: 'ACTIVO' | 'INACTIVO';

  @ApiPropertyOptional({ description: 'Número de página', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: 'Cantidad por página', default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number;
}
