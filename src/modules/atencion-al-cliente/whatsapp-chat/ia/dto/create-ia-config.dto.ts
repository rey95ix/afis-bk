import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsInt,
} from 'class-validator';
import { proveedor_ia } from '@prisma/client';

export class CreateIaConfigDto {
  @ApiProperty({
    description: 'Nombre de la configuración',
    example: 'Configuración Principal',
  })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiPropertyOptional({
    description: 'Descripción de la configuración',
    example: 'Configuración para atención general de clientes',
  })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({
    description: 'Si esta configuración está activa',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional({
    description: 'Proveedor de IA',
    enum: proveedor_ia,
    default: 'OPENAI',
  })
  @IsOptional()
  @IsEnum(proveedor_ia)
  proveedor?: proveedor_ia;

  @ApiPropertyOptional({
    description: 'Modelo de IA a utilizar',
    example: 'gpt-4',
    default: 'gpt-4',
  })
  @IsOptional()
  @IsString()
  modelo?: string;

  @ApiPropertyOptional({
    description: 'API Key del proveedor (si es diferente a la global)',
  })
  @IsOptional()
  @IsString()
  api_key?: string;

  @ApiPropertyOptional({
    description: 'Temperatura del modelo (creatividad)',
    example: 0.7,
    default: 0.7,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperatura?: number;

  @ApiPropertyOptional({
    description: 'Tokens máximos de respuesta',
    example: 500,
    default: 500,
  })
  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(4000)
  max_tokens?: number;

  @ApiProperty({
    description: 'Prompt del sistema para la IA',
    example:
      'Eres un asistente de atención al cliente de una empresa de telecomunicaciones...',
  })
  @IsString()
  @IsNotEmpty()
  system_prompt: string;

  @ApiPropertyOptional({
    description: 'Número de mensajes previos a incluir en el contexto',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  ventana_contexto?: number;

  @ApiPropertyOptional({
    description: 'Si debe escalar a humano cuando no puede responder',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  fallback_a_humano?: boolean;

  @ApiPropertyOptional({
    description: 'Condiciones para escalar a humano (JSON)',
    example: { keywords: ['urgente', 'hablar con humano'], max_interactions: 5 },
  })
  @IsOptional()
  condiciones_fallback?: any;

  @ApiPropertyOptional({
    description: 'Delay en segundos antes de responder (simular escritura)',
    example: 2,
    default: 2,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  delay_respuesta_seg?: number;

  @ApiPropertyOptional({
    description: 'Horario de atención de IA (JSON)',
    example: {
      enabled: true,
      schedule: [
        { day: 1, start: '08:00', end: '18:00' },
        { day: 2, start: '08:00', end: '18:00' },
      ],
    },
  })
  @IsOptional()
  horario_atencion?: any;
}
