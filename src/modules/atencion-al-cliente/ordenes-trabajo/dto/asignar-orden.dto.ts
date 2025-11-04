import { IsInt, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AsignarOrdenDto {
  @ApiProperty({
    description: 'ID del técnico a asignar',
    example: 5,
  })
  @IsInt()
  @IsNotEmpty()
  id_tecnico: number;
}
