import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class QueryEtiquetaDto {
  @ApiPropertyOptional({
    description: 'Filtrar solo etiquetas activas',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  solo_activas?: boolean = true;
}
