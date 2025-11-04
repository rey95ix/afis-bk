import { IsDateString, IsEnum, IsInt, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class QueryReportesDto {
  @ApiPropertyOptional({
    description: 'Filtrar desde fecha (formato ISO 8601)',
    example: '2025-11-01',
  })
  @IsDateString()
  @IsOptional()
  desde?: string;

  @ApiPropertyOptional({
    description: 'Filtrar hasta fecha (formato ISO 8601)',
    example: '2025-11-30',
  })
  @IsDateString()
  @IsOptional()
  hasta?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado de orden',
    example: 'COMPLETADA',
  })
  @IsOptional()
  estado?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por ID del técnico',
    example: 5,
  })
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  id_tecnico?: number;
}
