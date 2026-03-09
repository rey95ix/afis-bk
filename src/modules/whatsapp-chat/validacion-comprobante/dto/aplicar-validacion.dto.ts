import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class AplicarValidacionDto {
  @ApiPropertyOptional({ description: 'ID del contrato para registrar pago automático' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  idContrato?: number;
}
