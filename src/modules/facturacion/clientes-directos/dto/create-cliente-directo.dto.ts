import {
  IsInt,
  IsOptional,
  IsString,
  IsBoolean,
  IsEmail,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para crear un cliente directo (para venta sin contrato)
 */
export class CreateClienteDirectoDto {
  @ApiProperty({ description: 'Nombre o razón social del cliente' })
  @IsString()
  @MinLength(2)
  @MaxLength(250)
  nombre: string;

  @ApiPropertyOptional({ description: 'Razón social (si es empresa)' })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  razon_social?: string;

  @ApiPropertyOptional({ description: 'Número de Registro de Contribuyente (NRC)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  registro_nrc?: string;

  @ApiPropertyOptional({ description: 'NIT (14 dígitos con guión, ej: 0614-123456-001-2)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  nit?: string;

  @ApiPropertyOptional({ description: 'DUI (9 dígitos con guión, ej: 12345678-9)' })
  @IsOptional()
  @IsString()
  @MaxLength(15)
  dui?: string;

  @ApiPropertyOptional({ description: 'ID del tipo de documento de identificación' })
  @IsOptional()
  @IsInt()
  id_tipo_documento?: number;

  @ApiPropertyOptional({ description: 'ID de la actividad económica' })
  @IsOptional()
  @IsInt()
  id_actividad_economica?: number;

  @ApiPropertyOptional({ description: 'ID del país' })
  @IsOptional()
  @IsInt()
  id_pais?: number;

  @ApiPropertyOptional({ description: 'ID del municipio' })
  @IsOptional()
  @IsInt()
  id_municipio?: number;

  @ApiPropertyOptional({ description: 'Dirección completa' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  direccion?: string;

  @ApiPropertyOptional({ description: 'Nombre del contacto' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  contacto?: string;

  @ApiPropertyOptional({ description: 'Teléfono de contacto' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @ApiPropertyOptional({ description: 'Correo electrónico' })
  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  correo?: string;

  @ApiPropertyOptional({ description: 'Si aplica retención de IVA', default: false })
  @IsOptional()
  @IsBoolean()
  retencion?: boolean;

  @ApiPropertyOptional({ description: 'ID del tipo de cliente' })
  @IsOptional()
  @IsInt()
  id_tipo_cliente?: number;

  @ApiPropertyOptional({ description: 'ID de la sucursal' })
  @IsOptional()
  @IsInt()
  id_sucursal?: number;
}
