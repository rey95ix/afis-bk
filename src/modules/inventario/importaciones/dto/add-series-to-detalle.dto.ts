// src/modules/inventario/importaciones/dto/add-series-to-detalle.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateImportacionSerieDto } from './create-importacion-serie.dto';

export class AddSeriesToDetalleDto {
  @ApiProperty({
    description: 'Series a agregar al item de importación',
    type: [CreateImportacionSerieDto],
  })
  @IsArray({ message: 'Las series deben ser un arreglo.' })
  @ValidateNested({ each: true })
  @Type(() => CreateImportacionSerieDto)
  series: CreateImportacionSerieDto[];
}
