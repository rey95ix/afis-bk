// src/modules/administracion/modelos/dto/create-modelo.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateModeloDto {
  @ApiProperty({ description: 'Nombre del modelo' })
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @IsString()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  nombre: string;

  @ApiProperty({ description: 'Descripción del modelo', required: false })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({ description: 'ID de la marca asociada' })
  @IsNotEmpty({ message: 'La marca es requerida' })
  @IsInt()
  id_marca: number;
}
