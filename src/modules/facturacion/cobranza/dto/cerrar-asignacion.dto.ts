// src/modules/facturacion/cobranza/dto/cerrar-asignacion.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class CerrarAsignacionDto {
  @ApiProperty({
    enum: ['CERRADA_PAGADA', 'CERRADA_INCOBRABLE'],
    example: 'CERRADA_PAGADA',
  })
  @IsEnum(['CERRADA_PAGADA', 'CERRADA_INCOBRABLE'])
  estado: 'CERRADA_PAGADA' | 'CERRADA_INCOBRABLE';

  @ApiProperty({ example: 'Cliente pagó la totalidad el 2026-04-10' })
  @IsString()
  @IsNotEmpty()
  motivo: string;
}
