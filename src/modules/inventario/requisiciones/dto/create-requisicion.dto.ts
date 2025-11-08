// src/modules/inventario/requisiciones/dto/create-requisicion.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export enum TipoRequisicion {
  TRANSFERENCIA_BODEGA = 'TRANSFERENCIA_BODEGA',
  TRANSFERENCIA_SUCURSAL = 'TRANSFERENCIA_SUCURSAL',
  CAMBIO_ESTANTE = 'CAMBIO_ESTANTE',
}

export class CreateRequisicionDetalleDto {
  @ApiProperty({
    description: 'ID del catálogo del producto',
    example: 1,
  })
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  id_catalogo: number;

  @ApiProperty({
    description: 'Cantidad solicitada (ignorado si se especifican series)',
    example: 10,
  })
  @IsInt()
  cantidad_solicitada: number;

  @ApiProperty({
    description: 'IDs de series específicas a transferir (para productos serializados)',
    example: [1, 2, 3],
    required: false,
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  series?: number[];

  @ApiProperty({
    description: 'Observaciones del item',
    example: 'Producto urgente para instalación',
    required: false,
  })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class CreateRequisicionDto {
  @ApiProperty({
    description: 'Tipo de requisición',
    enum: TipoRequisicion,
    example: TipoRequisicion.TRANSFERENCIA_BODEGA,
  })
  @IsEnum(TipoRequisicion)
  tipo: TipoRequisicion;

  // Origen
  @ApiProperty({
    description: 'ID de la sucursal origen',
    example: 1,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  id_sucursal_origen?: number;

  @ApiProperty({
    description: 'ID de la bodega origen',
    example: 1,
    required: false,
  })
  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  @IsInt()
  id_bodega_origen?: number;

  @ApiProperty({
    description: 'ID del estante origen',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  id_estante_origen?: number;

  // Destino
  @ApiProperty({
    description: 'ID de la sucursal destino',
    example: 2,
    required: false,
  })
  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  @IsInt()
  id_sucursal_destino?: number;

  @ApiProperty({
    description: 'ID de la bodega destino',
    example: 2,
    required: false,
  })
  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  @IsInt()
  id_bodega_destino?: number;

  @ApiProperty({
    description: 'ID del estante destino',
    example: 2,
    required: false,
  })
  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  @IsInt()
  id_estante_destino?: number;

  @ApiProperty({
    description: 'Motivo de la requisición',
    example: 'Transferencia por reabastecimiento de bodega',
  })
  @IsString()
  motivo: string;

  @ApiProperty({
    description: 'Detalle de items a transferir',
    type: [CreateRequisicionDetalleDto],
    example: [
      {
        id_catalogo: 1,
        cantidad_solicitada: 10,
        observaciones: 'Producto urgente',
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateRequisicionDetalleDto)
  detalle: CreateRequisicionDetalleDto[];
}
