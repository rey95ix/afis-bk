import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, MaxLength } from 'class-validator';

export class CreateAjusteDto {
  @ApiProperty({
    description: 'Monto del ajuste (positivo para sumar, negativo para restar)',
    example: -50.00,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  monto: number;

  @ApiProperty({ description: 'Descripción del ajuste', example: 'Ajuste por comisión bancaria no registrada' })
  @IsString()
  @MaxLength(500)
  descripcion: string;

  @ApiPropertyOptional({ description: 'Referencia bancaria del ajuste', example: 'ADJ-2024-001' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  referencia_bancaria?: string;
}
