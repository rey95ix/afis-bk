import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';
import { RenovarContratoDto } from './renovar-contrato.dto';

export class MigrarContratoDto extends RenovarContratoDto {
  @ApiProperty({
    description: 'ID del cliente destino al que se migrará el contrato',
    example: 5,
  })
  @IsInt()
  @Min(1)
  id_cliente: number;
}
