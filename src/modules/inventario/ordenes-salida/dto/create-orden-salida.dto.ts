import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsEnum,
  IsInt,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum TipoOrdenSalida {
  VENTA = 'VENTA',
  DONACION = 'DONACION',
  BAJA_INVENTARIO = 'BAJA_INVENTARIO',
  DEVOLUCION_PROVEEDOR = 'DEVOLUCION_PROVEEDOR',
  TRASLADO_EXTERNO = 'TRASLADO_EXTERNO',
  CONSUMO_INTERNO = 'CONSUMO_INTERNO',
  MERMA = 'MERMA',
  OTRO = 'OTRO',
}

export class CreateOrdenSalidaDetalleDto {
  @ApiProperty({
    description: 'ID del catálogo de producto',
    example: 1,
  })
  @IsNotEmpty()
  @IsInt()
  id_catalogo: number;

  @ApiProperty({
    description: 'Cantidad solicitada',
    example: 10,
    minimum: 1,
  })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  cantidad_solicitada: number;

  @ApiPropertyOptional({
    description: 'Costo unitario del producto',
    example: 25.50,
  })
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

export class CreateOrdenSalidaDto {
  @ApiProperty({
    description: 'Tipo de orden de salida',
    enum: TipoOrdenSalida,
    example: TipoOrdenSalida.VENTA,
  })
  @IsNotEmpty()
  @IsEnum(TipoOrdenSalida)
  tipo: TipoOrdenSalida;

  @ApiProperty({
    description: 'ID de la sucursal de origen',
    example: 1,
  })
  @IsNotEmpty()
  @IsInt()
  id_sucursal_origen: number;

  @ApiProperty({
    description: 'ID de la bodega de origen',
    example: 1,
  })
  @IsNotEmpty()
  @IsInt()
  id_bodega_origen: number;

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

  @ApiProperty({
    description: 'Detalle de los productos a salir',
    type: [CreateOrdenSalidaDetalleDto],
  })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrdenSalidaDetalleDto)
  detalle: CreateOrdenSalidaDetalleDto[];
}
