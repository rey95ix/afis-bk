import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

// DTOs para el payload del webhook de WhatsApp Business API

class WhatsAppContact {
  @IsString()
  wa_id: string;

  @IsOptional()
  profile?: {
    name: string;
  };
}

class WhatsAppTextMessage {
  @IsString()
  body: string;
}

class WhatsAppMediaMessage {
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  mime_type?: string;

  @IsOptional()
  @IsString()
  sha256?: string;

  @IsOptional()
  @IsNumber()
  file_size?: number;

  @IsOptional()
  @IsString()
  caption?: string;
}

class WhatsAppMessage {
  @IsString()
  id: string;

  @IsString()
  from: string;

  @IsString()
  timestamp: string;

  @IsString()
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contacts';

  @IsOptional()
  text?: WhatsAppTextMessage;

  @IsOptional()
  image?: WhatsAppMediaMessage;

  @IsOptional()
  video?: WhatsAppMediaMessage;

  @IsOptional()
  audio?: WhatsAppMediaMessage;

  @IsOptional()
  document?: WhatsAppMediaMessage;

  @IsOptional()
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };

  @IsOptional()
  contacts?: any[];
}

class WhatsAppStatus {
  @IsString()
  id: string;

  @IsString()
  status: 'sent' | 'delivered' | 'read' | 'failed';

  @IsString()
  timestamp: string;

  @IsString()
  recipient_id: string;

  @IsOptional()
  errors?: any[];
}

class WhatsAppValue {
  @IsString()
  messaging_product: string;

  @IsOptional()
  metadata?: {
    display_phone_number: string;
    phone_number_id: string;
  };

  @IsOptional()
  @IsArray()
  contacts?: WhatsAppContact[];

  @IsOptional()
  @IsArray()
  messages?: WhatsAppMessage[];

  @IsOptional()
  @IsArray()
  statuses?: WhatsAppStatus[];
}

class WhatsAppChange {
  @IsString()
  field: string;

  @ValidateNested()
  @Type(() => WhatsAppValue)
  value: WhatsAppValue;
}

class WhatsAppEntry {
  @IsString()
  id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatsAppChange)
  changes: WhatsAppChange[];
}

export class WebhookPayloadDto {
  @ApiProperty({
    description: 'Objeto del webhook',
    example: 'whatsapp_business_account',
  })
  @IsString()
  @IsNotEmpty()
  object: string;

  @ApiProperty({
    description: 'Entries del webhook',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatsAppEntry)
  entry: WhatsAppEntry[];
}

// DTO para enviar mensajes via API
export class SendWhatsAppMessageDto {
  @ApiProperty({
    description: 'Número de teléfono destinatario (formato E.164)',
    example: '+50370001234',
  })
  @IsString()
  @IsNotEmpty()
  to: string;

  @ApiProperty({
    description: 'Tipo de mensaje',
    example: 'text',
  })
  @IsString()
  type: 'text' | 'image' | 'video' | 'audio' | 'document';

  @ApiPropertyOptional({
    description: 'Contenido de texto',
  })
  @IsOptional()
  text?: {
    body: string;
    preview_url?: boolean;
  };

  @ApiPropertyOptional({
    description: 'Media (imagen, video, audio, documento)',
  })
  @IsOptional()
  media?: {
    link: string;
    caption?: string;
  };
}
