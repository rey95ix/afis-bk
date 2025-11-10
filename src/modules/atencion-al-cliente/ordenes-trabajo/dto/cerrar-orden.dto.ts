import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ResultadoOrden {
  RESUELTO = 'RESUELTO',
  NO_RESUELTO = 'NO_RESUELTO',
  REQUIERE_SEGUNDA_VISITA = 'REQUIERE_SEGUNDA_VISITA',
  CLIENTE_AUSENTE = 'CLIENTE_AUSENTE',
  ACCESO_DENEGADO = 'ACCESO_DENEGADO',
  FALLO_EQUIPO = 'FALLO_EQUIPO',
}

export class CerrarOrdenDto {
  @ApiProperty({
    description: 'Resultado de la orden de trabajo',
    enum: ResultadoOrden,
    example: ResultadoOrden.RESUELTO,
  })
  @IsEnum(ResultadoOrden)
  @IsNotEmpty()
  resultado: ResultadoOrden;

  @ApiPropertyOptional({
    description: 'ID del motivo de cierre del catálogo',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  id_motivo_cierre?: number;

  @ApiPropertyOptional({
    description: 'Notas de cierre del técnico',
    example: 'Servicio restablecido después de reemplazar ONU defectuosa',
  })
  @IsString()
  @IsOptional()
  notas_cierre?: string;

  @ApiPropertyOptional({
    description: 'Calificación del cliente (1-5)',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  calificacion_cliente?: number;
}
