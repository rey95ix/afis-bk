import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCompraDetalleDto {
  @ApiProperty({
    description: 'ID del producto en el catálogo',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id_catalogo?: number;

  @ApiProperty({
    description: 'Código del producto',
    example: 'ONT-001',
    required: false,
  })
  @IsOptional()
  @IsString()
  codigo?: string;

  @ApiProperty({
    description: 'Nombre del producto',
    example: 'ONU GPON 1GE',
  })
  @IsString()
  nombre: string;

  @ApiProperty({
    description: 'Descripción detallada del producto',
    example: 'ONU GPON 1 puerto Gigabit Ethernet',
    required: false,
  })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({
    description: 'Indica si el producto requiere número de serie',
    example: true,
    default: false,
  })
  @IsBoolean()
  tiene_serie: boolean;

  @ApiProperty({
    description: 'Costo unitario del producto',
    example: 25.5,
  })
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  @Type(() => Number)
  costo_unitario: number;

  @ApiProperty({
    description: 'Cantidad del producto',
    example: 10,
  })
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  cantidad: number;

  @ApiProperty({
    description: 'Cantidad que se agregará al inventario',
    example: 10,
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  cantidad_inventario: number;

  @ApiProperty({
    description: 'Porcentaje de descuento aplicado',
    example: 5,
    default: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  descuento_porcentaje?: number;

  @ApiProperty({
    description: 'Monto de descuento aplicado',
    example: 12.75,
    default: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  descuento_monto?: number;

  @ApiProperty({
    description: 'Array de números de serie (si tiene_serie es true)',
    example: ['SN001', 'SN002', 'SN003'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  series?: string[];
}
