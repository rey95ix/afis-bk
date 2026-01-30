import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsInt, IsOptional, IsEnum, Min } from 'class-validator';

export class CreateFacturasBloqueDto {
  @ApiProperty({ description: 'Número de tira/autorización' })
  @IsString()
  tira: string;

  @ApiPropertyOptional({ description: 'Número de autorización' })
  @IsString()
  @IsOptional()
  autorizacion?: string;

  @ApiPropertyOptional({ description: 'Número de resolución' })
  @IsString()
  @IsOptional()
  resolucion?: string;

  @ApiProperty({ description: 'Número inicial del bloque' })
  @IsInt()
  @Min(1)
  desde: number;

  @ApiProperty({ description: 'Número final del bloque' })
  @IsInt()
  @Min(1)
  hasta: number;

  @ApiProperty({ description: 'Número actual (correlativo)' })
  @IsInt()
  @Min(0)
  actual: number;

  @ApiProperty({ description: 'Serie del bloque' })
  @IsString()
  serie: string;

  @ApiProperty({ description: 'ID del tipo de factura' })
  @IsInt()
  id_tipo_factura: number;

  @ApiPropertyOptional({ description: 'ID de la sucursal' })
  @IsInt()
  @IsOptional()
  id_sucursal?: number;
}
