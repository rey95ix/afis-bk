// src/modules/inventario/importaciones/dto/calcular-retaceo.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class CalcularRetaceoDto {
  @ApiProperty({
    description: 'Recalcular el retaceo aunque ya exista',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  forzar_recalculo?: boolean;
}
