import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  namespace: 'whatsapp-chat',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class WhatsAppChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WhatsAppChatGateway.name);

  afterInit() {
    this.logger.log('WhatsApp Chat WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Cliente se une a la sala de un chat específico
   */
  @SubscribeMessage('join-chat')
  handleJoinChat(client: Socket, chatId: number) {
    const room = `chat-${chatId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);
    return { event: 'joined', room };
  }

  /**
   * Cliente sale de la sala de un chat
   */
  @SubscribeMessage('leave-chat')
  handleLeaveChat(client: Socket, chatId: number) {
    const room = `chat-${chatId}`;
    client.leave(room);
    this.logger.log(`Client ${client.id} left room ${room}`);
    return { event: 'left', room };
  }

  /**
   * Emitir nuevo mensaje a usuarios en el chat
   */
  emitNewMessage(chatId: number, message: any) {
    const room = `chat-${chatId}`;
    this.server.to(room).emit('new-message', message);
    // También emitir a todos para actualizar lista de chats
    this.server.emit('chat-list-updated', { chatId, lastMessage: message });
    this.logger.debug(`Emitted new-message to room ${room}`);
  }

  /**
   * Emitir cambio de estado de mensaje
   */
  emitMessageStatus(
    chatId: number,
    messageId: string,
    status: string,
    errorInfo?: { code: number; title: string; message: string },
  ) {
    const room = `chat-${chatId}`;
    const payload: any = { messageId, status };
    if (errorInfo) {
      payload.errorInfo = errorInfo;
    }
    this.server.to(room).emit('message-status', payload);
    this.logger.debug(`Emitted message-status to room ${room}: ${status}${errorInfo ? ` (error: ${errorInfo.code})` : ''}`);
  }

  /**
   * Emitir actualización de chat (asignación, estado, IA, etc.)
   */
  emitChatUpdated(chat: any) {
    this.server.emit('chat-updated', chat);
    this.logger.debug(`Emitted chat-updated for chat ${chat.id_chat}`);
  }

  /**
   * Emitir actualización de estadísticas
   */
  emitStatsUpdated(stats: any) {
    this.server.emit('stats-updated', stats);
    this.logger.debug('Emitted stats-updated');
  }

  /**
   * Emitir actualización de etiquetas (crear/editar/eliminar)
   */
  emitEtiquetasUpdated() {
    this.server.emit('etiquetas-updated');
    this.logger.debug('Emitted etiquetas-updated');
  }

  /**
   * Emitir cambio de etiquetas en un chat específico
   */
  emitChatEtiquetasUpdated(chatId: number, etiquetas: any[]) {
    this.server.emit('chat-etiquetas-updated', { chatId, etiquetas });
    this.logger.debug(`Emitted chat-etiquetas-updated for chat ${chatId}`);
  }

  /**
   * Emitir notificación de número inválido (sin WhatsApp)
   */
  emitNumberInvalid(
    chatId: number,
    telefono: string,
    errorInfo: { code: number; title: string; message: string },
  ) {
    const room = `chat-${chatId}`;
    this.server.to(room).emit('number-invalid', { chatId, telefono, errorInfo });
    this.server.emit('number-invalid', { chatId, telefono, errorInfo });
    this.logger.debug(`Emitted number-invalid for chat ${chatId}, phone ${telefono}`);
  }
}
