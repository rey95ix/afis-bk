import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsArray, ValidateNested, IsInt, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CantidadAprobadaItemDto {
  @IsInt()
  id_solicitud_compra_detalle: number;

  @IsNumber()
  @Min(0)
  cantidad_aprobada: number;
}

export class AutorizarSolicitudCompraDto {
  @ApiPropertyOptional({ description: 'Observaciones de revisión' })
  @IsOptional()
  @IsString()
  observaciones_revision?: string;

  @ApiPropertyOptional({ description: 'Cantidades aprobadas por ítem (si se desean ajustar)' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CantidadAprobadaItemDto)
  cantidades_aprobadas?: CantidadAprobadaItemDto[];
}
