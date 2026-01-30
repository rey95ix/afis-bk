import {
  IsInt,
  IsArray,
  ValidateNested,
  IsNumber,
  IsString,
  IsOptional,
  Min,
  MaxLength,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para un item de la Nota de Crédito
 * Representa un item seleccionado del CCF original para devolver/ajustar
 */
export class ItemNotaCreditoDto {
  @ApiProperty({
    description: 'ID del detalle original del CCF (facturaDirectaDetalle.id_detalle)',
  })
  @IsInt()
  id_detalle_original: number;

  @ApiProperty({
    description: 'Cantidad a devolver/ajustar (debe ser <= cantidad original del item)',
    minimum: 0.0001,
  })
  @IsNumber()
  @Min(0.0001)
  cantidad: number;

  @ApiPropertyOptional({
    description: 'Motivo de devolución/ajuste específico para este item',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}

/**
 * DTO principal para crear una Nota de Crédito (NC - tipo "05")
 *
 * La NC se crea a partir de un Comprobante de Crédito Fiscal (CCF - "03")
 * o Comprobante de Retención ("07") ya procesado.
 *
 * Características:
 * - Requiere documento relacionado (factura original)
 * - Receptor se hereda del CCF original (NIT y NRC obligatorios)
 * - Precios son SIN IVA (igual que CCF)
 * - Se puede hacer NC parcial (seleccionando algunos items)
 * - Se puede hacer NC total (todos los items)
 */
export class CrearNotaCreditoDto {
  @ApiProperty({
    description: 'ID de la factura original (CCF o Comprobante de Retención) que se va a ajustar',
    example: 123,
  })
  @IsInt()
  id_factura_original: number;

  @ApiProperty({
    description: 'Items seleccionados del CCF original para incluir en la NC',
    type: [ItemNotaCreditoDto],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe incluir al menos un item en la Nota de Crédito' })
  @ValidateNested({ each: true })
  @Type(() => ItemNotaCreditoDto)
  items: ItemNotaCreditoDto[];

  @ApiPropertyOptional({
    description: 'Observaciones generales de la Nota de Crédito (motivo general)',
    example: 'Devolución de mercadería por defecto de fábrica',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observaciones?: string;

  @ApiPropertyOptional({
    description: 'ID de la sucursal emisora (si es diferente a la del usuario)',
  })
  @IsOptional()
  @IsInt()
  id_sucursal?: number;
}
