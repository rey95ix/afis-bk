import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateAuthDto {
  @ApiProperty({
    description: 'Codigo de usuario (unique)',
    nullable: false,
    minLength: 6,
    example: 'usuario@demo.com',
  })
  @IsString()
  @MinLength(1)
  usuario: string;

  @ApiProperty({
    description: 'Contraseña del usuario',
    nullable: false,
    minLength: 6,
    example: '1234',
  })
  @IsString()
  @MinLength(1)
  password: string;
}
