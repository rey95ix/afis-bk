// src/modules/inventario/importaciones/dto/update-estado-importacion.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';
import { estado_importacion } from '@prisma/client';

export class UpdateEstadoImportacionDto {
  @ApiProperty({
    description: 'Nuevo estado de la importación',
    enum: estado_importacion,
    example: 'EN_TRANSITO',
  })
  @IsEnum(estado_importacion, {
    message: 'El estado debe ser un valor válido del enum estado_importacion.',
  })
  @IsNotEmpty({ message: 'El estado no puede estar vacío.' })
  estado: estado_importacion;

  @ApiProperty({
    description: 'Fecha de embarque (si aplica)',
    required: false,
    example: '2025-01-15',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de embarque debe ser una fecha válida.' })
  fecha_embarque?: string;

  @ApiProperty({
    description: 'Fecha real de arribo (si aplica)',
    required: false,
    example: '2025-02-10',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de arribo real debe ser una fecha válida.' })
  fecha_arribo_real?: string;

  @ApiProperty({
    description: 'Fecha de liberación aduanal (si aplica)',
    required: false,
    example: '2025-02-12',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de liberación debe ser una fecha válida.' })
  fecha_liberacion_aduana?: string;

  @ApiProperty({
    description: 'Fecha de recepción (si aplica)',
    required: false,
    example: '2025-02-15',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de recepción debe ser una fecha válida.' })
  fecha_recepcion?: string;
}
