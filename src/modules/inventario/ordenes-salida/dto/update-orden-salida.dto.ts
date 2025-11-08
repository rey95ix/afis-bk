import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsEnum,
  IsInt,
  IsString,
  IsArray,
  ValidateNested,
  Min,
  IsNumber,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { TipoOrdenSalida } from './create-orden-salida.dto';

export class UpdateOrdenSalidaDetalleDto {
  @ApiPropertyOptional({
    description: 'ID del detalle (si existe)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  id_orden_salida_detalle?: number;

  @ApiPropertyOptional({
    description: 'ID del catálogo de producto',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  id_catalogo?: number;

  @ApiPropertyOptional({
    description: 'Cantidad solicitada',
    example: 10,
    minimum: 1,
  })
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsInt()
  @Min(1)
  cantidad_solicitada?: number;

  @ApiPropertyOptional({
    description: 'Costo unitario del producto',
    example: 25.50,
  })
  @Transform(({ value }) => parseFloat(value))
  @IsOptional()
  @IsNumber()
  costo_unitario?: number;

  @ApiPropertyOptional({
    description: 'Observaciones del item',
    example: 'Material en buen estado',
  })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class UpdateOrdenSalidaDto {
  @ApiPropertyOptional({
    description: 'Tipo de orden de salida',
    enum: TipoOrdenSalida,
    example: TipoOrdenSalida.VENTA,
  })
  @IsOptional()
  @IsEnum(TipoOrdenSalida)
  tipo?: TipoOrdenSalida;

  @ApiPropertyOptional({
    description: 'ID de la sucursal de origen',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  id_sucursal_origen?: number;

  @ApiPropertyOptional({
    description: 'ID de la bodega de origen',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  id_bodega_origen?: number;

  @ApiPropertyOptional({
    description: 'ID del estante (opcional)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  id_estante?: number;

  @ApiPropertyOptional({
    description: 'Motivo de la salida',
    example: 'Venta de productos según orden del cliente',
  })
  @IsOptional()
  @IsString()
  motivo?: string;

  @ApiPropertyOptional({
    description: 'Detalle de los productos a salir',
    type: [UpdateOrdenSalidaDetalleDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateOrdenSalidaDetalleDto)
  detalle?: UpdateOrdenSalidaDetalleDto[];
}
