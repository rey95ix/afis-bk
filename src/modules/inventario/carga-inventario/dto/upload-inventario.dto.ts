import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class UploadInventarioDto {
  @ApiProperty({
    description: 'ID de la bodega destino donde se registrará el inventario',
    example: 1,
  })
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt({ message: 'El ID de la bodega debe ser un número entero.' })
  @IsNotEmpty({ message: 'La bodega destino es requerida.' })
  id_bodega: number;

  @ApiProperty({
    description: 'ID del estante destino (opcional)',
    example: 1,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : null))
  @IsInt({ message: 'El ID del estante debe ser un número entero.' })
  id_estante?: number;

  @ApiProperty({
    description: 'ID de la categoría por defecto para nuevos productos',
    example: 1,
  })
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt({ message: 'El ID de la categoría debe ser un número entero.' })
  @IsNotEmpty({ message: 'La categoría por defecto es requerida.' })
  id_categoria: number;
}
