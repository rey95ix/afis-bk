// src/modules/atencion-al-cliente/clientes/dto/create-cliente-direccion.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt } from 'class-validator';

export class CreateClienteDireccionDto {
  @ApiProperty({
    description: 'ID del cliente',
    example: 1,
  })
  @IsInt()
  id_cliente: number;

  @ApiProperty({
    description: 'Dirección completa',
    example: 'Calle Principal #123, Casa #45',
  })
  @IsString()
  direccion: string;

  @ApiProperty({
    description: 'ID de la colonia',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  id_colonia?: number;

  @ApiProperty({
    description: 'ID del municipio',
    example: 1,
  })
  @IsInt()
  id_municipio: number;

  @ApiProperty({
    description: 'ID del departamento',
    example: 1,
  })
  @IsInt()
  id_departamento: number;

  @ApiProperty({
    description: 'Código postal',
    example: '01101',
    required: false,
  })
  @IsOptional()
  @IsString()
  codigo_postal?: string;
}
