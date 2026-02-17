import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, Min, IsEnum, IsOptional, IsString, MaxLength, IsDateString, IsInt } from 'class-validator';
import { metodo_pago_abono } from '@prisma/client';

export class CrearAbonoDto {
  @ApiProperty({ description: 'Monto del abono', minimum: 0.01 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto: number;

  @ApiProperty({ description: 'Método de pago', enum: metodo_pago_abono })
  @IsEnum(metodo_pago_abono)
  metodo_pago: metodo_pago_abono;

  @ApiPropertyOptional({ description: 'Referencia del pago (número de cheque, transferencia, etc.)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  referencia?: string;

  @ApiPropertyOptional({ description: 'Fecha del pago (YYYY-MM-DD). Si no se envía, se usa la fecha actual' })
  @IsOptional()
  @IsDateString()
  fecha_pago?: string;

  @ApiPropertyOptional({ description: 'ID de cuenta bancaria para registrar movimiento bancario' })
  @IsOptional()
  @IsInt()
  id_cuenta_bancaria?: number;

  @ApiPropertyOptional({ description: 'Observaciones del abono' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}
