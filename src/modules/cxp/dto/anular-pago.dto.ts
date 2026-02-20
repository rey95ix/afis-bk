import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class AnularPagoDto {
  @ApiProperty({ description: 'Motivo de la anulación del pago' })
  @IsString()
  @MaxLength(500)
  motivo: string;
}
