import { PartialType } from '@nestjs/swagger';
import { CreateEtiquetaDto } from './create-etiqueta.dto';
import { IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateEtiquetaDto extends PartialType(CreateEtiquetaDto) {
  @ApiPropertyOptional({
    description: 'Estado activo/inactivo de la etiqueta',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
