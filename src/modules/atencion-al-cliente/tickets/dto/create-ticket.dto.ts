import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export enum CanalContacto {
  TELEFONO = 'TELEFONO',
  WHATSAPP = 'WHATSAPP',
  EMAIL = 'EMAIL',
  APP = 'APP',
  WEB = 'WEB',
}

export enum Severidad {
  BAJA = 'BAJA',
  MEDIA = 'MEDIA',
  ALTA = 'ALTA',
  CRITICA = 'CRITICA',
}

export class CreateTicketDto {
  @ApiProperty({
    description: 'ID del cliente que reporta el problema',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  @Transform(({ value }) => parseInt(value, 10))
  id_cliente: number;

  @ApiProperty({
    description: 'Canal por el cual contactó el cliente',
    enum: CanalContacto,
    example: CanalContacto.TELEFONO,
  })
  @IsEnum(CanalContacto)
  @IsNotEmpty()
  canal: CanalContacto;

  @ApiProperty({
    description: 'Descripción detallada del problema reportado',
    example: 'Cliente reporta que no tiene servicio de internet desde hace 2 horas',
  })
  @IsString()
  @IsNotEmpty()
  descripcion_problema: string;

  @ApiPropertyOptional({
    description: 'Nivel de severidad del problema',
    enum: Severidad,
    example: Severidad.MEDIA,
    default: Severidad.MEDIA,
  })
  @IsEnum(Severidad)
  @IsOptional()
  severidad?: Severidad;

  @ApiPropertyOptional({
    description: 'ID de la dirección donde ocurre el problema',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  id_direccion_servicio?: number;

  @ApiPropertyOptional({
    description: 'Diagnóstico inicial realizado por el agente',
    example: 'Se realizó ping al CPE, no responde. Potencia en OLT muestra valores fuera de rango.',
  })
  @IsString()
  @IsOptional()
  diagnostico_inicial?: string;

  @ApiPropertyOptional({
    description: 'ID del diagnóstico del catálogo',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  id_diagnostico_catalogo?: number;

  @ApiPropertyOptional({
    description: 'Resultados de pruebas remotas realizadas (ping, traceroute, potencia, etc.)',
    example: 'Ping: 100% pérdida de paquetes. Potencia OLT: -28 dBm',
  })
  @IsString()
  @IsOptional()
  pruebas_remotas?: string;

  @ApiPropertyOptional({
    description: 'Indica si el problema requiere visita técnica',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  requiere_visita?: boolean;
}
