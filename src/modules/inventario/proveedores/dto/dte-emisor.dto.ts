// src/modules/inventario/proveedores/dto/dte-emisor.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class DireccionDteDto {
  @ApiProperty({ description: 'Codigo de departamento DTE', example: '06' })
  @IsString()
  @IsNotEmpty()
  departamento: string;

  @ApiProperty({ description: 'Codigo de municipio DTE', example: '23' })
  @IsString()
  @IsNotEmpty()
  municipio: string;

  @ApiProperty({ description: 'Direccion complemento', example: 'Calle Principal #123' })
  @IsString()
  @IsOptional()
  complemento?: string;
}

export class DteEmisorDto {
  @ApiProperty({ description: 'NIT del emisor', example: '06122408711029' })
  @IsString()
  @IsNotEmpty({ message: 'El NIT del emisor es requerido.' })
  nit: string;

  @ApiProperty({ description: 'NRC del emisor', required: false, example: '3053948' })
  @IsOptional()
  @IsString()
  nrc?: string;

  @ApiProperty({ description: 'Nombre o razon social del emisor', example: 'SONIA JOVEL CANJURA' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre del emisor es requerido.' })
  nombre: string;

  @ApiProperty({ description: 'Nombre comercial del emisor', required: false, example: 'LUBRICANTES PALACIOS JOVEL' })
  @IsOptional()
  @IsString()
  nombreComercial?: string;

  @ApiProperty({ description: 'Telefono del emisor', required: false, example: '78502631' })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiProperty({ description: 'Correo del emisor', required: false, example: 'correo@ejemplo.com' })
  @IsOptional()
  @IsString()
  correo?: string;

  @ApiProperty({ description: 'Direccion del emisor', required: false, type: DireccionDteDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DireccionDteDto)
  direccion?: DireccionDteDto;

  @ApiProperty({ description: 'Codigo de actividad economica', required: false, example: '45301' })
  @IsOptional()
  @IsString()
  codActividad?: string;
}
