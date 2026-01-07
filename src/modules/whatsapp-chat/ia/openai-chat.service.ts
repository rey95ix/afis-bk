import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { IaConfigService } from './ia-config.service';
import OpenAI from 'openai';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface IAResponse {
  content: string;
  shouldEscalate: boolean;
  confidence: number;
  tokensUsed: number;
}

@Injectable()
export class OpenAIChatService {
  private readonly logger = new Logger(OpenAIChatService.name);
  private openai: OpenAI | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly iaConfigService: IaConfigService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    } else {
      this.logger.warn('OpenAI API key not configured');
    }
  }

  /**
   * Generar respuesta para un mensaje de chat
   */
  async generateResponse(
    chatId: number,
    userMessage: string,
    customPrompt?: string,
  ): Promise<IAResponse> {
    // Obtener configuración activa
    let config;
    try {
      config = await this.iaConfigService.getActive();
    } catch (error) {
      this.logger.warn('No active IA config, using defaults');
      config = {
        system_prompt: 'Eres un asistente de atención al cliente amable y profesional.',
        modelo: 'gpt-4',
        temperatura: 0.7,
        max_tokens: 500,
        ventana_contexto: 10,
        fallback_a_humano: true,
        condiciones_fallback: null,
        api_key: null,
      };
    }

    // Obtener historial del chat
    const historial = await this.getConversationHistory(
      chatId,
      config.ventana_contexto,
    );

    // Construir mensajes para la API
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: customPrompt || config.system_prompt,
      },
      ...historial,
      {
        role: 'user',
        content: userMessage,
      },
    ];

    // Llamar a OpenAI
    const response = await this.callOpenAI(
      messages,
      config.modelo,
      config.temperatura,
      config.max_tokens,
      config.api_key,
    );

    // Evaluar si debe escalar
    const shouldEscalate = this.evaluateEscalation(
      response.content,
      userMessage,
      config.condiciones_fallback,
    );

    return {
      content: response.content,
      shouldEscalate,
      confidence: response.confidence,
      tokensUsed: response.tokensUsed,
    };
  }

  /**
   * Probar configuración de IA
   */
  async testConfiguration(
    mensaje: string,
    configId?: number,
    historial?: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Promise<IAResponse> {
    let config;

    if (configId) {
      config = await this.iaConfigService.findOne(configId);
    } else {
      try {
        config = await this.iaConfigService.getActive();
      } catch {
        throw new Error('No hay configuración de IA activa');
      }
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: config.system_prompt,
      },
    ];

    // Agregar historial si existe
    if (historial && historial.length > 0) {
      historial.forEach((msg) => {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      });
    }

    // Agregar mensaje de prueba
    messages.push({
      role: 'user',
      content: mensaje,
    });

    return this.callOpenAI(
      messages,
      config.modelo,
      config.temperatura,
      config.max_tokens,
      config.api_key,
    );
  }

  /**
   * Obtener historial de conversación
   */
  private async getConversationHistory(
    chatId: number,
    limit: number,
  ): Promise<ChatMessage[]> {
    const mensajes = await this.prisma.whatsapp_message.findMany({
      where: { id_chat: chatId },
      orderBy: { fecha_creacion: 'desc' },
      take: limit,
    });

    // Invertir para orden cronológico
    return mensajes.reverse().map((msg) => ({
      role: msg.direccion === 'ENTRANTE' ? 'user' : 'assistant',
      content: msg.contenido,
    }));
  }

  /**
   * Llamar a la API de OpenAI
   */
  private async callOpenAI(
    messages: ChatMessage[],
    model: string,
    temperature: number,
    maxTokens: number,
    customApiKey?: string | null,
  ): Promise<IAResponse> {
    // Usar cliente con API key personalizada si se proporciona
    const client = customApiKey
      ? new OpenAI({ apiKey: customApiKey })
      : this.openai;

    if (!client) {
      this.logger.error('OpenAI client not configured');
      return {
        content: 'Lo siento, el sistema de IA no está disponible en este momento. Un agente humano le atenderá pronto.',
        shouldEscalate: true,
        confidence: 0,
        tokensUsed: 0,
      };
    }

    try {
      const response = await client.chat.completions.create({
        model: model || 'gpt-4',
        messages: messages,
        temperature: temperature || 0.7,
        max_tokens: maxTokens || 500,
      });

      const content = response.choices[0]?.message?.content || '';
      const tokensUsed =
        (response.usage?.prompt_tokens || 0) +
        (response.usage?.completion_tokens || 0);

      return {
        content,
        shouldEscalate: false,
        confidence: 1.0,
        tokensUsed,
      };
    } catch (error) {
      this.logger.error(`OpenAI API error: ${error.message}`);
      return {
        content: 'Lo siento, no pude procesar tu mensaje. Un agente humano te asistirá pronto.',
        shouldEscalate: true,
        confidence: 0,
        tokensUsed: 0,
      };
    }
  }

  /**
   * Evaluar si se debe escalar a humano
   */
  private evaluateEscalation(
    iaResponse: string,
    userMessage: string,
    condiciones: any,
  ): boolean {
    if (!condiciones) {
      return false;
    }

    // Verificar palabras clave de escalamiento
    if (condiciones.keywords && Array.isArray(condiciones.keywords)) {
      const messageLower = userMessage.toLowerCase();
      const hasEscalationKeyword = condiciones.keywords.some((keyword: string) =>
        messageLower.includes(keyword.toLowerCase()),
      );
      if (hasEscalationKeyword) {
        return true;
      }
    }

    // Verificar si la IA indica que no puede ayudar
    const escalationPhrases = [
      'no puedo ayudar',
      'necesita hablar con un agente',
      'transferir a un humano',
      'un representante le contactará',
      'fuera de mi alcance',
    ];

    const responseLower = iaResponse.toLowerCase();
    return escalationPhrases.some((phrase) => responseLower.includes(phrase));
  }
}
