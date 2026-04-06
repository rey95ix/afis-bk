import { IsOptional, IsInt, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AbonosListadoDto {
  @ApiPropertyOptional({ description: 'Número de página', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items por página', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Búsqueda por nombre de cliente o código de contrato' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Fecha desde (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  fechaDesde?: string;

  @ApiPropertyOptional({ description: 'Fecha hasta (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  fechaHasta?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por método de pago',
    enum: ['EFECTIVO', 'CHEQUE', 'TRANSFERENCIA', 'DEPOSITO', 'TARJETA', 'PUNTOXPRESS', 'OTRO'],
  })
  @IsOptional()
  @IsString()
  metodoPago?: string;

  @ApiPropertyOptional({ description: 'Filtrar por ID de usuario que registró el abono' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idUsuario?: number;
}
