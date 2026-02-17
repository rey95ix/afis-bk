import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CancelarOrdenCompraDto {
  @ApiProperty({
    description: 'Motivo de la cancelación',
    example: 'Proveedor no puede cumplir con los términos acordados',
  })
  @IsNotEmpty()
  @IsString()
  motivo: string;
}
