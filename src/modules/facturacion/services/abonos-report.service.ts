import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import axios from 'axios';
import { ContratoPagosService } from './contrato-pagos.service';
import { AbonosListadoDto } from '../dto/abonos-listado.dto';

const METODO_PAGO_LABELS: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  CHEQUE: 'Cheque',
  DEPOSITO: 'Depósito',
  TARJETA: 'Payway',
  PUNTOXPRESS: 'PuntoXpress',
  OTRO: 'Otro',
};

@Injectable()
export class AbonosReportService implements OnModuleInit {
  private readonly logger = new Logger(AbonosReportService.name);
  private readonly API_REPORT: string;

  constructor(private readonly contratoPagosService: ContratoPagosService) {
    this.API_REPORT = process.env.API_REPORT || '';
  }

  onModuleInit() {
    if (!this.API_REPORT) {
      this.logger.warn('API_REPORT no configurado. La generación de PDFs de abonos no estará disponible.');
    }
  }

  /**
   * Obtiene todos los abonos (sin paginación) aplicando los filtros
   */
  private async getAllAbonos(dto: AbonosListadoDto) {
    const allDto = { ...dto, page: 1, limit: 10000 };
    const result = await this.contratoPagosService.listarAbonos(allDto);
    return result;
  }

  // ==================== EXCEL ====================

  async generateExcel(dto: AbonosListadoDto): Promise<Buffer> {
    this.logger.log('Generando Excel de abonos');
    const result = await this.getAllAbonos(dto);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AFIS - Sistema ERP';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Historial de Abonos');

