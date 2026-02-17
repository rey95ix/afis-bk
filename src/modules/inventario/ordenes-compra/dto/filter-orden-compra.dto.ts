import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsInt, IsString, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export enum EstadoOrdenCompra {
  BORRADOR = 'BORRADOR',
  PENDIENTE_APROBACION = 'PENDIENTE_APROBACION',
  APROBADA = 'APROBADA',
  RECHAZADA = 'RECHAZADA',
  EMITIDA = 'EMITIDA',
  RECEPCION_PARCIAL = 'RECEPCION_PARCIAL',
  RECEPCION_TOTAL = 'RECEPCION_TOTAL',
  CERRADA = 'CERRADA',
  CANCELADA = 'CANCELADA',
}

export class FilterOrdenCompraDto {
  @ApiPropertyOptional({
    description: 'Estado de la orden de compra',
    enum: EstadoOrdenCompra,
  })
  @IsOptional()
  @IsEnum(EstadoOrdenCompra)
  estado?: EstadoOrdenCompra;

  @ApiPropertyOptional({
    description: 'ID del proveedor',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_proveedor?: number;

  @ApiPropertyOptional({
    description: 'ID de sucursal',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_sucursal?: number;

  @ApiPropertyOptional({
    description: 'ID de bodega',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_bodega?: number;

  @ApiPropertyOptional({
    description: 'Código de la orden de compra',
    example: 'OC-202602-00001',
  })
  @IsOptional()
  @IsString()
  codigo?: string;

  @ApiPropertyOptional({
    description: 'Búsqueda por texto',
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
