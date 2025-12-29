import { IsString, IsNotEmpty, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para cambiar contraseña estando autenticado
 * Requiere la contraseña actual para verificación
 */
export class ClienteChangePasswordDto {
  @ApiProperty({
    description: 'Contraseña actual del cliente',
    example: 'MiPasswordActual123!',
  })
  @IsString({ message: 'La contraseña actual debe ser texto' })
  @IsNotEmpty({ message: 'La contraseña actual es requerida' })
  password_actual: string;

  @ApiProperty({
    description: 'Nueva contraseña (mín 8 chars, 1 mayúscula, 1 minúscula, 1 número, 1 especial)',
    example: 'MiNuevaPassword456!',
  })
  @IsString({ message: 'La nueva contraseña debe ser texto' })
  @IsNotEmpty({ message: 'La nueva contraseña es requerida' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(50, { message: 'La contraseña no puede exceder 50 caracteres' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    {
      message:
        'La contraseña debe tener: 8+ caracteres, 1 mayúscula, 1 minúscula, 1 número y 1 carácter especial (@$!%*?&)',
    },
  )
  password_nuevo: string;

  @ApiProperty({
    description: 'Confirmación de la nueva contraseña',
    example: 'MiNuevaPassword456!',
  })
  @IsString({ message: 'La confirmación de contraseña debe ser texto' })
  @IsNotEmpty({ message: 'La confirmación de contraseña es requerida' })
  confirmar_password: string;
}
