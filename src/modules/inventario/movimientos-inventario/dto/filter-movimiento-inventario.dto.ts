import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsInt,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { tipo_movimiento } from '@prisma/client';

export class FilterMovimientoInventarioDto {
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
    description: 'Registros por página',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Tipo de movimiento',
    enum: tipo_movimiento,
    example: tipo_movimiento.ENTRADA_COMPRA,
  })
  @IsOptional()
  @IsEnum(tipo_movimiento)
  tipo?: tipo_movimiento;

  @ApiPropertyOptional({
    description: 'ID del producto en catálogo',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id_catalogo?: number;

  @ApiPropertyOptional({
    description: 'ID de la bodega de origen',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id_bodega_origen?: number;

  @ApiPropertyOptional({
    description: 'ID de la bodega de destino',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id_bodega_destino?: number;

  @ApiPropertyOptional({
    description: 'ID del usuario que realizó el movimiento',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id_usuario?: number;

  @ApiPropertyOptional({
    description: 'Fecha de inicio del rango (ISO 8601)',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @ApiPropertyOptional({
    description: 'Fecha de fin del rango (ISO 8601)',
    example: '2025-01-31',
  })
  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;
}
