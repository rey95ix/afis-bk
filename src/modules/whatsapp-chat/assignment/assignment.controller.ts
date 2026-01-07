import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
  Param,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { AssignmentService } from './assignment.service';
import { AssignChatDto, UnassignChatDto } from './dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { Auth } from 'src/modules/auth/decorators';
import { RequirePermissions } from 'src/modules/auth/decorators/require-permissions.decorator';

@ApiTags('WhatsApp Assignments')
@Controller('api/atencion-al-cliente/whatsapp-chat/chats/:chatId/assign')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Auth()
export class AssignmentController {
  constructor(private readonly assignmentService: AssignmentService) {}

  @RequirePermissions('atencion_cliente.whatsapp_chat:asignar')
  @Post()
  @ApiOperation({
    summary: 'Asignar chat a usuario',
    description: 'Asigna un chat de WhatsApp a un usuario específico.',
  })
  @ApiParam({
    name: 'chatId',
    description: 'ID del chat',
    example: 1,
  })
  @ApiResponse({
    status: 201,
    description: 'Chat asignado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'El chat está cerrado',
  })
  @ApiResponse({
    status: 404,
    description: 'Chat o usuario no encontrado',
  })
  assignChat(
    @Param('chatId', ParseIntPipe) chatId: number,
    @Body() assignDto: AssignChatDto,
    @Request() req,
  ) {
    return this.assignmentService.assignChat(
      chatId,
      assignDto,
      req.user.id_usuario,
    );
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:asignar')
  @Delete()
  @ApiOperation({
    summary: 'Desasignar chat',
    description: 'Quita la asignación de un chat.',
  })
  @ApiParam({
    name: 'chatId',
    description: 'ID del chat',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Chat desasignado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'El chat no tiene usuario asignado',
  })
  @ApiResponse({
    status: 404,
    description: 'Chat no encontrado',
  })
  unassignChat(
    @Param('chatId', ParseIntPipe) chatId: number,
    @Body() unassignDto: UnassignChatDto,
    @Request() req,
  ) {
    return this.assignmentService.unassignChat(
      chatId,
      unassignDto,
      req.user.id_usuario,
    );
  }

  @RequirePermissions('atencion_cliente.whatsapp_chat:ver')
  @Get('history')
  @ApiOperation({
    summary: 'Historial de asignaciones',
    description: 'Obtiene el historial de asignaciones de un chat.',
  })
  @ApiParam({
    name: 'chatId',
    description: 'ID del chat',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Historial de asignaciones',
  })
  @ApiResponse({
    status: 404,
    description: 'Chat no encontrado',
  })
  getHistory(@Param('chatId', ParseIntPipe) chatId: number) {
    return this.assignmentService.getHistory(chatId);
  }
}

@ApiTags('WhatsApp Assignments')
@Controller('api/atencion-al-cliente/whatsapp-chat/agents')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Auth()
export class AgentsController {
  constructor(private readonly assignmentService: AssignmentService) {}

  @RequirePermissions('atencion_cliente.whatsapp_chat:ver')
  @Get()
  @ApiOperation({
    summary: 'Listar agentes disponibles',
    description: 'Obtiene la lista de usuarios disponibles para asignación.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de agentes',
  })
  getAvailableAgents() {
    return this.assignmentService.getAvailableAgents();
  }
}
