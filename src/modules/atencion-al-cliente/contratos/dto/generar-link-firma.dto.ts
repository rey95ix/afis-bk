import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max } from 'class-validator';

export class GenerarLinkFirmaDto {
  @ApiProperty({
    description: 'Horas de validez del link (default: 72)',
    required: false,
    default: 72,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  horas_validez?: number;
}
