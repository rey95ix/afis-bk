import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsBoolean, IsOptional, IsString } from 'class-validator';

export class AutorizarAjusteDto {
  @ApiProperty({
    description: 'true = autorizar, false = rechazar',
    example: true,
  })
  @IsNotEmpty()
  @IsBoolean()
  autorizado: boolean;

  @ApiPropertyOptional({
    description: 'Observaciones de la autorización/rechazo',
    example: 'Aprobado. Discrepancias justificadas por auditoría física.',
  })
  @IsOptional()
  @IsString()
  observaciones_autorizacion?: string;

  @ApiPropertyOptional({
    description: 'Motivo del rechazo (requerido si autorizado = false)',
    example: 'Discrepancia muy alta, requiere investigación adicional',
  })
  @IsOptional()
  @IsString()
  motivo_rechazo?: string;
}
