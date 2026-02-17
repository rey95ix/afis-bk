import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsOptional, IsInt, IsEnum, IsBoolean, IsDateString } from 'class-validator';
import { PaginationDto } from 'src/common/dto';
import { estado_cxc } from '@prisma/client';

export class ConsultarCxcDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filtrar por cliente directo' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @Type(() => Number)
  @IsInt()
  id_cliente_directo?: number;

  @ApiPropertyOptional({ description: 'Filtrar por estado', enum: estado_cxc })
  @IsOptional()
  @IsEnum(estado_cxc)
  estado?: estado_cxc;

  @ApiPropertyOptional({ description: 'Filtrar por sucursal' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @Type(() => Number)
  @IsInt()
  id_sucursal?: number;

  @ApiPropertyOptional({ description: 'Fecha de vencimiento desde (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  fecha_vencimiento_desde?: string;

  @ApiPropertyOptional({ description: 'Fecha de vencimiento hasta (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  fecha_vencimiento_hasta?: string;

  @ApiPropertyOptional({ description: 'Fecha de emisión desde (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  fecha_emision_desde?: string;

  @ApiPropertyOptional({ description: 'Fecha de emisión hasta (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  fecha_emision_hasta?: string;

  @ApiPropertyOptional({ description: 'Solo mostrar cuentas vencidas', default: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  solo_vencidas?: boolean;
}
