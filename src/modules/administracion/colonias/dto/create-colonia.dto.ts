// src/modules/administracion/colonias/dto/create-colonia.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt } from 'class-validator';

export class CreateColoniaDto {
  @ApiProperty({
    description: 'Nombre de la colonia',
    example: 'Colonia San Benito',
  })
  @IsString()
  nombre: string;

  @ApiProperty({ description: 'Código de la colonia', required: false })
  @IsOptional()
  @IsString()
  codigo?: string;

  @ApiProperty({
    description: 'ID del municipio al que pertenece la colonia',
  })
  @IsInt()
  id_municipio: number;
}
