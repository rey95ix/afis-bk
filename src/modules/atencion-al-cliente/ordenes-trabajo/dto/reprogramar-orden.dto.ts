import { IsDateString, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReprogramarOrdenDto {
  @ApiProperty({
    description: 'Nueva fecha y hora de inicio de la ventana de visita (formato ISO 8601)',
    example: '2025-11-06T08:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  inicio: string;

  @ApiProperty({
    description: 'Nueva fecha y hora de fin de la ventana de visita (formato ISO 8601)',
    example: '2025-11-06T12:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  fin: string;

  @ApiProperty({
    description: 'Motivo de la reprogramación',
    example: 'Cliente no se encontraba en el domicilio',
  })
  @IsString()
  @IsNotEmpty()
  motivo: string;
}
