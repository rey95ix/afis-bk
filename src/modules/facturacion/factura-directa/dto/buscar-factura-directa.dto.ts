import { IsOptional, IsString, IsInt, IsEnum, IsDateString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * DTO para buscar/filtrar facturas directas
 */
export class BuscarFacturaDirectaDto {
  @ApiPropertyOptional({ description: 'Búsqueda por número de factura o nombre cliente' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Filtrar por ID de cliente directo' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id_cliente_directo?: number;

  @ApiPropertyOptional({ description: 'Filtrar por NIT del cliente' })
  @IsOptional()
  @IsString()
  cliente_nit?: string;

  @ApiPropertyOptional({ description: 'Filtrar por tipo de factura (código: 01, 03, 05, 06, 11, 14)' })
  @IsOptional()
  @IsString()
  tipo_dte?: string;

  @ApiPropertyOptional({ description: 'Filtrar por ID de tipo de factura' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id_tipo_factura?: number;

  @ApiPropertyOptional({ description: 'Filtrar por ID de sucursal' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id_sucursal?: number;

  @ApiPropertyOptional({ description: 'Filtrar por estado del DTE', enum: ['BORRADOR', 'FIRMADO', 'TRANSMITIDO', 'PROCESADO', 'RECHAZADO', 'CONTINGENCIA', 'INVALIDADO'] })
  @IsOptional()
  @IsEnum(['BORRADOR', 'FIRMADO', 'TRANSMITIDO', 'PROCESADO', 'RECHAZADO', 'CONTINGENCIA', 'INVALIDADO'])
  estado_dte?: string;

  @ApiPropertyOptional({ description: 'Filtrar por estado de la factura', enum: ['ACTIVO', 'ANULADO'] })
  @IsOptional()
  @IsEnum(['ACTIVO', 'ANULADO'])
  estado?: string;

  @ApiPropertyOptional({ description: 'Fecha de inicio (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  fecha_inicio?: string;

  @ApiPropertyOptional({ description: 'Fecha de fin (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  fecha_fin?: string;

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

/**
 * DTO para consultar errores de DTE
 */
export class BuscarErroresDteDto {
  @ApiPropertyOptional({ description: 'Filtrar por ID de sucursal' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id_sucursal?: number;

  @ApiPropertyOptional({ description: 'Fecha de inicio (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  fecha_inicio?: string;

  @ApiPropertyOptional({ description: 'Fecha de fin (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  fecha_fin?: string;

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
