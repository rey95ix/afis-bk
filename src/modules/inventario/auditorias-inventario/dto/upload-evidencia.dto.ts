import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsInt, IsEnum } from 'class-validator';

export enum TipoEvidencia {
  ESTANTE = 'ESTANTE',
  PRODUCTO = 'PRODUCTO',
  GENERAL = 'GENERAL',
  DISCREPANCIA = 'DISCREPANCIA',
}

export class UploadEvidenciaDto {
  @ApiProperty({
    description: 'Tipo de evidencia',
    enum: TipoEvidencia,
    example: 'PRODUCTO',
  })
  @IsNotEmpty()
  @IsEnum(TipoEvidencia)
  tipo: TipoEvidencia;

  @ApiPropertyOptional({
    description: 'Título de la evidencia',
    example: 'Foto de producto dañado',
  })
  @IsOptional()
  @IsString()
  titulo?: string;

  @ApiPropertyOptional({
    description: 'Descripción de la evidencia',
    example: 'Se encontró producto con daño en empaque',
  })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({
    description: 'ID del catálogo relacionado (opcional)',
    example: 15,
  })
  @IsOptional()
  @IsInt()
  id_catalogo?: number;
}
