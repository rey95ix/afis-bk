import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IaRuleService } from './ia-rule.service';

export interface RuleCondition {
  type: string;
  value: any;
  operator?: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in';
  negate?: boolean;
}

export interface RuleAction {
  type: string;
  params: any;
  delay?: number;
}

interface MessageContext {
  contenido: string;
  chatId: number;
  clienteTelefono?: string;
  clienteNombre?: string;
  idCliente?: number;
  messageCount?: number;
  hora?: string;
  isFirstMessage?: boolean;
}

interface RuleMatch {
  ruleId: number;
  ruleName: string;
  actions: RuleAction[];
  confidence: number;
}

@Injectable()
export class RuleEngineService {
  private readonly logger = new Logger(RuleEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly iaRuleService: IaRuleService,
  ) {}

  /**
   * Evaluar mensaje contra todas las reglas activas
   */
  async evaluateMessage(context: MessageContext): Promise<RuleMatch | null> {
    const rules = await this.iaRuleService.findAllActive();

    if (rules.length === 0) {
      this.logger.debug('No hay reglas activas para evaluar');
      return null;
    }

    for (const rule of rules) {
      const conditions = rule.condiciones as unknown as RuleCondition[];
      const logica = rule.logica_condiciones;

      const matches = await this.evaluateConditions(conditions, logica, context);

      if (matches) {
        this.logger.log(`Regla "${rule.nombre}" coincide con mensaje`);

        // Incrementar contador
        await this.iaRuleService.incrementExecutionCount(rule.id_regla);

        return {
          ruleId: rule.id_regla,
          ruleName: rule.nombre,
          actions: rule.acciones as unknown as RuleAction[],
          confidence: 1.0, // Por ahora, confianza fija
        };
      }
    }

    this.logger.debug('Ninguna regla coincide con el mensaje');
    return null;
  }

  /**
   * Evaluar condiciones de una regla
   */
  private async evaluateConditions(
    conditions: RuleCondition[],
    logica: 'AND' | 'OR',
    context: MessageContext,
  ): Promise<boolean> {
    if (conditions.length === 0) {
      return false;
    }

    const results = conditions.map((condition) =>
      this.evaluateCondition(condition, context),
    );

    if (logica === 'AND') {
      return results.every((r) => r);
    } else {
      return results.some((r) => r);
    }
  }

  /**
   * Evaluar una condición individual
   */
  private evaluateCondition(
    condition: RuleCondition,
    context: MessageContext,
  ): boolean {
    let result = false;

    switch (condition.type) {
      case 'CONTAINS_KEYWORD':
        result = this.evaluateContainsKeyword(condition.value, context.contenido);
        break;

      case 'REGEX_MATCH':
        result = this.evaluateRegexMatch(condition.value, context.contenido);
        break;

      case 'MESSAGE_COUNT':
        result = this.evaluateMessageCount(
          condition.value,
          condition.operator,
          context.messageCount || 0,
        );
        break;

      case 'TIME_OF_DAY':
        result = this.evaluateTimeOfDay(condition.value);
        break;

      case 'CLIENT_TYPE':
        result = this.evaluateClientType(condition.value, context.idCliente);
        break;

      case 'FIRST_MESSAGE':
        result = context.isFirstMessage === true;
        break;

      case 'SENTIMENT':
        // TODO: Implementar análisis de sentimiento
        result = false;
        break;

      default:
        this.logger.warn(`Tipo de condición desconocido: ${condition.type}`);
        result = false;
    }

    // Aplicar negación si es necesario
    if (condition.negate) {
      result = !result;
    }

    return result;
  }

  /**
   * Evaluar si el mensaje contiene alguna palabra clave
   */
  private evaluateContainsKeyword(keywords: string[], mensaje: string): boolean {
    if (!Array.isArray(keywords) || keywords.length === 0) {
      return false;
    }

    const mensajeLower = mensaje.toLowerCase();
    return keywords.some((keyword) =>
      mensajeLower.includes(keyword.toLowerCase()),
    );
  }

