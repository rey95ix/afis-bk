import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, ArrayMinSize } from 'class-validator';

export class CrearPagoIntentDto {
  @ApiProperty({
    description: 'IDs de facturas seleccionadas para pagar',
    example: [1, 2],
  })
  @IsArray()
  @IsInt({ each: true })
  @ArrayMinSize(1)
  idFacturas: number[];
}
