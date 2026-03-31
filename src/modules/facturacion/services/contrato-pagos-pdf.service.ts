import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { ContratoPagosService } from './contrato-pagos.service';
import { PrismaService } from 'src/modules/prisma/prisma.service';

const ESTADO_LABELS: Record<string, { label: string; badgeClass: string }> = {
  PENDIENTE: { label: 'Pendiente', badgeClass: 'badge-pendiente' },
  PARCIAL: { label: 'Parcial', badgeClass: 'badge-parcial' },
  PAGADO: { label: 'Pagado', badgeClass: 'badge-pagado' },
  VENCIDA: { label: 'Vencida', badgeClass: 'badge-vencida' },
  EN_ACUERDO: { label: 'En Acuerdo', badgeClass: 'badge-acuerdo' },
};

const ESTADO_CONTRATO_CLASS: Record<string, string> = {
  ACTIVO: '',
  SUSPENDIDO: 'suspendido',
  INACTIVO: 'inactivo',
};

@Injectable()
export class ContratoPagosPdfService implements OnModuleInit {
  private readonly logger = new Logger(ContratoPagosPdfService.name);
  private readonly API_REPORT: string;

  constructor(
    private readonly contratoPagosService: ContratoPagosService,
    private readonly prisma: PrismaService,
  ) {
    this.API_REPORT = process.env.API_REPORT || '';
  }

  onModuleInit() {
    if (!this.API_REPORT) {
      this.logger.warn('API_REPORT no configurado. La generación de PDFs de estado de cuenta no estará disponible.');
    }
  }

