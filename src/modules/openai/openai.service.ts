// src/modules/openai/openai.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class OpenaiService implements OnModuleInit {
  private readonly logger = new Logger(OpenaiService.name);
  private openai: OpenAI;
  private isConfigured = false;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY no está configurada. Las funciones de IA estarán deshabilitadas.');
      return;
    }

    this.openai = new OpenAI({
      apiKey,
    });
    this.isConfigured = true;
    this.logger.log('OpenAI configurado correctamente');
  }

  /**
   * Verifica si el servicio de OpenAI está configurado
   */
  isAvailable(): boolean {
    return this.isConfigured;
  }

  /**
   * Analiza una imagen usando GPT-4 Vision
   * @param imageBuffer Buffer de la imagen
   * @param prompt Instrucciones para el análisis
   * @param mimeType Tipo MIME de la imagen (default: image/jpeg)
   */
  async analyzeImage(
    imageBuffer: Buffer,
    prompt: string,
    mimeType: string = 'image/jpeg',
  ): Promise<string> {
    if (!this.isConfigured) {
      throw new Error('OpenAI no está configurado');
    }

    const base64Image = imageBuffer.toString('base64');
    const imageMediaType = mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${imageMediaType};base64,${base64Image}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 500,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      this.logger.error(`Error al analizar imagen con OpenAI: ${error.message}`);
      throw error;
    }
  }
}
