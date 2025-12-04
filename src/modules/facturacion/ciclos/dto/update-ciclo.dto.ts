// src/modules/facturacion/ciclos/dto/update-ciclo.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateCicloDto } from './create-ciclo.dto';
import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCicloDto extends PartialType(CreateCicloDto) {
  @ApiPropertyOptional({
    description: 'Estado del ciclo',
    enum: ['ACTIVO', 'INACTIVO'],
    example: 'ACTIVO',
  })
  @IsOptional()
  @IsEnum(['ACTIVO', 'INACTIVO'])
  estado?: 'ACTIVO' | 'INACTIVO';
}
