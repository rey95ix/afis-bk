import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, Min } from 'class-validator';

export class CrearPagoIntentDto {
  @ApiProperty({
    description: 'ID de la factura seleccionada para pagar',
    example: 1,
  })
  @IsInt()
  idFactura: number;

  @ApiProperty({
    description: 'Monto a pagar (puede ser parcial)',
    example: 25.5,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto: number;
}
