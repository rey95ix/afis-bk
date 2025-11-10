// src/modules/inventario/bodegas/dto/create-bodega.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsEnum } from 'class-validator';
import { tipo_ubicacion } from '@prisma/client';

export class CreateBodegaDto {
  @ApiProperty({
    description: 'Nombre de la bodega',
    example: 'Bodega Principal',
  })
  @IsString()
  nombre: string;

  @ApiProperty({ description: 'Descripción de la bodega', required: false })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({
    description: 'Tipo de ubicación (BODEGA o CUADRILLA)',
    enum: tipo_ubicacion,
    default: tipo_ubicacion.BODEGA,
    required: false,
  })
  @IsOptional()
  @IsEnum(tipo_ubicacion)
  tipo?: tipo_ubicacion;

  @ApiProperty({
    description: 'ID de la sucursal a la que pertenece la bodega',
  })
  @IsInt()
  id_sucursal: number;

  @ApiProperty({
    description: 'ID del usuario responsable (si es cuadrilla)',
    required: false,
  })
  @IsOptional()
  @IsInt()
  id_responsable?: number;

  @ApiProperty({
    description: 'Placa del vehículo (si es cuadrilla)',
    required: false,
  })
  @IsOptional()
  @IsString()
  placa_vehiculo?: string;
}
