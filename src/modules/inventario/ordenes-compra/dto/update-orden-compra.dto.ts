import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsInt,
  IsString,
  IsArray,
  ValidateNested,
  Min,
  IsNumber,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateOrdenCompraDetalleDto {
  @ApiPropertyOptional({
    description: 'ID del detalle (si existe)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  id_orden_compra_detalle?: number;

  @ApiPropertyOptional({
    description: 'ID del catálogo de producto',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  id_catalogo?: number;

  @ApiPropertyOptional({
    description: 'Código del producto',
  })
  @IsOptional()
  @IsString()
  codigo?: string;

  @ApiPropertyOptional({
    description: 'Nombre del producto',
  })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional({
    description: 'Descripción del producto',
  })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({
    description: 'Indica si el producto maneja series',
  })
  @IsOptional()
  @IsBoolean()
  tiene_serie?: boolean;

  @ApiPropertyOptional({
    description: 'Cantidad a ordenar',
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  cantidad_ordenada?: number;

  @ApiPropertyOptional({
    description: 'Costo unitario del producto',
  })
  @IsOptional()
  @IsNumber()
  costo_unitario?: number;

  @ApiPropertyOptional({
    description: 'Porcentaje de descuento',
  })
  @IsOptional()
  @IsNumber()
  descuento_porcentaje?: number;

  @ApiPropertyOptional({
    description: 'Monto de descuento',
  })
  @IsOptional()
  @IsNumber()
  descuento_monto?: number;

  @ApiPropertyOptional({
    description: 'Observaciones del item',
  })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class UpdateOrdenCompraDto {
  @ApiPropertyOptional({
    description: 'ID del proveedor',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  id_proveedor?: number;

  @ApiPropertyOptional({
    description: 'ID de la sucursal de destino',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  id_sucursal?: number;

  @ApiPropertyOptional({
    description: 'ID de la bodega de destino',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  id_bodega?: number;

  @ApiPropertyOptional({
    description: 'ID de la forma de pago',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  id_forma_pago?: number;

  @ApiPropertyOptional({
    description: 'Días de crédito',
  })
  @IsOptional()
  @IsInt()
  dias_credito?: number;

  @ApiPropertyOptional({
    description: 'Moneda',
  })
  @IsOptional()
  @IsString()
  moneda?: string;

  @ApiPropertyOptional({
    description: 'Motivo de la orden de compra',
  })
  @IsOptional()
  @IsString()
  motivo?: string;

  @ApiPropertyOptional({
    description: 'Observaciones generales',
  })
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiPropertyOptional({
    description: 'Fecha de entrega esperada (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  fecha_entrega_esperada?: string;

  @ApiPropertyOptional({
    description: 'Detalle de los productos',
    type: [UpdateOrdenCompraDetalleDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateOrdenCompraDetalleDto)
  detalle?: UpdateOrdenCompraDetalleDto[];
}
