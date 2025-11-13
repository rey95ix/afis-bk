import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class FinalizarAuditoriaDto {
  @ApiPropertyOptional({
    description: 'Observaciones finales de la auditoría',
    example: 'Auditoría completada. Se encontraron discrepancias menores en categoría de cables.',
  })
  @IsOptional()
  @IsString()
  observaciones?: string;
}
