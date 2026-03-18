import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsInt, IsOptional, IsArray, ValidateNested, IsNumber, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class GenerarOcItemDto {
  @ApiProperty({ description: 'ID del detalle de cotización' })
  @IsNotEmpty()
  @IsInt()
  id_cotizacion_compra_detalle: number;

  @ApiProperty({ description: 'Cantidad a ordenar', minimum: 0.01 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  cantidad: number;

  @ApiProperty({ description: 'Costo unitario', minimum: 0 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  costo_unitario: number;
}

export class GenerarOcGrupoDto {
  @ApiProperty({ description: 'ID del proveedor' })
  @IsNotEmpty()
  @IsInt()
  id_proveedor: number;

  @ApiPropertyOptional({ description: 'ID de la sucursal de destino' })
  @IsOptional()
  @IsInt()
  id_sucursal?: number;

  @ApiPropertyOptional({ description: 'ID de la bodega de destino' })
  @IsOptional()
  @IsInt()
  id_bodega?: number;

  @ApiPropertyOptional({ description: 'ID de la forma de pago' })
  @IsOptional()
  @IsInt()
  id_forma_pago?: number;

  @ApiPropertyOptional({ description: 'Días de crédito' })
  @IsOptional()
  @IsInt()
  dias_credito?: number;

  @ApiPropertyOptional({ description: 'Observaciones' })
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiProperty({ description: 'Items a incluir en esta OC', type: [GenerarOcItemDto] })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GenerarOcItemDto)
  items: GenerarOcItemDto[];
}

export class GenerarOcDesdeCotizacionDto {
  @ApiProperty({ description: 'Grupos de items para generar OCs', type: [GenerarOcGrupoDto] })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GenerarOcGrupoDto)
  grupos: GenerarOcGrupoDto[];
}
