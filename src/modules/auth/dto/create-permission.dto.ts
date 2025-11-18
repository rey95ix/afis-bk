import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsBoolean, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({
    example: 'inventario.compras:crear',
    description: 'Código único del permiso (formato: modulo.recurso:accion)',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  codigo: string;

  @ApiProperty({
    example: 'Crear Compras',
    description: 'Nombre descriptivo del permiso',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  nombre: string;

  @ApiPropertyOptional({
    example: 'Permite crear nuevas órdenes de compra en el módulo de inventario',
    description: 'Descripción detallada del permiso',
  })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiProperty({
    example: 'inventario',
    description: 'Módulo al que pertenece el permiso',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  modulo: string;

  @ApiProperty({
    example: 'compras',
    description: 'Recurso al que aplica el permiso',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  recurso: string;

  @ApiProperty({
    enum: ['VER', 'CREAR', 'EDITAR', 'ELIMINAR', 'APROBAR', 'RECHAZAR', 'EXPORTAR', 'IMPRIMIR', 'CUSTOM'],
    example: 'CREAR',
    description: 'Acción que permite el permiso',
  })
  @IsEnum(['VER', 'CREAR', 'EDITAR', 'ELIMINAR', 'APROBAR', 'RECHAZAR', 'EXPORTAR', 'IMPRIMIR', 'CUSTOM'])
  accion: string;

  @ApiPropertyOptional({
    enum: ['RECURSO', 'MODULO', 'SISTEMA'],
    example: 'RECURSO',
    description: 'Tipo de permiso',
    default: 'RECURSO',
  })
  @IsEnum(['RECURSO', 'MODULO', 'SISTEMA'])
  @IsOptional()
  tipo?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Indica si el permiso es crítico para el sistema',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  es_critico?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Indica si las acciones con este permiso requieren auditoría',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  requiere_auditoria?: boolean;
}
