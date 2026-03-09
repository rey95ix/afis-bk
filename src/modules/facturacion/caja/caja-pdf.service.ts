import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { CajaService } from './caja.service';
import { PrismaService } from 'src/modules/prisma/prisma.service';

const METODO_BADGE: Record<string, string> = {
  EFECTIVO: 'badge-efectivo',
  CHEQUE: 'badge-cheque',
  TRANSFERENCIA: 'badge-transferencia',
  DEPOSITO: 'badge-deposito',
  TARJETA: 'badge-tarjeta',
  OTRO: 'badge-otro',
};

@Injectable()
export class CajaPdfService implements OnModuleInit {
  private readonly logger = new Logger(CajaPdfService.name);
  private readonly API_REPORT: string;

  constructor(
    private readonly cajaService: CajaService,
    private readonly prisma: PrismaService,
  ) {
    this.API_REPORT = process.env.API_REPORT || '';
  }

  onModuleInit() {
    if (!this.API_REPORT) {
      this.logger.warn('API_REPORT no configurado. La generación de PDFs de Caja no estará disponible.');
    }
  }

  async generarPdfCierreUsuario(id: number): Promise<Buffer> {
    this.checkApiReport();
    this.logger.log(`Generando PDF cierre usuario #${id}`);

    const data = await this.cajaService.obtenerCierreUsuario(id);
    const empresa = await this.prisma.generalData.findFirst();
    const templateHtml = this.loadTemplate('cierre-usuario.html');

    const templateData = {
      ...this.getEmpresaData(empresa),
      idCierreUsuario: data.idCierreUsuario,
      usuario: data.usuario,
      fechaHoraCierre: this.formatDate(data.fechaHora),
      estado: data.estado,
      estadoClass: data.estado === 'CERRADO' ? 'estado-cerrado' : 'estado-abierto',
      totalEfectivo: data.totalEfectivo.toFixed(2),
      totalCheque: data.totalCheque.toFixed(2),
      totalTransferencia: data.totalTransferencia.toFixed(2),
      totalDeposito: data.totalDeposito.toFixed(2),
      totalTarjeta: data.totalTarjeta.toFixed(2),
      totalOtro: data.totalOtro.toFixed(2),
      totalGeneral: data.totalGeneral.toFixed(2),
      cantidadMovimientos: data.movimientos.length,
      movimientos: data.movimientos.map((m: any) => ({
        fechaHora: this.formatDate(m.fechaHora),
        cliente: m.cliente,
        metodoPago: m.metodoPago,
        badgeClass: METODO_BADGE[m.metodoPago] || 'badge-otro',
        referencia: m.referencia || '-',
        monto: m.monto.toFixed(2),
      })),
    };

    return this.renderPdf(templateHtml, templateData, `Cierre_Usuario_${id}.pdf`);
  }

  async generarPdfCierreDiario(id: number): Promise<Buffer> {
    this.checkApiReport();
    this.logger.log(`Generando PDF cierre diario #${id}`);

    const data = await this.cajaService.obtenerCierreDiario(id);
    const empresa = await this.prisma.generalData.findFirst();
    const templateHtml = this.loadTemplate('cierre-diario.html');

    const templateData = {
      ...this.getEmpresaData(empresa),
      idCierreDiario: data.idCierreDiario,
      creadoPor: data.creadoPor,
      fechaHoraCierre: this.formatDate(data.fechaHora),
      estado: data.estado,
      estadoClass: data.estado === 'CERRADO' ? 'estado-cerrado' : 'estado-abierto',
      totalEfectivo: data.totalEfectivo.toFixed(2),
      totalCheque: data.totalCheque.toFixed(2),
      totalTransferencia: data.totalTransferencia.toFixed(2),
      totalDeposito: data.totalDeposito.toFixed(2),
      totalTarjeta: data.totalTarjeta.toFixed(2),
      totalOtro: data.totalOtro.toFixed(2),
      totalGeneral: data.totalGeneral.toFixed(2),
      cantidadMovimientos: data.movimientos.length,
      movimientos: data.movimientos.map((m: any) => ({
        fechaHora: this.formatDate(m.fechaHora),
        usuario: m.usuario,
        cliente: m.cliente,
        metodoPago: m.metodoPago,
        badgeClass: METODO_BADGE[m.metodoPago] || 'badge-otro',
        referencia: m.referencia || '-',
        monto: m.monto.toFixed(2),
      })),
    };

    return this.renderPdf(templateHtml, templateData, `Cierre_Diario_${id}.pdf`);
  }

