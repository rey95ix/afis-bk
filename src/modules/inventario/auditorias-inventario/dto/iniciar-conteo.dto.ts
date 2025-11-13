import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class IniciarConteoDto {
  @ApiPropertyOptional({
    description: 'Observaciones al iniciar el conteo',
    example: 'Iniciando conteo físico del turno de la mañana',
  })
  @IsOptional()
  @IsString()
  observaciones?: string;
}
