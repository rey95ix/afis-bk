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

export class CreateOrdenDto {
  @ApiPropertyOptional({
    description: 'ID del ticket que originó esta orden (opcional)',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  id_ticket?: number;

  @ApiProperty({
    description: 'Tipo de orden de trabajo',
    enum: TipoOrden,
    example: TipoOrden.INCIDENCIA,
  })
  @IsEnum(TipoOrden)
  @IsNotEmpty()
  tipo: TipoOrden;

  @ApiProperty({
    description: 'ID del cliente',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  id_cliente: number;

  @ApiProperty({
    description: 'ID de la dirección donde se realizará el servicio',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  id_direccion_servicio: number;

  @ApiPropertyOptional({
    description: 'ID del técnico asignado (opcional, puede asignarse después)',
    example: 5,
  })
  @IsInt()
  @IsOptional()
  id_tecnico_asignado?: number;

  @ApiPropertyOptional({
    description: 'Observaciones del técnico',
    example: 'Cliente solicita visita en horario de tarde',
  })
  @IsString()
  @IsOptional()
  observaciones_tecnico?: string;
}
