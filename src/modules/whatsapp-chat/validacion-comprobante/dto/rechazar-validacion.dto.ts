import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RechazarValidacionDto {
  @ApiProperty({
    description: 'Razón del rechazo de la validación',
    maxLength: 500,
    example: 'El monto del comprobante no coincide con el pago registrado'
  })
  @IsNotEmpty({ message: 'El comentario de rechazo es obligatorio' })
  @IsString()
  @MaxLength(500, { message: 'El comentario no debe exceder 500 caracteres' })
  comentario: string;
}
