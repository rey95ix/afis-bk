import {
  IsString,
  IsOptional,
  IsIn,
  IsArray,
  ValidateNested,
  IsBoolean,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HeaderComponentDto {
  @ApiProperty({
    description: 'Tipo de header',
    enum: ['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'],
    example: 'TEXT',
  })
  @IsString()
  @IsIn(['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'])
  type: string;

  @ApiPropertyOptional({
    description: 'Texto del header (solo para type TEXT)',
    example: 'Hola {{1}}!',
    maxLength: 60,
  })
  @IsString()
  @IsOptional()
  @MaxLength(60)
  text?: string;

  @ApiPropertyOptional({
    description: 'Ejemplo para la variable o media handle',
    example: 'Juan',
  })
  @IsString()
  @IsOptional()
  example?: string;
}

export class BodyComponentDto {
  @ApiProperty({
    description: 'Texto del cuerpo del mensaje. Usa {{1}}, {{2}}, etc. para variables.',
    example: 'Hola {{1}}, tu pedido {{2}} está listo para recoger.',
    maxLength: 1024,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  text: string;

  @ApiPropertyOptional({
    description: 'Ejemplos para las variables en orden',
    example: ['Juan', 'ORD-12345'],
    type: [String],
  })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  examples?: string[];
}

export class FooterComponentDto {
  @ApiProperty({
    description: 'Texto del pie de página',
    example: 'Gracias por su preferencia',
    maxLength: 60,
  })
  @IsString()
  @MaxLength(60)
  text: string;
}

export class ButtonDto {
  @ApiProperty({
    description: 'Tipo de botón',
    enum: ['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'COPY_CODE', 'OTP'],
    example: 'QUICK_REPLY',
  })
  @IsString()
  @IsIn(['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'COPY_CODE', 'OTP'])
  type: string;

  @ApiProperty({
    description: 'Texto del botón',
    example: 'Ver detalles',
    maxLength: 25,
  })
  @IsString()
  @MaxLength(25)
  text: string;

  @ApiPropertyOptional({
    description: 'URL para botones tipo URL',
    example: 'https://ejemplo.com/pedido/{{1}}',
  })
  @IsString()
  @IsOptional()
  url?: string;

  @ApiPropertyOptional({
    description: 'Número de teléfono para botones tipo PHONE_NUMBER',
    example: '+50312345678',
  })
  @IsString()
  @IsOptional()
  phone_number?: string;

  @ApiPropertyOptional({
    description: 'Ejemplo para URL dinámica',
    example: '12345',
  })
  @IsString()
  @IsOptional()
  example?: string;

  @ApiPropertyOptional({
    description: 'Tipo de OTP (COPY_CODE o ONE_TAP)',
    enum: ['COPY_CODE', 'ONE_TAP'],
  })
  @IsString()
  @IsOptional()
  @IsIn(['COPY_CODE', 'ONE_TAP'])
  otp_type?: string;

  @ApiPropertyOptional({
    description: 'Texto de autofill para ONE_TAP',
  })
  @IsString()
  @IsOptional()
  autofill_text?: string;

  @ApiPropertyOptional({
    description: 'Nombre del paquete Android para ONE_TAP',
  })
  @IsString()
  @IsOptional()
  package_name?: string;

  @ApiPropertyOptional({
    description: 'Hash de firma Android para ONE_TAP',
  })
  @IsString()
  @IsOptional()
  signature_hash?: string;
}

export class CreateMetaTemplateDto {
  @ApiProperty({
    description: 'Nombre único de la plantilla (solo minúsculas, números y guiones bajos)',
    example: 'confirmacion_pedido',
    pattern: '^[a-z0-9_]+$',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  @Matches(/^[a-z0-9_]+$/, {
    message: 'El nombre solo puede contener letras minúsculas, números y guiones bajos',
  })
  nombre: string;

  @ApiProperty({
    description: 'Categoría de la plantilla',
    enum: ['MARKETING', 'UTILITY', 'AUTHENTICATION'],
    example: 'UTILITY',
  })
  @IsString()
  @IsIn(['MARKETING', 'UTILITY', 'AUTHENTICATION'])
  categoria: string;

  @ApiPropertyOptional({
    description: 'Código de idioma',
    example: 'es',
    default: 'es',
  })
  @IsString()
  @IsOptional()
  idioma?: string = 'es';

  @ApiPropertyOptional({
    description: 'Configuración del header',
    type: HeaderComponentDto,
  })
  @ValidateNested()
  @Type(() => HeaderComponentDto)
  @IsOptional()
  header?: HeaderComponentDto;

  @ApiProperty({
    description: 'Configuración del body (obligatorio)',
    type: BodyComponentDto,
  })
  @ValidateNested()
  @Type(() => BodyComponentDto)
  body: BodyComponentDto;

  @ApiPropertyOptional({
    description: 'Configuración del footer',
    type: FooterComponentDto,
  })
  @ValidateNested()
  @Type(() => FooterComponentDto)
  @IsOptional()
  footer?: FooterComponentDto;

  @ApiPropertyOptional({
    description: 'Botones de la plantilla (máximo 3)',
    type: [ButtonDto],
    maxItems: 3,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ButtonDto)
  @IsOptional()
  buttons?: ButtonDto[];

  @ApiPropertyOptional({
    description: 'Descripción interna de la plantilla',
    example: 'Plantilla para confirmar pedidos listos para recoger',
  })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiPropertyOptional({
    description: 'Si la plantilla está activa localmente',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  activo?: boolean = true;
}
