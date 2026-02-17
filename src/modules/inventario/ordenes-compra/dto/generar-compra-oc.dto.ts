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

export class GenerarCompraOcDetalleDto {
  @ApiProperty({
    description: 'ID del detalle de la orden de compra',
    example: 1,
  })
  @IsNotEmpty()
  @IsInt()
  id_orden_compra_detalle: number;

  @ApiProperty({
    description: 'Cantidad a recibir (debe ser <= cantidad restante)',
    example: 50,
    minimum: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  cantidad_a_recibir: number;

  @ApiPropertyOptional({
    description: 'Costo unitario override (opcional, usa el de la OC si no se proporciona)',
    example: 26.00,
  })
  @IsOptional()
  @IsNumber()
  costo_unitario?: number;

  @ApiPropertyOptional({
    description: 'Números de serie (requerido si tiene_serie=true)',
    example: ['SN-001', 'SN-002'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  series?: string[];
}

export class GenerarCompraOcDto {
  @ApiProperty({
    description: 'Número de factura del proveedor',
    example: 'F001-0001',
  })
  @IsNotEmpty()
  @IsString()
  numero_factura: string;

  @ApiPropertyOptional({
    description: 'Número de quedan',
    example: 'Q001-0001',
  })
  @IsOptional()
  @IsString()
  numero_quedan?: string;

  @ApiProperty({
    description: 'ID del estante donde se almacenará',
    example: 1,
  })
  @IsNotEmpty()
  @IsInt()
  id_estante: number;

  @ApiPropertyOptional({
    description: 'ID del tipo de factura',
    example: 2,
  })
  @IsOptional()
  @IsInt()
  id_tipo_factura?: number;

  @ApiProperty({
    description: 'Fecha de factura (ISO 8601)',
    example: '2026-02-17',
  })
  @IsNotEmpty()
  @IsDateString()
  fecha_factura: string;

  @ApiPropertyOptional({
    description: 'Fecha de pago (ISO 8601)',
    example: '2026-03-17',
  })
  @IsOptional()
  @IsDateString()
  fecha_de_pago?: string;

  @ApiPropertyOptional({
    description: 'Es DTE',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  is_dte?: boolean;

  @ApiPropertyOptional({
    description: 'JSON del DTE',
  })
  @IsOptional()
  @IsString()
  json_dte?: string;

  @ApiPropertyOptional({
    description: 'Número de control DTE',
  })
  @IsOptional()
  @IsString()
  numeroControl?: string;

  @ApiPropertyOptional({
    description: 'Código de generación DTE',
  })
  @IsOptional()
  @IsString()
  codigoGeneracion?: string;

  @ApiProperty({
    description: 'Detalle de líneas a recibir',
    type: [GenerarCompraOcDetalleDto],
  })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GenerarCompraOcDetalleDto)
  detalles: GenerarCompraOcDetalleDto[];
}
