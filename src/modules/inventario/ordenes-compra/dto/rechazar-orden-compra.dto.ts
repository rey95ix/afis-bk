import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RechazarOrdenCompraDto {
  @ApiProperty({
    description: 'Motivo del rechazo',
    example: 'Presupuesto no aprobado para este período',
  })
  @IsNotEmpty()
  @IsString()
  motivo_rechazo: string;
}
