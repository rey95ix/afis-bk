import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsDateString,
  IsNumber,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateCuentaBancariaDto {
  @ApiProperty({ description: 'ID del banco (cat_banco)', example: 1 })
  @IsInt()
  id_banco: number;

  @ApiProperty({ description: 'ID del tipo de cuenta (cat_tipo_cuenta_banco)', example: 1 })
  @IsInt()
  id_tipo_cuenta: number;

  @ApiPropertyOptional({ description: 'ID de la sucursal asociada', example: 1 })
  @IsOptional()
  @IsInt()
  id_sucursal?: number;

  @ApiProperty({ description: 'Número de cuenta bancaria', example: '0001-1234-5678-9012' })
  @IsString()
  @MaxLength(50)
  numero_cuenta: string;

  @ApiPropertyOptional({ description: 'Alias o nombre corto de la cuenta', example: 'Cuenta Principal' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  alias?: string;

  @ApiPropertyOptional({ description: 'Moneda de la cuenta', default: 'USD', example: 'USD' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  moneda?: string;

  @ApiPropertyOptional({ description: 'Saldo inicial de la cuenta', default: 0, example: 1000.00 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  saldo_actual?: number;

  @ApiPropertyOptional({ description: 'Permite saldo negativo', default: false })
  @IsOptional()
  @IsBoolean()
  permite_saldo_negativo?: boolean;

  @ApiPropertyOptional({ description: 'Fecha de apertura de la cuenta', example: '2024-01-15' })
  @IsOptional()
  @IsDateString()
  fecha_apertura?: string;
}
