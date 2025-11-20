// src/modules/inventario/salidas-temporales-ot/dto/query-salida-temporal.dto.ts
import { IsOptional, IsInt, IsPositive, IsEnum, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

enum EstadoSalidaTemporal {
  PROCESADA = 'PROCESADA',
  CANCELADA = 'CANCELADA',
}

export class QuerySalidaTemporalDto {
  @ApiPropertyOptional({
    description: 'Número de página',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de registros por página',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filtrar por estado',
    enum: EstadoSalidaTemporal,
    example: 'PROCESADA',
  })
  @IsOptional()
  @IsEnum(EstadoSalidaTemporal)
  estado?: EstadoSalidaTemporal;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de usuario que creó la salida',
    example: 5,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  id_usuario_crea?: number;

  @ApiPropertyOptional({
    description: 'Buscar por código de salida',
    example: 'ST-202501-00001',
  })
  @IsOptional()
  @IsString()
  codigo?: string;

  @ApiPropertyOptional({
    description: 'Fecha de salida desde (YYYY-MM-DD)',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsString()
  fecha_desde?: string;

  @ApiPropertyOptional({
    description: 'Fecha de salida hasta (YYYY-MM-DD)',
    example: '2025-01-31',
  })
  @IsOptional()
  @IsString()
  fecha_hasta?: string;
}