  async generarPdfMovimientosPendientes(idUsuario: number, nombreUsuario: string): Promise<Buffer> {
    this.checkApiReport();
    this.logger.log(`Generando PDF movimientos pendientes usuario #${idUsuario}`);

    const data = await this.cajaService.obtenerMovimientosPendientes(idUsuario);
    const empresa = await this.prisma.generalData.findFirst();
    const templateHtml = this.loadTemplate('movimientos-pendientes.html');

    const templateData = {
      ...this.getEmpresaData(empresa),
      titulo: 'Movimientos Pendientes de Cierre',
      usuario: nombreUsuario,
      esDiario: false,
      totalEfectivo: data.totales.totalEfectivo.toFixed(2),
      totalCheque: data.totales.totalCheque.toFixed(2),
      totalTransferencia: data.totales.totalTransferencia.toFixed(2),
      totalDeposito: data.totales.totalDeposito.toFixed(2),
      totalTarjeta: data.totales.totalTarjeta.toFixed(2),
      totalOtro: data.totales.totalOtro.toFixed(2),
      totalGeneral: data.totales.totalGeneral.toFixed(2),
      cantidadMovimientos: data.movimientos.length,
      movimientos: data.movimientos.map((m: any) => ({
        fechaHora: this.formatDate(m.fechaHora),
        cliente: m.cliente,
        metodoPago: m.metodoPago,
        badgeClass: METODO_BADGE[m.metodoPago] || 'badge-otro',
        referencia: m.referencia || '-',
        monto: m.monto.toFixed(2),
      })),
    };

    return this.renderPdf(templateHtml, templateData, `Movimientos_Pendientes_${idUsuario}.pdf`);
  }

  async generarPdfMovimientosPendientesDiario(): Promise<Buffer> {
    this.checkApiReport();
    this.logger.log('Generando PDF movimientos pendientes diario');

    const data = await this.cajaService.obtenerMovimientosPendientesDiario();
    const empresa = await this.prisma.generalData.findFirst();
    const templateHtml = this.loadTemplate('movimientos-pendientes.html');

    const templateData = {
      ...this.getEmpresaData(empresa),
      titulo: 'Movimientos Pendientes de Cierre Diario',
      usuario: null,
      esDiario: true,
      totalEfectivo: data.totales.totalEfectivo.toFixed(2),
      totalCheque: data.totales.totalCheque.toFixed(2),
      totalTransferencia: data.totales.totalTransferencia.toFixed(2),
      totalDeposito: data.totales.totalDeposito.toFixed(2),
      totalTarjeta: data.totales.totalTarjeta.toFixed(2),
      totalOtro: data.totales.totalOtro.toFixed(2),
      totalGeneral: data.totales.totalGeneral.toFixed(2),
      cantidadMovimientos: data.movimientos.length,
      movimientos: data.movimientos.map((m: any) => ({
        fechaHora: this.formatDate(m.fechaHora),
        usuario: m.usuario,
        cliente: m.cliente,
        metodoPago: m.metodoPago,
        badgeClass: METODO_BADGE[m.metodoPago] || 'badge-otro',
        referencia: m.referencia || '-',
        monto: m.monto.toFixed(2),
      })),
    };

    return this.renderPdf(templateHtml, templateData, 'Movimientos_Pendientes_Diario.pdf');
  }

  private checkApiReport(): void {
    if (!this.API_REPORT) {
      throw new BadRequestException(
        'La generación de PDFs no está configurada. Contacte al administrador.',
      );
    }
  }

  private loadTemplate(filename: string): string {
    const templatePath = path.join(process.cwd(), 'templates/caja', filename);
    try {
      if (!fs.existsSync(templatePath)) {
        throw new BadRequestException(
          `Plantilla no encontrada: ${filename}. Verifique que existe en templates/caja/`,
        );
      }
      return fs.readFileSync(templatePath, 'utf-8');
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`Error leyendo template ${filename}:`, error.message);
      throw new BadRequestException('Error al cargar la plantilla del reporte.');
    }
  }

  private async renderPdf(templateHtml: string, data: any, reportName: string): Promise<Buffer> {
    try {
      const response = await axios.post(
        this.API_REPORT,
        {
          template: {
            content: templateHtml,
            engine: 'jsrender',
            recipe: 'chrome-pdf',
            chrome: {
              landscape: false,
              marginTop: '1cm',
              marginBottom: '1cm',
              marginLeft: '1.5cm',
              marginRight: '1.5cm',
            },
          },
          data,
          options: { reportName },
        },
        {
          responseType: 'arraybuffer',
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000,
        },
      );

      this.logger.log(`PDF generado: ${reportName}`);
      return Buffer.from(response.data);
    } catch (error) {
      this.logger.error('Error generando PDF:', {
        message: error.message,
        status: error.response?.status,
      });
      throw new BadRequestException('Error al generar el PDF. Por favor intente nuevamente.');
    }
  }

  private getEmpresaData(empresa: any): Record<string, any> {
    return {
      empresa: {
        nombre: empresa?.razon || empresa?.nombre_comercial || 'EMPRESA',
        nit: empresa?.nit || '',
        nrc: empresa?.nrc || '',
      },
      fechaGeneracion: new Date().toLocaleDateString('es-SV', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  }

  private formatDate(date: any): string {
    if (!date) return '-';
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }
}
