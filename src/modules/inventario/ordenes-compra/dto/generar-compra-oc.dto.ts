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

  @ApiPropertyOptional({
    description: 'ID del estante donde se almacenará (requerido si hay productos que afectan inventario)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  id_estante?: number;

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

  // Campos opcionales de crédito
  @ApiPropertyOptional({ description: 'Indica si la compra es a crédito (genera cuenta por pagar)' })
  @IsOptional()
  @IsBoolean()
  es_credito?: boolean;

  @ApiPropertyOptional({ description: 'Días de crédito override (por defecto usa el de la OC)' })
  @IsOptional()
  @IsInt()
  dias_credito_override?: number;

  // Campos opcionales de pago
  @ApiPropertyOptional({ description: 'Registrar pago al generar compra' })
  @IsOptional()
  @IsBoolean()
  registrar_pago?: boolean;

  @ApiPropertyOptional({
    description: 'Método de pago',
    example: 'TRANSFERENCIA',
  })
  @IsOptional()
  @IsString()
  metodo_pago?: string;

  @ApiPropertyOptional({ description: 'ID de la cuenta bancaria origen' })
  @IsOptional()
  @IsInt()
  id_cuenta_bancaria?: number;

  @ApiPropertyOptional({ description: 'Número de cheque (si método = CHEQUE)' })
  @IsOptional()
  @IsString()
  cheque_numero?: string;

  @ApiPropertyOptional({ description: 'Beneficiario del cheque' })
  @IsOptional()
  @IsString()
  cheque_beneficiario?: string;

  @ApiPropertyOptional({ description: 'Fecha emisión cheque (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  cheque_fecha_emision?: string;
}
