import { IsEnum, IsInt, IsOptional, IsDateString, IsBoolean, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { TipoOrden } from './create-orden.dto';

export enum ResultadoOrden {
  RESUELTO = 'RESUELTO',
  NO_RESUELTO = 'NO_RESUELTO',
  REQUIERE_SEGUNDA_VISITA = 'REQUIERE_SEGUNDA_VISITA',
  CLIENTE_AUSENTE = 'CLIENTE_AUSENTE',
  ACCESO_DENEGADO = 'ACCESO_DENEGADO',
  FALLO_EQUIPO = 'FALLO_EQUIPO',
}

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

  // Filtra OTs que NO tienen técnico asignado (id_tecnico_asignado IS NULL)
  @ApiPropertyOptional({
    description: 'Solo órdenes sin técnico asignado',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  sin_tecnico?: boolean;

  // Filtra por resultado de cierre (solo OTs ya cerradas tendrán valor)
  @ApiPropertyOptional({
    description: 'Filtrar por resultado de cierre',
    enum: ResultadoOrden,
    example: ResultadoOrden.RESUELTO,
  })
  @IsEnum(ResultadoOrden)
  @IsOptional()
  resultado?: ResultadoOrden;

  // Filtra por contrato relacionado
  @ApiPropertyOptional({
    description: 'Filtrar por ID de contrato asociado',
    example: 12,
  })
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  id_contrato?: number;

  // true: solo OTs originadas desde un ticket; false: solo OTs creadas manualmente
  @ApiPropertyOptional({
    description: 'Filtrar OTs según si tienen ticket de origen (true/false)',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  con_ticket?: boolean;

  // Búsqueda parcial por código de OT (OT-YYYYMM-#####) o por nombre del cliente (titular).
  // Insensible a mayúsculas y a tildes/acentos (usa unaccent en el backend).
  @ApiPropertyOptional({
    description:
      'Búsqueda parcial por código de la orden o por nombre del cliente. Insensible a tildes y mayúsculas.',
    example: 'Garcia',
  })
  @IsString()
  @IsOptional()
  codigo?: string;

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
