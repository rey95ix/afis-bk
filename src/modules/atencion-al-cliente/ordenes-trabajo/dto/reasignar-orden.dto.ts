import { IsInt, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReasignarOrdenDto {
  @ApiProperty({
    description: 'ID del nuevo técnico a asignar',
    example: 5,
  })
  @IsInt()
  @IsNotEmpty()
  id_tecnico: number;

  @ApiProperty({
    description: 'Motivo de la reasignación',
    example: 'Técnico anterior no disponible por incapacidad',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(5)
  motivo?: string;
}
