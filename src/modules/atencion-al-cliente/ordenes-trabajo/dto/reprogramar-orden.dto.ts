import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReprogramarOrdenDto {
  @ApiProperty({
    description: 'Nueva fecha y hora de inicio de la ventana de visita (formato ISO 8601). La hora fin se calculará automáticamente 2 horas después.',
    example: '2025-11-06T08:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  inicio: string;

  @ApiPropertyOptional({
    description: 'Nueva fecha y hora de fin de la ventana de visita (opcional, por defecto 2 horas después del inicio)',
    example: '2025-11-06T10:00:00Z',
  })
  @IsDateString()
  @IsOptional()
  fin?: string;

  @ApiProperty({
    description: 'Motivo de la reprogramación',
    example: 'Cliente no se encontraba en el domicilio',
  })
  @IsString()
  @IsNotEmpty()
  motivo: string;
}
