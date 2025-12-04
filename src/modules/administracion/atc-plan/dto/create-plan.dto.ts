// src/modules/administracion/atc-plan/dto/create-plan.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, IsOptional, IsInt, IsNumber, IsBoolean, IsDateString, Min } from 'class-validator';

export class CreatePlanDto {
  @ApiProperty({ description: 'Nombre del plan', example: 'Plan 50 Mbps' })
  @IsString()
  nombre: string;

  @ApiProperty({ description: 'Descripción del plan', example: 'Internet residencial 50 Mbps', required: false })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({ description: 'Precio mensual del plan', example: 25.00 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  precio: number;

  @ApiProperty({ description: 'ID del tipo de plan', example: 1 })
  @IsInt()
  @Transform(({ value }) => parseInt(value, 10))
  id_tipo_plan: number;

  @ApiProperty({ description: 'Duración del contrato en meses', example: 12, default: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  meses_contrato?: number;

  @ApiProperty({ description: 'Velocidad de bajada en Mbps', example: 50, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Transform(({ value }) => value ? parseInt(value, 10) : null)
  velocidad_bajada?: number;

  @ApiProperty({ description: 'Velocidad de subida en Mbps', example: 10, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Transform(({ value }) => value ? parseInt(value, 10) : null)
  velocidad_subida?: number;

  @ApiProperty({ description: 'Indica si aplica IVA', example: true, default: true })
  @IsOptional()
  @IsBoolean()
  aplica_iva?: boolean;

  @ApiProperty({ description: 'Indica si aplica CESC (Contribución Especial)', example: false, default: false })
  @IsOptional()
  @IsBoolean()
  aplica_cesc?: boolean;

  @ApiProperty({ description: 'Porcentaje de IVA', example: 13.00, default: 13.00 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Transform(({ value }) => parseFloat(value))
  porcentaje_iva?: number;

  @ApiProperty({ description: 'Fecha de inicio de vigencia del plan', required: false })
  @IsOptional()
  @IsDateString()
  fecha_inicio_vigencia?: string;

  @ApiProperty({ description: 'Fecha de fin de vigencia del plan', required: false })
  @IsOptional()
  @IsDateString()
  fecha_fin_vigencia?: string;
}
