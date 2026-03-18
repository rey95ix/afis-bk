import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class ActivarOntDto {
  @ApiProperty({ description: 'ID del cliente a activar ONT' })
  @IsInt()
  idCliente: number;
}
