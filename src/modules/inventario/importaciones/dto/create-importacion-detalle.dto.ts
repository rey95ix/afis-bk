// src/modules/inventario/importaciones/dto/create-importacion-detalle.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateImportacionSerieDto } from './create-importacion-serie.dto';

export class CreateImportacionDetalleDto {
  @ApiProperty({
    description: 'ID del catálogo (producto)',
    required: false,
    example: 1,
  })
  @IsOptional()
  @IsInt({ message: 'El ID del catálogo debe ser un número entero.' })
  id_catalogo?: number;

  @ApiProperty({
    description: 'Código del producto',
    example: 'ONU-GPON-001',
  })
  @IsString({ message: 'El código debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El código no puede estar vacío.' })
  codigo: string;

  @ApiProperty({
    description: 'Nombre del producto',
    example: 'ONU GPON 1GE',
  })
  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El nombre no puede estar vacío.' })
  nombre: string;

  @ApiProperty({
    description: 'Descripción del producto',
    required: false,
    example: 'ONU GPON con 1 puerto Gigabit Ethernet',
  })
  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto.' })
  descripcion?: string;

  @ApiProperty({
    description: 'Cantidad ordenada',
    example: 100,
  })
  @IsInt({ message: 'La cantidad ordenada debe ser un número entero.' })
  @IsNotEmpty({ message: 'La cantidad ordenada no puede estar vacía.' })
  cantidad_ordenada: number;

  @ApiProperty({
    description: 'Precio unitario en USD',
    example: 25.50,
  })
  @IsNumber({}, { message: 'El precio unitario debe ser un número.' })
  @IsNotEmpty({ message: 'El precio unitario no puede estar vacío.' })
  precio_unitario_usd: number;

  @ApiProperty({
    description: 'Peso en kilogramos',
    required: false,
    example: 0.5,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El peso debe ser un número.' })
  peso_kg?: number;

  @ApiProperty({
    description: 'Volumen en metros cúbicos',
    required: false,
    example: 0.002,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El volumen debe ser un número.' })
  volumen_m3?: number;

  @ApiProperty({
    description: 'Indica si el producto requiere número de serie',
    example: true,
    default: false,
  })
  @IsBoolean({ message: 'tiene_serie debe ser un valor booleano.' })
  @IsNotEmpty({ message: 'tiene_serie no puede estar vacío.' })
  tiene_serie: boolean;

  @ApiProperty({
    description: 'Series del producto (si tiene_serie es true)',
    required: false,
    type: [CreateImportacionSerieDto],
  })
  @IsOptional()
  @IsArray({ message: 'Las series deben ser un arreglo.' })
  @ValidateNested({ each: true })
  @Type(() => CreateImportacionSerieDto)
  series?: CreateImportacionSerieDto[];

  @ApiProperty({
    description: 'Observaciones del item',
    required: false,
    example: 'Color negro',
  })
  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser una cadena de texto.' })
  observaciones?: string;
}
