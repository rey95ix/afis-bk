import { IsInt, IsNotEmpty, IsOptional, IsString, IsDecimal } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateMaterialDto {
  @ApiProperty({
    description: 'SKU del material utilizado',
    example: 'ONU-HG8546M',
  })
  @IsString()
  @IsNotEmpty()
  sku: string;

  @ApiProperty({
    description: 'Nombre del material',
    example: 'ONU Huawei HG8546M',
  })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({
    description: 'Cantidad utilizada',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  cantidad: number;

  @ApiPropertyOptional({
    description: 'Número de serie del equipo (si aplica)',
    example: 'SN123456789',
  })
  @IsString()
  @IsOptional()
  serie?: string;

  @ApiPropertyOptional({
    description: 'Costo unitario del material',
    example: 45.50,
  })
  @IsOptional()
  @Type(() => Number)
  costo_unitario?: number;
}
