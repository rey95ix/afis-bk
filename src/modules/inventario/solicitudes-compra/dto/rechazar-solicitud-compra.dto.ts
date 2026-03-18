import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RechazarSolicitudCompraDto {
  @ApiProperty({ description: 'Motivo del rechazo' })
  @IsNotEmpty()
  @IsString()
  motivo_rechazo: string;

  @ApiPropertyOptional({ description: 'Observaciones de revisión' })
  @IsOptional()
  @IsString()
  observaciones_revision?: string;
}
