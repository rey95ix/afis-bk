import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, IsString, IsEnum, IsArray, IsDateString } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { estado_chat } from '@prisma/client';

export class QueryChatDto {
  @ApiPropertyOptional({ description: 'Número de página', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Registros por página', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Buscar por nombre o teléfono' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filtrar por estado', enum: estado_chat })
  @IsOptional()
  @IsEnum(estado_chat)
  estado?: estado_chat;

  @ApiPropertyOptional({ description: 'Filtrar por usuario asignado' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_usuario_asignado?: number;

  @ApiPropertyOptional({ description: 'Filtrar chats sin asignar' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  sin_asignar?: boolean;

  @ApiPropertyOptional({ description: 'Incluir chats sin asignar junto con los del usuario (para filtro combinado)' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  incluir_sin_asignar?: boolean;

  @ApiPropertyOptional({ description: 'Filtrar por cliente' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_cliente?: number;

  @ApiPropertyOptional({ description: 'Filtrar por tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  tags?: string[];

  @ApiPropertyOptional({ description: 'Fecha desde (ISO string)' })
  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @ApiPropertyOptional({ description: 'Fecha hasta (ISO string)' })
  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;

  @ApiPropertyOptional({
    description: 'Ordenar por',
    enum: ['ultimo_mensaje_at', 'fecha_creacion', 'mensajes_no_leidos'],
  })
  @IsOptional()
  @IsString()
  sort_by?: 'ultimo_mensaje_at' | 'fecha_creacion' | 'mensajes_no_leidos' = 'ultimo_mensaje_at';

  @ApiPropertyOptional({ description: 'Orden', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString()
  sort_order?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ description: 'Incluir chats archivados (por defecto false)' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  incluir_archivados?: boolean = false;
}
