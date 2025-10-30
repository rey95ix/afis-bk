// src/modules/inventario/sucursales/dto/create-sucursal.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsEmail } from 'class-validator';

export class CreateSucursalDto {
  @ApiProperty({
    description: 'Nombre de la sucursal',
    example: 'Sucursal Central',
  })
  @IsString()
  nombre: string;

  @ApiProperty({
    description: 'Color distintivo de la sucursal',
    example: '#FF0000',
    required: false,
  })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({
    description: 'Dirección o complemento',
    example: 'Frente a parque central',
    required: false,
  })
  @IsOptional()
  @IsString()
  complemento?: string;

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
    example: 'central@empresa.com',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  correo?: string;

  @ApiProperty({
    description: 'Código de establecimiento de MH',
    example: 'M001',
    required: false,
  })
  @IsOptional()
  @IsString()
  cod_estable_MH?: string;

  @ApiProperty({
    description: 'Código de establecimiento',
    example: 'M001',
    required: false,
  })
  @IsOptional()
  @IsString()
  cod_estable?: string;

  @ApiProperty({
    description: 'Código de punto de venta de MH',
    example: 'P001',
    required: false,
  })
  @IsOptional()
  @IsString()
  cod_punto_venta_MH?: string;

  @ApiProperty({
    description: 'Código de punto de venta',
    example: 'P001',
    required: false,
  })
  @IsOptional()
  @IsString()
  cod_punto_venta?: string;

  @ApiProperty({ description: 'ID del municipio', example: 1, required: false })
  @IsOptional()
  @IsInt()
  id_municipio?: number;

  @ApiProperty({
    description: 'ID del tipo de establecimiento',
    example: 2,
    required: false,
  })
  @IsOptional()
  @IsInt()
  id_tipo_establecimiento?: number;

  @ApiProperty({ description: 'Icono para la factura', required: false })
  @IsOptional()
  @IsString()
  icono_factura?: string;
}
