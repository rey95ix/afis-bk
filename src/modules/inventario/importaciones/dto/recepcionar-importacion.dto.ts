// src/modules/inventario/importaciones/dto/recepcionar-importacion.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsOptional,
  IsString,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class RecepcionItemDto {
  @ApiProperty({
    description: 'ID del detalle de importación',
    example: 1,
  })
  @IsInt({ message: 'El ID del detalle debe ser un número entero.' })
  @IsNotEmpty({ message: 'El ID del detalle no puede estar vacío.' })
  id_importacion_detalle: number;

  @ApiProperty({
    description: 'Cantidad recibida',
    example: 95,
  })
  @IsInt({ message: 'La cantidad recibida debe ser un número entero.' })
  @IsNotEmpty({ message: 'La cantidad recibida no puede estar vacía.' })
  cantidad_recibida: number;

  @ApiProperty({
    description: 'Observaciones de la recepción',
    required: false,
    example: 'Se recibieron 5 unidades dañadas',
  })
  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser una cadena de texto.' })
  observaciones?: string;
}

export class RecepcionarImportacionDto {
  @ApiProperty({
    description: 'ID de la bodega donde se recepcionará',
    example: 1,
  })
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt({ message: 'El ID de la bodega debe ser un número entero.' })
  @IsNotEmpty({ message: 'El ID de la bodega no puede estar vacío.' })
  id_bodega: number;

  @ApiProperty({
    description: 'ID del estante (opcional)',
    required: false,
    example: 1,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt({ message: 'El ID del estante debe ser un número entero.' })
  id_estante?: number;

  @ApiProperty({
    description: 'Items recepcionados',
    type: [RecepcionItemDto],
  })
  @IsArray({ message: 'Los items deben ser un arreglo.' })
  @ValidateNested({ each: true })
  @Type(() => RecepcionItemDto)
  items: RecepcionItemDto[];
}
