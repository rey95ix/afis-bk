import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsArray, ArrayMinSize } from 'class-validator';

export class AsignarEtiquetaDto {
  @ApiProperty({
    description: 'IDs de etiquetas a asignar',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsArray()
  @IsInt({ each: true })
  @ArrayMinSize(1)
  id_etiquetas: number[];
}

export class DesasignarEtiquetaDto {
  @ApiProperty({
    description: 'IDs de etiquetas a desasignar',
    example: [1, 2],
    type: [Number],
  })
  @IsArray()
  @IsInt({ each: true })
  @ArrayMinSize(1)
  id_etiquetas: number[];
}

export class ReemplazarEtiquetasDto {
  @ApiProperty({
    description: 'IDs de etiquetas a asignar (puede ser vacío para eliminar todas)',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsArray()
  @IsInt({ each: true })
  id_etiquetas: number[];
}
