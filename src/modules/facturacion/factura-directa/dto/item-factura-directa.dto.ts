import {
  IsInt,
  IsOptional,
  IsNumber,
  IsString,
  IsEnum,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Tipo de detalle para cada línea de factura
 */
export enum TipoDetalleFactura {
  GRAVADO = 'GRAVADO',     // Aplica IVA 13%
  EXENTA = 'EXENTA',       // Exento de IVA
  NOSUJETO = 'NOSUJETO',   // No sujeto a IVA
  NOGRABADO = 'NOGRABADO', // No gravado (cargos que no afectan base imponible)
}

/**
 * DTO para un item/línea de la factura directa
 */
export class ItemFacturaDirectaDto {
  @ApiPropertyOptional({ description: 'Código/SKU del producto' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  codigo?: string;

  @ApiProperty({ description: 'Nombre del producto o servicio' })
  @IsString()
  @MaxLength(200)
  nombre: string;

  @ApiPropertyOptional({ description: 'Descripción adicional' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descripcion?: string;

  @ApiPropertyOptional({ description: 'Nota adicional' })
  @IsOptional()
  @IsString()
  nota?: string;

  @ApiProperty({ description: 'Cantidad', minimum: 0 })
  @IsNumber()
  @Min(0)
  cantidad: number;

  @ApiPropertyOptional({ description: 'Código de unidad de medida (99=Otro)', default: 99 })
  @IsOptional()
  @IsInt()
  uni_medida?: number;

  @ApiProperty({ description: 'Precio unitario (con IVA si es FC, sin IVA si es CCF)' })
  @IsNumber()
  @Min(0)
  precio_unitario: number;

  @ApiPropertyOptional({ description: 'Precio sin IVA' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  precio_sin_iva?: number;

  @ApiPropertyOptional({ description: 'Precio con IVA' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  precio_con_iva?: number;

  @ApiPropertyOptional({
    description: 'Tipo de detalle: GRAVADO, EXENTA, NOSUJETO, NOGRABADO',
    enum: TipoDetalleFactura,
    default: 'GRAVADO'
  })
  @IsOptional()
  @IsEnum(TipoDetalleFactura)
  tipo_detalle?: TipoDetalleFactura;

  @ApiPropertyOptional({ description: 'Monto de descuento', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  descuento?: number;

  @ApiPropertyOptional({ description: 'ID del catálogo de productos (opcional)' })
  @IsOptional()
  @IsInt()
  id_catalogo?: number;

  @ApiPropertyOptional({ description: 'ID del descuento aplicado (opcional)' })
  @IsOptional()
  @IsInt()
  id_descuento?: number;
}
