// src/modules/administracion/categorias/dto/create-categoria.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, IsOptional, IsInt, Length } from 'class-validator';

export class CreateCategoriaDto {
  @ApiProperty({ description: 'Nombre de la categoría', example: 'Electrónicos' })
  @IsString()
  nombre: string;

  @ApiProperty({ description: 'Código de 2 dígitos para la categoría', example: '01' })
  @IsString()
  @Length(2, 2, { message: 'El código debe tener 2 dígitos' })
  codigo: string;

  @ApiProperty({ description: 'ID de la categoría padre (opcional)', example: 1, required: false })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10)) 
  id_categoria_padre?: number;
}
