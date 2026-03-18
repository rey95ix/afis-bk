import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SeleccionarCotizacionDto {
  @ApiPropertyOptional({ description: 'Motivo de selección de esta cotización' })
  @IsOptional()
  @IsString()
  motivo_seleccion?: string;
}
