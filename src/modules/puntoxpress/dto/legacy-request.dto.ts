import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LegacyRequestDto {
  @ApiProperty({
    description: 'Método a ejecutar',
    example: 'BusquedaDUI',
    enum: [
      'Autenticacion',
      'BusquedaCorrelativo',
      'BusquedaCodigoCliente',
      'BusquedaDUI',
      'BusquedaNombre',
      'AplicarPago',
      'AnularPago',
    ],
  })
  @IsString()
  @IsNotEmpty()
  metodo: string;

  @ApiPropertyOptional({ description: 'Token JWT (para métodos autenticados)' })
  @IsString()
  @IsOptional()
  token?: string;

  @ApiPropertyOptional({ description: 'Usuario (para Autenticacion)' })
  @IsString()
  @IsOptional()
  usuario?: string;

  @ApiPropertyOptional({ description: 'Contraseña (para Autenticacion)' })
  @IsString()
  @IsOptional()
  contrasena?: string;

  @ApiPropertyOptional({ description: 'Correlativo de factura' })
  @IsString()
  @IsOptional()
  correlativo?: string;

  @ApiPropertyOptional({ description: 'Código de cliente' })
  @IsOptional()
  codigo_cliente?: number;

  @ApiPropertyOptional({ description: 'DUI del cliente' })
  @IsString()
  @IsOptional()
  dui?: string;

  @ApiPropertyOptional({ description: 'Nombre del cliente' })
  @IsString()
  @IsOptional()
  nombre?: string;

  @ApiPropertyOptional({ description: 'ID de la factura directa para pago' })
  @IsOptional()
  id_factura_directa?: number;

  @ApiPropertyOptional({ description: 'Monto del pago' })
  @IsOptional()
  monto?: number;

  @ApiPropertyOptional({ description: 'Nombre del colector' })
  @IsString()
  @IsOptional()
  colector?: string;

  @ApiPropertyOptional({ description: 'Referencia del pago' })
  @IsString()
  @IsOptional()
  referencia?: string;

  @ApiPropertyOptional({ description: 'ID del pago a anular' })
  @IsOptional()
  id_pago?: number;

  @ApiPropertyOptional({ description: 'Motivo de anulación' })
  @IsString()
  @IsOptional()
  motivo?: string;
}
