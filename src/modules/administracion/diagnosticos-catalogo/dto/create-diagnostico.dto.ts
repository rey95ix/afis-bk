// src/modules/administracion/diagnosticos-catalogo/dto/create-diagnostico.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, MinLength, MaxLength } from 'class-validator';

export class CreateDiagnosticoDto {
  @ApiProperty({
    description: 'Código único del diagnóstico',
    example: 'LOS_ROJO',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @MinLength(2, { message: 'El código debe tener al menos 2 caracteres' })
  @MaxLength(50, { message: 'El código no puede exceder 50 caracteres' })
  codigo: string;

  @ApiProperty({
    description: 'Nombre descriptivo del diagnóstico',
    example: 'Luz LOS en rojo',
  })
  @IsString()
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
  nombre: string;

  @ApiProperty({
    description: 'Descripción detallada del diagnóstico',
    example: 'Indica que no hay señal óptica llegando al equipo',
    required: false,
  })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({
    description: 'Estado activo del diagnóstico',
    example: true,
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
