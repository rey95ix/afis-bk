// src/modules/inventario/importaciones/dto/create-importacion-serie.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateImportacionSerieDto {
  @ApiProperty({
    description: 'Número de serie del equipo',
    example: 'SN123456789',
  })
  @IsString({ message: 'El número de serie debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El número de serie no puede estar vacío.' })
  numero_serie: string;

  @ApiProperty({
    description: 'Dirección MAC del equipo',
    required: false,
    example: '00:11:22:33:44:55',
  })
  @IsOptional()
  @IsString({ message: 'La dirección MAC debe ser una cadena de texto.' })
  mac_address?: string;

  @ApiProperty({
    description: 'Observaciones de la serie',
    required: false,
    example: 'Equipo con firmware actualizado',
  })
  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser una cadena de texto.' })
  observaciones?: string;
}
