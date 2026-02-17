import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AprobarOrdenCompraDto {
  @ApiPropertyOptional({
    description: 'Observaciones de la aprobación',
    example: 'Aprobado según presupuesto del mes',
  })
  @IsOptional()
  @IsString()
  observaciones_aprobacion?: string;
}
