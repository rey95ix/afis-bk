import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from 'src/common/dto';

export class ClientesPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filtrar por estado del cliente',
    example: 'ACTIVO',
  })
  @IsOptional()
  @IsString()
  estado?: string;
}
