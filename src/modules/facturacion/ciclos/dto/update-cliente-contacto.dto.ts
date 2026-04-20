import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateClienteContactoDto {
  @ApiPropertyOptional({
    description: 'Telefono principal del cliente (formato libre, se valida en backend)',
    example: '7123-4567',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  telefono1?: string;

  @ApiPropertyOptional({
    description: 'Correo electronico del cliente',
    example: 'cliente@dominio.com',
    maxLength: 150,
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  correo_electronico?: string;
}
