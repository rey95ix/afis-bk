import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class QueryPuntoxpressLegacyLogDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filtrar por método',
    example: 'BusquedaDUI',
  })
  @IsOptional()
  @IsString()
  metodo?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por código de respuesta',
    example: 0,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  codigo_respuesta?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por IP',
    example: '192.168.1.1',
  })
  @IsOptional()
  @IsString()
  ip?: string;

  @ApiPropertyOptional({
    description: 'Fecha inicio',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @ApiPropertyOptional({
    description: 'Fecha fin',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;
}
