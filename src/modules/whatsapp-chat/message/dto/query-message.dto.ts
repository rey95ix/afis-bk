import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsInt,
  IsString,
  IsEnum,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { direccion_mensaje, tipo_mensaje_whatsapp } from '@prisma/client';

export class QueryMessageDto {
  @ApiPropertyOptional({ description: 'Número de página', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Registros por página', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number = 50;

  @ApiPropertyOptional({
    description: 'Filtrar por dirección del mensaje',
    enum: direccion_mensaje,
  })
  @IsOptional()
  @IsEnum(direccion_mensaje)
  direccion?: direccion_mensaje;

  @ApiPropertyOptional({
    description: 'Filtrar por tipo de mensaje',
    enum: tipo_mensaje_whatsapp,
  })
  @IsOptional()
  @IsEnum(tipo_mensaje_whatsapp)
  tipo?: tipo_mensaje_whatsapp;

  @ApiPropertyOptional({ description: 'Filtrar mensajes de IA' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  es_de_ia?: boolean;

  @ApiPropertyOptional({ description: 'Buscar en contenido' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Obtener mensajes desde esta fecha (ISO string)',
  })
  @IsOptional()
  @IsDateString()
  since?: string;

  @ApiPropertyOptional({ description: 'Orden', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString()
  sort_order?: 'asc' | 'desc' = 'desc';
}
