import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SerieManualDto {
  @ApiProperty({ description: 'Número de serie', example: 'SN123456789' })
  @IsString()
  @IsNotEmpty()
  numero_serie: string;

  @ApiPropertyOptional({ description: 'Dirección MAC (opcional)', example: 'AA:BB:CC:DD:EE:FF' })
  @IsString()
  @IsOptional()
  mac_address?: string;

  @ApiPropertyOptional({ description: 'Costo de adquisición (opcional)', example: 150.00 })
  @IsNumber()
  @IsOptional()
  costo_adquisicion?: number;

  @ApiPropertyOptional({ description: 'Observaciones (opcional)', example: 'Ingresado manualmente desde inventario físico' })
  @IsString()
  @IsOptional()
  observaciones?: string;
}

export class AgregarSeriesManualDto {
  @ApiProperty({ description: 'ID del inventario', example: 1 })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  id_inventario: number;

  @ApiProperty({ description: 'Lista de series a agregar', type: [SerieManualDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SerieManualDto)
  series: SerieManualDto[];
}

export class VerificarSeriesDto {
  @ApiProperty({ description: 'Lista de números de serie a verificar', type: [String] })
  @IsArray()
  @IsString({ each: true })
  series: string[];
}
