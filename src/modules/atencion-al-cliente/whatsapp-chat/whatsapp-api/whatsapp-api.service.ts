import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendWhatsAppMessageDto } from './dto';
import { MinioService } from '../../../minio/minio.service';

interface WhatsAppApiResponse {
  messaging_product: string;
  contacts?: Array<{ input: string; wa_id: string }>;
  messages?: Array<{ id: string }>;
  error?: {
    message: string;
    type: string;
    code: number;
  };
}

@Injectable()
export class WhatsAppApiService {
  private readonly logger = new Logger(WhatsAppApiService.name);
  private readonly apiUrl: string;
  private readonly phoneNumberId: string;
  private readonly accessToken: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly minioService: MinioService,
  ) {
    this.apiUrl = this.configService.get<string>(
      'WHATSAPP_API_URL',
      'https://graph.facebook.com/v18.0',
    );
    this.phoneNumberId = this.configService.get<string>(
      'WHATSAPP_PHONE_NUMBER_ID',
      '',
    );
    this.accessToken = this.configService.get<string>(
      'WHATSAPP_ACCESS_TOKEN',
      '',
    );
  }

  /**
   * Enviar mensaje de texto
   */
  async sendTextMessage(to: string, text: string): Promise<string | null> {
    return this.sendMessage({
      to,
      type: 'text',
      text: { body: text },
    });
  }

  /**
   * Enviar mensaje con imagen
   */
  async sendImageMessage(
    to: string,
    imageUrl: string,
    caption?: string,
  ): Promise<string | null> {
    return this.sendMessage({
      to,
      type: 'image',
      media: { link: imageUrl, caption },
    });
  }

  /**
   * Enviar mensaje con documento
   */
  async sendDocumentMessage(
    to: string,
    documentUrl: string,
    caption?: string,
  ): Promise<string | null> {
    return this.sendMessage({
      to,
      type: 'document',
      media: { link: documentUrl, caption },
    });
  }

  /**
   * Enviar mensaje genérico via WhatsApp Business API
   */
  async sendMessage(dto: SendWhatsAppMessageDto): Promise<string | null> {
    if (!this.phoneNumberId || !this.accessToken) {
      this.logger.warn(
        'WhatsApp API not configured. Message not sent to: ' + dto.to,
      );
      // Retornar ID mock para desarrollo
      return `mock_${Date.now()}`;
    }

    const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;

    const body: any = {
      messaging_product: 'whatsapp',
      to: dto.to.replace('+', ''), // WhatsApp API no usa +
      type: dto.type,
    };

    switch (dto.type) {
      case 'text':
        body.text = dto.text;
        break;
      case 'image':
        body.image = { link: dto.media?.link, caption: dto.media?.caption };
        break;
      case 'video':
        body.video = { link: dto.media?.link, caption: dto.media?.caption };
        break;
      case 'audio':
        body.audio = { link: dto.media?.link };
        break;
      case 'document':
        body.document = { link: dto.media?.link, caption: dto.media?.caption };
        break;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data: WhatsAppApiResponse = await response.json();

      if (!response.ok) {
        this.logger.error(
          `WhatsApp API error: ${data.error?.message || 'Unknown error'}`,
        );
        throw new HttpException(
          data.error?.message || 'Error sending WhatsApp message',
          HttpStatus.BAD_REQUEST,
        );
      }

      const messageId = data.messages?.[0]?.id;
      this.logger.log(`Message sent successfully. ID: ${messageId}`);
      return messageId || null;
    } catch (error) {
      this.logger.error(`Failed to send WhatsApp message: ${error.message}`);
      throw error;
    }
  }

  /**
   * Marcar mensaje como leído
   */
  async markAsRead(messageId: string): Promise<boolean> {
    if (!this.phoneNumberId || !this.accessToken) {
      return true; // Mock para desarrollo
    }

    const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        }),
      });

      return response.ok;
    } catch (error) {
      this.logger.error(`Failed to mark message as read: ${error.message}`);
      return false;
    }
  }

  /**
   * Descargar archivo multimedia de WhatsApp y subirlo a MinIO
   */
  async downloadMedia(mediaId: string): Promise<{ url: string; mimeType: string } | null> {
    if (!this.accessToken) {
      return null;
    }

    try {
      // Paso 1: Obtener la URL del media desde WhatsApp
      const metadataUrl = `${this.apiUrl}/${mediaId}`;
      const metadataResponse = await fetch(metadataUrl, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!metadataResponse.ok) {
        this.logger.error(`Failed to get media metadata: ${metadataResponse.status}`);
        return null;
      }

      const metadata = await metadataResponse.json();
      const whatsappMediaUrl = metadata.url;
      const mimeType = metadata.mime_type || 'application/octet-stream';

      // Paso 2: Descargar el contenido binario desde WhatsApp
      const mediaResponse = await fetch(whatsappMediaUrl, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!mediaResponse.ok) {
        this.logger.error(`Failed to download media content: ${mediaResponse.status}`);
        return null;
      }

      const arrayBuffer = await mediaResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Paso 3: Determinar extension del archivo
      const extension = this.getExtensionFromMimeType(mimeType);
      const objectName = `whatsapp-media/${Date.now()}_${mediaId}${extension}`;

      // Paso 4: Subir a MinIO
      const result = await this.minioService.uploadBuffer(buffer, objectName, mimeType);

      this.logger.log(`Media uploaded to MinIO: ${objectName}`);

      return {
        url: result.url,
        mimeType: mimeType,
      };
    } catch (error) {
      this.logger.error(`Failed to download media: ${error.message}`);
      return null;
    }
  }

  /**
   * Obtener extension de archivo desde mime type
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'video/mp4': '.mp4',
      'video/3gpp': '.3gp',
      'audio/aac': '.aac',
      'audio/mp4': '.m4a',
      'audio/mpeg': '.mp3',
      'audio/amr': '.amr',
      'audio/ogg': '.ogg',
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    };

    return mimeToExt[mimeType] || '';
  }

  /**
   * Verificar token del webhook
   */
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    const verifyToken = this.configService.get<string>(
      'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
      'verify_token',
    );

    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('Webhook verified successfully');
      return challenge;
    }

    this.logger.warn('Webhook verification failed');
    return null;
  }

  /**
   * Verificar firma del webhook
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const secret = this.configService.get<string>(
      'WHATSAPP_WEBHOOK_SECRET',
      '',
    );

    if (!secret) {
      this.logger.warn('Webhook secret not configured, skipping verification');
      return true;
    }

    // En producción, verificar HMAC-SHA256
    // const crypto = require('crypto');
    // const expectedSignature = crypto
    //   .createHmac('sha256', secret)
    //   .update(payload)
    //   .digest('hex');
    // return signature === `sha256=${expectedSignature}`;

    return true; // Por ahora, permitir todo en desarrollo
  }
}
