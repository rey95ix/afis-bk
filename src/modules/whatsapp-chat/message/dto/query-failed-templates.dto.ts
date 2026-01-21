import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, IsString, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryFailedTemplatesDto {
  @ApiPropertyOptional({ description: 'Número de página', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Registros por página', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filtrar por código de error' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  error_code?: number;

  @ApiPropertyOptional({ description: 'Buscar por teléfono o nombre de cliente' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filtrar desde fecha (ISO string)' })
  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @ApiPropertyOptional({ description: 'Filtrar hasta fecha (ISO string)' })
  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;
}
