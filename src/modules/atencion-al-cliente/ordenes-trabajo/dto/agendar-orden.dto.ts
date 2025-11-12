import { IsDateString, IsInt, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AgendarOrdenDto {
  @ApiProperty({
    description: 'Fecha y hora de inicio de la ventana de visita (formato ISO 8601). La hora fin se calculará automáticamente 2 horas después.',
    example: '2025-11-05T08:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  inicio: string;

  @ApiPropertyOptional({
    description: 'Fecha y hora de fin de la ventana de visita (opcional, por defecto 2 horas después del inicio)',
    example: '2025-11-05T10:00:00Z',
  })
  @IsDateString()
  @IsOptional()
  fin?: string;

  @ApiPropertyOptional({
    description: 'ID del técnico (opcional si ya está asignado)',
    example: 5,
  })
  @IsInt()
  @IsOptional()
  id_tecnico?: number;
}
