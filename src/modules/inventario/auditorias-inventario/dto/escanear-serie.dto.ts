import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsInt,
  IsString,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class EscanearSerieDto {
  @ApiProperty({
    description: 'ID del catálogo/producto al que pertenece la serie',
    example: 15,
  })
  @IsNotEmpty()
  @IsInt()
  id_catalogo: number;

  @ApiProperty({
    description: 'Número de serie escaneado',
    example: 'SN123456789',
  })
  @IsNotEmpty()
  @IsString()
  numero_serie: string;

  @ApiPropertyOptional({
    description: 'Serie fue encontrada físicamente',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  encontrado_fisicamente?: boolean;

  @ApiPropertyOptional({
    description: 'Observaciones de la serie escaneada',
    example: 'Serie encontrada en estante incorrecto',
  })
  @IsOptional()
  @IsString()
  observaciones?: string;
}
