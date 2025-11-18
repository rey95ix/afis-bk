import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsString, IsOptional, IsDateString } from 'class-validator';

export class AssignPermissionToUserDto {
  @ApiProperty({
    example: 5,
    description: 'ID del permiso a asignar',
  })
  @IsInt()
  id_permiso: number;

  @ApiPropertyOptional({
    example: 'Usuario requiere acceso temporal a compras para proyecto específico',
    description: 'Motivo de la asignación del permiso',
  })
  @IsString()
  @IsOptional()
  motivo?: string;

  @ApiPropertyOptional({
    example: '2025-12-31T23:59:59.000Z',
    description: 'Fecha de expiración del permiso (opcional, si no se especifica el permiso no expira)',
  })
  @IsDateString()
  @IsOptional()
  fecha_expiracion?: string;
}
