import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para solicitar restablecimiento de contraseña
 * Acepta DUI o correo electrónico
 */
export class ClienteForgotPasswordDto {
  @ApiProperty({
    description: 'DUI o correo electrónico del cliente',
    example: '12345678-9',
  })
  @IsString({ message: 'El identificador debe ser texto' })
  @IsNotEmpty({ message: 'El identificador es requerido' })
  @MaxLength(100, { message: 'El identificador no puede exceder 100 caracteres' })
  identificador: string;
}
