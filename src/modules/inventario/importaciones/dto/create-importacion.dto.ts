// src/modules/inventario/importaciones/dto/create-importacion.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsDateString,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { CreateImportacionDetalleDto } from './create-importacion-detalle.dto';

export class CreateImportacionDto {
  @ApiProperty({
    description: 'ID del proveedor',
    example: 1,
  })
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt({ message: 'El ID del proveedor debe ser un número entero.' })
  @IsNotEmpty({ message: 'El ID del proveedor no puede estar vacío.' })
  id_proveedor: number;

  @ApiProperty({
    description: 'Número de factura del proveedor',
    required: false,
    example: 'FAC-2025-001',
  })
  @IsOptional()
  @IsString({ message: 'El número de factura debe ser una cadena de texto.' })
  numero_factura_proveedor?: string;

  @ApiProperty({
    description: 'Número de tracking del envío',
    required: false,
    example: 'TRK123456789',
  })
  @IsOptional()
  @IsString({ message: 'El número de tracking debe ser una cadena de texto.' })
  numero_tracking?: string;

  @ApiProperty({
    description: 'Incoterm aplicado (FOB, CIF, EXW, etc.)',
    required: false,
    example: 'FOB',
  })
  @IsOptional()
  @IsString({ message: 'El incoterm debe ser una cadena de texto.' })
  incoterm?: string;

  @ApiProperty({
    description: 'Puerto de origen',
    required: false,
    example: 'Shanghai, China',
  })
  @IsOptional()
  @IsString({ message: 'El puerto de origen debe ser una cadena de texto.' })
  puerto_origen?: string;

  @ApiProperty({
    description: 'Puerto de destino',
    required: false,
    example: 'Acajutla, El Salvador',
  })
  @IsOptional()
  @IsString({ message: 'El puerto de destino debe ser una cadena de texto.' })
  puerto_destino?: string;

  @ApiProperty({
    description: 'Naviera o courier',
    required: false,
    example: 'Maersk',
  })
  @IsOptional()
  @IsString({ message: 'La naviera/courier debe ser una cadena de texto.' })
  naviera_courier?: string;

  @ApiProperty({
    description: 'Fecha de embarque',
    required: false,
    example: '2025-01-15',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de embarque debe ser una fecha válida.' })
  fecha_embarque?: string;

  @ApiProperty({
    description: 'Fecha estimada de arribo',
    required: false,
    example: '2025-02-15',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha estimada de arribo debe ser una fecha válida.' })
  fecha_arribo_estimado?: string;

  @ApiProperty({
    description: 'Moneda utilizada',
    example: 'USD',
    default: 'USD',
  })
  @IsString({ message: 'La moneda debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La moneda no puede estar vacía.' })
  moneda: string;

  @ApiProperty({
    description: 'Subtotal de mercancía en moneda extranjera',
    example: 10000.00,
  })
  @IsNumber({}, { message: 'El subtotal de mercancía debe ser un número.' })
  @IsNotEmpty({ message: 'El subtotal de mercancía no puede estar vacío.' })
  subtotal_mercancia: number;

  @ApiProperty({
    description: 'Flete internacional',
    required: false,
    example: 500.00,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El flete internacional debe ser un número.' })
  flete_internacional?: number;

  @ApiProperty({
    description: 'Seguro',
    required: false,
    example: 100.00,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El seguro debe ser un número.' })
  seguro?: number;

  @ApiProperty({
    description: 'Tipo de cambio aplicado',
    example: 8.75,
  })
  @IsNumber({}, { message: 'El tipo de cambio debe ser un número.' })
  @IsNotEmpty({ message: 'El tipo de cambio no puede estar vacío.' })
  tipo_cambio: number;

  @ApiProperty({
    description: 'Número de declaración aduanal',
    required: false,
    example: 'DEC-2025-001',
  })
  @IsOptional()
  @IsString({ message: 'El número de declaración debe ser una cadena de texto.' })
  numero_declaracion?: string;

  @ApiProperty({
    description: 'Nombre del agente aduanal',
    required: false,
    example: 'Agencia Aduanal XYZ',
  })
  @IsOptional()
  @IsString({ message: 'El agente aduanal debe ser una cadena de texto.' })
  agente_aduanal?: string;

  @ApiProperty({
    description: 'Observaciones generales',
    required: false,
    example: 'Mercancía frágil, manejar con cuidado',
  })
  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser una cadena de texto.' })
  observaciones?: string;

  @ApiProperty({
    description: 'Detalle de items de la importación',
    type: [CreateImportacionDetalleDto],
  })
  @IsArray({ message: 'El detalle debe ser un arreglo.' })
  @ValidateNested({ each: true })
  @Type(() => CreateImportacionDetalleDto)
  detalle: CreateImportacionDetalleDto[];
}
