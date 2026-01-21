import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsObject } from 'class-validator';

export class ResendTemplateDto {
  @ApiPropertyOptional({
    description: 'Parámetros opcionales para sobrescribir los del template original',
    example: { '1': 'Juan', '2': '100.00' },
  })
  @IsOptional()
  @IsObject()
  parametros?: Record<string, string>;
}
