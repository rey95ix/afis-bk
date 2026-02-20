import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsDateString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateCompraDetalleDto } from './create-compra-detalle.dto';

export class CreateCompraDto {
  @ApiProperty({
    description: 'Número de factura del proveedor',
    example: 'F001-0001234',
  })
  @IsString()
  numero_factura: string;

  @ApiProperty({
    description: 'Número de quedan (opcional)',
    example: 'Q001-5678',
    required: false,
  })
  @IsOptional()
  @IsString()
  numero_quedan?: string;

  @ApiProperty({
    description: 'Detalle adicional de la compra',
    example: 'Compra de equipos GPON',
    required: false,
  })
  @IsOptional()
  @IsString()
  detalle?: string;

  @ApiProperty({
    description: 'Nombre del proveedor',
    example: 'Proveedor XYZ',
    required: false,
  })
  @IsOptional()
  @IsString()
  nombre_proveedor?: string;

  @ApiProperty({
    description: 'ID del proveedor',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id_proveedor?: number;

  @ApiProperty({
    description: 'ID de la forma de pago (dTEFormaPago)',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id_forma_pago?: number;

  @ApiProperty({
    description: 'Días de crédito otorgados',
    example: 30,
    default: 0,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  dias_credito?: number;

  @ApiProperty({
    description: 'ID de la sucursal donde se registra la compra',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id_sucursal?: number;

  @ApiProperty({
    description: 'ID de la bodega donde ingresará el inventario',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id_bodega?: number;

  @ApiProperty({
    description: 'ID del estante donde se ubicará el inventario (obligatorio si hay líneas de inventario)',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id_estante?: number;

  @ApiProperty({
    description: 'ID del tipo de factura',
    example: 2,
    default: 2,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id_tipo_factura?: number;

  @ApiProperty({
    description: 'Fecha de la factura',
    example: '2025-01-15T10:30:00Z',
    required: false,
  })
  @IsDateString()
  fecha_factura: string;

  @ApiProperty({
    description: 'Fecha de pago programada',
    example: '2025-02-15T10:30:00Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  fecha_de_pago?: string;

  @ApiProperty({
    description: 'Indica si es factura electrónica (DTE)',
    example: false,
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  is_dte?: boolean;

  @ApiProperty({
    description: 'JSON de la factura electrónica (DTE)',
    required: false,
  })
  @IsOptional()
  @IsString()
  json_dte?: string;

  @ApiProperty({
    description: 'Número de control del DTE',
    example: 'DTE-01-00000001-000000000000001',
    required: false,
  })
  @IsOptional()
  @IsString()
  numeroControl?: string;

  @ApiProperty({
    description: 'Código de generación del DTE',
    example: '12345678-1234-1234-1234-123456789012',
    required: false,
  })
  @IsOptional()
  @IsString()
  codigoGeneracion?: string;

  @ApiProperty({
    description: 'Subtotal de la compra (calculado)',
    example: 255.0,
    default: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  subtotal?: number;

  @ApiProperty({
    description: 'Descuento total aplicado',
    example: 10.0,
    default: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  descuento?: number;

  @ApiProperty({
    description: 'CESC (Contribución especial para seguridad ciudadana)',
    example: 0.0,
    default: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  cesc?: number;

  @ApiProperty({
    description: 'FOVIAL (Fondo de conservación vial)',
    example: 0.0,
    default: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  fovial?: number;

  @ApiProperty({
    description: 'COTRANS (Contribución especial al transporte)',
    example: 0.0,
    default: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  cotrans?: number;

  @ApiProperty({
    description: 'IVA aplicado',
    example: 31.85,
    default: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  iva?: number;

  @ApiProperty({
    description: 'IVA retenido',
    example: 0.0,
    default: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  iva_retenido?: number;

  @ApiProperty({
    description: 'IVA percibido',
    example: 0.0,
    default: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  iva_percivido?: number;

  @ApiProperty({
    description: 'Total de la compra',
    example: 276.85,
    default: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  total?: number;

  @ApiProperty({
    description: 'Indica si la compra es a crédito (genera cuenta por pagar)',
    example: false,
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  es_credito?: boolean;

  @ApiProperty({
    description: 'Detalles de los productos de la compra',
    type: [CreateCompraDetalleDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCompraDetalleDto)
  detalles: CreateCompraDetalleDto[];
}
