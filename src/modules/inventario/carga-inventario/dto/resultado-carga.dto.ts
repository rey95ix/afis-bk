import { ApiProperty } from '@nestjs/swagger';

export class ItemResultadoDto {
  @ApiProperty({ description: 'Número de fila en el Excel' })
  fila: number;

  @ApiProperty({ description: 'Marca del producto' })
  marca: string;

  @ApiProperty({ description: 'Modelo del producto' })
  modelo: string;

  @ApiProperty({ description: 'Descripción del producto' })
  descripcion: string;

  @ApiProperty({ description: 'Cantidad cargada' })
  cantidad: number;

  @ApiProperty({
    description: 'Estado del procesamiento',
    enum: ['CREADO', 'ACTUALIZADO', 'ERROR'],
  })
  estado: 'CREADO' | 'ACTUALIZADO' | 'ERROR';

  @ApiProperty({ description: 'Mensaje de error o información', required: false })
  mensaje?: string;

  @ApiProperty({ description: 'Indica si la marca fue creada', required: false })
  marca_creada?: boolean;

  @ApiProperty({ description: 'Indica si el modelo fue creado', required: false })
  modelo_creado?: boolean;

  @ApiProperty({
    description: 'Indica si el catálogo fue creado',
    required: false,
  })
  catalogo_creado?: boolean;
}

export class ResultadoCargaDto {
  @ApiProperty({ description: 'Indica si el proceso fue exitoso' })
  success: boolean;

  @ApiProperty({ description: 'Total de filas encontradas en el Excel' })
  total_filas: number;

  @ApiProperty({ description: 'Filas procesadas correctamente' })
  filas_procesadas: number;

  @ApiProperty({ description: 'Registros de inventario creados' })
  filas_creadas: number;

  @ApiProperty({ description: 'Registros de inventario actualizados' })
  filas_actualizadas: number;

  @ApiProperty({ description: 'Filas con error' })
  filas_error: number;

  @ApiProperty({ description: 'Marcas nuevas creadas' })
  marcas_creadas: number;

  @ApiProperty({ description: 'Modelos nuevos creados' })
  modelos_creados: number;

  @ApiProperty({ description: 'Productos de catálogo nuevos creados' })
  catalogos_creados: number;

  @ApiProperty({ type: [ItemResultadoDto], description: 'Detalle por fila' })
  detalle: ItemResultadoDto[];

  @ApiProperty({
    type: [String],
    description: 'Lista de errores encontrados',
    required: false,
  })
  errores?: string[];
}

export class ValidacionExcelDto {
  @ApiProperty({ description: 'Indica si el archivo es válido' })
  valido: boolean;

  @ApiProperty({ description: 'Total de filas con datos' })
  total_filas: number;

  @ApiProperty({ description: 'Vista previa de las primeras filas' })
  preview: Array<{
    fila: number;
    marca: string;
    modelo: string;
    descripcion: string;
    cantidad: number;
  }>;

  @ApiProperty({ type: [String], description: 'Errores de validación' })
  errores: string[];
}
