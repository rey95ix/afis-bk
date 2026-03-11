import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, Min, Max, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class ConvertirACreditoDto {
  @ApiProperty({ description: 'Días de crédito', example: 30, minimum: 1, maximum: 365 })
  @IsInt()
  @Min(1)
  @Max(365)
  @Type(() => Number)
  dias_credito: number;

  @ApiPropertyOptional({ description: 'Observaciones sobre la conversión', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}
