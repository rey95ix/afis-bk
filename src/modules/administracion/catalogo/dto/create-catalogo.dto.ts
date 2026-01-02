// src/modules/administracion/catalogo/dto/create-catalogo.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsNumber } from 'class-validator';

export class CreateCatalogoDto {
  @ApiProperty({ description: 'ID de la categoría' })
  @IsInt()
  id_categoria: number;

  @ApiProperty({ description: 'Código del producto' })
  @IsString()
  codigo: string;

  @ApiProperty({ description: 'Código del proveedor', required: false })
  @IsOptional()
  @IsString()
  codigo_proveedor?: string;

  @ApiProperty({ description: 'Nombre del producto' })
  @IsString()
  nombre: string;

  @ApiProperty({ description: 'Descripción del producto', required: false })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({ description: 'Cantidad mínima en stock', required: false, default: 0 })
  @IsOptional()
  @IsInt()
  cantidad_minima?: number;

  @ApiProperty({ description: 'Cantidad máxima en stock', required: false, default: 0 })
  @IsOptional()
  @IsInt()
  cantidad_maxima?: number;

  @ApiProperty({ description: 'ID de la marca', required: false })
  @IsOptional()
  @IsInt()
  id_marca?: number;

  @ApiProperty({ description: 'ID del modelo', required: false })
  @IsOptional()
  @IsInt()
  id_modelo?: number;

  @ApiProperty({ description: 'Días que tarda el proveedor en entregar', required: false })
  @IsOptional()
  @IsInt()
  lead_time_dias?: number;

  @ApiProperty({ description: 'Consumo promedio diario del producto', required: false })
  @IsOptional()
  @IsNumber()
  demanda_promedio_diaria?: number;

  @ApiProperty({ description: 'Stock de seguridad buffer', required: false })
  @IsOptional()
  @IsInt()
  stock_seguridad?: number;

  @ApiProperty({ description: 'Punto de reorden calculado (ROP)', required: false })
  @IsOptional()
  @IsInt()
  punto_reorden?: number;

  @ApiProperty({ description: 'Vida útil del producto en meses', required: false })
  @IsOptional()
  @IsInt()
  vida_util_meses?: number;
}
