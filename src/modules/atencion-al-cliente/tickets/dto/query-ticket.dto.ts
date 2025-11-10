import { IsEnum, IsInt, IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { EstadoTicket } from './update-ticket.dto';
import { Severidad } from './create-ticket.dto';

export class QueryTicketDto {
  @ApiPropertyOptional({
    description: 'Filtrar por estado del ticket',
    enum: EstadoTicket,
    example: EstadoTicket.ABIERTO,
  })
  @IsEnum(EstadoTicket)
  @IsOptional()
  estado?: EstadoTicket;

  @ApiPropertyOptional({
    description: 'Filtrar por ID del cliente',
    example: 1,
  })
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  id_cliente?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por nivel de severidad',
    enum: Severidad,
    example: Severidad.ALTA,
  })
  @IsEnum(Severidad)
  @IsOptional()
  severidad?: Severidad;

  @ApiPropertyOptional({
    description: 'Filtrar desde fecha (formato ISO 8601)',
    example: '2025-11-01',
  })
  @IsDateString()
  @IsOptional()
  fecha_desde?: string;

  @ApiPropertyOptional({
    description: 'Filtrar hasta fecha (formato ISO 8601)',
    example: '2025-11-30',
  })
  @IsDateString()
  @IsOptional()
  fecha_hasta?: string;

  @ApiPropertyOptional({
    description: 'Página actual para paginación',
    example: 1,
    default: 1,
  })
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de registros por página',
    example: 10,
    default: 10,
  })
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  limit?: number = 10;
}