  /**
   * Evaluar si el mensaje coincide con una expresión regular
   */
  private evaluateRegexMatch(pattern: string, mensaje: string): boolean {
    try {
      const regex = new RegExp(pattern, 'i');
      return regex.test(mensaje);
    } catch (error) {
      this.logger.error(`Regex inválida: ${pattern}`);
      return false;
    }
  }

  /**
   * Evaluar contador de mensajes
   */
  private evaluateMessageCount(
    value: number,
    operator: string | undefined,
    actual: number,
  ): boolean {
    switch (operator) {
      case 'equals':
        return actual === value;
      case 'greater_than':
        return actual > value;
      case 'less_than':
        return actual < value;
      default:
        return actual >= value;
    }
  }

  /**
   * Evaluar hora del día
   */
  private evaluateTimeOfDay(ranges: Array<{ start: string; end: string }>): boolean {
    if (!Array.isArray(ranges)) {
      return false;
    }

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;

    return ranges.some(
      (range) => currentTime >= range.start && currentTime <= range.end,
    );
  }

  /**
   * Evaluar tipo de cliente
   */
  private evaluateClientType(
    expectedType: 'registered' | 'anonymous',
    clienteId?: number,
  ): boolean {
    if (expectedType === 'registered') {
      return clienteId !== undefined && clienteId !== null;
    } else if (expectedType === 'anonymous') {
      return clienteId === undefined || clienteId === null;
    }
    return false;
  }

  /**
   * Ejecutar acciones de una regla
   */
  async executeActions(
    actions: RuleAction[],
    context: MessageContext,
  ): Promise<Array<{ type: string; result: any }>> {
    const results: Array<{ type: string; result: any }> = [];

    for (const action of actions) {
      // Aplicar delay si existe
      if (action.delay && action.delay > 0) {
        await this.delay(action.delay * 1000);
      }

      const result = await this.executeAction(action, context);
      results.push({ type: action.type, result });
    }

    return results;
  }

  /**
   * Ejecutar una acción individual
   */
  private async executeAction(
    action: RuleAction,
    context: MessageContext,
  ): Promise<any> {
    switch (action.type) {
      case 'RESPOND_TEXT':
        return {
          type: 'text',
          content: this.interpolateVariables(action.params.text, context),
        };

      case 'RESPOND_AI':
        return {
          type: 'ai',
          prompt: action.params.prompt || null,
        };

      case 'ADD_TAG':
        await this.prisma.whatsapp_chat.update({
          where: { id_chat: context.chatId },
          data: {
            tags: { push: action.params.tag },
          },
        });
        return { added_tag: action.params.tag };

      case 'ASSIGN_TO_USER':
        await this.prisma.whatsapp_chat.update({
          where: { id_chat: context.chatId },
          data: {
            id_usuario_asignado: action.params.user_id,
            estado: 'ABIERTO',
          },
        });
        return { assigned_to: action.params.user_id };

      case 'ESCALATE':
        await this.prisma.whatsapp_chat.update({
          where: { id_chat: context.chatId },
          data: {
            estado: 'PENDIENTE',
            ia_habilitada: false,
            tags: { push: 'escalado' },
          },
        });
        return { escalated: true };

      case 'CLOSE_CHAT':
        await this.prisma.whatsapp_chat.update({
          where: { id_chat: context.chatId },
          data: {
            estado: 'CERRADO',
            fecha_cierre: new Date(),
          },
        });
        return { closed: true };

      default:
        this.logger.warn(`Tipo de acción desconocido: ${action.type}`);
        return null;
    }
  }

  /**
   * Interpolar variables en texto
   */
  private interpolateVariables(text: string, context: MessageContext): string {
    return text
      .replace(/\{\{cliente_nombre\}\}/g, context.clienteNombre || 'Cliente')
      .replace(/\{\{cliente_telefono\}\}/g, context.clienteTelefono || '')
      .replace(/\{\{hora\}\}/g, new Date().toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' }))
      .replace(/\{\{fecha\}\}/g, new Date().toLocaleDateString('es-SV'));
  }

  /**
   * Helper para delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
