import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AnularPagoPuntoXpressDto {
  @ApiProperty({ description: 'Motivo de la anulación', example: 'Pago duplicado' })
  @IsString()
  @IsNotEmpty()
  motivo: string;
}
