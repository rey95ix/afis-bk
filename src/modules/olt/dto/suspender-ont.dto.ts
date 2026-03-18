import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class SuspenderOntDto {
  @ApiProperty({ description: 'ID del cliente a suspender ONT' })
  @IsInt()
  idCliente: number;
}
