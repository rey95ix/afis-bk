import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIP,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * DTO para registrar un nuevo equipo OLT.
 *
 * Los campos `usuario` y `clave` corresponden a credenciales SSH. Internamente
 * se persisten en la tabla `olt_credencial` (relación 1:1 con `olt_equipo`)
 * y la clave se encripta con AES-256-GCM antes de guardarse.
 */
export class CreateOltEquipoDto {
  @ApiProperty({ description: 'Nombre identificador del equipo OLT', maxLength: 50 })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  nombre: string;

  @ApiProperty({ description: 'Dirección IP de gestión', example: '192.168.1.100' })
  @IsIP()
  @MaxLength(50)
  ip_address: string;

  @ApiPropertyOptional({ description: 'ID de la sucursal donde se ubica el equipo' })
  @IsOptional()
  @IsInt()
  id_sucursal?: number;

  @ApiProperty({ description: 'Usuario SSH para acceso al equipo', maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  usuario: string;

  @ApiProperty({ description: 'Contraseña SSH (se almacena encriptada)' })
  @IsString()
  @MinLength(1)
  clave: string;

  @ApiPropertyOptional({ description: 'Puerto SSH', default: 22, minimum: 1, maximum: 65535 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  puerto?: number;

  @ApiPropertyOptional({
    description: 'Patrón del prompt del CLI (para detectar fin de comando)',
    example: 'OLT1-Newtel>',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  prompt_pattern?: string;
}
