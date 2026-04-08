// src/modules/facturacion/cobranza/dto/facturas-vencidas-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsEnum, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from 'src/common/dto';
import { bucket_mora } from '@prisma/client';

export class FacturasVencidasQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Bucket de antigüedad de mora',
    enum: ['DIAS_1_30', 'DIAS_31_60', 'DIAS_61_90', 'DIAS_91_MAS'],
  })
  @IsOptional()
  @IsEnum(['DIAS_1_30', 'DIAS_31_60', 'DIAS_61_90', 'DIAS_91_MAS'])
  bucket?: bucket_mora;

  @ApiPropertyOptional({
    description: 'Filtrar por estado de asignación: true=asignadas, false=sin asignar',
  })
  @IsOptional()
  @IsBooleanString()
  asignado?: string;

  @ApiPropertyOptional({ description: 'Filtrar por id de gestor de cobro' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_gestor?: number;
}
