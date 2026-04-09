import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { TicketsService } from './tickets.service';

const ESTADO_LABELS: Record<string, string> = {
  ABIERTO: 'Abierto',
  EN_DIAGNOSTICO: 'En diagnóstico',
  ESCALADO: 'Escalado',
  CERRADO: 'Cerrado',
  CANCELADO: 'Cancelado',
};

const ESTADO_CLASS: Record<string, string> = {
  ABIERTO: 'estado-abierto',
  EN_DIAGNOSTICO: 'estado-diagnostico',
  ESCALADO: 'estado-escalado',
  CERRADO: 'estado-cerrado',
  CANCELADO: 'estado-cancelado',
};

const SEVERIDAD_LABELS: Record<string, string> = {
  BAJA: 'Baja',
  MEDIA: 'Media',
  ALTA: 'Alta',
  CRITICA: 'Crítica',
};

const SEVERIDAD_CLASS: Record<string, string> = {
  BAJA: 'sev-baja',
  MEDIA: 'sev-media',
  ALTA: 'sev-alta',
  CRITICA: 'sev-critica',
};

const CANAL_LABELS: Record<string, string> = {
  TELEFONO: 'Teléfono',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Email',
  APP: 'Aplicación',
  WEB: 'Web',
};

@Injectable()
export class TicketsPdfService implements OnModuleInit {
  private readonly logger = new Logger(TicketsPdfService.name);
  private readonly API_REPORT: string;

  constructor(
    private readonly ticketsService: TicketsService,
    private readonly prisma: PrismaService,
  ) {
    this.API_REPORT = process.env.API_REPORT || '';
  }

  onModuleInit() {
    if (!this.API_REPORT) {
      this.logger.warn(
        'API_REPORT no configurado. La generación de PDFs de Tickets no estará disponible.',
      );
    }
  }

  async generarPdf(id: number): Promise<Buffer> {
    this.checkApiReport();
    this.logger.log(`Generando PDF de ticket #${id}`);

    const ticket: any = await this.ticketsService.findOne(id);
    if (!ticket) {
      throw new NotFoundException(`Ticket con ID ${id} no encontrado`);
    }

    // Traer contrato activo del cliente (para tomar la dirección atada al contrato)
    const contrato = await this.prisma.atcContrato.findFirst({
      where: {
        id_cliente: ticket.id_cliente,
        estado: {
          in: [
            'INSTALADO_ACTIVO',
            'SUSPENDIDO',
            'SUSPENDIDO_TEMPORAL',
            'VELOCIDAD_REDUCIDA',
            'EN_MORA',
            'PENDIENTE_INSTALACION',
          ] as any,
        },
      },
      include: {
        plan: { select: { nombre: true, velocidad_bajada: true, velocidad_subida: true } },
        direccionServicio: {
          include: {
            colonias: { select: { nombre: true } },
            municipio: { select: { nombre: true } },
            departamento: { select: { nombre: true } },
          },
        },
      },
      orderBy: { fecha_creacion: 'desc' },
    });

    const empresa = await this.prisma.generalData.findFirst();
    const templateHtml = this.loadTemplate('ticket.html');

    const logoPath = path.join(process.cwd(), 'templates', 'logo-newtel.png');
    const logoBase64 = fs.existsSync(logoPath)
      ? fs.readFileSync(logoPath).toString('base64')
      : '';

    // Preferir dirección del contrato (la atada al contrato); fallback a la del ticket
    const direccionFuente: any =
      contrato?.direccionServicio || ticket.direccion_servicio || null;

    const direccion = direccionFuente
      ? {
          calle: direccionFuente.direccion || '-',
          colonia: direccionFuente.colonias?.nombre || '',
          municipio: direccionFuente.municipio?.nombre || '',
          departamento: direccionFuente.departamento?.nombre || '',
          codigo_postal: direccionFuente.codigo_postal || '',
        }
      : null;

    const ordenes = (ticket.ordenes || []).map((o: any) => ({
      codigo: o.codigo,
      tipo: o.tipo,
      estado: o.estado,
      tecnico: o.tecnico_asignado
        ? `${o.tecnico_asignado.nombres} ${o.tecnico_asignado.apellidos}`
        : '-',
    }));

    const templateData = {
      logoBase64,
      empresa: {
        nombre: empresa?.razon || empresa?.nombre_comercial || 'EMPRESA',
        nit: empresa?.nit || '',
        nrc: empresa?.nrc || '',
      },
      fechaGeneracion: this.formatDate(new Date()),
      ticket: {
        id_ticket: ticket.id_ticket,
        fecha_apertura: this.formatDate(ticket.fecha_apertura),
        fecha_cierre: ticket.fecha_cierre ? this.formatDate(ticket.fecha_cierre) : null,
        canal: CANAL_LABELS[ticket.canal] || ticket.canal,
        severidad: SEVERIDAD_LABELS[ticket.severidad] || ticket.severidad,
        severidadClass: SEVERIDAD_CLASS[ticket.severidad] || '',
        estado: ESTADO_LABELS[ticket.estado] || ticket.estado,
        estadoClass: ESTADO_CLASS[ticket.estado] || '',
        descripcion_problema: ticket.descripcion_problema || '-',
        diagnostico_inicial: ticket.diagnostico_inicial || '',
        diagnostico_catalogo: ticket.diagnostico_catalogo?.nombre || '',
        pruebas_remotas: ticket.pruebas_remotas || '',
        requiere_visita: ticket.requiere_visita ? 'Sí' : 'No',
        observaciones_cierre: ticket.observaciones_cierre || '',
      },
      cliente: {
        titular: ticket.cliente?.titular || '-',
        dui: ticket.cliente?.dui || '-',
        correo: ticket.cliente?.correo_electronico || '-',
        telefono1: ticket.cliente?.telefono1 || '-',
        telefono2: ticket.cliente?.telefono2 || '',
      },
      contrato: contrato
        ? {
            codigo: contrato.codigo,
            plan: contrato.plan?.nombre || '-',
            velocidad:
              contrato.plan?.velocidad_bajada && contrato.plan?.velocidad_subida
                ? `${contrato.plan.velocidad_bajada}/${contrato.plan.velocidad_subida} Mbps`
                : '',
            estado: String(contrato.estado),
          }
        : null,
      direccion,
      ordenes,
      tieneOrdenes: ordenes.length > 0,
    };

    return this.renderPdf(templateHtml, templateData, `Ticket_${id}.pdf`);
  }

  private checkApiReport(): void {
    if (!this.API_REPORT) {
      throw new BadRequestException(
        'La generación de PDFs no está configurada. Contacte al administrador.',
      );
    }
  }

  private loadTemplate(filename: string): string {
    const templatePath = path.join(
      process.cwd(),
      'templates/atencion-cliente',
      filename,
    );
    try {
      if (!fs.existsSync(templatePath)) {
        throw new BadRequestException(
          `Plantilla no encontrada: ${filename}. Verifique que existe en templates/atencion-cliente/`,
        );
      }
      return fs.readFileSync(templatePath, 'utf-8');
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`Error leyendo template ${filename}:`, error.message);
      throw new BadRequestException('Error al cargar la plantilla del reporte.');
    }
  }

  private async renderPdf(
    templateHtml: string,
    data: any,
    reportName: string,
  ): Promise<Buffer> {
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
      throw new BadRequestException(
        'Error al generar el PDF. Por favor intente nuevamente.',
      );
    }
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
