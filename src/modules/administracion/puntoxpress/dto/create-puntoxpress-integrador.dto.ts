import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreatePuntoxpressIntegradorDto {
  @ApiProperty({ description: 'Nombre del integrador' })
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @IsString()
  @MinLength(2)
  nombre: string;

  @ApiProperty({ description: 'Usuario para autenticación' })
  @IsNotEmpty({ message: 'El usuario es requerido' })
  @IsString()
  @MinLength(3)
  usuario: string;

  @ApiProperty({ description: 'Contraseña para autenticación' })
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @IsString()
  @MinLength(6)
  contrasena: string;
}
