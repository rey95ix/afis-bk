// src/modules/facturacion/ciclos/dto/query-ciclo.dto.ts
import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from 'src/common/dto';

export class QueryCicloDto extends PaginationDto {
  // search ya viene heredado de PaginationDto

  @ApiPropertyOptional({
    description: 'Filtrar por estado',
    enum: ['ACTIVO', 'INACTIVO'],
    example: 'ACTIVO',
  })
  @IsOptional()
  @IsEnum(['ACTIVO', 'INACTIVO'])
  estado?: 'ACTIVO' | 'INACTIVO';
}
