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
    description:
      'Cantidad autorizada. Para productos con series, debe coincidir exactamente con el número de series_autorizadas. Para productos sin series, no puede exceder la cantidad solicitada.',
    example: 8,
  })
  @IsInt()
  cantidad_autorizada: number;

  @ApiProperty({
    description:
      'IDs de series autorizadas (REQUERIDO para productos serializados cuando cantidad_autorizada > 0). ' +
      'Debe contener exactamente el mismo número de elementos que cantidad_autorizada. ' +
      'Si no se especifica o está vacío para un producto serializado con cantidad_autorizada > 0, se lanzará un error.',
    example: [101, 102, 103],
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
