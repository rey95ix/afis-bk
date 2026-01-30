import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { LibrosIvaService } from './libros-iva.service';
import {
  QueryLibroIvaDto,
  TipoLibroIva,
  LibroIvaAnexo1RowDto,
  LibroIvaAnexo2RowDto,
  LibroIvaAnexo5RowDto,
} from './dto';
import {
  COLUMNAS_ANEXO_1,
  COLUMNAS_ANEXO_2,
  COLUMNAS_ANEXO_5,
  NOMBRES_ANEXOS,
  EXCEL_HEADER_STYLE,
  EXCEL_NUMBER_STYLE,
  EXCEL_TOTALS_STYLE,
} from './constants/libro-iva.constants';

/**
 * Servicio para generación de archivos Excel de Libros de IVA
 */
@Injectable()
export class LibrosIvaExcelService {
  private readonly logger = new Logger(LibrosIvaExcelService.name);

  constructor(private readonly librosIvaService: LibrosIvaService) {}

  /**
   * Genera el Excel del libro de IVA según el tipo
   */
  async generateExcel(queryDto: QueryLibroIvaDto): Promise<Buffer> {
    const { tipo_libro } = queryDto;

    this.logger.log(`Generando Excel para ${tipo_libro}`);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AFIS - Sistema ERP';
    workbook.created = new Date();

    // Obtener todos los registros sin paginación
    const records = await this.librosIvaService.getAllRecords(queryDto);
    const resumen = await this.librosIvaService.getResumen(queryDto);

    switch (tipo_libro) {
      case TipoLibroIva.ANEXO_1:
        await this.generateAnexo1Sheet(workbook, records as LibroIvaAnexo1RowDto[], resumen, queryDto);
        break;
      case TipoLibroIva.ANEXO_2:
        await this.generateAnexo2Sheet(workbook, records as LibroIvaAnexo2RowDto[], resumen, queryDto);
        break;
      case TipoLibroIva.ANEXO_5:
        await this.generateAnexo5Sheet(workbook, records as LibroIvaAnexo5RowDto[], resumen, queryDto);
        break;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Genera la hoja del Anexo 1 (Ventas a Contribuyentes - CCF)
   */
  private async generateAnexo1Sheet(
    workbook: ExcelJS.Workbook,
    data: LibroIvaAnexo1RowDto[],
    resumen: any,
    queryDto: QueryLibroIvaDto,
  ): Promise<void> {
    const sheet = workbook.addWorksheet('Anexo 1 - CCF');

    // Título
    this.addTitle(sheet, NOMBRES_ANEXOS.ANEXO_1, queryDto);

    // Configurar columnas
    sheet.columns = COLUMNAS_ANEXO_1.map((col) => ({
      key: col.key,
      width: col.width,
    }));

    // Encabezados
    const headerRow = sheet.addRow(COLUMNAS_ANEXO_1.map((col) => col.header));
    this.styleHeaderRow(headerRow);

    // Datos
    data.forEach((row) => {
      const dataRow = sheet.addRow([
        row.fila,
        row.fechaEmision,
        row.claseDocumento,
        row.tipoDocumento,
        row.numeroResolucion,
        row.numeroSerie,
        row.numeroDocumento,
        row.controlInterno,
        row.nitNrc,
        row.nombreCliente,
        row.ventasExentas,
        row.ventasNoSujetas,
        row.ventasGravadas,
        row.debitoFiscal,
        row.ventasTerceros,
        row.debitoTerceros,
        row.totalVentas,
        row.duiCliente,
        row.tipoOperacion,
        row.tipoIngreso,
        row.numeroAnexo,
      ]);
      this.styleDataRow(dataRow, [11, 12, 13, 14, 15, 16, 17]); // Columnas numéricas
    });

    // Fila de totales
    const totalsRow = sheet.addRow([
      'TOTALES',
      '', '', '', '', '', '', '', '', '',
      resumen.totales.ventasExentas,
      resumen.totales.ventasNoSujetas,
      resumen.totales.ventasGravadas,
      resumen.totales.debitoFiscal,
      '0.00',
      '0.00',
      resumen.totales.totalVentas,
      '', '', '', '',
    ]);
    this.styleTotalsRow(totalsRow, [11, 12, 13, 14, 15, 16, 17]);

    // Auto-filtro
    sheet.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: 4, column: COLUMNAS_ANEXO_1.length },
    };
  }

