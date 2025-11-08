// src/modules/inventario/requisiciones/dto/authorize-requisicion.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AutorizarRequisicionDetalleDto {
  @ApiProperty({
    description: 'ID del detalle de la requisición',
    example: 1,
  })
  @IsInt()
  id_requisicion_detalle: number;

  @ApiProperty({
    description: 'Cantidad autorizada (ignorado si el producto tiene series)',
    example: 8,
  })
  @IsInt()
  cantidad_autorizada: number;

  @ApiProperty({
    description: 'IDs de series autorizadas (para productos serializados). Si se omite, se autorizan todas las series solicitadas',
    example: [1, 2],
    required: false,
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  series_autorizadas?: number[];
}

export class AuthorizeRequisicionDto {
  @ApiProperty({
    description: '¿Aprobar la requisición?',
    example: true,
  })
  @IsBoolean()
  aprobar: boolean;

  @ApiProperty({
    description: 'Observaciones de la autorización',
    example: 'Aprobada parcialmente por falta de stock',
    required: false,
  })
  @IsOptional()
  @IsString()
  observaciones_autorizacion?: string;

  @ApiProperty({
    description: 'Detalle de cantidades autorizadas por item',
    type: [AutorizarRequisicionDetalleDto],
    required: false,
    example: [
      {
        id_requisicion_detalle: 1,
        cantidad_autorizada: 8,
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutorizarRequisicionDetalleDto)
  detalle?: AutorizarRequisicionDetalleDto[];
}
