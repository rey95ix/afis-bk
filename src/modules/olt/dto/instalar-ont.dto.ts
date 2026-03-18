import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export class InstalarOntDto {
  @ApiProperty({ description: 'ID del cliente' })
  @IsInt()
  idCliente: number;

  @ApiProperty({ description: 'ID de la tarjeta OLT' })
  @IsInt()
  idOltTarjeta: number;

  @ApiProperty({ description: 'Puerto en la tarjeta' })
  @IsInt()
  port: number;

  @ApiProperty({ description: 'ONT ID asignado' })
  @IsInt()
  ontId: number;

  @ApiProperty({ description: 'Service port asignado' })
  @IsInt()
  serviceport: number;

  @ApiProperty({ description: 'ID del modelo de ONT' })
  @IsInt()
  idOltModelo: number;

  @ApiProperty({ description: 'Serial Number (para SN-auth)', required: false })
  @IsOptional()
  @IsString()
  sn?: string;

  @ApiProperty({ description: 'Password LOID (para LOID-auth)', required: false })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiProperty({ description: 'VLAN asignada' })
  @IsInt()
  vlan: number;

  @ApiProperty({ description: 'User VLAN' })
  @IsInt()
  userVlan: number;

  @ApiProperty({ description: 'Tipo de autenticación', enum: ['SN', 'LOID'] })
  @IsEnum(['SN', 'LOID'], { message: 'tipoAuth debe ser SN o LOID' })
  tipoAuth: 'SN' | 'LOID';
}
