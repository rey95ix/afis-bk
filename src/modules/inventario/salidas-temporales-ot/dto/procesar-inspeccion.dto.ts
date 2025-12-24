// src/modules/inventario/salidas-temporales-ot/dto/procesar-inspeccion.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsEnum, IsOptional, IsString } from 'class-validator';

export enum ResultadoInspeccion {
  APROBADO = 'APROBADO',
  REQUIERE_REPARACION = 'REQUIERE_REPARACION',
  DANO_PERMANENTE = 'DANO_PERMANENTE',
}

export class ProcesarInspeccionDto {
  @ApiProperty({
    description: 'ID de la serie a inspeccionar',
    example: 123,
  })
  @IsInt()
  id_serie: number;

  @ApiProperty({
    description: 'Resultado de la inspección',
    enum: ResultadoInspeccion,
    example: ResultadoInspeccion.APROBADO,
  })
  @IsEnum(ResultadoInspeccion)
  resultado: ResultadoInspeccion;

  @ApiProperty({
    description: 'Observaciones de la inspección',
    required: false,
    example: 'Equipo en buen estado, sin daños visibles',
  })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class ProcesarInspeccionBulkDto {
  @ApiProperty({
    description: 'Lista de inspecciones a procesar',
    type: [ProcesarInspeccionDto],
  })
  inspecciones: ProcesarInspeccionDto[];
}
