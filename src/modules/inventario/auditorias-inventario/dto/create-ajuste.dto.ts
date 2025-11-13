import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsString,
  IsEnum,
  IsArray,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { causa_discrepancia, tipo_discrepancia } from '@prisma/client';

export class AjusteItemDto {
  @ApiProperty({
    description: 'ID del detalle de auditoría (con la discrepancia)',
    example: 5,
  })
  @IsNotEmpty()
  @IsInt()
  id_auditoria_detalle: number;

  @ApiProperty({
    description: 'ID del catálogo/producto',
    example: 15,
  })
  @IsNotEmpty()
  @IsInt()
  id_catalogo: number;

  @ApiProperty({
    description: 'Cantidad anterior (según sistema)',
    example: 10,
  })
  @IsNotEmpty()
  @IsInt()
  cantidad_anterior: number;

  @ApiProperty({
    description: 'Cantidad nueva (según conteo físico)',
    example: 8,
  })
  @IsNotEmpty()
  @IsInt()
  cantidad_nueva: number;

  @ApiPropertyOptional({
    description: 'Tipo de discrepancia',
    enum: tipo_discrepancia,
    example: 'FALTANTE',
  })
  @IsOptional()
  @IsEnum(tipo_discrepancia)
  tipo_discrepancia?: tipo_discrepancia;

  @ApiPropertyOptional({
    description: 'Causa de la discrepancia',
    enum: causa_discrepancia,
    example: 'ERROR_REGISTRO',
  })
  @IsOptional()
  @IsEnum(causa_discrepancia)
  causa_discrepancia?: causa_discrepancia;

  @ApiPropertyOptional({
    description: 'Observaciones específicas del ajuste',
    example: 'Faltantes encontrados en auditoría sorpresa',
  })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class CreateAjusteDto {
  @ApiProperty({
    description: 'ID de la auditoría origen',
    example: 3,
  })
  @IsNotEmpty()
  @IsInt()
  id_auditoria: number;

  @ApiProperty({
    description: 'Array de ajustes a crear',
    type: [AjusteItemDto],
  })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => AjusteItemDto)
  ajustes: AjusteItemDto[];

  @ApiPropertyOptional({
    description: 'Motivo detallado general para todos los ajustes',
    example: 'Ajustes resultado de auditoría sorpresa del 2025-01-15',
  })
  @IsOptional()
  @IsString()
  motivo_detallado?: string;

  @ApiPropertyOptional({
    description: 'URLs de documentos de soporte (JSON array)',
    example: '["https://bucket/doc1.pdf","https://bucket/doc2.pdf"]',
  })
  @IsOptional()
  @IsString()
  documentos_soporte?: string;
}