  async generateEstadoCuentaPdf(idContrato: number): Promise<{ buffer: Buffer; filename: string }> {
    if (!this.API_REPORT) {
      throw new BadRequestException(
        'La generación de PDFs no está configurada. Contacte al administrador.',
      );
    }

    this.logger.log(`Generando PDF estado de cuenta para contrato #${idContrato}`);

    const [estadoCuenta, facturas, empresa] = await Promise.all([
      this.contratoPagosService.obtenerEstadoCuentaContrato(idContrato),
      this.contratoPagosService.obtenerFacturasContrato(idContrato),
      this.prisma.generalData.findFirst(),
    ]);

    const templatePath = path.join(process.cwd(), 'templates/facturacion', 'estado-cuenta-contrato.html');

    let templateHtml: string;
    try {
      if (!fs.existsSync(templatePath)) {
        throw new BadRequestException(
          'Plantilla no encontrada: estado-cuenta-contrato.html. Verifique que existe en templates/facturacion/',
        );
      }
      templateHtml = fs.readFileSync(templatePath, 'utf-8');
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error('Error leyendo template estado-cuenta-contrato.html:', error.message);
      throw new BadRequestException('Error al cargar la plantilla del reporte.');
    }

    const templateData = this.prepareTemplateData(estadoCuenta, facturas, empresa);

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
              // marginTop: '1cm',
              // marginBottom: '1cm',
              // marginLeft: '1.5cm',
              // marginRight: '1.5cm',
            },
          },
          data: templateData,
          options: {
            reportName: this.getFilename(estadoCuenta.contrato.codigo),
          },
        },
        {
          responseType: 'arraybuffer',
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000,
        },
      );

      this.logger.log(`PDF estado de cuenta generado - Contrato: ${estadoCuenta.contrato.codigo}, Facturas: ${facturas.length}`);
      return {
        buffer: Buffer.from(response.data),
        filename: this.getFilename(estadoCuenta.contrato.codigo),
      };
    } catch (error) {
      this.logger.error('Error generando PDF estado de cuenta contrato:', {
        message: error.message,
        status: error.response?.status,
      });
      throw new BadRequestException('Error al generar el PDF. Por favor intente nuevamente.');
    }
  }

  private prepareTemplateData(data: any, facturas: any[], empresa: any): Record<string, any> {
    const ahora = new Date();

    let totalFacturado = 0;
    let totalDescuento = 0;
    let totalMora = 0;
    let totalAbonado = 0;
    let totalSaldo = 0;
    let facturasPendientes = 0;

    const facturasFormateadas = facturas.map((f: any) => {
      const total = parseFloat(f.total?.toString() || '0');
      const descuento = parseFloat(f.descuento?.toString() || '0');
      const mora = parseFloat(f.montoMora?.toString() || '0');
      const abonado = parseFloat(f.montoAbonado?.toString() || '0');
      const saldo = parseFloat(f.saldoPendiente?.toString() || '0');
      const esVencida = f.estadoPago === 'VENCIDA' ||
        (f.fechaVencimiento && new Date(f.fechaVencimiento) < ahora && f.estadoPago !== 'PAGADO');

      totalFacturado += total;
      totalDescuento += descuento;
      totalMora += mora;
      totalAbonado += abonado;
      totalSaldo += saldo;

      if (f.estadoPago !== 'PAGADO') {
        facturasPendientes++;
      }

      const estadoInfo = ESTADO_LABELS[f.estadoPago] || { label: f.estadoPago, badgeClass: 'badge-pendiente' };

      return {
        cuota: f.esInstalacion ? 'Inst.' : `${f.numeroCuota}`,
        periodo: f.periodoInicio && f.periodoFin
          ? `${this.formatDate(f.periodoInicio)} - ${this.formatDate(f.periodoFin)}`
          : '-',
        fechaVencimiento: this.formatDate(f.fechaVencimiento),
        total: total.toFixed(2),
        descuento: descuento.toFixed(2),
        descuentoNum: descuento,
        mora: mora.toFixed(2),
        moraNum: mora,
        abonado: abonado.toFixed(2),
        saldo: saldo.toFixed(2),
        estadoPago: f.estadoPago,
        estadoLabel: estadoInfo.label,
        badgeClass: estadoInfo.badgeClass,
        esVencida,
        numeroFactura: f.numeroFactura || '-',
      };
    });

    const dirServicioParts = [
      data.contrato.direccionServicio,
      data.contrato.coloniaServicio,
      data.contrato.municipioServicio,
      data.contrato.departamentoServicio,
    ].filter(Boolean);

    const dirFacturacionParts = [
      data.cliente.direccionFacturacion,
      data.cliente.coloniaFacturacion,
      data.cliente.municipioFacturacion,
      data.cliente.departamentoFacturacion,
    ].filter(Boolean);

    return {
      empresa: {
        nombre: empresa?.razon || empresa?.nombre_comercial || 'EMPRESA',
        nit: empresa?.nit || '',
        nrc: empresa?.nrc || '',
      },
      cliente: {
        nombre: data.cliente.nombre || '',
        dui: data.cliente.dui || '',
        nit: data.cliente.nit || '',
        nrc: data.cliente.nrc || '',
        correo: data.cliente.correo || '',
        telefono1: data.cliente.telefono1 || '',
        direccionFacturacion: dirFacturacionParts.join(', ') || '',
      },
      contrato: {
        codigo: data.contrato.codigo || '',
        estado: data.contrato.estado || '',
        estadoClass: ESTADO_CONTRATO_CLASS[data.contrato.estado] || '',
        direccionServicio: dirServicioParts.join(', ') || '',
        fechaInicio: this.formatDate(data.contrato.fechaInicioContrato),
        fechaFin: this.formatDate(data.contrato.fechaFinContrato),
        mesesContrato: data.contrato.mesesContrato || null,
      },
      plan: {
        nombre: data.plan.nombre || '',
        precio: Number(data.plan.precio || 0).toFixed(2),
        velocidad: data.plan.velocidadBajada
          ? `${data.plan.velocidadBajada} / ${data.plan.velocidadSubida || '-'}`
          : '',
      },
      ciclo: {
        nombre: data.ciclo.nombre || '',
        diaCorte: data.ciclo.diaCorte || 0,
        diaVencimiento: data.ciclo.diaVencimiento || 0,
      },
      facturas: facturasFormateadas,
      totales: {
        totalFacturado: totalFacturado.toFixed(2),
        totalDescuento: totalDescuento.toFixed(2),
        totalMora: totalMora.toFixed(2),
        totalAbonado: totalAbonado.toFixed(2),
        saldoPendiente: totalSaldo.toFixed(2),
        facturasPendientes,
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
    if (isNaN(d.getTime())) return '-';
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  getFilename(codigoContrato: string): string {
    const safe = (codigoContrato || 'Contrato').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    return `Estado_Cuenta_${safe}.pdf`;
  }
}
