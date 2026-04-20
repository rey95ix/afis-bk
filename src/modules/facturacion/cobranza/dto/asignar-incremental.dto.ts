// src/modules/facturacion/cobranza/dto/asignar-incremental.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AsignarIncrementalDto {
  @ApiProperty({
    description:
      'IDs de las facturas (facturaDirecta) a asignar. Deben pertenecer al ciclo y no tener asignación ACTIVA.',
    example: [101, 102, 103],
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  id_factura_directa_list: number[];

  @ApiProperty({
    description:
      'IDs de los gestores. Si es uno solo, todas las facturas se asignan a ese gestor. Si son varios, se distribuyen Round Robin.',
    example: [4, 7],
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  id_gestores: number[];
}
