import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, IsArray } from 'class-validator';

export class TestIaDto {
  @ApiProperty({
    description: 'Mensaje de prueba para enviar a la IA',
    example: '¿Cuál es el precio del plan básico de internet?',
  })
  @IsString()
  @IsNotEmpty()
  mensaje: string;

  @ApiPropertyOptional({
    description: 'ID de la configuración de IA a usar (default: activa)',
  })
  @IsOptional()
  @IsInt()
  id_config?: number;

  @ApiPropertyOptional({
    description: 'Historial de mensajes previos para contexto',
    example: [
      { role: 'user', content: 'Hola, necesito información' },
      { role: 'assistant', content: '¡Hola! ¿En qué puedo ayudarte?' },
    ],
  })
  @IsOptional()
  @IsArray()
  historial?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export class TestRuleDto {
  @ApiProperty({
    description: 'Mensaje de prueba para evaluar reglas',
    example: '¿Cuánto cuesta el internet?',
  })
  @IsString()
  @IsNotEmpty()
  mensaje: string;

  @ApiPropertyOptional({
    description: 'ID del chat simulado para contexto',
  })
  @IsOptional()
  @IsInt()
  id_chat?: number;
}
