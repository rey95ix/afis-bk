import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsString,
  Matches,
  MaxLength,
  ArrayMinSize,
} from 'class-validator';

export class PagoTarjetaPortalDto {
  @ApiProperty({
    description: 'IDs de facturas seleccionadas para pagar',
    example: [1, 2],
  })
  @IsArray()
  @IsInt({ each: true })
  @ArrayMinSize(1)
  idFacturas: number[];

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
