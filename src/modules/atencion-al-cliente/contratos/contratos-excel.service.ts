import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import {
  QueryReporteContratosDto,
  TipoReporteContrato,
} from './dto/query-reporte-contratos.dto';
import {
  COLUMNAS_REPORTE_VENTAS,
  COLUMNAS_REPORTE_RENOVACIONES,
  EXCEL_HEADER_STYLE,
  EXCEL_NUMBER_STYLE,
} from './constants/contrato-reporte.constants';

@Injectable()
export class ContratosExcelService {
  private readonly logger = new Logger(ContratosExcelService.name);

  constructor(private readonly prisma: PrismaService) {}

  async generateExcel(queryDto: QueryReporteContratosDto): Promise<Buffer> {
    const { tipo_reporte } = queryDto;

    this.logger.log(`Generando Excel reporte ${tipo_reporte}`);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AFIS - Sistema ERP';
    workbook.created = new Date();

    if (tipo_reporte === TipoReporteContrato.VENTAS) {
      const data = await this.getVentasData(queryDto);
      this.generateVentasSheet(workbook, data, queryDto);
    } else {
      const data = await this.getRenovacionesData(queryDto);
      this.generateRenovacionesSheet(workbook, data, queryDto);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private async getVentasData(queryDto: QueryReporteContratosDto) {
    const where: any = {
      id_contrato_anterior: null,
      fecha_venta: {
        gte: new Date(queryDto.fecha_inicio),
        lte: new Date(`${queryDto.fecha_fin}T23:59:59.999`),
      },
    };

    if (queryDto.estado) {
      where.estado = queryDto.estado;
    }

    return this.prisma.atcContrato.findMany({
      where,
      orderBy: { fecha_venta: 'desc' },
      include: {
        cliente: { select: { titular: true } },
        plan: true,
        direccionServicio: { include: { colonias: true } },
        usuarioCreador: { select: { nombres: true, apellidos: true } },
      },
    });
  }

  private async getRenovacionesData(queryDto: QueryReporteContratosDto) {
    const where: any = {
      id_contrato_anterior: { not: null },
      fecha_venta: {
        gte: new Date(queryDto.fecha_inicio),
        lte: new Date(`${queryDto.fecha_fin}T23:59:59.999`),
      },
    };

    if (queryDto.estado) {
      where.estado = queryDto.estado;
    }

    return this.prisma.atcContrato.findMany({
      where,
      orderBy: { fecha_venta: 'desc' },
      include: {
        cliente: { select: { titular: true } },
        plan: true,
        direccionServicio: { include: { colonias: true } },
        usuarioCreador: { select: { nombres: true, apellidos: true } },
        contratoAnterior: {
          select: {
            fecha_fin_contrato: true,
            plan: { select: { nombre: true, precio: true } },
          },
        },
      },
    });
  }

  private generateVentasSheet(
    workbook: ExcelJS.Workbook,
    data: any[],
    queryDto: QueryReporteContratosDto,
  ): void {
    const sheet = workbook.addWorksheet('Reporte de Ventas');

    sheet.columns = COLUMNAS_REPORTE_VENTAS.map((col) => ({
      key: col.key,
      width: col.width,
    }));

    this.addTitle(sheet, 'Newtel', queryDto, COLUMNAS_REPORTE_VENTAS.length);

    const headerRow = sheet.addRow(
      COLUMNAS_REPORTE_VENTAS.map((col) => col.header),
    );
    this.styleHeaderRow(headerRow);

    data.forEach((contrato) => {
      const dataRow = sheet.addRow([
        contrato.estado,
        contrato.cliente?.titular || '',
        contrato.direccionServicio?.colonias?.nombre || '',
        contrato.plan?.nombre || '',
        contrato.meses_contrato,
        Number(contrato.plan?.precio) || 0,
        Number(contrato.plan?.velocidad_bajada) || 0,
        Number(contrato.plan?.velocidad_subida) || 0,
        this.formatDate(contrato.fecha_venta),
        this.formatDate(contrato.fecha_instalacion),
        `${contrato.usuarioCreador?.nombres || ''} ${contrato.usuarioCreador?.apellidos || ''}`.trim(),
        contrato.estado === 'INSTALADO_ACTIVO' ? 'Si' : 'No',
      ]);
      this.styleDataRow(dataRow, [6, 7, 8]);
    });

    sheet.autoFilter = {
      from: { row: 3, column: 1 },
      to: { row: 3, column: COLUMNAS_REPORTE_VENTAS.length },
    };
  }

  private generateRenovacionesSheet(
    workbook: ExcelJS.Workbook,
    data: any[],
    queryDto: QueryReporteContratosDto,
  ): void {
    const sheet = workbook.addWorksheet('Reporte de Renovaciones');

    sheet.columns = COLUMNAS_REPORTE_RENOVACIONES.map((col) => ({
      key: col.key,
      width: col.width,
    }));

    this.addTitle(
      sheet,
      'Newtel',
      queryDto,
      COLUMNAS_REPORTE_RENOVACIONES.length,
    );

    const headerRow = sheet.addRow(
      COLUMNAS_REPORTE_RENOVACIONES.map((col) => col.header),
    );
    this.styleHeaderRow(headerRow);

    data.forEach((contrato) => {
      const dataRow = sheet.addRow([
        contrato.estado,
        contrato.cliente?.titular || '',
        contrato.direccionServicio?.colonias?.nombre || '',
        contrato.contratoAnterior?.plan?.nombre || '',
        Number(contrato.contratoAnterior?.plan?.precio) || 0,
        contrato.plan?.nombre || '',
        Number(contrato.plan?.precio) || 0,
        this.formatDate(contrato.contratoAnterior?.fecha_fin_contrato),
        this.formatDate(contrato.fecha_venta),
        `${contrato.usuarioCreador?.nombres || ''} ${contrato.usuarioCreador?.apellidos || ''}`.trim(),
        contrato.estado === 'INSTALADO_ACTIVO' ? 'Si' : 'No',
      ]);
      this.styleDataRow(dataRow, [5, 7]);
    });

    sheet.autoFilter = {
      from: { row: 3, column: 1 },
      to: { row: 3, column: COLUMNAS_REPORTE_RENOVACIONES.length },
    };
  }

  // ==================== HELPERS ====================

  private addTitle(
    sheet: ExcelJS.Worksheet,
    title: string,
    queryDto: QueryReporteContratosDto,
    colCount: number,
  ): void {
    const lastCol = String.fromCharCode(64 + colCount);

    sheet.mergeCells(`A1:${lastCol}1`);
    const titleCell = sheet.getCell('A1');
    titleCell.value = title;
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center' };

    sheet.mergeCells(`A2:${lastCol}2`);
    const periodCell = sheet.getCell('A2');
    periodCell.value = `Período: ${queryDto.fecha_inicio} al ${queryDto.fecha_fin}`;
    periodCell.font = { size: 11 };
    periodCell.alignment = { horizontal: 'center' };
  }

  private styleHeaderRow(row: ExcelJS.Row): void {
    row.eachCell((cell) => {
      cell.font = EXCEL_HEADER_STYLE.font;
      cell.fill = EXCEL_HEADER_STYLE.fill as ExcelJS.FillPattern;
      cell.alignment = EXCEL_HEADER_STYLE.alignment;
      cell.border = EXCEL_HEADER_STYLE.border;
    });
    row.height = 25;
  }

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

  private formatDate(date: Date | string | null | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  getFilename(
    tipo: TipoReporteContrato,
    fechaInicio: string,
    fechaFin: string,
  ): string {
    const name =
      tipo === TipoReporteContrato.VENTAS
        ? 'Reporte_Ventas'
        : 'Reporte_Renovaciones';
    const fechaFormateada = `${fechaInicio}_${fechaFin}`.replace(/-/g, '');
    return `${name}_${fechaFormateada}.xlsx`;
  }
}
