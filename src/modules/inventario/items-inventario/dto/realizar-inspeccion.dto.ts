import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export enum ResultadoInspeccion {
  APROBADO = 'APROBADO',
  REQUIERE_REPARACION = 'REQUIERE_REPARACION',
  DANO_PERMANENTE = 'DANO_PERMANENTE',
}

export class RealizarInspeccionDto {
  @ApiProperty({
    description: 'ID de la serie a inspeccionar',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  id_serie: number;

  @ApiProperty({
    description: 'Resultado de la inspección',
    enum: ResultadoInspeccion,
    example: ResultadoInspeccion.APROBADO,
  })
  @IsEnum(ResultadoInspeccion)
  @IsNotEmpty()
  resultado: ResultadoInspeccion;

  @ApiProperty({
    description: 'Observaciones de la inspección',
    example: 'Equipo en perfectas condiciones, sin daños visibles',
    minLength: 10,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  observaciones: string;

  @ApiPropertyOptional({
    description: 'ID de la bodega destino (opcional, si se mueve a otra bodega)',
    example: 2,
  })
  @IsOptional()
  @IsInt()
  id_bodega_destino?: number;
}

export class CambiarEstadoSerieDto {
  @ApiProperty({
    description: 'Nuevo estado de la serie',
    example: 'DISPONIBLE',
  })
  @IsString()
  @IsNotEmpty()
  estado: string;

  @ApiPropertyOptional({
    description: 'Observaciones del cambio de estado',
    example: 'Cambio de estado post-inspección',
  })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export enum ResultadoReparacion {
  EXITOSA = 'EXITOSA',
  FALLIDA = 'FALLIDA',
}

export class CompletarReparacionDto {
  @ApiProperty({
    description: 'ID de la serie en reparación',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  id_serie: number;

  @ApiProperty({
    description: 'Resultado de la reparación',
    enum: ResultadoReparacion,
    example: ResultadoReparacion.EXITOSA,
  })
  @IsEnum(ResultadoReparacion)
  @IsNotEmpty()
  resultado: ResultadoReparacion;

  @ApiProperty({
    description: 'Observaciones de la reparación',
    example: 'Se reemplazó el componente dañado, equipo funciona correctamente',
    minLength: 10,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  observaciones: string;

  @ApiPropertyOptional({
    description: 'Costo de la reparación',
    example: 150.50,
  })
  @IsOptional()
  costo_reparacion?: number;
}
