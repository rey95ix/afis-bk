import { PartialType } from '@nestjs/swagger';
import { CreateFacturasBloqueDto } from './create-facturas-bloque.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

enum Estado {
  ACTIVO = 'ACTIVO',
  SUSPENDIDO = 'SUPENDIDO',
  INACTIVO = 'INACTIVO',
}

export class UpdateFacturasBloqueDto extends PartialType(CreateFacturasBloqueDto) {
  @ApiPropertyOptional({ description: 'Estado del bloque', enum: Estado })
  @IsEnum(Estado)
  @IsOptional()
  estado?: Estado;
}
