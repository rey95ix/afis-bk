import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsInt, IsString, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { TipoOrdenSalida } from './create-orden-salida.dto';

export enum EstadoOrdenSalida {
  BORRADOR = 'BORRADOR',
  PENDIENTE_AUTORIZACION = 'PENDIENTE_AUTORIZACION',
  AUTORIZADA = 'AUTORIZADA',
  RECHAZADA = 'RECHAZADA',
  PROCESADA = 'PROCESADA',
  CANCELADA = 'CANCELADA',
}

export class FilterOrdenSalidaDto {
  @ApiPropertyOptional({
    description: 'Estado de la orden',
    enum: EstadoOrdenSalida,
    example: EstadoOrdenSalida.PENDIENTE_AUTORIZACION,
  })
  @IsOptional()
  @IsEnum(EstadoOrdenSalida)
  estado?: EstadoOrdenSalida;

  @ApiPropertyOptional({
    description: 'Tipo de orden',
    enum: TipoOrdenSalida,
    example: TipoOrdenSalida.VENTA,
  })
  @IsOptional()
  @IsEnum(TipoOrdenSalida)
  tipo?: TipoOrdenSalida;

  @ApiPropertyOptional({
    description: 'ID de bodega de origen',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_bodega_origen?: number;

  @ApiPropertyOptional({
    description: 'ID de sucursal de origen',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_sucursal_origen?: number;

  @ApiPropertyOptional({
    description: 'ID de usuario solicitante',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_usuario_solicita?: number;

  @ApiPropertyOptional({
    description: 'Código de la orden',
    example: 'OS-202511-00001',
  })
  @IsOptional()
  @IsString()
  codigo?: string;

  @ApiPropertyOptional({
    description: 'Fecha desde (ISO 8601)',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @ApiPropertyOptional({
    description: 'Fecha hasta (ISO 8601)',
    example: '2025-12-31',
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
