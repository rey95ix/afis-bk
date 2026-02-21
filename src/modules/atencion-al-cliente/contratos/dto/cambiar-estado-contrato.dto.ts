import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { estadoContrato } from '@prisma/client';

export class CambiarEstadoContratoDto {
  @ApiProperty({
    description: 'Nuevo estado del contrato',
    enum: estadoContrato,
    example: estadoContrato.SUSPENDIDO,
  })
  @IsEnum(estadoContrato)
  @IsNotEmpty()
  estado: estadoContrato;

  @ApiPropertyOptional({
    description: 'Comentario sobre el cambio de estado',
    example: 'Cliente solicita suspensión temporal por viaje',
  })
  @IsString()
  @IsOptional()
  comentario?: string;
}
