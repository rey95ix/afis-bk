// src/modules/inventario/salidas-temporales-ot/dto/create-salida-temporal.dto.ts
import {
  IsInt,
  IsOptional,
  IsPositive,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DetalleItemDto } from './detalle-item.dto';

export class CreateSalidaTemporalDto {
  @ApiProperty({
    description: 'Código alfanumérico de la orden de trabajo ingresado por el usuario (ejemplo: OT-202501-00001, 123, etc)',
    example: 'OT-202501-00001',
  })
  @IsString()
  codigo: string;

  @ApiPropertyOptional({
    description: 'Observaciones generales de la salida',
    example: 'Materiales para instalación de fibra óptica',
  })
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiProperty({
    description: 'Lista de items a descargar (mínimo 1)',
    type: [DetalleItemDto],
    example: [
      {
        id_catalogo: 45,
        id_serie: 789,
      },
      {
        id_catalogo: 12,
        cantidad: 5,
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe incluir al menos un item en la salida' })
  @ValidateNested({ each: true })
  @Type(() => DetalleItemDto)
  detalle: DetalleItemDto[];

  // Nota: La foto se maneja con Multer en el controller
  // @ApiProperty({ type: 'string', format: 'binary' })
  // foto: Express.Multer.File;
}
