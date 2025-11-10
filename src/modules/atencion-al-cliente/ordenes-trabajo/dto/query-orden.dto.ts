import { IsEnum, IsInt, IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TipoOrden } from './create-orden.dto';

export enum EstadoOrden {
  PENDIENTE_ASIGNACION = 'PENDIENTE_ASIGNACION',
  ASIGNADA = 'ASIGNADA',
  AGENDADA = 'AGENDADA',
  EN_RUTA = 'EN_RUTA',
  EN_PROGRESO = 'EN_PROGRESO',
  EN_ESPERA_CLIENTE = 'EN_ESPERA_CLIENTE',
  REPROGRAMADA = 'REPROGRAMADA',
  COMPLETADA = 'COMPLETADA',
  CANCELADA = 'CANCELADA',
}

export class QueryOrdenDto {
  @ApiPropertyOptional({
    description: 'Filtrar por estado de la orden',
    enum: EstadoOrden,
    example: EstadoOrden.PENDIENTE_ASIGNACION,
  })
  @IsEnum(EstadoOrden)
  @IsOptional()
  estado?: EstadoOrden;

  @ApiPropertyOptional({
    description: 'Filtrar por ID del técnico asignado',
    example: 5,
  })
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  id_tecnico?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por tipo de orden',
    enum: TipoOrden,
    example: TipoOrden.INCIDENCIA,
  })
  @IsEnum(TipoOrden)
  @IsOptional()
  tipo?: TipoOrden;

  @ApiPropertyOptional({
    description: 'Filtrar por ID del cliente',
    example: 1,
  })
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  id_cliente?: number;

  @ApiPropertyOptional({
    description: 'Filtrar desde fecha de creación (formato ISO 8601)',
    example: '2025-11-01',
  })
  @IsDateString()
  @IsOptional()
  fecha_desde?: string;

  @ApiPropertyOptional({
    description: 'Filtrar hasta fecha de creación (formato ISO 8601)',
    example: '2025-11-30',
  })
  @IsDateString()
  @IsOptional()
  fecha_hasta?: string;

  @ApiPropertyOptional({
    description: 'Página actual para paginación',
    example: 1,
    default: 1,
  })
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de registros por página',
    example: 10,
    default: 10,
  })
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  limit?: number = 10;
}
