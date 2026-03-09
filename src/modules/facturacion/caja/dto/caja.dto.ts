import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsOptional, IsInt, Min } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class QueryCierresUsuariosDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filtrar por ID de usuario' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idUsuario?: number;
}
