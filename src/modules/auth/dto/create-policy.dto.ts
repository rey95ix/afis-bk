import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsObject, MinLength, MaxLength } from 'class-validator';

export class CreatePolicyDto {
  @ApiProperty({
    example: 'same_sucursal',
    description: 'Código único de la política',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  codigo: string;

  @ApiProperty({
    example: 'Misma Sucursal',
    description: 'Nombre descriptivo de la política',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  nombre: string;

  @ApiPropertyOptional({
    example: 'Valida que el usuario y el recurso pertenezcan a la misma sucursal',
    description: 'Descripción detallada de la política',
  })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiProperty({
    enum: ['SUCURSAL', 'PROPIETARIO', 'ESTADO_RECURSO', 'CUSTOM'],
    example: 'SUCURSAL',
    description: 'Tipo de política',
  })
  @IsEnum(['SUCURSAL', 'PROPIETARIO', 'ESTADO_RECURSO', 'CUSTOM'])
  tipo: string;

  @ApiProperty({
    example: 'SameSucursalPolicy',
    description: 'Nombre del handler que ejecutará la lógica de la política',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  handler: string;

  @ApiPropertyOptional({
    example: {
      campo_usuario: 'id_sucursal',
      campo_recurso: 'id_sucursal',
    },
    description: 'Configuración JSON para el handler de la política',
  })
  @IsObject()
  @IsOptional()
  configuracion?: any;
}
