// src/modules/administracion/catalogo/dto/create-catalogo.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt } from 'class-validator';

export class CreateCatalogoDto {
  @ApiProperty({ description: 'ID de la categoría' })
  @IsInt()
  id_categoria: number;

  @ApiProperty({ description: 'Código del producto' })
  @IsString()
  codigo: string;

  @ApiProperty({ description: 'Código del proveedor', required: false })
  @IsOptional()
  @IsString()
  codigo_proveedor?: string;

  @ApiProperty({ description: 'Nombre del producto' })
  @IsString()
  nombre: string;

  @ApiProperty({ description: 'Descripción del producto', required: false })
  @IsOptional()
  @IsString()
  descripcion?: string;
}
