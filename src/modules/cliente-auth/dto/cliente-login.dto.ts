import { IsString, IsNotEmpty, MinLength, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para login de cliente
 * Acepta DUI o correo electrónico como identificador
 */
export class ClienteLoginDto {
  @ApiProperty({
    description: 'DUI o correo electrónico del cliente',
    example: '12345678-9',
  })
  @IsString({ message: 'El identificador debe ser texto' })
  @IsNotEmpty({ message: 'El identificador es requerido' })
  @MaxLength(100, { message: 'El identificador no puede exceder 100 caracteres' })
  identificador: string;

  @ApiProperty({
    description: 'Contraseña del cliente',
    example: 'MiPassword123!',
  })
  @IsString({ message: 'La contraseña debe ser texto' })
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(100, { message: 'La contraseña no puede exceder 100 caracteres' })
  password: string;

  @ApiProperty({
    description: 'Token FCM para notificaciones push (opcional)',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El token FCM debe ser texto' })
  fcm_token?: string;
}
