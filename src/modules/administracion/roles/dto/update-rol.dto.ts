import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, IsEnum } from 'class-validator';

export class UpdateRolDto {
  @ApiProperty({
    description: 'Nombre del rol',
    example: 'Administrador de Inventario',
    maxLength: 255,
    required: false,
  })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsOptional()
  @MaxLength(255, { message: 'El nombre no puede exceder 255 caracteres' })
  nombre?: string;

  @ApiProperty({
    description: 'Descripción del rol',
    example: 'Rol con permisos completos para gestionar inventario, bodegas y movimientos',
    required: false,
  })
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  @IsOptional()
  descripcion?: string;

  @ApiProperty({
    description: 'Estado del rol',
    example: 'ACTIVO',
    enum: ['ACTIVO', 'SUPENDIDO', 'INACTIVO'],
    required: false,
  })
  @IsEnum(['ACTIVO', 'SUPENDIDO', 'INACTIVO'], {
    message: 'El estado debe ser ACTIVO, SUPENDIDO o INACTIVO',
  })
  @IsOptional()
  estado?: 'ACTIVO' | 'SUPENDIDO' | 'INACTIVO';
}
