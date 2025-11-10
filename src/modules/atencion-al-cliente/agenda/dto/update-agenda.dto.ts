import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAgendaDto {
  @ApiPropertyOptional({
    description: 'Nueva fecha y hora de inicio (formato ISO 8601)',
    example: '2025-11-05T08:00:00Z',
  })
  @IsDateString()
  @IsOptional()
  inicio?: string;

  @ApiPropertyOptional({
    description: 'Nueva fecha y hora de fin (formato ISO 8601)',
    example: '2025-11-05T12:00:00Z',
  })
  @IsDateString()
  @IsOptional()
  fin?: string;

  @ApiPropertyOptional({
    description: 'ID del técnico asignado',
    example: 5,
  })
  @IsInt()
  @IsOptional()
  id_tecnico?: number;

  @ApiPropertyOptional({
    description: 'Motivo del cambio',
    example: 'Ajuste de horario por solicitud del cliente',
  })
  @IsString()
  @IsOptional()
  motivo?: string;
}
