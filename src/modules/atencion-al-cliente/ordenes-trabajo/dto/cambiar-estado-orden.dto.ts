import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoOrden } from './query-orden.dto';

export class CambiarEstadoOrdenDto {
  @ApiProperty({
    description: 'Nuevo estado de la orden',
    enum: EstadoOrden,
    example: EstadoOrden.EN_RUTA,
  })
  @IsEnum(EstadoOrden)
  @IsNotEmpty()
  estado: EstadoOrden;

  @ApiPropertyOptional({
    description: 'Comentario sobre el cambio de estado',
    example: 'Técnico en camino al domicilio del cliente',
  })
  @IsString()
  @IsOptional()
  comentario?: string;
}
