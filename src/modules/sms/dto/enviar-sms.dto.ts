import { IsString, IsNotEmpty, IsOptional, IsEnum, IsInt, IsPhoneNumber, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TipoMensajeSms {
  NOTIFICACION_FACTURA = 'NOTIFICACION_FACTURA',
  TECNICO_EN_CAMINO = 'TECNICO_EN_CAMINO',
  ORDEN_TRABAJO_ASIGNADA = 'ORDEN_TRABAJO_ASIGNADA',
  ORDEN_TRABAJO_AGENDADA = 'ORDEN_TRABAJO_AGENDADA',
  ORDEN_TRABAJO_COMPLETADA = 'ORDEN_TRABAJO_COMPLETADA',
  TICKET_CREADO = 'TICKET_CREADO',
  TICKET_ACTUALIZADO = 'TICKET_ACTUALIZADO',
  CAMBIO_ESTADO_SERVICIO = 'CAMBIO_ESTADO_SERVICIO',
  RECORDATORIO_PAGO = 'RECORDATORIO_PAGO',
  PROMOCION = 'PROMOCION',
  GENERAL = 'GENERAL',
}

export class EnviarSmsDto {
  @ApiProperty({
    description: 'Número de teléfono destino en formato +503XXXXXXXX',
    example: '+50312345678'
  })
  @IsNotEmpty({ message: 'El teléfono destino es requerido' })
  @IsString()
  telefono_destino: string;

  @ApiProperty({
    description: 'Tipo de mensaje SMS',
    enum: TipoMensajeSms
  })
  @IsNotEmpty({ message: 'El tipo de mensaje es requerido' })
  @IsEnum(TipoMensajeSms, { message: 'Tipo de mensaje inválido' })
  tipo_mensaje: TipoMensajeSms;

  @ApiProperty({
    description: 'Contenido del mensaje (máximo 1600 caracteres)',
    example: 'Estimado cliente, su factura #12345 ha sido generada. Total: $45.50'
  })
  @IsNotEmpty({ message: 'El mensaje es requerido' })
  @IsString()
  @MaxLength(1600, { message: 'El mensaje no puede exceder 1600 caracteres' })
  mensaje: string;

  @ApiPropertyOptional({
    description: 'ID del cliente asociado (opcional)',
    example: 1
  })
  @IsOptional()
  @IsInt()
  id_cliente?: number;

  @ApiPropertyOptional({
    description: 'ID de orden de trabajo asociada (opcional)',
    example: 5
  })
  @IsOptional()
  @IsInt()
  id_orden_trabajo?: number;

  @ApiPropertyOptional({
    description: 'ID de ticket asociado (opcional)',
    example: 10
  })
  @IsOptional()
  @IsInt()
  id_ticket?: number;

  @ApiPropertyOptional({
    description: 'Referencia adicional (número de factura, etc.)',
    example: 'FAC-2025-00123'
  })
  @IsOptional()
  @IsString()
  referencia_adicional?: string;
}
