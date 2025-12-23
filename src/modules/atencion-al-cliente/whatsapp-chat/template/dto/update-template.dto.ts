import { IsString, IsOptional, IsObject, IsBoolean, IsIn } from 'class-validator';

export class UpdateTemplateDto {
  @IsString()
  @IsOptional()
  nombre?: string;

  @IsString()
  @IsOptional()
  idioma?: string;

  @IsString()
  @IsIn(['MARKETING', 'UTILITY', 'AUTHENTICATION'])
  @IsOptional()
  categoria?: string;

  @IsString()
  @IsIn(['APPROVED', 'PENDING', 'REJECTED'])
  @IsOptional()
  estado?: string;

  @IsObject()
  @IsOptional()
  componentes?: {
    header?: {
      type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
      text?: string;
      example?: string;
    };
    body: {
      text: string;
      examples?: string[];
    };
    footer?: {
      text: string;
    };
    buttons?: Array<{
      type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
      text: string;
      url?: string;
      phone_number?: string;
    }>;
  };

  @IsObject()
  @IsOptional()
  variables?: Record<string, string>;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
