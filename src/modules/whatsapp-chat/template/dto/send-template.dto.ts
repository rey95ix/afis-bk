import { IsString, IsOptional, IsObject, IsNumber } from 'class-validator';

export class SendTemplateDto {
  @IsNumber()
  id_template: number;

  @IsObject()
  @IsOptional()
  parametros?: Record<string, string>;
}

export class SendTemplateByNameDto {
  @IsString()
  nombre_template: string;

  @IsString()
  @IsOptional()
  idioma?: string = 'es';

  @IsObject()
  @IsOptional()
  parametros?: Record<string, string>;
}
