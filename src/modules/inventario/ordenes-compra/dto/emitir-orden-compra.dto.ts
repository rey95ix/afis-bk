import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class EmitirOrdenCompraDto {
  @ApiPropertyOptional({
    description: 'Observaciones de la emisión',
    example: 'Emitida al proveedor vía correo electrónico',
  })
  @IsOptional()
  @IsString()
  observaciones?: string;
}
