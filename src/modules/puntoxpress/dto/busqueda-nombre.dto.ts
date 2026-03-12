import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class BusquedaNombreDto {
  @ApiProperty({ description: 'Nombre o parte del nombre del cliente', example: 'Juan' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  nombre: string;
}
