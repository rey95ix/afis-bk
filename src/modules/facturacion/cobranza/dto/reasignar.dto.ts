// src/modules/facturacion/cobranza/dto/reasignar.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class ReasignarDto {
  @ApiProperty({ description: 'ID del nuevo gestor', example: 7 })
  @Type(() => Number)
  @IsInt()
  id_gestor_nuevo: number;

  @ApiProperty({ example: 'Gestor anterior de vacaciones' })
  @IsString()
  @IsNotEmpty()
  motivo: string;
}
