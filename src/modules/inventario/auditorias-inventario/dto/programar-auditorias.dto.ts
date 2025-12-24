import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsEnum, IsDateString, IsInt, IsOptional, IsBoolean } from 'class-validator';

export enum FrecuenciaAuditoria {
  TRIMESTRAL = 'TRIMESTRAL',
  SEMESTRAL = 'SEMESTRAL',
  ANUAL = 'ANUAL',
}

export enum TipoAuditoriaPrograma {
  COMPLETA = 'COMPLETA',
  PARCIAL = 'PARCIAL',
}

export class ProgramarAuditoriasDto {
  @ApiProperty({
    description: 'Frecuencia de las auditorías a programar',
    enum: FrecuenciaAuditoria,
    example: FrecuenciaAuditoria.TRIMESTRAL,
  })
  @IsNotEmpty()
  @IsEnum(FrecuenciaAuditoria)
  frecuencia: FrecuenciaAuditoria;

  @ApiProperty({
    description: 'Tipo de auditoría',
    enum: TipoAuditoriaPrograma,
    example: TipoAuditoriaPrograma.COMPLETA,
  })
  @IsNotEmpty()
  @IsEnum(TipoAuditoriaPrograma)
  tipo: TipoAuditoriaPrograma;

  @ApiProperty({
    description: 'Fecha de inicio de la auditoría',
    example: '2024-12-24',
  })
  @IsNotEmpty()
  @IsDateString()
  fechaInicio: string;

  @ApiPropertyOptional({
    description: 'ID de bodega específica (si no se especifica, programa para todas las bodegas activas)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  id_bodega?: number;

  @ApiPropertyOptional({
    description: 'Notificar a responsables de la auditoría programada',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  notificar?: boolean;
}
