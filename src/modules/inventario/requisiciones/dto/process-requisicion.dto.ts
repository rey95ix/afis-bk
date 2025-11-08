// src/modules/inventario/requisiciones/dto/process-requisicion.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class ProcessRequisicionDto {
  @ApiProperty({
    description: 'Observaciones del proceso',
    example: 'Transferencia completada sin novedades',
    required: false,
  })
  @IsOptional()
  @IsString()
  observaciones_proceso?: string;
}
