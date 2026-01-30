import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para una fila del Anexo 5 - Ventas a Sujeto Excluido (FSE)
 * Formato según requerimientos del Ministerio de Hacienda de El Salvador
 */
export class LibroIvaAnexo5RowDto {
  @ApiProperty({ description: 'Número de fila', example: 1 })
  fila: number;

  @ApiProperty({ description: 'A - Fecha de emisión (DD/MM/AAAA)', example: '15/01/2024' })
  fechaEmision: string;

  @ApiProperty({ description: 'B - Clase de documento (4 = DTE)', example: '4' })
  claseDocumento: string;

  @ApiProperty({ description: 'C - Tipo de documento (14 = FSE)', example: '14' })
  tipoDocumento: string;

  @ApiProperty({ description: 'D - Número de resolución', example: 'DTE-14-M001P001-000000000001234' })
  numeroResolucion: string;

  @ApiProperty({ description: 'E - Número de serie (sello de recepción)', example: '2024FE123456789' })
  numeroSerie: string;

  @ApiProperty({ description: 'F - Número de documento (código generación)', example: 'ABC123DEF456' })
  numeroDocumento: string;

  @ApiProperty({ description: 'G - Número de control interno (vacío para DTEs)', example: '' })
  controlInterno: string;

  @ApiProperty({ description: 'H - DUI o NIT del sujeto excluido', example: '00000000-0' })
  duiNit: string;

  @ApiProperty({ description: 'I - Nombre del sujeto excluido', example: 'JUAN PEREZ' })
  nombreSujeto: string;

  @ApiProperty({ description: 'J - Monto de la compra (sin retención)', example: '100.00' })
  montoCompra: string;

  @ApiProperty({ description: 'K - IVA retenido (1%)', example: '1.00' })
  ivaRetenido: string;

  @ApiProperty({ description: 'L - Total (monto - IVA retenido)', example: '99.00' })
  total: string;

  @ApiProperty({ description: 'M - Número de anexo', example: '5' })
  numeroAnexo: string;
}

/**
 * Totales del Anexo 5
 */
export interface TotalesAnexo5 {
  montoCompra: string;
  ivaRetenido: string;
  total: string;
}

/**
 * DTO para respuesta paginada del Anexo 5
 */
export class LibroIvaAnexo5ResponseDto {
  @ApiProperty({ type: [LibroIvaAnexo5RowDto], description: 'Filas del libro' })
  data: LibroIvaAnexo5RowDto[];

  @ApiProperty({ description: 'Metadatos de paginación' })
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };

  @ApiProperty({ description: 'Totales consolidados del período' })
  totales: TotalesAnexo5;
}
