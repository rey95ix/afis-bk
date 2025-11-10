// src/modules/inventario/importaciones/dto/create-importacion-gasto.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { tipo_gasto_importacion } from '@prisma/client';

export class CreateImportacionGastoDto {
  @ApiProperty({
    description: 'Tipo de gasto',
    enum: tipo_gasto_importacion,
    example: 'FLETE_INTERNACIONAL',
  })
  @IsEnum(tipo_gasto_importacion, {
    message: 'El tipo de gasto debe ser un valor válido del enum tipo_gasto_importacion.',
  })
  @IsNotEmpty({ message: 'El tipo de gasto no puede estar vacío.' })
  tipo: tipo_gasto_importacion;

  @ApiProperty({
    description: 'Descripción del gasto',
    example: 'Flete marítimo desde Shanghai',
  })
  @IsString({ message: 'La descripción debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La descripción no puede estar vacía.' })
  descripcion: string;

  @ApiProperty({
    description: 'Monto del gasto',
    example: 500.00,
  })
  @IsNumber({}, { message: 'El monto debe ser un número.' })
  @IsNotEmpty({ message: 'El monto no puede estar vacío.' })
  monto: number;

  @ApiProperty({
    description: 'Moneda del gasto',
    example: 'USD',
    default: 'USD',
  })
  @IsString({ message: 'La moneda debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La moneda no puede estar vacía.' })
  moneda: string;

  @ApiProperty({
    description: 'Tipo de cambio aplicado',
    required: false,
    example: 8.75,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El tipo de cambio debe ser un número.' })
  tipo_cambio?: number;

  @ApiProperty({
    description: 'Indica si el gasto aplica para retaceo',
    example: true,
    default: true,
  })
  @IsBoolean({ message: 'aplica_retaceo debe ser un valor booleano.' })
  @IsNotEmpty({ message: 'aplica_retaceo no puede estar vacío.' })
  aplica_retaceo: boolean;

  @ApiProperty({
    description: 'Método de retaceo (VALOR, PESO, VOLUMEN, CANTIDAD)',
    required: false,
    example: 'VALOR',
    default: 'VALOR',
  })
  @IsOptional()
  @IsString({ message: 'El método de retaceo debe ser una cadena de texto.' })
  metodo_retaceo?: string;

  @ApiProperty({
    description: 'Número de factura del gasto',
    required: false,
    example: 'FAC-GASTO-001',
  })
  @IsOptional()
  @IsString({ message: 'El número de factura debe ser una cadena de texto.' })
  numero_factura?: string;

  @ApiProperty({
    description: 'Fecha de la factura del gasto',
    required: false,
    example: '2025-01-20',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de factura debe ser una fecha válida.' })
  fecha_factura?: string;

  @ApiProperty({
    description: 'Observaciones del gasto',
    required: false,
    example: 'Pago realizado por transferencia',
  })
  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser una cadena de texto.' })
  observaciones?: string;
}
