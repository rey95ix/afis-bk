import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class AnularMovimientoDto {
  @ApiProperty({ description: 'Motivo de la anulación', example: 'Error en el monto registrado' })
  @IsString()
  @MaxLength(500)
  motivo_anulacion: string;
}
