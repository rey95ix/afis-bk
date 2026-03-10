import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsEnum,
  IsOptional,
  IsString,
  IsDateString,
  IsInt,
  IsIn,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { metodo_pago_abono } from '@prisma/client';

export class RegistrarPagoContratoDto {
  @ApiProperty({ description: 'Monto total a distribuir entre facturas', minimum: 0.01 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto: number;

  @ApiProperty({ description: 'Método de pago', enum: metodo_pago_abono })
  @IsEnum(metodo_pago_abono)
  metodoPago: metodo_pago_abono;

  @ApiPropertyOptional({ description: 'Referencia del pago (número de cheque, transferencia, etc.)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  referencia?: string;

  @ApiPropertyOptional({ description: 'ID de cuenta bancaria para registrar movimiento' })
  @IsOptional()
  @IsInt()
  idCuentaBancaria?: number;

  @ApiPropertyOptional({ description: 'Observaciones del pago' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;

  @ApiPropertyOptional({ description: 'URL del comprobante de pago (imagen en MinIO)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comprobanteUrl?: string;
}

export class AplicarDescuentoFacturaDto {
  @ApiProperty({ description: 'Tipo de descuento', enum: ['PORCENTAJE', 'MONTO_FIJO'] })
  @IsIn(['PORCENTAJE', 'MONTO_FIJO'])
  tipoDescuento: 'PORCENTAJE' | 'MONTO_FIJO';

  @ApiProperty({ description: 'Valor del descuento (porcentaje 0.01-100 o monto fijo)', minimum: 0.01 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  valor: number;

  @ApiPropertyOptional({ description: 'Motivo del descuento' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}

export class RegistrarAcuerdoPagoDto {
  @ApiProperty({ description: 'Nueva fecha de vencimiento (acuerdo de pago)', example: '2026-03-25' })
  @IsDateString()
  fechaAcuerdo: string;

  @ApiPropertyOptional({ description: 'Observaciones del acuerdo' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}
