// src/modules/atencion-al-cliente/contratos/dto/create-contrato.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsDateString,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class CreateContratoDto {
  @ApiProperty({
    description: 'ID del cliente al que pertenece el contrato',
    example: 1,
  })
  @IsInt()
  id_cliente: number;

  @ApiProperty({
    description: 'ID del plan contratado',
    example: 1,
  })
  @IsInt()
  id_plan: number;

  @ApiProperty({
    description: 'ID del ciclo de facturación',
    example: 1,
  })
  @IsInt()
  id_ciclo: number;

  @ApiProperty({
    description: 'ID de la dirección donde se prestará el servicio',
    example: 1,
  })
  @IsInt()
  id_direccion_servicio: number;

  @ApiProperty({
    description: 'ID de la orden de trabajo de instalación (opcional)',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  id_orden_trabajo?: number;

  @ApiProperty({
    description: 'Fecha de venta del contrato',
    example: '2025-01-15',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  fecha_venta?: string;

  @ApiProperty({
    description: 'Duración del contrato en meses',
    example: 12,
    default: 12,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  meses_contrato?: number;

  @ApiProperty({
    description: 'Costo de instalación del servicio',
    example: 25,
    default: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(40)
  costo_instalacion?: number;
}
