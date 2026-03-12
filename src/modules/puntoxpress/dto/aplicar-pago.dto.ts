import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AplicarPagoDto {
  @ApiProperty({ description: 'ID de la factura directa (id_factura retornado por los endpoints de búsqueda)', example: 1 })
  @IsInt()
  @IsNotEmpty()
  id_factura_directa: number;

  @ApiProperty({ description: 'Monto del pago', example: 25.5 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto: number;

  @ApiProperty({ description: 'Nombre del colector/cajero que recibe el pago', example: 'Juan Pérez' })
  @IsString()
  @IsNotEmpty()
  colector: string;

  @ApiPropertyOptional({ description: 'Referencia del pago', example: 'REC-001' })
  @IsString()
  @IsOptional()
  referencia?: string;
}
