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
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSolicitudCompraDetalleDto {
  @ApiPropertyOptional({ description: 'ID del catálogo de producto', example: 1 })
  @IsOptional()
  @IsInt()
  id_catalogo?: number;

  @ApiPropertyOptional({ description: 'Código del producto', example: 'PROD-001' })
  @IsOptional()
  @IsString()
  codigo?: string;

  @ApiProperty({ description: 'Nombre del producto/servicio', example: 'Cable UTP Cat6' })
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @ApiPropertyOptional({ description: 'Descripción del producto', example: 'Cable UTP categoría 6 exterior' })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({ description: 'Indica si el producto maneja series', example: false })
  @IsOptional()
  @IsBoolean()
  tiene_serie?: boolean;

  @ApiPropertyOptional({ description: 'Indica si el producto afecta inventario', example: true })
  @IsOptional()
  @IsBoolean()
  afecta_inventario?: boolean;

  @ApiProperty({ description: 'Cantidad solicitada', example: 100, minimum: 1 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  cantidad_solicitada: number;

  @ApiPropertyOptional({ description: 'Costo unitario estimado', example: 25.50 })
  @IsOptional()
  @IsNumber()
  costo_estimado?: number;

  @ApiPropertyOptional({ description: 'Observaciones del item', example: 'Urgente' })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class CreateSolicitudCompraDto {
  @ApiPropertyOptional({ description: 'Prioridad de la solicitud', enum: ['BAJA', 'MEDIA', 'ALTA', 'URGENTE'], example: 'MEDIA' })
  @IsOptional()
  @IsString()
  prioridad?: string;

  @ApiPropertyOptional({ description: 'Motivo/justificación de la compra' })
  @IsOptional()
  @IsString()
  motivo?: string;

  @ApiPropertyOptional({ description: 'ID de la sucursal destino', example: 1 })
  @IsOptional()
  @IsInt()
  id_sucursal?: number;

  @ApiPropertyOptional({ description: 'ID de la bodega destino', example: 1 })
  @IsOptional()
  @IsInt()
  id_bodega?: number;

  @ApiPropertyOptional({ description: 'Observaciones generales' })
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiProperty({ description: 'Detalle de los productos/servicios solicitados', type: [CreateSolicitudCompraDetalleDto] })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSolicitudCompraDetalleDto)
  detalle: CreateSolicitudCompraDetalleDto[];
}
