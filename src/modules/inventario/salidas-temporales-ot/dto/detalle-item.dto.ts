// src/modules/inventario/salidas-temporales-ot/dto/detalle-item.dto.ts
import {
  IsInt,
  IsOptional,
  IsPositive,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DetalleItemDto {
  @ApiProperty({
    description: 'ID del producto en el catálogo',
    example: 45,
  })
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  id_catalogo: number;

  @ApiPropertyOptional({
    description:
      'Cantidad a sacar (requerido si el producto NO es serializado, debe ser >= 1)',
    example: 5,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @ValidateIf((o) => !o.id_serie) // Requerido si no hay id_serie
  cantidad?: number;

  @ApiPropertyOptional({
    description:
      'ID de la serie del inventario (requerido si el producto ES serializado)',
    example: 789,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  @ValidateIf((o) => !o.cantidad || o.cantidad === 1) // Requerido si no hay cantidad o es 1
  id_serie?: number;

  @ApiPropertyOptional({
    description: 'Observaciones del item',
    example: 'ONU para cliente nuevo',
  })
  @IsOptional()
  observaciones?: string;
}
