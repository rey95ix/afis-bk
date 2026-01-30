import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para una fila del Anexo 2 - Ventas a Consumidor Final (Factura)
 * Formato según requerimientos del Ministerio de Hacienda de El Salvador
 */
export class LibroIvaAnexo2RowDto {
  @ApiProperty({ description: 'Número de fila', example: 1 })
  fila: number;

  @ApiProperty({ description: 'A - Fecha de emisión (DD/MM/AAAA)', example: '15/01/2024' })
  fechaEmision: string;

  @ApiProperty({ description: 'B - Clase de documento (4 = DTE)', example: '4' })
  claseDocumento: string;

  @ApiProperty({ description: 'C - Tipo de documento (01 = Factura)', example: '01' })
  tipoDocumento: string;

  @ApiProperty({ description: 'D - Número de resolución', example: 'DTE-01-M001P001-000000000001234' })
  numeroResolucion: string;

  @ApiProperty({ description: 'E - Serie del documento DEL', example: '2024FE123456789' })
  serieDel: string;

  @ApiProperty({ description: 'F - Serie del documento AL', example: '2024FE123456789' })
  serieAl: string;

  @ApiProperty({ description: 'G - Número de documento DEL', example: 'ABC123DEF456' })
  numeroDocumentoDel: string;

  @ApiProperty({ description: 'H - Número de documento AL', example: 'ABC123DEF456' })
  numeroDocumentoAl: string;

  @ApiProperty({ description: 'I - Número de máquina registradora (vacío para DTEs)', example: '' })
  numeroMaquina: string;

  @ApiProperty({ description: 'J - Ventas exentas', example: '0.00' })
  ventasExentas: string;

  @ApiProperty({ description: 'K - Ventas no sujetas', example: '0.00' })
  ventasNoSujetas: string;

  @ApiProperty({ description: 'L - Ventas gravadas locales', example: '100.00' })
  ventasGravadas: string;

  @ApiProperty({ description: 'M - Exportaciones dentro de Centroamérica', example: '0.00' })
  exportacionesCa: string;

  @ApiProperty({ description: 'N - Exportaciones fuera de Centroamérica', example: '0.00' })
  exportacionesFueraCa: string;

  @ApiProperty({ description: 'O - Exportaciones de servicios', example: '0.00' })
  exportacionesServicios: string;

  @ApiProperty({ description: 'P - Ventas a zonas francas', example: '0.00' })
  ventasZonasFrancas: string;

  @ApiProperty({ description: 'Q - Total ventas', example: '100.00' })
  totalVentas: string;

  @ApiProperty({ description: 'R - Número de anexo', example: '2' })
  numeroAnexo: string;
}

/**
 * Totales del Anexo 2
 */
export interface TotalesAnexo2 {
  ventasExentas: string;
  ventasNoSujetas: string;
  ventasGravadas: string;
  totalVentas: string;
}

/**
 * DTO para respuesta paginada del Anexo 2
 */
export class LibroIvaAnexo2ResponseDto {
  @ApiProperty({ type: [LibroIvaAnexo2RowDto], description: 'Filas del libro' })
  data: LibroIvaAnexo2RowDto[];

  @ApiProperty({ description: 'Metadatos de paginación' })
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };

  @ApiProperty({ description: 'Totales consolidados del período' })
  totales: TotalesAnexo2;
}
