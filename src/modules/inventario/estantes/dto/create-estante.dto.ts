// src/modules/inventario/estantes/dto/create-estante.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt } from 'class-validator';

export class CreateEstanteDto {
  @ApiProperty({
    description: 'Nombre del estante',
    example: 'Estante A-1',
  })
  @IsString()
  nombre: string;

  @ApiProperty({
    description: 'ID de la bodega a la que pertenece el estante',
  })
  @IsInt()
  id_bodega: number;
}
