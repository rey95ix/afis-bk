import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateBancoDto {
  @ApiProperty({ description: 'Nombre del banco destino', example: 'BAC' })
  @IsString()
  @IsNotEmpty()
  banco: string;
}
