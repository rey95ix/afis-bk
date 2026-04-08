// src/modules/facturacion/cobranza/dto/distribuir-asignaciones.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { bucket_mora } from '@prisma/client';

export class DistribuirAsignacionesDto {
  @ApiProperty({
    description: 'IDs de los usuarios que actuarán como gestores de cobro',
    example: [4, 7, 12],
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  id_gestores: number[];

  @ApiPropertyOptional({
    description: 'Buckets a incluir. Si se omite, se distribuyen todos.',
    enum: ['DIAS_1_30', 'DIAS_31_60', 'DIAS_61_90', 'DIAS_91_MAS'],
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(['DIAS_1_30', 'DIAS_31_60', 'DIAS_61_90', 'DIAS_91_MAS'], { each: true })
  buckets?: bucket_mora[];

  @ApiPropertyOptional({
    description:
      'Si true (default), solo distribuye facturas que aún no tienen asignación ACTIVA',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  solo_sin_asignar?: boolean = true;

  @ApiPropertyOptional({
    description: 'Estrategia de distribución',
    enum: ['ROUND_ROBIN'],
    default: 'ROUND_ROBIN',
  })
  @IsOptional()
  @IsEnum(['ROUND_ROBIN'])
  estrategia?: 'ROUND_ROBIN' = 'ROUND_ROBIN';
}
