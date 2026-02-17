import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class AnularAbonoDto {
  @ApiProperty({ description: 'Motivo de la anulación del abono' })
  @IsString()
  @MaxLength(500)
  motivo: string;
}
