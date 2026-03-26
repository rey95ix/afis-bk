import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsArray, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class FixDuplicatedInvoicesDto {
  @ApiPropertyOptional({
    description:
      'IDs de contratos específicos a corregir. Si se omite, corrige todos los detectados.',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  idsContratos?: number[];
}
