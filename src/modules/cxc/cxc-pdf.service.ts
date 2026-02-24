import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { CxcService } from './cxc.service';
import { PrismaService } from 'src/modules/prisma/prisma.service';

const ESTADO_LABELS: Record<string, { label: string; badgeClass: string }> = {
  PENDIENTE: { label: 'Pendiente', badgeClass: 'badge-pendiente' },
  PAGADA_PARCIAL: { label: 'Parcial', badgeClass: 'badge-parcial' },
  PAGADA_TOTAL: { label: 'Pagada', badgeClass: 'badge-pagada' },
  VENCIDA: { label: 'Vencida', badgeClass: 'badge-vencida' },
};

@Injectable()
export class CxcPdfService implements OnModuleInit {
  private readonly logger = new Logger(CxcPdfService.name);
  private readonly API_REPORT: string;

  constructor(
    private readonly cxcService: CxcService,
    private readonly prisma: PrismaService,
  ) {
    this.API_REPORT = process.env.API_REPORT || '';
  }

  onModuleInit() {
    if (!this.API_REPORT) {
      this.logger.warn('API_REPORT no configurado. La generación de PDFs de CxC no estará disponible.');
    }
  }

  /**
   * Genera PDF del estado de cuenta de un cliente
   */
  async generateEstadoCuentaPdf(id_cliente_directo: number): Promise<Buffer> {
    if (!this.API_REPORT) {
      throw new BadRequestException(
        'La generación de PDFs no está configurada. Contacte al administrador.',
      );
    }

    this.logger.log(`Generando PDF estado de cuenta para cliente #${id_cliente_directo}`);

    // Obtener datos del cliente y sus CxC
    const data = await this.cxcService.obtenerCxcPorCliente(id_cliente_directo);

    // Obtener datos de la empresa
    const empresa = await this.prisma.generalData.findFirst();

    // Cargar template HTML
    const templatePath = path.join(process.cwd(), 'templates/cxc', 'estado-cuenta-cliente.html');

    let templateHtml: string;
    try {
      if (!fs.existsSync(templatePath)) {
        throw new BadRequestException(
          'Plantilla no encontrada: estado-cuenta-cliente.html. Verifique que existe en templates/cxc/',
        );
      }
      templateHtml = fs.readFileSync(templatePath, 'utf-8');
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error('Error leyendo template estado-cuenta-cliente.html:', error.message);
      throw new BadRequestException('Error al cargar la plantilla del reporte.');
    }

    // Preparar datos para el template
    const templateData = this.prepareTemplateData(data, empresa);

    // Enviar a jsReport
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
          data: templateData,
          options: {
            reportName: this.getFilename(data.cliente.nombre),
          },
        },
        {
          responseType: 'arraybuffer',
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000,
        },
      );

      this.logger.log(`PDF estado de cuenta generado - Cliente: ${data.cliente.nombre}, CxC: ${data.cuentas.length}`);
      return Buffer.from(response.data);
    } catch (error) {
      this.logger.error('Error generando PDF estado de cuenta:', {
        message: error.message,
        status: error.response?.status,
      });
      throw new BadRequestException('Error al generar el PDF. Por favor intente nuevamente.');
    }
  }

  private prepareTemplateData(data: any, empresa: any): Record<string, any> {
    const ahora = new Date();

    // Calcular totales para el pie de tabla
    let totalMonto = 0;
    let totalSaldo = 0;
    let totalAbonado = 0;

    const cuentas = data.cuentas.map((c: any) => {
      const monto = parseFloat(c.monto_total?.toString() || '0');
      const saldo = parseFloat(c.saldo_pendiente?.toString() || '0');
      const abonado = parseFloat(c.total_abonado?.toString() || '0');
      const esVencida = c.estado === 'VENCIDA' || (c.fecha_vencimiento && new Date(c.fecha_vencimiento) < ahora && c.estado !== 'PAGADA_TOTAL');

      totalMonto += monto;
      totalSaldo += saldo;
      totalAbonado += abonado;

      const estadoInfo = ESTADO_LABELS[c.estado] || { label: c.estado, badgeClass: 'badge-pendiente' };

      return {
        numero_factura: c.facturaDirecta?.numero_factura || '-',
        monto_total: monto.toFixed(2),
        saldo_pendiente: saldo.toFixed(2),
        total_abonado: abonado.toFixed(2),
        fecha_emision: this.formatDate(c.fecha_emision),
        fecha_vencimiento: this.formatDate(c.fecha_vencimiento),
        estado: c.estado,
        estadoLabel: estadoInfo.label=="Parcial"?"PENDIENTE":estadoInfo.label,
        badgeClass: estadoInfo.badgeClass,
        esVencida,
      };
    });

    return {
      cliente: {
        nombre: data.cliente.nombre || '',
        nit: data.cliente.nit || '',
      },
      resumen: {
        total_deuda: parseFloat(data.resumen.total_deuda?.toString() || '0').toFixed(2),
        total_vencido: parseFloat(data.resumen.total_vencido?.toString() || '0').toFixed(2),
        total_al_dia: parseFloat(data.resumen.total_al_dia?.toString() || '0').toFixed(2),
        num_cxc_pendientes: data.resumen.num_cxc_pendientes || 0,
      },
      cuentas,
      totales: {
        monto_total: totalMonto.toFixed(2),
        saldo_pendiente: totalSaldo.toFixed(2),
        total_abonado: totalAbonado.toFixed(2),
      },
      empresa: {
        nombre: empresa?.razon || empresa?.nombre_comercial || 'EMPRESA',
        nit: empresa?.nit || '',
        nrc: empresa?.nrc || '',
        direccion: empresa?.direccion || '',
      },
      fechaGeneracion: ahora.toLocaleDateString('es-SV', {
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
    return `${day}/${month}/${year}`;
  }

  getFilename(nombreCliente: string): string {
    const safe = (nombreCliente || 'Cliente').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    return `Estado_Cuenta_${safe}.pdf`;
  }
}
