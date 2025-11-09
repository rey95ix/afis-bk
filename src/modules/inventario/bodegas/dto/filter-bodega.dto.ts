// src/modules/inventario/bodegas/dto/filter-bodega.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsOptional, IsInt } from 'class-validator';
import { PaginationDto } from 'src/common/dto';

export class FilterBodegaDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'ID de la sucursal para filtrar bodegas',
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @Type(() => Number)
  @IsInt()
  id_sucursal?: number;
}
