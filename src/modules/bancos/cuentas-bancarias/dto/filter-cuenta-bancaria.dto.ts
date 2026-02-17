import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsOptional, IsInt, IsEnum } from 'class-validator';
import { PaginationDto } from 'src/common/dto';
import { estado } from '@prisma/client';

export class FilterCuentaBancariaDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filtrar por banco' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @Type(() => Number)
  @IsInt()
  id_banco?: number;

  @ApiPropertyOptional({ description: 'Filtrar por sucursal' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @Type(() => Number)
  @IsInt()
  id_sucursal?: number;

  @ApiPropertyOptional({ description: 'Filtrar por estado', enum: estado })
  @IsOptional()
  @IsEnum(estado)
  estado?: estado;
}
