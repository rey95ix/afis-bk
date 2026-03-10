import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsString, Matches, MaxLength, Min } from 'class-validator';

export class PagoTarjetaPortalDto {
  @ApiProperty({
    description: 'Token de intención de pago obtenido previamente',
    example: 'a1b2c3d4...',
  })
  @IsString()
  @MaxLength(64)
  tokenPago: string;

  @ApiProperty({
    description: 'ID de la factura seleccionada para pagar',
    example: 1,
  })
  @IsInt()
  idFactura: number;

  @ApiProperty({
    description: 'Monto a pagar (puede ser parcial)',
    example: 25.5,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto: number;

  @ApiProperty({ description: 'Numero de tarjeta (13-19 digitos)' })
  @IsString()
  @Matches(/^\d{13,19}$/, { message: 'Numero de tarjeta invalido' })
  numeroTarjeta: string;

  @ApiProperty({ description: 'CVV2 (3-4 digitos)' })
  @IsString()
  @Matches(/^\d{3,4}$/, { message: 'CVV2 invalido' })
  cvv2: string;

  @ApiProperty({ description: 'Fecha de expiracion YYYYMM', example: '202712' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Fecha de expiracion invalida (YYYYMM)' })
  fechaExpiracion: string;

  @ApiProperty({ description: 'Nombre del tarjetahabiente' })
  @IsString()
  @MaxLength(100)
  nombreTarjetahabiente: string;
}
