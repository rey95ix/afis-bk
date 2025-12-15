import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsUrl,
  IsInt,
} from 'class-validator';
import { tipo_mensaje_whatsapp } from '@prisma/client';

export class SendMessageDto {
  @ApiProperty({
    description: 'Contenido del mensaje',
    example: 'Hola, ¿cómo podemos ayudarte?',
  })
  @IsString()
  @IsNotEmpty()
  contenido: string;

  @ApiPropertyOptional({
    description: 'Tipo de mensaje',
    enum: tipo_mensaje_whatsapp,
    default: 'TEXTO',
  })
  @IsOptional()
  @IsEnum(tipo_mensaje_whatsapp)
  tipo?: tipo_mensaje_whatsapp = tipo_mensaje_whatsapp.TEXTO;

  @ApiPropertyOptional({
    description: 'URL del archivo multimedia (para mensajes de media)',
    example: 'https://storage.example.com/files/image.jpg',
  })
  @IsOptional()
  @IsUrl()
  url_media?: string;

  @ApiPropertyOptional({
    description: 'Tipo MIME del archivo multimedia',
    example: 'image/jpeg',
  })
  @IsOptional()
  @IsString()
  tipo_media?: string;
}
