import {
  IsInt,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  IsString,
  Min,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para un item/línea del cobro
 */
export class ItemCobroDto {
  @ApiProperty({ description: 'Tipo de item: 1=Bienes, 2=Servicios, 3=Ambos, 4=Tributo' })
  @IsInt()
  @IsEnum([1, 2, 3, 4])
  tipoItem: number;

  @ApiPropertyOptional({ description: 'Código/SKU del producto o servicio' })
  @IsOptional()
  @IsString()
  codigo?: string;

  @ApiProperty({ description: 'Descripción del item' })
  @IsString()
  descripcion: string;

  @ApiProperty({ description: 'Cantidad', minimum: 0 })
  @IsNumber()
  @Min(0)
  cantidad: number;

  @ApiProperty({ description: 'Código de unidad de medida (1=Unidad, 59=Servicio, 99=Otro)' })
  @IsInt()
  uniMedida: number;

  @ApiProperty({ description: 'Precio unitario sin IVA' })
  @IsNumber()
  @Min(0)
  precioUnitario: number;

  @ApiPropertyOptional({ description: 'Monto de descuento para este item' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  descuento?: number;

  @ApiPropertyOptional({ description: 'true si es venta gravada con IVA' })
  @IsOptional()
  @IsBoolean()
  esGravado?: boolean;

  @ApiPropertyOptional({ description: 'true si es venta exenta' })
  @IsOptional()
  @IsBoolean()
  esExento?: boolean;

  @ApiPropertyOptional({ description: 'true si es venta no sujeta' })
  @IsOptional()
  @IsBoolean()
  esNoSujeto?: boolean;

  @ApiPropertyOptional({ description: 'ID del catálogo de productos (opcional)' })
  @IsOptional()
  @IsInt()
  idCatalogo?: number;
}

/**
 * DTO para información de pago
 */
export class PagoCobroDto {
  @ApiProperty({ description: 'Código de forma de pago (01=Efectivo, 02=Tarjeta, etc.)' })
  @IsString()
  codigo: string;

  @ApiProperty({ description: 'Monto del pago' })
  @IsNumber()
  @Min(0)
  monto: number;

  @ApiPropertyOptional({ description: 'Referencia del pago (número de cheque, etc.)' })
  @IsOptional()
  @IsString()
  referencia?: string;

  @ApiPropertyOptional({ description: 'Código de plazo (01=Días, 02=Meses, 03=Años)' })
  @IsOptional()
  @IsString()
  plazo?: string;

  @ApiPropertyOptional({ description: 'Cantidad de períodos del plazo' })
  @IsOptional()
  @IsInt()
  periodo?: number;
}

/**
 * DTO principal para crear un cobro/factura
 */
export class CrearCobroDto {
  @ApiProperty({ description: 'ID del contrato asociado al cobro' })
  @IsInt()
  idContrato: number;

  @ApiPropertyOptional({ description: 'ID de los datos de facturación del cliente (si difiere del default)' })
  @IsOptional()
  @IsInt()
  idClienteFacturacion?: number;

  @ApiPropertyOptional({ description: 'ID de la sucursal emisora (si difiere del default)' })
  @IsOptional()
  @IsInt()
  idSucursal?: number;

  @ApiProperty({ description: 'Período facturado (ej: "Enero 2025")' })
  @IsString()
  periodoFacturado: string;

  @ApiProperty({
    description: 'Items/líneas del cobro',
    type: [ItemCobroDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemCobroDto)
  items: ItemCobroDto[];

  @ApiPropertyOptional({ description: 'Condición de operación: 1=Contado, 2=Crédito, 3=Otro' })
  @IsOptional()
  @IsInt()
  @IsEnum([1, 2, 3])
  condicionOperacion?: number;

  @ApiPropertyOptional({
    description: 'Formas de pago (requerido si condicionOperacion != 1)',
    type: [PagoCobroDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PagoCobroDto)
  pagos?: PagoCobroDto[];

  @ApiPropertyOptional({ description: 'Aplicar mora de facturas vencidas' })
  @IsOptional()
  @IsBoolean()
  aplicarMora?: boolean;

  @ApiPropertyOptional({ description: 'Observaciones para la extensión del DTE' })
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiPropertyOptional({ description: 'Número de pago electrónico (si aplica)' })
  @IsOptional()
  @IsString()
  numPagoElectronico?: string;
}
