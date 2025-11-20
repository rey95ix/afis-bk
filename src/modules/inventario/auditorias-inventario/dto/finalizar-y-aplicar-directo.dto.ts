import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class FinalizarYAplicarDirectoDto {
  @ApiPropertyOptional({
    description:
      'Observaciones de la finalización y aplicación directa del levantamiento',
    example:
      'Levantamiento físico completado. Ajustes aplicados automáticamente al inventario.',
  })
  @IsOptional()
  @IsString()
  observaciones?: string;
}
