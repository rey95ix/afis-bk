import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TipoOrden {
  INCIDENCIA = 'INCIDENCIA',
  INSTALACION = 'INSTALACION',
  MANTENIMIENTO = 'MANTENIMIENTO',
  REUBICACION = 'REUBICACION',
  RETIRO = 'RETIRO',
  MEJORA = 'MEJORA',
}

export class EscalarTicketDto {
  @ApiProperty({
    description: 'Tipo de orden de trabajo a crear',
    enum: TipoOrden,
    example: TipoOrden.INCIDENCIA,
  })
  @IsEnum(TipoOrden)
  @IsNotEmpty()
  tipo: TipoOrden;

  @ApiPropertyOptional({
    description: 'ID del técnico a asignar (opcional, puede asignarse después)',
    example: 5,
  })
  @IsInt()
  @IsOptional()
  id_tecnico_asignado: number;

  @ApiPropertyOptional({
    description: 'Observaciones adicionales para la orden de trabajo',
    example: 'Cliente requiere atención urgente, sin servicio por más de 24 horas',
  })
  @IsString()
  @IsOptional()
  observaciones?: string;
}
