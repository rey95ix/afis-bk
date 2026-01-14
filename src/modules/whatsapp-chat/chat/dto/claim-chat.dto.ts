import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Respuesta del endpoint de reclamar chat
 */
export class ClaimChatResponseDto {
  @ApiProperty({
    description: 'Indica si la operación fue exitosa',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'ID del chat reclamado',
    example: 123,
  })
  chatId: number;

  @ApiProperty({
    description: 'ID del usuario asignado',
    example: 1,
  })
  assignedToUserId: number;

  @ApiProperty({
    description: 'Nombre completo del usuario asignado',
    example: 'Juan Pérez',
  })
  assignedToUserName: string;

  @ApiProperty({
    description: 'Indica si el chat ya estaba asignado a este usuario',
    example: false,
  })
  wasAlreadyAssigned: boolean;

  @ApiPropertyOptional({
    description: 'Chat actualizado con toda la información',
  })
  chat?: any;
}

/**
 * Error específico de conflicto al reclamar chat
 */
export class ClaimChatErrorDto {
  @ApiProperty({
    description: 'Código de error',
    enum: ['ALREADY_ASSIGNED', 'CHAT_NOT_FOUND', 'CHAT_CLOSED'],
    example: 'ALREADY_ASSIGNED',
  })
  errorCode: 'ALREADY_ASSIGNED' | 'CHAT_NOT_FOUND' | 'CHAT_CLOSED';

  @ApiProperty({
    description: 'Mensaje descriptivo del error',
    example: 'Chat ya asignado a otro agente',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'ID del usuario actualmente asignado (solo si ALREADY_ASSIGNED)',
    example: 5,
  })
  currentAssigneeId?: number;

  @ApiPropertyOptional({
    description: 'Nombre del usuario actualmente asignado (solo si ALREADY_ASSIGNED)',
    example: 'María García',
  })
  currentAssigneeName?: string;
}
