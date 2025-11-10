import { PartialType } from '@nestjs/swagger';
import { CreateTicketDto } from './create-ticket.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsInt, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export enum EstadoTicket {
  ABIERTO = 'ABIERTO',
  EN_DIAGNOSTICO = 'EN_DIAGNOSTICO',
  ESCALADO = 'ESCALADO',
  CERRADO = 'CERRADO',
  CANCELADO = 'CANCELADO',
}

export class UpdateTicketDto extends PartialType(CreateTicketDto) {
  @ApiPropertyOptional({
    description: 'Estado actual del ticket',
    enum: EstadoTicket,
    example: EstadoTicket.EN_DIAGNOSTICO,
  })
  @IsEnum(EstadoTicket)
  @IsOptional()
  estado?: EstadoTicket;

  @ApiPropertyOptional({
    description: 'Fecha de cierre del ticket',
    example: '2025-11-02T10:30:00Z',
  })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  fecha_cierre?: Date;

  @ApiPropertyOptional({
    description: 'ID del usuario que cerró el ticket',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  cerrado_por_usuario?: number;

  @ApiPropertyOptional({
    description: 'Observaciones al cerrar el ticket',
    example: 'Problema resuelto mediante reinicio remoto del equipo',
  })
  @IsString()
  @IsOptional()
  observaciones_cierre?: string;
}
