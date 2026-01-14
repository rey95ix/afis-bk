import { IsOptional, IsEnum, IsInt, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryValidacionDto {
  @ApiPropertyOptional({
    enum: ['PENDIENTE', 'APROBADO', 'APLICADO', 'RECHAZADO'],
    description: 'Filtrar por estado de validación'
  })
  @IsOptional()
  @IsEnum(['PENDIENTE', 'APROBADO', 'APLICADO', 'RECHAZADO'])
  estado?: 'PENDIENTE' | 'APROBADO' | 'APLICADO' | 'RECHAZADO';

  @ApiPropertyOptional({
    description: 'Fecha de inicio para filtrar (formato YYYY-MM-DD)'
  })
  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @ApiPropertyOptional({
    description: 'Fecha de fin para filtrar (formato YYYY-MM-DD)'
  })
  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por banco (búsqueda parcial)'
  })
  @IsOptional()
  banco?: string;

  @ApiPropertyOptional({
    default: 1,
    description: 'Número de página'
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    default: 20,
    description: 'Cantidad de registros por página'
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
