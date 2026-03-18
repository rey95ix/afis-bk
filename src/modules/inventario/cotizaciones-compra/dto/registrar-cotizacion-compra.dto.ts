import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsInt, IsString, IsOptional, IsArray, ValidateNested, IsNumber, Min, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CotizacionCompraDetalleDto {
  @ApiProperty({ description: 'ID del detalle de solicitud correspondiente' })
  @IsNotEmpty()
  @IsInt()
  id_solicitud_compra_detalle: number;

  @ApiProperty({ description: 'Costo unitario del proveedor', example: 25.50 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  costo_unitario: number;

  @ApiPropertyOptional({ description: 'Porcentaje de descuento', example: 5 })
  @IsOptional()
  @IsNumber()
  descuento_porcentaje?: number;

  @ApiPropertyOptional({ description: 'Monto de descuento', example: 12.75 })
  @IsOptional()
  @IsNumber()
  descuento_monto?: number;

  @ApiPropertyOptional({ description: 'Disponibilidad', example: 'En stock' })
  @IsOptional()
  @IsString()
  disponibilidad?: string;

  @ApiPropertyOptional({ description: 'Observaciones' })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class RegistrarCotizacionCompraDto {
  @ApiProperty({ description: 'ID de la solicitud de compra' })
  @IsNotEmpty()
  @IsInt()
  id_solicitud_compra: number;

  @ApiProperty({ description: 'ID del proveedor' })
  @IsNotEmpty()
  @IsInt()
  id_proveedor: number;

  @ApiPropertyOptional({ description: 'Número de cotización del proveedor' })
  @IsOptional()
  @IsString()
  numero_cotizacion?: string;

  @ApiPropertyOptional({ description: 'Fecha de la cotización (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  fecha_cotizacion?: string;

  @ApiPropertyOptional({ description: 'Fecha de vencimiento de la cotización' })
  @IsOptional()
  @IsDateString()
  fecha_vencimiento?: string;

  @ApiPropertyOptional({ description: 'Condiciones de pago' })
  @IsOptional()
  @IsString()
  condiciones_pago?: string;

  @ApiPropertyOptional({ description: 'Días de crédito' })
  @IsOptional()
  @IsInt()
  dias_credito?: number;

  @ApiPropertyOptional({ description: 'Días estimados de entrega' })
  @IsOptional()
  @IsInt()
  dias_entrega?: number;

  @ApiPropertyOptional({ description: 'Moneda', example: 'USD' })
  @IsOptional()
  @IsString()
  moneda?: string;

  @ApiPropertyOptional({ description: 'Ruta del archivo de cotización en MinIO' })
  @IsOptional()
  @IsString()
  archivo_cotizacion?: string;

  @ApiPropertyOptional({ description: 'Observaciones' })
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiProperty({ description: 'Detalle de precios por item', type: [CotizacionCompraDetalleDto] })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CotizacionCompraDetalleDto)
  detalle: CotizacionCompraDetalleDto[];
}
