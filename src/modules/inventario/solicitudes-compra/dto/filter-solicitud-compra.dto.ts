import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsInt, IsString, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export enum EstadoSolicitudCompra {
  BORRADOR = 'BORRADOR',
  PENDIENTE_REVISION = 'PENDIENTE_REVISION',
  AUTORIZADA = 'AUTORIZADA',
  EN_COTIZACION = 'EN_COTIZACION',
  COTIZACION_APROBADA = 'COTIZACION_APROBADA',
  RECHAZADA = 'RECHAZADA',
  CANCELADA = 'CANCELADA',
}

export enum PrioridadSolicitudCompra {
  BAJA = 'BAJA',
  MEDIA = 'MEDIA',
  ALTA = 'ALTA',
  URGENTE = 'URGENTE',
}

export class FilterSolicitudCompraDto {
  @ApiPropertyOptional({
    description: 'Estado de la solicitud de compra',
    enum: EstadoSolicitudCompra,
  })
  @IsOptional()
  @IsEnum(EstadoSolicitudCompra)
  estado?: EstadoSolicitudCompra;

  @ApiPropertyOptional({
    description: 'Prioridad de la solicitud',
    enum: PrioridadSolicitudCompra,
  })
  @IsOptional()
  @IsEnum(PrioridadSolicitudCompra)
  prioridad?: PrioridadSolicitudCompra;

  @ApiPropertyOptional({
    description: 'Búsqueda por texto (código o motivo)',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Fecha desde (ISO 8601)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @ApiPropertyOptional({
    description: 'Fecha hasta (ISO 8601)',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;

  @ApiPropertyOptional({
    description: 'Página',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de registros por página',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number = 10;
}
