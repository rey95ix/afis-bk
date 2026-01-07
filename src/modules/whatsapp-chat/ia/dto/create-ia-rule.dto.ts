import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsInt,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { logica_condicion } from '@prisma/client';

// Tipos de condiciones disponibles
export type ConditionType =
  | 'CONTAINS_KEYWORD'
  | 'REGEX_MATCH'
  | 'MESSAGE_COUNT'
  | 'TIME_OF_DAY'
  | 'CLIENT_TYPE'
  | 'NO_RESPONSE_TIME'
  | 'SENTIMENT';

// Tipos de acciones disponibles
export type ActionType =
  | 'RESPOND_TEXT'
  | 'RESPOND_AI'
  | 'ASSIGN_TO_USER'
  | 'ASSIGN_TO_QUEUE'
  | 'ADD_TAG'
  | 'ESCALATE'
  | 'CLOSE_CHAT'
  | 'SEND_TEMPLATE';

class RuleConditionDto {
  @ApiProperty({
    description: 'Tipo de condición',
    example: 'CONTAINS_KEYWORD',
  })
  @IsString()
  type: ConditionType;

  @ApiProperty({
    description: 'Valor de la condición',
    example: ['precio', 'costo', 'cuanto'],
  })
  value: any;

  @ApiPropertyOptional({
    description: 'Operador de comparación',
    example: 'equals',
  })
  @IsOptional()
  @IsString()
  operator?: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in';

  @ApiPropertyOptional({
    description: 'Negar la condición',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  negate?: boolean;
}

class RuleActionDto {
  @ApiProperty({
    description: 'Tipo de acción',
    example: 'RESPOND_TEXT',
  })
  @IsString()
  type: ActionType;

  @ApiProperty({
    description: 'Parámetros de la acción',
    example: { text: 'Gracias por contactarnos. Un agente le atenderá pronto.' },
  })
  params: any;

  @ApiPropertyOptional({
    description: 'Delay antes de ejecutar (segundos)',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  delay?: number;
}

export class CreateIaRuleDto {
  @ApiProperty({
    description: 'ID de la configuración de IA',
    example: 1,
  })
  @IsInt()
  id_config: number;

  @ApiProperty({
    description: 'Nombre de la regla',
    example: 'Respuesta automática de precios',
  })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiPropertyOptional({
    description: 'Descripción de la regla',
    example: 'Responde cuando el cliente pregunta por precios',
  })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({
    description: 'Prioridad de la regla (mayor = primero)',
    example: 10,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  prioridad?: number;

  @ApiPropertyOptional({
    description: 'Si la regla está activa',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiProperty({
    description: 'Condiciones para activar la regla',
    type: [RuleConditionDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RuleConditionDto)
  condiciones: RuleConditionDto[];

  @ApiPropertyOptional({
    description: 'Lógica entre condiciones',
    enum: logica_condicion,
    default: 'AND',
  })
  @IsOptional()
  @IsEnum(logica_condicion)
  logica_condiciones?: logica_condicion;

  @ApiProperty({
    description: 'Acciones a ejecutar',
    type: [RuleActionDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RuleActionDto)
  acciones: RuleActionDto[];
}
