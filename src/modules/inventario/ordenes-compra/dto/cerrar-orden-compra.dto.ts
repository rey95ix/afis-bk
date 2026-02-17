import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CerrarOrdenCompraDto {
  @ApiPropertyOptional({
    description: 'Observaciones del cierre',
    example: 'Cierre manual - cantidades restantes no serán recibidas',
  })
  @IsOptional()
  @IsString()
  observaciones?: string;
}
