// src/modules/atencion-al-cliente/clientes/dto/create-cliente-datos-facturacion.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsEmail, IsIn } from 'class-validator';

export class CreateClienteDatosFacturacionDto {
  @ApiProperty({
    description: 'ID del cliente',
    example: 1,
  })
  @IsInt()
  id_cliente: number;

  @ApiProperty({
    description: 'Tipo de cliente: PERSONA o EMPRESA',
    example: 'PERSONA',
    enum: ['PERSONA', 'EMPRESA'],
  })
  @IsString()
  @IsIn(['PERSONA', 'EMPRESA'])
  tipo: string;

  @ApiProperty({
    description: 'ID del tipo de documento de identificación',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  id_tipo_documento?: number;

  @ApiProperty({
    description: 'ID de la actividad económica',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  id_actividad?: number;

  @ApiProperty({
    description: 'Nombre de la empresa o persona',
    example: 'Empresa ABC S.A. de C.V.',
  })
  @IsString()
  nombre_empresa: string;

  @ApiProperty({
    description: 'Número de Identificación Tributaria (NIT)',
    example: '1234-567890-123-4',
    required: false,
  })
  @IsOptional()
  @IsString()
  nit?: string;

  @ApiProperty({
    description: 'Número de Registro de Contribuyente (NRC)',
    example: '12345-6',
    required: false,
  })
  @IsOptional()
  @IsString()
  nrc?: string;

  @ApiProperty({
    description: 'Teléfono de contacto',
    example: '2233-4455',
    required: false,
  })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiProperty({
    description: 'Correo electrónico',
    example: 'facturacion@empresa.com',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  correo_electronico?: string;

  @ApiProperty({
    description: 'Dirección para facturación',
    example: 'Calle Principal #123, Colonia Centro',
    required: false,
  })
  @IsOptional()
  @IsString()
  direccion_facturacion?: string;

  @ApiProperty({
    description: 'ID del municipio',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  id_municipio?: number;

  @ApiProperty({
    description: 'ID del departamento',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  id_departamento?: number;
}
