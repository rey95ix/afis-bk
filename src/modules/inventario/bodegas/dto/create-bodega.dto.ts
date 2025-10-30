// src/modules/inventario/bodegas/dto/create-bodega.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt } from 'class-validator';

export class CreateBodegaDto {
  @ApiProperty({
    description: 'Nombre de la bodega',
    example: 'Bodega Principal',
  })
  @IsString()
  nombre: string;

  @ApiProperty({ description: 'Descripción de la bodega', required: false })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({
    description: 'ID de la sucursal a la que pertenece la bodega',
  })
  @IsInt()
  id_sucursal: number;
}
