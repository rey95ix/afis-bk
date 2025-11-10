import { IsInt, IsOptional, IsDateString, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class QueryAgendaDto {
  @ApiPropertyOptional({
    description: 'Filtrar por ID del técnico',
    example: 5,
  })
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  tecnico?: number;

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
    description: 'Filtrar solo agendas activas',
    example: true,
    default: true,
  })
  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  activo?: boolean = true;
}
