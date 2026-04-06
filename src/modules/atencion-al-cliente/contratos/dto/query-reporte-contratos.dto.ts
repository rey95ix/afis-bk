import { IsEnum, IsOptional, IsDateString, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TipoReporteContrato {
  VENTAS = 'VENTAS',
  RENOVACIONES = 'RENOVACIONES',
}

export class QueryReporteContratosDto {
  @ApiProperty({
    description: 'Tipo de reporte a generar',
    enum: TipoReporteContrato,
    example: TipoReporteContrato.VENTAS,
  })
  @IsEnum(TipoReporteContrato)
  tipo_reporte: TipoReporteContrato;

  @ApiProperty({
    description: 'Fecha de inicio del período (YYYY-MM-DD)',
    example: '2026-01-01',
  })
  @IsDateString()
  fecha_inicio: string;

  @ApiProperty({
    description: 'Fecha de fin del período (YYYY-MM-DD)',
    example: '2026-04-05',
  })
  @IsDateString()
  fecha_fin: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado del contrato',
    example: 'INSTALADO_ACTIVO',
  })
  @IsOptional()
  @IsString()
  estado?: string;
}
