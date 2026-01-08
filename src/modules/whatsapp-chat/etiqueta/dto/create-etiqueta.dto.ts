import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  Matches,
  IsInt,
  Min,
} from 'class-validator';

export class CreateEtiquetaDto {
  @ApiProperty({
    description: 'Nombre de la etiqueta',
    example: 'Urgente',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nombre: string;

  @ApiProperty({
    description: 'Color en formato hexadecimal',
    example: '#FF5733',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'El color debe estar en formato hexadecimal (#RRGGBB)',
  })
  color: string;

  @ApiPropertyOptional({
    description: 'Descripción de la etiqueta',
    example: 'Chats que requieren atención inmediata',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  descripcion?: string;

  @ApiPropertyOptional({
    description: 'Orden de visualización (menor = primero)',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;
}
