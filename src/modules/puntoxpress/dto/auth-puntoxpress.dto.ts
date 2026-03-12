import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AuthPuntoXpressDto {
  @ApiProperty({ description: 'Usuario del integrador', example: 'puntoxpress_1' })
  @IsString()
  @IsNotEmpty()
  usuario: string;

  @ApiProperty({ description: 'Contraseña del integrador' })
  @IsString()
  @IsNotEmpty()
  contrasena: string;
}
