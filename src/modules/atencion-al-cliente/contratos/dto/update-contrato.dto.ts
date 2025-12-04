// src/modules/atencion-al-cliente/contratos/dto/update-contrato.dto.ts
import { PartialType, ApiProperty } from '@nestjs/swagger';
import { CreateContratoDto } from './create-contrato.dto';
import { IsOptional, IsDateString, IsEnum } from 'class-validator';

// Enum para estados de contrato (debe coincidir con Prisma)
export enum EstadoContrato {
  PENDIENTE_INSTALACION = 'PENDIENTE_INSTALACION',
  INSTALADO_ACTIVO = 'INSTALADO_ACTIVO',
  SUSPENDIDO = 'SUSPENDIDO',
  SUSPENDIDO_TEMPORAL = 'SUSPENDIDO_TEMPORAL',
  VELOCIDAD_REDUCIDA = 'VELOCIDAD_REDUCIDA',
  EN_MORA = 'EN_MORA',
  BAJA_DEFINITIVA = 'BAJA_DEFINITIVA',
  BAJA_CAMBIO_TITULAR = 'BAJA_CAMBIO_TITULAR',
  CANCELADO = 'CANCELADO',
}

export class UpdateContratoDto extends PartialType(CreateContratoDto) {
  @ApiProperty({
    description: 'Fecha de instalación del servicio',
    example: '2025-01-20',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  fecha_instalacion?: string;

  @ApiProperty({
    description: 'Fecha de inicio del contrato',
    example: '2025-01-20',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  fecha_inicio_contrato?: string;

  @ApiProperty({
    description: 'Fecha de fin del contrato',
    example: '2026-01-20',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  fecha_fin_contrato?: string;

  @ApiProperty({
    description: 'Estado del contrato',
    enum: EstadoContrato,
    example: EstadoContrato.INSTALADO_ACTIVO,
    required: false,
  })
  @IsOptional()
  @IsEnum(EstadoContrato)
  estado?: EstadoContrato;
}
