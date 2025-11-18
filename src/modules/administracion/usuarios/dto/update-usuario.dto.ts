// src/modules/administracion/usuarios/dto/update-usuario.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, MinLength, Matches } from 'class-validator';

export class UpdateUsuarioDto {
  @ApiProperty({ description: 'Nombre de usuario', example: 'jdoe', required: false })
  @IsString()
  @IsOptional()
  usuario?: string;

  @ApiProperty({ description: 'Nombres del usuario', example: 'John', required: false })
  @IsString()
  @IsOptional()
  @MinLength(3)
  nombres?: string;

  @ApiProperty({ description: 'Apellidos del usuario', example: 'Doe', required: false })
  @IsString()
  @IsOptional()
  @MinLength(3)
  apellidos?: string;

  @ApiProperty({ description: 'Teléfono del usuario', example: '+50312345678', required: false })
  @IsString()
  @IsOptional()
  @Matches(/^\+503\d{8}$/, {
    message: 'El teléfono debe tener el formato +503XXXXXXXX (código de El Salvador + 8 dígitos)'
  })
  telefono?: string;

  @ApiProperty({ description: 'ID del rol', example: 1, required: false })
  @IsInt()
  @IsOptional()
  id_rol?: number;

  @ApiProperty({ description: 'ID de la sucursal', example: 1, required: false })
  @IsInt()
  @IsOptional()
  id_sucursal?: number;

  @ApiProperty({ description: 'DUI del usuario', example: '12345678-9', required: false })
  @IsString()
  @IsOptional()
  dui?: string;

  @ApiProperty({ description: 'ID del tipo de documento', example: 1, required: false })
  @IsInt()
  @IsOptional()
  id_tipo_documento?: number;

  @ApiProperty({ description: 'Foto del usuario en base64', required: false })
  @IsString()
  @IsOptional()
  foto?: string;
}
