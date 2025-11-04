import { IsDateString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class IniciarOrdenDto {
  @ApiPropertyOptional({
    description: 'Fecha y hora de llegada al sitio (formato ISO 8601). Si no se proporciona, se usa la fecha/hora actual',
    example: '2025-11-05T09:30:00Z',
  })
  @IsDateString()
  @IsOptional()
  fecha_llegada?: string;

  @ApiPropertyOptional({
    description: 'Fecha y hora de inicio del trabajo (formato ISO 8601). Si no se proporciona, se usa la fecha/hora actual',
    example: '2025-11-05T09:45:00Z',
  })
  @IsDateString()
  @IsOptional()
  fecha_inicio_trabajo?: string;
}
