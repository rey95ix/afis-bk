import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * DTO para listar/filtrar equipos OLT. Extiende `PaginationDto` que ya maneja
 * `page`, `limit` y `search` (match por nombre/ip_address en el servicio).
 */
export class QueryOltEquipoDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filtrar por sucursal' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @Type(() => Number)
  @IsInt()
  id_sucursal?: number;
}
