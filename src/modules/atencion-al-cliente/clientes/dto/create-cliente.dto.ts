// src/modules/atencion-al-cliente/clientes/dto/create-cliente.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsEmail, IsDateString } from 'class-validator';

export class CreateClienteDto { 
  @ApiProperty({
    description: 'Nombre completo del titular',
    example: 'Juan Carlos Pérez García',
  })
  @IsString()
  titular: string;

  @ApiProperty({
    description: 'Fecha de nacimiento del cliente',
    example: '1990-05-15',
  })
  @IsDateString()
  fecha_nacimiento: string;

  @ApiProperty({
    description: 'Documento Único de Identidad (DUI)',
    example: '12345678-9',
  })
  @IsString()
  dui: string;

  @ApiProperty({
    description: 'Número de Identificación Tributaria (NIT)',
    example: '1234-567890-123-4',
    required: false,
  })
  @IsOptional()
  @IsString()
  nit?: string;

  @ApiProperty({
    description: 'Empresa donde trabaja el cliente',
    example: 'Empresa ABC S.A. de C.V.',
  })
  @IsString()
  empresa_trabajo: string;

  @ApiProperty({
    description: 'Correo electrónico del cliente',
    example: 'cliente@example.com',
  })
  @IsEmail()
  correo_electronico: string;

  @ApiProperty({
    description: 'Teléfono principal',
    example: '7890-1234',
  })
  @IsString()
  telefono1: string;

  @ApiProperty({
    description: 'Teléfono secundario',
    example: '2233-4455',
    required: false,
  })
  @IsOptional()
  @IsString()
  telefono2?: string;

  @ApiProperty({
    description: 'Nombre de la primera referencia personal',
    example: 'María González',
  })
  @IsString()
  referencia1: string;

  @ApiProperty({
    description: 'Teléfono de la primera referencia',
    example: '7777-8888',
  })
  @IsString()
  referencia1_telefono: string;

  @ApiProperty({
    description: 'Nombre de la segunda referencia personal',
    example: 'Carlos Ramírez',
  })
  @IsString()
  referencia2: string;

  @ApiProperty({
    description: 'Teléfono de la segunda referencia',
    example: '7555-6666',
  })
  @IsString()
  referencia2_telefono: string;
}
