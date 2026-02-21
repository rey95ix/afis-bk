// src/modules/inventario/proveedores/dto/create-proveedor.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsEmail, IsNotEmpty } from 'class-validator';

export class CreateProveedorDto {
  @ApiProperty({
    description: 'Nombre o razón social del proveedor',
    example: 'Proveedor S.A. de C.V.',
  })
  @IsString({ message: 'El nombre o razón social debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El nombre o razón social no puede estar vacío.' })
  nombre_razon_social: string;

  @ApiProperty({
    description: 'Nombre comercial del proveedor',
    required: false,
    example: 'ProveeTodo S.A.',
  })
  @IsOptional()
  @IsString({ message: 'El nombre comercial debe ser una cadena de texto.' })
  nombre_comercial?: string;

  @ApiProperty({ description: 'Registro NRC del proveedor', required: false, example: '123456-7' })
  @IsOptional()
  @IsString({ message: 'El registro NRC debe ser una cadena de texto.' })
  registro_nrc?: string;

  @ApiProperty({ description: 'Número de documento', required: false, example: '0614-123456-123-4' })
  @IsOptional()
  @IsString({ message: 'El número de documento debe ser una cadena de texto.' })
  numero_documento?: string;

  @ApiProperty({ description: 'ID tipo de documento', required: false, example: 1 })
  @IsOptional()
  @IsInt({ message: 'El ID del tipo de documento debe ser un número entero.' })
  id_tipo_documento?: number;

  @ApiProperty({ description: 'ID de municipio', required: false, example: 1 })
  @IsOptional()
  @IsInt({ message: 'El ID del municipio debe ser un número entero.' })
  id_municipio?: number;

  @ApiProperty({ description: 'Dirección del proveedor', required: false, example: 'Calle Principal, #123' })
  @IsOptional()
  @IsString({ message: 'La dirección debe ser una cadena de texto.' })
  direccion?: string;

  @ApiProperty({ description: 'Teléfono del proveedor', required: false, example: '7890-1234' })
  @IsOptional()
  @IsString({ message: 'El teléfono debe ser una cadena de texto.' })
  telefono?: string;

  @ApiProperty({ description: 'Correo del proveedor', required: false, example: 'contacto@proveedor.com' })
  @IsOptional()
  @IsEmail({}, { message: 'El correo electrónico debe tener un formato válido.' })
  correo?: string;

  @ApiProperty({ description: 'Días de crédito', required: false, example: '30' })
  @IsOptional()
  @IsString({ message: 'Los días de crédito deben ser una cadena de texto.' })
  dias_credito?: string;

  @ApiProperty({ description: 'Nombre contacto 1', required: false, example: 'Juan Pérez' })
  @IsOptional()
  @IsString({ message: 'El nombre de contacto 1 debe ser una cadena de texto.' })
  nombre_contac_1?: string;

  @ApiProperty({ description: 'Teléfono contacto 1', required: false, example: '7777-1111' })
  @IsOptional()
  @IsString({ message: 'El teléfono de contacto 1 debe ser una cadena de texto.' })
  telefono_contac_1?: string;

  @ApiProperty({ description: 'Correo contacto 1', required: false, example: 'juan.perez@proveedor.com' })
  @IsOptional()
  // @IsEmail({}, { message: 'El correo de contacto 1 debe tener un formato válido.' })
  correo_contac_1?: string;

  @ApiProperty({ description: 'Nombre contacto 2', required: false, example: 'María López' })
  @IsOptional()
  @IsString({ message: 'El nombre de contacto 2 debe ser una cadena de texto.' })
  nombre_contac_2?: string;

  @ApiProperty({ description: 'Teléfono contacto 2', required: false, example: '6666-2222' })
  @IsOptional()
  @IsString({ message: 'El teléfono de contacto 2 debe ser una cadena de texto.' })
  telefono_contac_2?: string;

  @ApiProperty({ description: 'Correo contacto 2', required: false, example: 'maria.lopez@proveedor.com' })
  @IsOptional()
  // @IsEmail({}, { message: 'El correo de contacto 2 debe tener un formato válido.' })
  correo_contac_2?: string;

  @ApiProperty({ description: 'ID actividad económica', required: false, example: 1 })
  @IsOptional()
  @IsInt({ message: 'El ID de la actividad económica debe ser un número entero.' })
  id_actividad_economica?: number;
 
}
