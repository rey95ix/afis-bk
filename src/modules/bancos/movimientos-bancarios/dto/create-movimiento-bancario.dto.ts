import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsNumber,
  IsEnum,
  IsDateString,
  Min,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  tipo_movimiento_bancario,
  metodo_movimiento_bancario,
  modulo_origen_movimiento,
} from '@prisma/client';

export class DetalleChequeDto {
  @ApiProperty({ description: 'Número de cheque', example: 'CHQ-001' })
  @IsString()
  @MaxLength(50)
  numero_cheque: string;

  @ApiProperty({ description: 'Beneficiario del cheque', example: 'Juan Pérez' })
  @IsString()
  @MaxLength(200)
  beneficiario: string;

  @ApiProperty({ description: 'Fecha de emisión', example: '2024-01-15' })
  @IsDateString()
  fecha_emision: string;
}

export class DetalleTransferenciaDto {
  @ApiPropertyOptional({ description: 'Banco contraparte', example: 'Banco Agrícola' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  banco_contraparte?: string;

  @ApiPropertyOptional({ description: 'Cuenta contraparte', example: '0001-9876-5432' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  cuenta_contraparte?: string;

  @ApiPropertyOptional({ description: 'Código de autorización', example: 'AUTH-123456' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  codigo_autorizacion?: string;

  @ApiProperty({ description: 'Fecha de transferencia', example: '2024-01-15' })
  @IsDateString()
  fecha_transferencia: string;
}

export class DetalleDepositoDto {
  @ApiProperty({ description: 'Tipo de depósito', enum: ['EFECTIVO', 'CHEQUE_TERCEROS'] })
  @IsString()
  tipo_deposito: string;

  @ApiPropertyOptional({ description: 'Número de boleta', example: 'BOL-001' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  numero_boleta?: string;

  @ApiProperty({ description: 'Fecha de depósito', example: '2024-01-15' })
  @IsDateString()
  fecha_deposito: string;
}

export class CreateMovimientoBancarioDto {
  @ApiProperty({ description: 'ID de la cuenta bancaria', example: 1 })
  @IsInt()
  id_cuenta_bancaria: number;

  @ApiProperty({ description: 'Tipo de movimiento', enum: tipo_movimiento_bancario })
  @IsEnum(tipo_movimiento_bancario)
  tipo_movimiento: tipo_movimiento_bancario;

  @ApiProperty({ description: 'Método del movimiento', enum: metodo_movimiento_bancario })
  @IsEnum(metodo_movimiento_bancario)
  metodo: metodo_movimiento_bancario;

  @ApiProperty({ description: 'Monto del movimiento', example: 1500.50 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto: number;

  @ApiPropertyOptional({ description: 'Referencia bancaria', example: 'REF-2024-001' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  referencia_bancaria?: string;

  @ApiPropertyOptional({ description: 'ID del documento origen en otro módulo' })
  @IsOptional()
  @IsInt()
  documento_origen_id?: number;

  @ApiPropertyOptional({ description: 'Módulo de origen', enum: modulo_origen_movimiento })
  @IsOptional()
  @IsEnum(modulo_origen_movimiento)
  modulo_origen?: modulo_origen_movimiento;

  @ApiPropertyOptional({ description: 'Descripción del movimiento', example: 'Pago a proveedor XYZ' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @ApiPropertyOptional({ description: 'Fecha del movimiento (default: ahora)', example: '2024-01-15' })
  @IsOptional()
  @IsDateString()
  fecha_movimiento?: string;

  @ApiPropertyOptional({ description: 'Detalle de cheque (si método = CHEQUE)' })
  @IsOptional()
  @ValidateNested()
  @Type(() => DetalleChequeDto)
  cheque?: DetalleChequeDto;

  @ApiPropertyOptional({ description: 'Detalle de transferencia (si método = TRANSFERENCIA)' })
  @IsOptional()
  @ValidateNested()
  @Type(() => DetalleTransferenciaDto)
  transferencia?: DetalleTransferenciaDto;

  @ApiPropertyOptional({ description: 'Detalle de depósito (si método = DEPOSITO)' })
  @IsOptional()
  @ValidateNested()
  @Type(() => DetalleDepositoDto)
  deposito?: DetalleDepositoDto;
}
