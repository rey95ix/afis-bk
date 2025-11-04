import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateActividadDto {
  @ApiPropertyOptional({
    description: 'ID de la solución del catálogo',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  id_solucion?: number;

  @ApiProperty({
    description: 'Descripción de la actividad realizada',
    example: 'Ajuste de potencia en puerto OLT',
  })
  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @ApiPropertyOptional({
    description: 'Valor medido durante la actividad (potencia, SNR, latencia, etc.)',
    example: '-22 dBm',
  })
  @IsString()
  @IsOptional()
  valor_medido?: string;

  @ApiPropertyOptional({
    description: 'Indica si la actividad requiere firma del cliente',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  requerido_firma?: boolean;

  @ApiPropertyOptional({
    description: 'Indica si la actividad fue completada',
    example: true,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  completado?: boolean;
}
