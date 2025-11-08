import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsInt,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AutorizarOrdenSalidaDetalleDto {
  @ApiProperty({
    description: 'ID del detalle de la orden',
    example: 1,
  })
  @IsNotEmpty()
  @IsInt()
  id_orden_salida_detalle: number;

  @ApiProperty({
    description: 'Cantidad autorizada',
    example: 10,
    minimum: 0,
  })
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  cantidad_autorizada: number;
}

export class AutorizarOrdenSalidaDto {
  @ApiPropertyOptional({
    description: 'Observaciones de la autorización',
    example: 'Autorizado según solicitud aprobada',
  })
  @IsOptional()
  @IsString()
  observaciones_autorizacion?: string;

  @ApiProperty({
    description: 'Detalle de cantidades autorizadas por item',
    type: [AutorizarOrdenSalidaDetalleDto],
  })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutorizarOrdenSalidaDetalleDto)
  detalle: AutorizarOrdenSalidaDetalleDto[];
}

export class RechazarOrdenSalidaDto {
  @ApiProperty({
    description: 'Motivo del rechazo',
    example: 'No hay suficiente stock en bodega',
  })
  @IsNotEmpty()
  @IsString()
  motivo_rechazo: string;
}
