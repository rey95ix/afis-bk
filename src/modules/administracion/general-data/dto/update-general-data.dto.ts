// src/modules/administracion/general-data/dto/update-general-data.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsEmail } from 'class-validator';

export class UpdateGeneralDataDto {
  @ApiProperty({ description: 'Nombre del sistema', required: false })
  @IsOptional()
  @IsString()
  nombre_sistema?: string;

  @ApiProperty({ description: 'Dirección de la empresa', required: false })
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiProperty({ description: 'Razón social', required: false })
  @IsOptional()
  @IsString()
  razon?: string;
   
  @IsOptional()
  @IsString()
  url_correo_atencion?: string;

  @ApiProperty({ description: 'NIT de la empresa', required: false })
  @IsOptional()
  @IsString()
  nit?: string;

  @ApiProperty({ description: 'NRC de la empresa', required: false })
  @IsOptional()
  @IsString()
  nrc?: string;

  @ApiProperty({ description: 'Código de actividad económica', required: false })
  @IsOptional()
  @IsString()
  cod_actividad?: string;

  @ApiProperty({ description: 'Descripción de la actividad económica', required: false })
  @IsOptional()
  @IsString()
  desc_actividad?: string;

  @ApiProperty({ description: 'Nombre comercial', required: false })
  @IsOptional()
  @IsString()
  nombre_comercial?: string;

  @ApiProperty({ description: 'Contactos de la empresa', required: false })
  @IsOptional()
  @IsString()
  contactos?: string;

  @ApiProperty({ description: 'Correo electrónico de la empresa', required: false })
  @IsOptional()
  @IsEmail({}, { message: 'El correo debe ser un email válido' })
  correo?: string;

  @ApiProperty({ description: 'Código de establecimiento MH', required: false })
  @IsOptional()
  @IsString()
  cod_estable_MH?: string;

  @ApiProperty({ description: 'Código de establecimiento', required: false })
  @IsOptional()
  @IsString()
  cod_estable?: string;

  @ApiProperty({ description: 'Código de punto de venta MH', required: false })
  @IsOptional()
  @IsString()
  cod_punto_venta_MH?: string;

  @ApiProperty({ description: 'Código de punto de venta', required: false })
  @IsOptional()
  @IsString()
  cod_punto_venta?: string;

  @ApiProperty({
    description: 'Ambiente de facturación (00=pruebas, 01=producción)',
    required: false,
    example: '00'
  })
  @IsOptional()
  @IsString()
  ambiente?: string;

  @ApiProperty({ description: 'Llave pública para facturación electrónica', required: false })
  @IsOptional()
  @IsString()
  public_key?: string;

  @ApiProperty({ description: 'Llave privada para facturación electrónica', required: false })
  @IsOptional()
  @IsString()
  private_key?: string;

  @ApiProperty({ description: 'API Key para facturación electrónica', required: false })
  @IsOptional()
  @IsString()
  api_key?: string;

  @ApiProperty({ description: 'Icono del sistema (base64)', required: false })
  @IsOptional()
  @IsString()
  icono_sistema?: string;

  @ApiProperty({ description: 'Icono para facturas (base64)', required: false })
  @IsOptional()
  @IsString()
  icono_factura?: string;

  @ApiProperty({ description: 'URL de Facebook', required: false })
  @IsOptional()
  @IsString()
  url_facebook?: string;

  @ApiProperty({ description: 'Nombre de perfil de Facebook', required: false })
  @IsOptional()
  @IsString()
  perfil_facebook?: string;

  @ApiProperty({ description: 'URL de Instagram', required: false })
  @IsOptional()
  @IsString()
  url_instagram?: string;

  @ApiProperty({ description: 'Nombre de perfil de Instagram', required: false })
  @IsOptional()
  @IsString()
  perfil_instagram?: string;

  @ApiProperty({ description: 'URL de la página web', required: false })
  @IsOptional()
  @IsString()
  url_pagina_web?: string;

  @ApiProperty({ description: 'Correo de atención al cliente', required: false })
  @IsOptional()
  @IsString()
  url_correo_atencio?: string;

  @ApiProperty({ description: 'URL de Google Maps', required: false })
  @IsOptional()
  @IsString()
  url_maps?: string;

  @ApiProperty({ description: 'Número de WhatsApp', required: false })
  @IsOptional()
  @IsString()
  whatsapp?: string;

  @ApiProperty({ description: 'Color del icono', required: false })
  @IsOptional()
  @IsString()
  color_icono?: string;
}
