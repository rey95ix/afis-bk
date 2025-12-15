// src/modules/atencion-al-cliente/contratos/dto/marcar-firmado.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class MarcarFirmadoDto {
  @ApiProperty({
    description: 'Observaciones al marcar el contrato como firmado',
    required: false,
    example: 'Contrato firmado por el titular en oficina central',
  })
  @IsOptional()
  @IsString()
  observaciones?: string;
}
