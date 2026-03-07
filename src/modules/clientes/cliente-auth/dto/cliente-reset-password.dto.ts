import { IsString, IsNotEmpty, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para restablecer contraseña con token
 * Usado cuando el cliente hace clic en el enlace del email
 */
export class ClienteResetPasswordDto {
  @ApiProperty({
    description: 'Token de restablecimiento enviado por email',
    example: 'abc123def456...',
  })
  @IsString({ message: 'El token debe ser texto' })
  @IsNotEmpty({ message: 'El token es requerido' })
  token: string;

  @ApiProperty({
    description: 'Nueva contraseña (mín 8 chars, 1 mayúscula, 1 minúscula, 1 número, 1 especial)',
    example: 'MiNuevaPassword123!',
  })
  @IsString({ message: 'La contraseña debe ser texto' })
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(50, { message: 'La contraseña no puede exceder 50 caracteres' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    {
      message:
        'La contraseña debe tener: 8+ caracteres, 1 mayúscula, 1 minúscula, 1 número y 1 carácter especial (@$!%*?&)',
    },
  )
  password: string;

  @ApiProperty({
    description: 'Confirmación de contraseña',
    example: 'MiNuevaPassword123!',
  })
  @IsString({ message: 'La confirmación de contraseña debe ser texto' })
  @IsNotEmpty({ message: 'La confirmación de contraseña es requerida' })
  confirmar_password: string;
}
