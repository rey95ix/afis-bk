import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsInt,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
  IsNumber,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrdenCompraDetalleDto {
  @ApiPropertyOptional({
    description: 'ID del catálogo de producto',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  id_catalogo?: number;

  @ApiPropertyOptional({
    description: 'Código del producto',
    example: 'PROD-001',
  })
  @IsOptional()
  @IsString()
  codigo?: string;

  @ApiProperty({
    description: 'Nombre del producto',
    example: 'Cable UTP Cat6',
  })
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @ApiPropertyOptional({
    description: 'Descripción del producto',
    example: 'Cable UTP categoría 6 exterior',
  })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({
    description: 'Indica si el producto maneja series',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  tiene_serie?: boolean;

  @ApiPropertyOptional({
    description: 'Indica si el producto afecta inventario (false para servicios/gastos)',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  afecta_inventario?: boolean;

  @ApiProperty({
    description: 'Cantidad a ordenar',
    example: 100,
    minimum: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  cantidad_ordenada: number;

  @ApiPropertyOptional({
    description: 'Costo unitario del producto',
    example: 25.50,
  })
  @IsOptional()
  @IsNumber()
  costo_unitario?: number;

  @ApiPropertyOptional({
    description: 'Porcentaje de descuento',
    example: 5,
  })
  @IsOptional()
  @IsNumber()
  descuento_porcentaje?: number;

  @ApiPropertyOptional({
    description: 'Monto de descuento',
    example: 12.75,
  })
  @IsOptional()
  @IsNumber()
  descuento_monto?: number;

  @ApiPropertyOptional({
    description: 'Observaciones del item',
    example: 'Entrega parcial aceptada',
  })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class CreateOrdenCompraDto {
  @ApiProperty({
    description: 'ID del proveedor',
    example: 1,
  })
  @IsNotEmpty()
  @IsInt()
  id_proveedor: number;

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
    example: 30,
  })
  @IsOptional()
  @IsInt()
  dias_credito?: number;

  @ApiPropertyOptional({
    description: 'Moneda',
    example: 'USD',
  })
  @IsOptional()
  @IsString()
  moneda?: string;

  @ApiPropertyOptional({
    description: 'Motivo de la orden de compra',
    example: 'Reposición de inventario mensual',
  })
  @IsOptional()
  @IsString()
  motivo?: string;

  @ApiPropertyOptional({
    description: 'Observaciones generales',
    example: 'Coordinar entrega con bodega central',
  })
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiPropertyOptional({
    description: 'Fecha de entrega esperada (ISO 8601)',
    example: '2026-03-15',
  })
  @IsOptional()
  @IsDateString()
  fecha_entrega_esperada?: string;

  @ApiProperty({
    description: 'Detalle de los productos a comprar',
    type: [CreateOrdenCompraDetalleDto],
  })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrdenCompraDetalleDto)
  detalle: CreateOrdenCompraDetalleDto[];
}
