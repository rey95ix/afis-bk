import { IsInt, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCuentaBancariaDto {
  @ApiProperty({ description: 'ID de la cuenta bancaria destino', example: 5 })
  @IsInt()
  @IsPositive()
  id_cuenta_bancaria: number;
}
