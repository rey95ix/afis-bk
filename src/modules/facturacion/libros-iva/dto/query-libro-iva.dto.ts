import { IsEnum, IsOptional, IsInt, IsDateString, IsBoolean, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

/**
 * Tipos de libros de IVA disponibles
 */
export enum TipoLibroIva {
  ANEXO_1 = 'ANEXO_1', // Ventas a Contribuyentes (CCF - 03)
  ANEXO_2 = 'ANEXO_2', // Ventas a Consumidor Final (Factura - 01)
  ANEXO_5 = 'ANEXO_5', // Ventas a Sujeto Excluido (FSE - 14)
}

/**
 * Mapeo de tipo de libro a código de DTE
 */
export const LIBRO_A_TIPO_DTE: Record<TipoLibroIva, string> = {
  [TipoLibroIva.ANEXO_1]: '03', // CCF
  [TipoLibroIva.ANEXO_2]: '01', // Factura
  [TipoLibroIva.ANEXO_5]: '14', // FSE
};

/**
 * DTO para consultar libros de IVA
 */
export class QueryLibroIvaDto {
  @ApiProperty({
    description: 'Tipo de libro de IVA a consultar',
    enum: TipoLibroIva,
    example: TipoLibroIva.ANEXO_1,
  })
  @IsEnum(TipoLibroIva)
  tipo_libro: TipoLibroIva;

  @ApiProperty({
    description: 'Fecha de inicio del período (YYYY-MM-DD)',
    example: '2024-01-01',
  })
  @IsDateString()
  fecha_inicio: string;

  @ApiProperty({
    description: 'Fecha de fin del período (YYYY-MM-DD)',
    example: '2024-01-31',
  })
  @IsDateString()
  fecha_fin: string;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de sucursal',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id_sucursal?: number;

  @ApiPropertyOptional({
    description: 'Solo incluir DTEs procesados (aceptados por MH)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  solo_procesados?: boolean = true;

  @ApiPropertyOptional({
    description: 'Número de página',
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de registros por página',
    default: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 50;
}
