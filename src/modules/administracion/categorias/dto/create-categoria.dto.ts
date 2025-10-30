// src/modules/inventario/categorias/dto/create-categoria.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateCategoriaDto {
  @ApiProperty({ description: 'Nombre de la categoría', example: 'Electrónicos' })
  @IsString()
  nombre: string;
}
