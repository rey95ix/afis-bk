import { IsOptional, IsEnum, IsInt, IsString, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum EstadoEnvioSms {
  PENDIENTE = 'PENDIENTE',
  ENVIADO = 'ENVIADO',
  ENTREGADO = 'ENTREGADO',
  FALLIDO = 'FALLIDO',
  EN_COLA = 'EN_COLA',
}

export class QuerySmsDto {
  @ApiPropertyOptional({
    description: 'ID del cliente',
    example: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_cliente?: number;

  @ApiPropertyOptional({
    description: 'Estado del envío',
    enum: EstadoEnvioSms
  })
  @IsOptional()
  @IsEnum(EstadoEnvioSms)
  estado?: EstadoEnvioSms;

  @ApiPropertyOptional({
    description: 'Tipo de mensaje',
    example: 'TECNICO_EN_CAMINO'
  })
  @IsOptional()
  @IsString()
  tipo_mensaje?: string;

  @ApiPropertyOptional({
    description: 'Número de teléfono destino',
    example: '+50312345678'
  })
  @IsOptional()
  @IsString()
  telefono_destino?: string;

  @ApiPropertyOptional({
    description: 'Fecha desde (ISO 8601)',
    example: '2025-01-01T00:00:00Z'
  })
  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @ApiPropertyOptional({
    description: 'Fecha hasta (ISO 8601)',
    example: '2025-12-31T23:59:59Z'
  })
  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;

  @ApiPropertyOptional({
    description: 'Página',
    example: 1,
    default: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Límite de resultados por página',
    example: 10,
    default: 10
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number = 10;
}
