import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class AssignChatDto {
  @ApiProperty({
    description: 'ID del usuario a asignar',
    example: 1,
  })
  @IsInt()
  id_usuario: number;

  @ApiPropertyOptional({
    description: 'Razón de la asignación',
    example: 'Cliente solicita atención especializada',
  })
  @IsOptional()
  @IsString()
  razon?: string;
}

export class UnassignChatDto {
  @ApiPropertyOptional({
    description: 'Razón de la desasignación',
    example: 'Transferido a otro departamento',
  })
  @IsOptional()
  @IsString()
  razon?: string;
}
