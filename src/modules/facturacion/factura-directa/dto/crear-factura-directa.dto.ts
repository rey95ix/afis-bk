import {
  IsInt,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  IsString,
  IsEmail,
  Min,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ItemFacturaDirectaDto } from './item-factura-directa.dto';

/**
 * DTO para información de pago en factura directa
 */
export class PagoFacturaDirectaDto {
  @ApiProperty({ description: 'Código de forma de pago (01=Efectivo, 02=Cheque, 03=Tarjeta, 04=Transferencia)' })
  @IsString()
  codigo: string;

  @ApiProperty({ description: 'Monto del pago' })
  @IsNumber()
  @Min(0)
  monto: number;

  @ApiPropertyOptional({ description: 'Referencia del pago (número de cheque, autorización, etc.)' })
  @IsOptional()
  @IsString()
  referencia?: string;
}

/**
 * DTO principal para crear una factura directa (venta sin contrato)
 * Soporta tipos: FC(01), CCF(03), NC(05), ND(06), FEX(11), FSE(14)
 */
export class CrearFacturaDirectaDto {
  // === TIPO DE DOCUMENTO ===
  @ApiProperty({ description: 'ID del tipo de factura (1=FC 01, 3=CCF 03, 5=NC 05, 6=ND 06, 11=FEX, 14=FSE)' })
  @IsInt()
  id_tipo_factura: number;

  // === CLIENTE ===
  @ApiPropertyOptional({ description: 'ID del cliente directo existente (opcional)' })
  @IsOptional()
  @IsInt()
  id_cliente_directo?: number;

  @ApiPropertyOptional({ description: 'Nombre del cliente (si no hay id_cliente_directo)' })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  cliente_nombre?: string;

  @ApiPropertyOptional({ description: 'NRC del cliente (requerido para CCF)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  cliente_nrc?: string;

  @ApiPropertyOptional({ description: 'NIT del cliente (requerido para CCF)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  cliente_nit?: string;

  @ApiPropertyOptional({ description: 'DUI del cliente' })
  @IsOptional()
  @IsString()
  @MaxLength(15)
  cliente_dui?: string;

  @ApiPropertyOptional({ description: 'Dirección del cliente' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cliente_direccion?: string;

  @ApiPropertyOptional({ description: 'Teléfono del cliente' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  cliente_telefono?: string;

  @ApiPropertyOptional({ description: 'Correo del cliente' })
  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  cliente_correo?: string;

  @ApiPropertyOptional({ description: 'ID del tipo de documento del cliente' })
  @IsOptional()
  @IsInt()
  id_tipo_documento_cliente?: number;

  @ApiPropertyOptional({ description: 'ID de la actividad económica del cliente' })
  @IsOptional()
  @IsInt()
  id_actividad_economica_cliente?: number;

  @ApiPropertyOptional({ description: 'ID del municipio del cliente' })
  @IsOptional()
  @IsInt()
  id_municipio_cliente?: number;

  // === ITEMS/DETALLE ===
  @ApiProperty({
    description: 'Items/líneas de la factura',
    type: [ItemFacturaDirectaDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemFacturaDirectaDto)
  items: ItemFacturaDirectaDto[];

  // === PAGOS ===
  @ApiPropertyOptional({
    description: 'Formas de pago (efectivo, tarjeta, transferencia, cheque)',
    type: [PagoFacturaDirectaDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PagoFacturaDirectaDto)
  pagos?: PagoFacturaDirectaDto[];

  @ApiPropertyOptional({ description: 'ID del método de pago principal' })
  @IsOptional()
  @IsInt()
  id_metodo_pago?: number;

  @ApiPropertyOptional({ description: 'Condición de operación: 1=Contado (default)', default: 1 })
  @IsOptional()
  @IsInt()
  @IsEnum([1, 2, 3])
  condicion_operacion?: number;

  @ApiPropertyOptional({ description: 'Días de crédito (solo condicion_operacion=2)', default: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  dias_credito?: number;

  // === MONTOS DIRECTOS (opcionales, se calculan si no se envían) ===
  @ApiPropertyOptional({ description: 'Monto en efectivo' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  efectivo?: number;

  @ApiPropertyOptional({ description: 'Monto en tarjeta' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tarjeta?: number;

  @ApiPropertyOptional({ description: 'Monto en cheque' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cheque?: number;

  @ApiPropertyOptional({ description: 'Monto en transferencia' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  transferencia?: number;

  // === CUENTAS BANCARIAS DESTINO (para pagos no-efectivo en contado) ===
  @ApiPropertyOptional({ description: 'ID cuenta bancaria para pago con tarjeta' })
  @IsOptional()
  @IsInt()
  id_cuenta_tarjeta?: number;

  @ApiPropertyOptional({ description: 'ID cuenta bancaria para pago con cheque' })
  @IsOptional()
  @IsInt()
  id_cuenta_cheque?: number;

  @ApiPropertyOptional({ description: 'ID cuenta bancaria para pago con transferencia' })
  @IsOptional()
  @IsInt()
  id_cuenta_transferencia?: number;

  // === RETENCIONES ===
  @ApiPropertyOptional({ description: 'IVA retenido por el cliente', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  iva_retenido?: number;

  @ApiPropertyOptional({ description: 'IVA percibido', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  iva_percibido?: number;

  @ApiPropertyOptional({ description: 'Retención de renta', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  renta_retenido?: number;

  // === DESCUENTOS POR TIPO (para CCF) ===
  @ApiPropertyOptional({ description: 'Descuento aplicado a ventas no sujetas', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  descuNoSuj?: number;

  @ApiPropertyOptional({ description: 'Descuento aplicado a ventas exentas', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  descuExenta?: number;

  @ApiPropertyOptional({ description: 'Descuento aplicado a ventas gravadas', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  descuGravada?: number;

  @ApiPropertyOptional({ description: 'Porcentaje de descuento global', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  porcentajeDescuento?: number;

  // === CAMPOS DE EXPORTACIÓN (solo para FEX tipo 11) ===
  @ApiPropertyOptional({ description: 'Flete (solo FEX)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  flete?: number;

  @ApiPropertyOptional({ description: 'Seguro (solo FEX)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  seguro?: number;

  @ApiPropertyOptional({ description: 'Código de recinto fiscal (solo FEX)' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  recintoFiscal?: string;

  @ApiPropertyOptional({ description: 'Código de régimen (solo FEX)' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  regimen?: string;

  @ApiPropertyOptional({ description: 'Código Incoterms (solo FEX)' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  codIncoterms?: string;

  @ApiPropertyOptional({ description: 'Descripción Incoterms (solo FEX)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  descIncoterms?: string;

  @ApiPropertyOptional({ description: 'Tipo de item de exportación (solo FEX)' })
  @IsOptional()
  @IsInt()
  tipoItemExpor?: number;

  // === DOCUMENTO RELACIONADO (para NC/ND) ===
  @ApiPropertyOptional({ description: 'ID de la factura original (para NC/ND)' })
  @IsOptional()
  @IsInt()
  id_factura_original?: number;

  // === SUCURSAL ===
  @ApiPropertyOptional({ description: 'ID de la sucursal emisora' })
  @IsOptional()
  @IsInt()
  id_sucursal?: number;

  // === OBSERVACIONES ===
  @ApiPropertyOptional({ description: 'Observaciones para la extensión del DTE' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observaciones?: string;
}
