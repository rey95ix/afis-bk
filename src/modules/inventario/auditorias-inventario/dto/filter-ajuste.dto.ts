import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsInt,
  IsEnum,
  IsDateString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { estado_ajuste, tipo_discrepancia, causa_discrepancia } from '@prisma/client';

export class FilterAjusteDto {
  @ApiPropertyOptional({
    description: 'Número de página',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Registros por página',
    example: 10,
    minimum: 1,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filtrar por estado del ajuste',
    enum: estado_ajuste,
    example: 'PENDIENTE_AUTORIZACION',
  })
  @IsOptional()
  @IsEnum(estado_ajuste)
  estado?: estado_ajuste;

  @ApiPropertyOptional({
    description: 'Filtrar por auditoría',
    example: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_auditoria?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por producto',
    example: 15,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_catalogo?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por bodega',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_bodega?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por tipo de discrepancia',
    enum: tipo_discrepancia,
    example: 'FALTANTE',
  })
  @IsOptional()
  @IsEnum(tipo_discrepancia)
  tipo_discrepancia?: tipo_discrepancia;

  @ApiPropertyOptional({
    description: 'Filtrar por causa de discrepancia',
    enum: causa_discrepancia,
    example: 'ERROR_REGISTRO',
  })
  @IsOptional()
  @IsEnum(causa_discrepancia)
  causa_discrepancia?: causa_discrepancia;

  @ApiPropertyOptional({
    description: 'Filtrar por usuario que solicita',
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_usuario_solicita?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por usuario que autoriza',
    example: 2,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_usuario_autoriza?: number;

  @ApiPropertyOptional({
    description: 'Fecha desde (ISO 8601)',
    example: '2025-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @ApiPropertyOptional({
    description: 'Fecha hasta (ISO 8601)',
    example: '2025-01-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;
}