    // Título
    sheet.mergeCells('A1:H1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'Historial de Abonos';
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center' };

    // Período
    sheet.mergeCells('A2:H2');
    const periodCell = sheet.getCell('A2');
    const desde = dto.fechaDesde || 'Inicio';
    const hasta = dto.fechaHasta || 'Actual';
    periodCell.value = `Período: ${desde} al ${hasta}`;
    periodCell.font = { size: 11 };
    periodCell.alignment = { horizontal: 'center' };

    // Fila vacía
    sheet.addRow([]);

    // Columnas
    sheet.columns = [
      { key: 'fecha', width: 14 },
      { key: 'cliente', width: 30 },
      { key: 'contrato', width: 16 },
      { key: 'cuota', width: 22 },
      { key: 'metodo', width: 16 },
      { key: 'referencia', width: 18 },
      { key: 'monto', width: 14 },
      { key: 'usuario', width: 24 },
    ];

    // Encabezados
    const headers = ['Fecha', 'Cliente', 'Contrato', 'Cuota / Período', 'Método', 'Referencia', 'Monto', 'Usuario'];
    const headerRow = sheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B5E20' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
    headerRow.height = 25;

    // Datos
    const numericCols = [7]; // Monto
    result.data.forEach((row: any) => {
      const cuota = row.factura?.esInstalacion
        ? 'Instalación'
        : row.factura?.numeroCuota
          ? `Cuota ${row.factura.numeroCuota} - ${this.formatPeriodo(row.factura.periodoInicio, row.factura.periodoFin)}`
          : '-';

      const dataRow = sheet.addRow([
        this.formatDate(row.fechaPago),
        row.cliente || '-',
        row.contrato || '-',
        cuota,
        METODO_PAGO_LABELS[row.metodoPago] || row.metodoPago,
        row.referencia || '-',
        row.monto,
        row.usuario || '-',
      ]);

      dataRow.eachCell((cell, colNumber) => {
        if (numericCols.includes(colNumber)) {
          cell.numFmt = '#,##0.00';
          cell.alignment = { horizontal: 'right' };
        }
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    // Fila de totales
    const totalsRow = sheet.addRow([
      'TOTALES', '', '', '', '', '',
      result.resumen.totalGeneral,
      '',
    ]);
    totalsRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
      cell.border = {
        top: { style: 'double' },
        left: { style: 'thin' },
        bottom: { style: 'double' },
        right: { style: 'thin' },
      };
      if (numericCols.includes(colNumber)) {
        cell.numFmt = '#,##0.00';
        cell.alignment = { horizontal: 'right' };
      }
    });
    totalsRow.height = 22;

    // Resumen por método
    sheet.addRow([]);
    const resumenTitleRow = sheet.addRow(['Resumen por Método de Pago']);
    resumenTitleRow.getCell(1).font = { bold: true, size: 12 };

    const resumenHeaderRow = sheet.addRow(['Método', 'Cantidad', 'Total']);
    resumenHeaderRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B5E20' } };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    result.resumen.porMetodo.forEach((r: any) => {
      const row = sheet.addRow([
        METODO_PAGO_LABELS[r.metodoPago] || r.metodoPago,
        r.cantidad,
        r.total,
      ]);
      row.getCell(3).numFmt = '#,##0.00';
      row.getCell(3).alignment = { horizontal: 'right' };
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    // Auto-filtro en datos
    sheet.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: 4, column: 8 },
    };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ==================== PDF ====================

  async generatePdf(dto: AbonosListadoDto): Promise<Buffer> {
    if (!this.API_REPORT) {
      throw new BadRequestException(
        'La generación de PDFs no está configurada. Contacte al administrador.',
      );
    }

    this.logger.log('Generando PDF de abonos');
    const result = await this.getAllAbonos(dto);

    const templatePath = path.join(process.cwd(), 'templates/facturacion', 'reporte-abonos.html');

    let templateHtml: string;
    try {
      if (!fs.existsSync(templatePath)) {
        throw new BadRequestException(
          'Plantilla no encontrada: reporte-abonos.html. Verifique que existe en templates/facturacion/',
        );
      }
      templateHtml = fs.readFileSync(templatePath, 'utf-8');
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error('Error leyendo template reporte-abonos.html:', error.message);
      throw new BadRequestException('Error al cargar la plantilla del reporte.');
    }

    const templateData = {
      titulo: 'Historial de Abonos',
      periodo: {
        desde: dto.fechaDesde || 'Inicio',
        hasta: dto.fechaHasta || 'Actual',
      },
      abonos: result.data.map((a: any) => ({
        ...a,
        fechaPagoFmt: this.formatDate(a.fechaPago),
        montoFmt: Number(a.monto).toFixed(2),
        metodoPagoLabel: METODO_PAGO_LABELS[a.metodoPago] || a.metodoPago,
        cuota: a.factura?.esInstalacion
          ? 'Inst.'
          : a.factura?.numeroCuota
            ? `${a.factura.numeroCuota} - ${this.formatPeriodo(a.factura.periodoInicio, a.factura.periodoFin)}`
            : '-',
      })),
      resumen: result.resumen.porMetodo.map((r: any) => ({
        metodoPago: METODO_PAGO_LABELS[r.metodoPago] || r.metodoPago,
        cantidad: r.cantidad,
        total: Number(r.total).toFixed(2),
      })),
      totalGeneral: Number(result.resumen.totalGeneral).toFixed(2),
      totalAbonos: result.meta.total,
      fechaGeneracion: new Date().toLocaleDateString('es-SV', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    try {
      const response = await axios.post(
        this.API_REPORT,
        {
          template: {
            content: templateHtml,
            engine: 'jsrender',
            recipe: 'chrome-pdf',
            chrome: {
              landscape: true,
              marginTop: '1cm',
              marginBottom: '1cm',
              marginLeft: '1cm',
              marginRight: '1cm',
            },
          },
          data: templateData,
          options: {
            reportName: this.getFilename(dto),
          },
        },
        {
          responseType: 'arraybuffer',
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000,
        },
      );

      return Buffer.from(response.data);
    } catch (error) {
      this.logger.error('Error generando PDF de abonos:', {
        message: error.message,
        status: error.response?.status,
      });
      throw new BadRequestException('Error al generar el PDF. Por favor intente nuevamente.');
    }
  }

  getFilename(dto: AbonosListadoDto): string {
    const desde = (dto.fechaDesde || '').replace(/-/g, '');
    const hasta = (dto.fechaHasta || '').replace(/-/g, '');
    return `Reporte_Abonos_${desde}_${hasta}.pdf`;
  }

  getExcelFilename(dto: AbonosListadoDto): string {
    const desde = (dto.fechaDesde || '').replace(/-/g, '');
    const hasta = (dto.fechaHasta || '').replace(/-/g, '');
    return `Reporte_Abonos_${desde}_${hasta}.xlsx`;
  }

  private formatDate(date: any): string {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private formatPeriodo(inicio: string | null, fin: string | null): string {
    if (!inicio || !fin) return '-';
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const fInicio = new Date(inicio);
    const fFin = new Date(fin);
    return `${meses[fInicio.getMonth()]} ${fInicio.getFullYear()} - ${meses[fFin.getMonth()]} ${fFin.getFullYear()}`;
  }
}
