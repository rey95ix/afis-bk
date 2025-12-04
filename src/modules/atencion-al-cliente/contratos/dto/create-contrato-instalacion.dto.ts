// src/modules/atencion-al-cliente/contratos/dto/create-contrato-instalacion.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsBoolean,
  IsDateString,
  IsArray,
} from 'class-validator';

export class CreateContratoInstalacionDto {
  @ApiProperty({
    description: 'ID del contrato al que pertenece la instalación',
    example: 1,
  })
  @IsInt()
  id_contrato: number;

  @ApiProperty({
    description: 'Nombre de la red WiFi configurada',
    example: 'NEWTEL_PEREZ_5G',
    required: false,
  })
  @IsOptional()
  @IsString()
  wifi_nombre?: string;

  @ApiProperty({
    description: 'Contraseña de la red WiFi',
    example: 'P4ssw0rd2025',
    required: false,
  })
  @IsOptional()
  @IsString()
  wifi_password?: string;

  @ApiProperty({
    description: 'Potencia de la ONU en dBm',
    example: '-18.5 dBm',
    required: false,
  })
  @IsOptional()
  @IsString()
  potencia_onu?: string;

  @ApiProperty({
    description: 'Dirección MAC de la ONU',
    example: 'AA:BB:CC:DD:EE:FF',
    required: false,
  })
  @IsOptional()
  @IsString()
  mac_onu?: string;

  @ApiProperty({
    description: 'Número de serie de la ONU',
    example: 'HWTC12345678',
    required: false,
  })
  @IsOptional()
  @IsString()
  numero_serie_onu?: string;

  @ApiProperty({
    description: 'Fecha y hora de la instalación',
    example: '2025-01-20T14:30:00Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  fecha_instalacion?: string;

  @ApiProperty({
    description: 'Indica si la instalación fue completada',
    example: true,
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  instalado?: boolean;

  @ApiProperty({
    description: 'Observaciones de la instalación',
    example: 'Cliente satisfecho con el servicio',
    required: false,
  })
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiProperty({
    description: 'IDs de los técnicos que realizaron la instalación',
    example: [1, 2],
    type: [Number],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  tecnicos_instalacion?: number[];
}
