import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { tipo_movimiento } from '@prisma/client';

export class QueryMovimientosDto {
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
    description: 'Filtrar por tipo de movimiento',
    enum: tipo_movimiento,
    example: 'ENTRADA_COMPRA',
  })
  @IsOptional()
  @IsEnum(tipo_movimiento)
  tipo?: tipo_movimiento;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de bodega origen',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_bodega_origen?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de bodega destino',
    example: 2,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_bodega_destino?: number;
}
