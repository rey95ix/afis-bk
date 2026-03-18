import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class QueryOntStatusDto {
  @ApiProperty({ description: 'ID del cliente para consultar estado ONT' })
  @IsInt()
  idCliente: number;
}
