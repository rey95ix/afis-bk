import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class CrearCuotaManualDto {
  @ApiProperty({ description: 'Fecha de vencimiento de la cuota (ISO 8601)' })
  @IsDateString()
  fecha_vencimiento: string;

  @ApiProperty({ description: 'Inicio del período facturado (ISO 8601)' })
  @IsDateString()
  periodo_inicio: string;

  @ApiProperty({ description: 'Fin del período facturado (ISO 8601)' })
  @IsDateString()
  periodo_fin: string;
}
