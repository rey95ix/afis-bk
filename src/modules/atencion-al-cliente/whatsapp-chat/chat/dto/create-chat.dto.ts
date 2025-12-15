import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsBoolean,
  IsArray,
  Matches,
} from 'class-validator';

export class CreateChatDto {
  @ApiProperty({
    description: 'Número de teléfono del cliente (formato internacional)',
    example: '+50370001234',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'El teléfono debe estar en formato internacional E.164',
  })
  telefono_cliente: string;

  @ApiPropertyOptional({
    description: 'ID del cliente en el sistema (si existe)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  id_cliente?: number;

  @ApiPropertyOptional({
    description: 'Nombre del cliente',
    example: 'Juan Pérez',
  })
  @IsOptional()
  @IsString()
  nombre_cliente?: string;

  @ApiPropertyOptional({
    description: 'Mensaje inicial para enviar al cliente',
    example: 'Hola, ¿en qué podemos ayudarte?',
  })
  @IsOptional()
  @IsString()
  mensaje_inicial?: string;

  @ApiPropertyOptional({
    description: 'ID del usuario a asignar',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  id_usuario_asignado?: number;

  @ApiPropertyOptional({
    description: 'Habilitar IA para este chat',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  ia_habilitada?: boolean;

  @ApiPropertyOptional({
    description: 'Tags para categorizar el chat',
    example: ['soporte', 'urgente'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
