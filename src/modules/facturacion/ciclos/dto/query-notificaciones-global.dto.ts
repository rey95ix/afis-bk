import { IsOptional, IsInt, IsIn, IsString, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export type FiltroNotificacionGlobal =
  | 'TODOS'
  | 'TELEFONO_INVALIDO'
  | 'CORREO_INVALIDO'
  | 'AMBOS_INVALIDOS'
  | 'TODOS_VALIDOS';

export class QueryNotificacionesGlobalDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === '' ? undefined : parseInt(value, 10),
  )
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === '' ? undefined : parseInt(value, 10),
  )
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;

  @ApiPropertyOptional({
    description: 'Filtrar por ciclo especifico. Si se omite, incluye todos los ciclos.',
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === '' ? undefined : parseInt(value, 10),
  )
  @Type(() => Number)
  @IsInt()
  id_ciclo?: number;

  @ApiPropertyOptional({
    enum: [
      'TODOS',
      'TELEFONO_INVALIDO',
      'CORREO_INVALIDO',
      'AMBOS_INVALIDOS',
      'TODOS_VALIDOS',
    ],
    default: 'TODOS',
  })
  @IsOptional()
  @IsIn([
    'TODOS',
    'TELEFONO_INVALIDO',
    'CORREO_INVALIDO',
    'AMBOS_INVALIDOS',
    'TODOS_VALIDOS',
  ])
  filtro?: FiltroNotificacionGlobal = 'TODOS';

  @ApiPropertyOptional({ description: 'Busqueda por nombre del cliente' })
  @IsOptional()
  @IsString()
  search?: string;
}
