import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class AnularCompraDto {
  @ApiProperty({
    description: 'Motivo de la anulación',
    example: 'Error en cantidades registradas',
  })
  @IsString()
  @IsNotEmpty({ message: 'El motivo de anulación es obligatorio' })
  @MinLength(10, { message: 'El motivo debe tener al menos 10 caracteres' })
  @MaxLength(500)
  motivo_anulacion: string;
}
