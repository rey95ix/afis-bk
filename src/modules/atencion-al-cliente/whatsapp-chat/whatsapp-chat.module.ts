import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Chat
import { ChatController } from './chat/chat.controller';
import { ChatService } from './chat/chat.service';

// Message
import { MessageController } from './message/message.controller';
import { MessageService } from './message/message.service';

// WhatsApp API
import { WhatsAppApiService } from './whatsapp-api/whatsapp-api.service';
import { WhatsAppWebhookController } from './whatsapp-api/whatsapp-webhook.controller';

// IA
import { IaConfigController } from './ia/ia-config.controller';
import { IaConfigService } from './ia/ia-config.service';
import { IaRuleController } from './ia/ia-rule.controller';
import { IaRuleService } from './ia/ia-rule.service';
import { RuleEngineService } from './ia/rule-engine.service';
import { OpenAIChatService } from './ia/openai-chat.service';

// Assignment
import { AssignmentController, AgentsController } from './assignment/assignment.controller';
import { AssignmentService } from './assignment/assignment.service';

// Analytics
import { AnalyticsController } from './analytics/analytics.controller';
import { AnalyticsService } from './analytics/analytics.service';

// WebSocket Gateway
import { WhatsAppChatGateway } from './whatsapp-chat.gateway';

// Prisma
import { PrismaModule } from '../../prisma/prisma.module';

// MinIO
import { MinioModule } from '../../minio/minio.module';

@Module({
  imports: [ConfigModule, PrismaModule, MinioModule],
  controllers: [
    ChatController,
    MessageController,
    WhatsAppWebhookController,
    IaConfigController,
    IaRuleController,
    AssignmentController,
    AgentsController,
    AnalyticsController,
  ],
  providers: [
    ChatService,
    MessageService,
    WhatsAppApiService,
    IaConfigService,
    IaRuleService,
    RuleEngineService,
    OpenAIChatService,
    AssignmentService,
    AnalyticsService,
    WhatsAppChatGateway,
  ],
  exports: [
    ChatService,
    MessageService,
    WhatsAppApiService,
    IaConfigService,
    IaRuleService,
    RuleEngineService,
    OpenAIChatService,
    AssignmentService,
    AnalyticsService,
    WhatsAppChatGateway,
  ],
})
export class WhatsAppChatModule {}
