import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { MigrationService } from './migration.service';
import {
  MigrationStatus,
  MigrationLog,
  MigrationModuleResult,
  MigrationOptions,
} from './interfaces/mapping.interface';

@WebSocketGateway({
  namespace: 'migration',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class MigrationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MigrationGateway.name);

  constructor(
    @Inject(forwardRef(() => MigrationService))
    private readonly migrationService: MigrationService,
  ) {}

  afterInit() {
    this.logger.log('Migration WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('start-migration')
  handleStartMigration(
    client: Socket,
    payload: {
      options: MigrationOptions;
      excludeModules?: string[];
    },
  ) {
    const { options, excludeModules } = payload;

    // Fire-and-forget: start migration without awaiting
    this.migrationService
      .executeAll(options, excludeModules as any)
      .then((results) => {
        this.emitCompleted(results);
      })
      .catch((error) => {
        this.emitError(
          error instanceof Error ? error.message : 'Error desconocido',
        );
      });

    // Immediate acknowledgment
    return { event: 'migration-started' };
  }

  emitProgress(status: MigrationStatus): void {
    this.server.emit('migration-progress', status);
  }

  emitLog(log: MigrationLog): void {
    this.server.emit('migration-log', log);
  }

  emitCompleted(results: MigrationModuleResult[]): void {
    this.server.emit('migration-completed', results);
  }

  emitError(message: string): void {
    this.server.emit('migration-error', { message });
  }
}
