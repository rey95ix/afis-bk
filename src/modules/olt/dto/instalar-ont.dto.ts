import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class InstalarOntDto {
  @ApiProperty({ description: 'ID del cliente' })
  @IsInt()
  idCliente: number;

  @ApiProperty({ description: 'ID de la tarjeta OLT' })
  @IsInt()
  idOltTarjeta: number;

  @ApiProperty({ description: 'Puerto en la tarjeta (0-15 para MA5680T GPON)' })
  @IsInt()
  @Min(0)
  @Max(15)
  port: number;

  @ApiProperty({ description: 'ONT ID asignado (0-127 en GPON)' })
  @IsInt()
  @Min(0)
  @Max(127)
  ontId: number;

  @ApiProperty({ description: 'Service port asignado (0-4095)' })
  @IsInt()
  @Min(0)
  @Max(4095)
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

  @ApiProperty({ description: 'VLAN asignada (1-4094)' })
  @IsInt()
  @Min(1)
  @Max(4094)
  vlan: number;

  @ApiProperty({ description: 'User VLAN (1-4094)' })
  @IsInt()
  @Min(1)
  @Max(4094)
  userVlan: number;

  @ApiProperty({ description: 'Tipo de autenticación', enum: ['SN', 'LOID'] })
  @IsEnum(['SN', 'LOID'], { message: 'tipoAuth debe ser SN o LOID' })
  tipoAuth: 'SN' | 'LOID';
}
