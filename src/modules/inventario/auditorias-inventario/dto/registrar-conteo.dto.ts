import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ConteoProductoDto {
  @ApiProperty({
    description: 'ID del catálogo/producto',
    example: 15,
  })
  @IsNotEmpty()
  @IsInt()
  id_catalogo: number;

  @ApiProperty({
    description: 'Cantidad física contada',
    example: 23,
    minimum: 0,
  })
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  cantidad_fisica: number;

  @ApiPropertyOptional({
    description: 'Observaciones del conteo de este producto específico',
    example: 'Encontradas 2 unidades dañadas',
  })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class RegistrarConteoDto {
  @ApiProperty({
    description: 'Array de conteos de productos',
    type: [ConteoProductoDto],
  })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => ConteoProductoDto)
  conteos: ConteoProductoDto[];

  @ApiPropertyOptional({
    description: 'Observaciones generales del conteo',
    example: 'Conteo realizado en el turno de la mañana',
  })
  @IsOptional()
  @IsString()
  observaciones_generales?: string;
}
