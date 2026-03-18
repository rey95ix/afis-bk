import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class ResetOntDto {
  @ApiProperty({ description: 'ID del cliente a reiniciar ONT' })
  @IsInt()
  idCliente: number;
}
