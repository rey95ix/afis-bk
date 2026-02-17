import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsOptional, IsInt, IsEnum, IsDateString } from 'class-validator';
import { PaginationDto } from 'src/common/dto';
import {
  tipo_movimiento_bancario,
  metodo_movimiento_bancario,
  modulo_origen_movimiento,
  estado_movimiento_bancario,
} from '@prisma/client';

export class FilterMovimientoBancarioDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filtrar por cuenta bancaria' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @Type(() => Number)
  @IsInt()
  id_cuenta_bancaria?: number;

  @ApiPropertyOptional({ description: 'Filtrar por tipo de movimiento', enum: tipo_movimiento_bancario })
  @IsOptional()
  @IsEnum(tipo_movimiento_bancario)
  tipo_movimiento?: tipo_movimiento_bancario;

  @ApiPropertyOptional({ description: 'Filtrar por método', enum: metodo_movimiento_bancario })
  @IsOptional()
  @IsEnum(metodo_movimiento_bancario)
  metodo?: metodo_movimiento_bancario;

  @ApiPropertyOptional({ description: 'Filtrar por módulo de origen', enum: modulo_origen_movimiento })
  @IsOptional()
  @IsEnum(modulo_origen_movimiento)
  modulo_origen?: modulo_origen_movimiento;

  @ApiPropertyOptional({ description: 'Filtrar por estado', enum: estado_movimiento_bancario })
  @IsOptional()
  @IsEnum(estado_movimiento_bancario)
  estado_movimiento?: estado_movimiento_bancario;

  @ApiPropertyOptional({ description: 'Fecha inicio (formato YYYY-MM-DD)', example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @ApiPropertyOptional({ description: 'Fecha fin (formato YYYY-MM-DD)', example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;
}
