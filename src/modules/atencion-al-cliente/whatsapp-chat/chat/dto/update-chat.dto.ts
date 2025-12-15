import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsBoolean, IsArray, IsEnum } from 'class-validator';
import { estado_chat } from '@prisma/client';

export class UpdateChatDto {
  @ApiPropertyOptional({
    description: 'Estado del chat',
    enum: estado_chat,
  })
  @IsOptional()
  @IsEnum(estado_chat)
  estado?: estado_chat;

  @ApiPropertyOptional({
    description: 'ID del usuario asignado',
  })
  @IsOptional()
  @IsInt()
  id_usuario_asignado?: number;

  @ApiPropertyOptional({
    description: 'Habilitar/deshabilitar IA',
  })
  @IsOptional()
  @IsBoolean()
  ia_habilitada?: boolean;

  @ApiPropertyOptional({
    description: 'Tags del chat',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Nombre del cliente',
  })
  @IsOptional()
  @IsString()
  nombre_cliente?: string;

  @ApiPropertyOptional({
    description: 'ID del cliente (vincular)',
  })
  @IsOptional()
  @IsInt()
  id_cliente?: number;
}
