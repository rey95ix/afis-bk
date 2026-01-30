import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para una fila del Anexo 1 - Ventas a Contribuyentes (CCF)
 * Formato según requerimientos del Ministerio de Hacienda de El Salvador
 */
export class LibroIvaAnexo1RowDto {
  @ApiProperty({ description: 'Número de fila', example: 1 })
  fila: number;

  @ApiProperty({ description: 'A - Fecha de emisión (DD/MM/AAAA)', example: '15/01/2024' })
  fechaEmision: string;

  @ApiProperty({ description: 'B - Clase de documento (4 = DTE)', example: '4' })
  claseDocumento: string;

  @ApiProperty({ description: 'C - Tipo de documento (03 = CCF)', example: '03' })
  tipoDocumento: string;

  @ApiProperty({ description: 'D - Número de resolución', example: 'DTE-03-M001P001-000000000001234' })
  numeroResolucion: string;

  @ApiProperty({ description: 'E - Número de serie (sello de recepción)', example: '2024FE123456789' })
  numeroSerie: string;

  @ApiProperty({ description: 'F - Número de documento (código generación)', example: 'ABC123DEF456' })
  numeroDocumento: string;

  @ApiProperty({ description: 'G - Número de control interno (vacío para DTEs)', example: '' })
  controlInterno: string;

  @ApiProperty({ description: 'H - NIT o NRC del cliente', example: '06142803951018' })
  nitNrc: string;

  @ApiProperty({ description: 'I - Nombre del cliente', example: 'EMPRESA CLIENTE SA DE CV' })
  nombreCliente: string;

  @ApiProperty({ description: 'J - Ventas exentas', example: '0.00' })
  ventasExentas: string;

  @ApiProperty({ description: 'K - Ventas no sujetas', example: '0.00' })
  ventasNoSujetas: string;

  @ApiProperty({ description: 'L - Ventas gravadas (sin IVA)', example: '100.00' })
  ventasGravadas: string;

  @ApiProperty({ description: 'M - Débito fiscal (IVA)', example: '13.00' })
  debitoFiscal: string;

  @ApiProperty({ description: 'N - Ventas a cuenta de terceros', example: '0.00' })
  ventasTerceros: string;

  @ApiProperty({ description: 'O - Débito fiscal terceros', example: '0.00' })
  debitoTerceros: string;

  @ApiProperty({ description: 'P - Total ventas (incluye IVA)', example: '113.00' })
  totalVentas: string;

  @ApiProperty({ description: 'Q - DUI del cliente (vacío para CCF)', example: '' })
  duiCliente: string;

  @ApiProperty({ description: 'R - Tipo de operación (1-4)', example: '1' })
  tipoOperacion: string;

  @ApiProperty({ description: 'S - Tipo de ingreso (1-5)', example: '2' })
  tipoIngreso: string;

  @ApiProperty({ description: 'T - Número de anexo', example: '1' })
  numeroAnexo: string;
}

/**
 * Totales del Anexo 1
 */
export interface TotalesAnexo1 {
  ventasExentas: string;
  ventasNoSujetas: string;
  ventasGravadas: string;
  debitoFiscal: string;
  totalVentas: string;
}

/**
 * DTO para respuesta paginada del Anexo 1
 */
export class LibroIvaAnexo1ResponseDto {
  @ApiProperty({ type: [LibroIvaAnexo1RowDto], description: 'Filas del libro' })
  data: LibroIvaAnexo1RowDto[];

  @ApiProperty({ description: 'Metadatos de paginación' })
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };

  @ApiProperty({ description: 'Totales consolidados del período' })
  totales: TotalesAnexo1;
}
