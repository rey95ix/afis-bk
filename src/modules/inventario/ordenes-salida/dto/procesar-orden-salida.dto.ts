import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsInt,
  IsString,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class ProcesarOrdenSalidaDto {
  @ApiPropertyOptional({
    description: 'Observaciones del proceso',
    example: 'Salida procesada exitosamente',
  })
  @IsOptional()
  @IsString()
  observaciones_proceso?: string;

  @ApiPropertyOptional({
    description: 'Fecha efectiva de salida física (ISO 8601)',
    example: '2025-11-08T10:30:00Z',
  })
  @IsOptional()
  @IsDateString()
  fecha_salida_efectiva?: string;
}

export class CancelarOrdenSalidaDto {
  @ApiProperty({
    description: 'Motivo de la cancelación',
    example: 'Solicitud cancelada por el cliente',
  })
  @IsNotEmpty()
  @IsString()
  motivo: string;
}
