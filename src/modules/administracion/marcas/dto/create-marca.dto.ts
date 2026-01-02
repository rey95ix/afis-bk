// src/modules/administracion/marcas/dto/create-marca.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateMarcaDto {
  @ApiProperty({ description: 'Nombre de la marca' })
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @IsString()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  nombre: string;

  @ApiProperty({ description: 'Descripción de la marca', required: false })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({ description: 'Logo de la marca (base64 o URL)', required: false })
  @IsOptional()
  @IsString()
  logo?: string;
}
