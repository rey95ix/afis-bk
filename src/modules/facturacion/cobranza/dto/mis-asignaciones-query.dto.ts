// src/modules/facturacion/cobranza/dto/mis-asignaciones-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from 'src/common/dto';
import { bucket_mora } from '@prisma/client';

export class MisAsignacionesQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filtrar por ciclo' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_ciclo?: number;

  @ApiPropertyOptional({
    enum: ['DIAS_1_30', 'DIAS_31_60', 'DIAS_61_90', 'DIAS_91_MAS'],
  })
  @IsOptional()
  @IsEnum(['DIAS_1_30', 'DIAS_31_60', 'DIAS_61_90', 'DIAS_91_MAS'])
  bucket?: bucket_mora;
}