  /**
   * Genera la hoja del Anexo 2 (Ventas a Consumidor Final - Factura)
   */
  private async generateAnexo2Sheet(
    workbook: ExcelJS.Workbook,
    data: LibroIvaAnexo2RowDto[],
    resumen: any,
    queryDto: QueryLibroIvaDto,
  ): Promise<void> {
    const sheet = workbook.addWorksheet('Anexo 2 - Facturas');

    // Título
    this.addTitle(sheet, NOMBRES_ANEXOS.ANEXO_2, queryDto);

    // Configurar columnas
    sheet.columns = COLUMNAS_ANEXO_2.map((col) => ({
      key: col.key,
      width: col.width,
    }));

    // Encabezados
    const headerRow = sheet.addRow(COLUMNAS_ANEXO_2.map((col) => col.header));
    this.styleHeaderRow(headerRow);

    // Datos
    data.forEach((row) => {
      const dataRow = sheet.addRow([
        row.fila,
        row.fechaEmision,
        row.claseDocumento,
        row.tipoDocumento,
        row.numeroResolucion,
        row.serieDel,
        row.serieAl,
        row.numeroDocumentoDel,
        row.numeroDocumentoAl,
        row.numeroMaquina,
        row.ventasExentas,
        row.ventasNoSujetas,
        row.ventasGravadas,
        row.exportacionesCa,
        row.exportacionesFueraCa,
        row.exportacionesServicios,
        row.ventasZonasFrancas,
        row.totalVentas,
        row.numeroAnexo,
      ]);
      this.styleDataRow(dataRow, [11, 12, 13, 14, 15, 16, 17, 18]); // Columnas numéricas
    });

    // Fila de totales
    const totalsRow = sheet.addRow([
      'TOTALES',
      '', '', '', '', '', '', '', '', '',
      resumen.totales.ventasExentas,
      resumen.totales.ventasNoSujetas,
      resumen.totales.ventasGravadas,
      '0.00',
      '0.00',
      '0.00',
      '0.00',
      resumen.totales.totalVentas,
      '',
    ]);
    this.styleTotalsRow(totalsRow, [11, 12, 13, 14, 15, 16, 17, 18]);

    // Auto-filtro
    sheet.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: 4, column: COLUMNAS_ANEXO_2.length },
    };
  }

  /**
   * Genera la hoja del Anexo 5 (Ventas a Sujeto Excluido - FSE)
   */
  private async generateAnexo5Sheet(
    workbook: ExcelJS.Workbook,
    data: LibroIvaAnexo5RowDto[],
    resumen: any,
    queryDto: QueryLibroIvaDto,
  ): Promise<void> {
    const sheet = workbook.addWorksheet('Anexo 5 - FSE');

    // Título
    this.addTitle(sheet, NOMBRES_ANEXOS.ANEXO_5, queryDto);

    // Configurar columnas
    sheet.columns = COLUMNAS_ANEXO_5.map((col) => ({
      key: col.key,
      width: col.width,
    }));

    // Encabezados
    const headerRow = sheet.addRow(COLUMNAS_ANEXO_5.map((col) => col.header));
    this.styleHeaderRow(headerRow);

    // Datos
    data.forEach((row) => {
      const dataRow = sheet.addRow([
        row.fila,
        row.fechaEmision,
        row.claseDocumento,
        row.tipoDocumento,
        row.numeroResolucion,
        row.numeroSerie,
        row.numeroDocumento,
        row.controlInterno,
        row.duiNit,
        row.nombreSujeto,
        row.montoCompra,
        row.ivaRetenido,
        row.total,
        row.numeroAnexo,
      ]);
      this.styleDataRow(dataRow, [11, 12, 13]); // Columnas numéricas
    });

    // Fila de totales
    const totalsRow = sheet.addRow([
      'TOTALES',
      '', '', '', '', '', '', '', '', '',
      resumen.totales.montoCompra,
      resumen.totales.ivaRetenido,
      resumen.totales.total,
      '',
    ]);
    this.styleTotalsRow(totalsRow, [11, 12, 13]);

    // Auto-filtro
    sheet.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: 4, column: COLUMNAS_ANEXO_5.length },
    };
  }

  // ==================== MÉTODOS DE ESTILO ====================

  /**
   * Agrega título y período al inicio de la hoja
   */
  private addTitle(sheet: ExcelJS.Worksheet, title: string, queryDto: QueryLibroIvaDto): void {
    // Fila 1: Título
    sheet.mergeCells('A1:J1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = title;
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center' };

    // Fila 2: Período
    sheet.mergeCells('A2:J2');
    const periodCell = sheet.getCell('A2');
    periodCell.value = `Período: ${queryDto.fecha_inicio} al ${queryDto.fecha_fin}`;
    periodCell.font = { size: 11 };
    periodCell.alignment = { horizontal: 'center' };

    // Fila 3: Vacía
    sheet.addRow([]);
  }

  /**
   * Aplica estilos a la fila de encabezados
   */
  private styleHeaderRow(row: ExcelJS.Row): void {
    row.eachCell((cell) => {
      cell.font = EXCEL_HEADER_STYLE.font;
      cell.fill = EXCEL_HEADER_STYLE.fill as ExcelJS.FillPattern;
      cell.alignment = EXCEL_HEADER_STYLE.alignment;
      cell.border = EXCEL_HEADER_STYLE.border;
    });
    row.height = 25;
  }

  /**
   * Aplica estilos a filas de datos
   */
  private styleDataRow(row: ExcelJS.Row, numericColumns: number[]): void {
    row.eachCell((cell, colNumber) => {
      if (numericColumns.includes(colNumber)) {
        cell.alignment = EXCEL_NUMBER_STYLE.alignment;
        cell.numFmt = EXCEL_NUMBER_STYLE.numFmt;
      }
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
  }

  /**
   * Aplica estilos a la fila de totales
   */
  private styleTotalsRow(row: ExcelJS.Row, numericColumns: number[]): void {
    row.eachCell((cell, colNumber) => {
      cell.font = EXCEL_TOTALS_STYLE.font;
      cell.fill = EXCEL_TOTALS_STYLE.fill as ExcelJS.FillPattern;
      cell.border = EXCEL_TOTALS_STYLE.border;

      if (numericColumns.includes(colNumber)) {
        cell.alignment = EXCEL_NUMBER_STYLE.alignment;
        cell.numFmt = EXCEL_NUMBER_STYLE.numFmt;
      }
    });
    row.height = 22;
  }

  /**
   * Obtiene el nombre del archivo según el tipo de libro
   */
  getFilename(tipoLibro: TipoLibroIva, fechaInicio: string, fechaFin: string): string {
    const nombres: Record<TipoLibroIva, string> = {
      [TipoLibroIva.ANEXO_1]: 'Libro_IVA_Anexo1_CCF',
      [TipoLibroIva.ANEXO_2]: 'Libro_IVA_Anexo2_Facturas',
      [TipoLibroIva.ANEXO_5]: 'Libro_IVA_Anexo5_FSE',
    };

    const fechaFormateada = `${fechaInicio}_${fechaFin}`.replace(/-/g, '');
    return `${nombres[tipoLibro]}_${fechaFormateada}.xlsx`;
  }
}
