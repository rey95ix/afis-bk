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
import { OrdenesTrabajoService } from './ordenes-trabajo.service';

const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE_ASIGNACION: 'Pendiente de asignación',
  ASIGNADA: 'Asignada',
  AGENDADA: 'Agendada',
  EN_RUTA: 'En ruta',
  EN_PROGRESO: 'En progreso',
  EN_ESPERA_CLIENTE: 'En espera del cliente',
  REPROGRAMADA: 'Reprogramada',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
};

const ESTADO_CLASS: Record<string, string> = {
  PENDIENTE_ASIGNACION: 'estado-pendiente',
  ASIGNADA: 'estado-asignada',
  AGENDADA: 'estado-agendada',
  EN_RUTA: 'estado-enruta',
  EN_PROGRESO: 'estado-progreso',
  EN_ESPERA_CLIENTE: 'estado-espera',
  REPROGRAMADA: 'estado-reprogramada',
  COMPLETADA: 'estado-completada',
  CANCELADA: 'estado-cancelada',
};

const TIPO_LABELS: Record<string, string> = {
  INCIDENCIA: 'Incidencia',
  INSTALACION: 'Instalación',
  RENOVACION: 'Renovación',
  MANTENIMIENTO: 'Mantenimiento',
  REUBICACION: 'Reubicación',
  RETIRO: 'Retiro',
  MEJORA: 'Mejora',
};

const RESULTADO_LABELS: Record<string, string> = {
  RESUELTO: 'Resuelto',
  NO_RESUELTO: 'No resuelto',
  REQUIERE_SEGUNDA_VISITA: 'Requiere segunda visita',
  CLIENTE_AUSENTE: 'Cliente ausente',
  ACCESO_DENEGADO: 'Acceso denegado',
  FALLO_EQUIPO: 'Fallo de equipo',
};

const SEVERIDAD_LABELS: Record<string, string> = {
  BAJA: 'Baja',
  MEDIA: 'Media',
  ALTA: 'Alta',
  CRITICA: 'Crítica',
};

@Injectable()
export class OrdenesTrabajoPdfService implements OnModuleInit {
  private readonly logger = new Logger(OrdenesTrabajoPdfService.name);
  private readonly API_REPORT: string;

  constructor(
    private readonly ordenesTrabajoService: OrdenesTrabajoService,
    private readonly prisma: PrismaService,
  ) {
    this.API_REPORT = process.env.API_REPORT || '';
  }

  onModuleInit() {
    if (!this.API_REPORT) {
      this.logger.warn(
        'API_REPORT no configurado. La generación de PDFs de Órdenes de Trabajo no estará disponible.',
      );
    }
  }

  async generarPdf(id: number): Promise<Buffer> {
    this.checkApiReport();
    this.logger.log(`Generando PDF de orden de trabajo #${id}`);

    const orden: any = await this.ordenesTrabajoService.findOne(id);
    if (!orden) {
      throw new NotFoundException(`Orden de trabajo con ID ${id} no encontrada`);
    }

    const empresa = await this.prisma.generalData.findFirst();
    const templateHtml = this.loadTemplate('orden-trabajo.html');

    const logoPath = path.join(process.cwd(), 'templates', 'logo-newtel.png');
    const logoBase64 = fs.existsSync(logoPath)
      ? fs.readFileSync(logoPath).toString('base64')
      : '';

    const direccion = orden.direccion_servicio
      ? {
          calle: orden.direccion_servicio.direccion || '-',
          colonia: orden.direccion_servicio.colonias?.nombre || '',
          municipio: orden.direccion_servicio.municipio?.nombre || '',
          departamento: orden.direccion_servicio.departamento?.nombre || '',
          codigo_postal: orden.direccion_servicio.codigo_postal || '',
        }
      : null;

    const actividades = (orden.actividades || []).map((a: any) => ({
      descripcion: a.descripcion,
      valor_medido: a.valor_medido || '-',
      completado: a.completado ? 'Sí' : 'No',
      solucion: a.solucion?.nombre || '',
    }));

    const materiales = (orden.materiales || []).map((m: any) => ({
      sku: m.sku || '-',
      nombre: m.nombre || '-',
      cantidad: m.cantidad,
      serie: m.id_serie ? `#${m.id_serie}` : '-',
      costo_unitario: m.costo_unitario
        ? Number(m.costo_unitario).toFixed(2)
        : '-',
    }));

    const historial = (orden.historico_estados || []).map((h: any) => ({
      estado: ESTADO_LABELS[h.estado] || h.estado,
      estadoClass: ESTADO_CLASS[h.estado] || '',
      fecha: this.formatDate(h.fecha_cambio),
      comentario: h.comentario || '-',
      usuario: h.tecnico
        ? `${h.tecnico.nombres} ${h.tecnico.apellidos}`
        : '-',
    }));

    const agendaActiva = (orden.agendas || []).find((a: any) => a.activo);

    const templateData = {
      logoBase64,
      empresa: {
        nombre: empresa?.razon || empresa?.nombre_comercial || 'EMPRESA',
        nit: empresa?.nit || '',
        nrc: empresa?.nrc || '',
      },
      fechaGeneracion: this.formatDate(new Date()),
      orden: {
        codigo: orden.codigo,
        tipo: TIPO_LABELS[orden.tipo] || orden.tipo,
        estado: ESTADO_LABELS[orden.estado] || orden.estado,
        estadoClass: ESTADO_CLASS[orden.estado] || '',
        fecha_creacion: this.formatDate(orden.fecha_creacion),
        fecha_asignacion: orden.fecha_asignacion
          ? this.formatDate(orden.fecha_asignacion)
          : null,
        fecha_llegada: orden.fecha_llegada
          ? this.formatDate(orden.fecha_llegada)
          : null,
        fecha_inicio_trabajo: orden.fecha_inicio_trabajo
          ? this.formatDate(orden.fecha_inicio_trabajo)
          : null,
        fecha_fin_trabajo: orden.fecha_fin_trabajo
          ? this.formatDate(orden.fecha_fin_trabajo)
          : null,
        resultado: orden.resultado
          ? RESULTADO_LABELS[orden.resultado] || orden.resultado
          : null,
        motivo_cierre: orden.motivo_cierre?.nombre || null,
        observaciones_tecnico: orden.observaciones_tecnico || null,
        notas_cierre: orden.notas_cierre || null,
        calificacion_cliente: orden.calificacion_cliente || null,
      },
      cliente: {
        titular: orden.cliente?.titular || '-',
        dui: orden.cliente?.dui || '-',
        correo: orden.cliente?.correo_electronico || '-',
        telefono1: orden.cliente?.telefono1 || '-',
        telefono2: orden.cliente?.telefono2 || '',
      },
      contrato: orden.contrato
        ? {
            codigo: orden.contrato.codigo,
            plan: orden.contrato.plan?.nombre || '-',
            estado: String(orden.contrato.estado),
          }
        : null,
      direccion,
      tecnico: orden.tecnico_asignado
        ? {
            nombre: `${orden.tecnico_asignado.nombres} ${orden.tecnico_asignado.apellidos}`,
            dui: orden.tecnico_asignado.dui || '-',
          }
        : null,
      ticket: orden.ticket
        ? {
            id_ticket: orden.ticket.id_ticket,
            severidad:
              SEVERIDAD_LABELS[orden.ticket.severidad] ||
              orden.ticket.severidad,
            descripcion_problema: orden.ticket.descripcion_problema || '-',
          }
        : null,
      agenda: agendaActiva
        ? {
            inicio: this.formatDate(agendaActiva.inicio),
            fin: this.formatDate(agendaActiva.fin),
            tecnico: agendaActiva.tecnico
              ? `${agendaActiva.tecnico.nombres} ${agendaActiva.tecnico.apellidos}`
              : '-',
          }
        : null,
      actividades,
      tieneActividades: actividades.length > 0,
      materiales,
      tieneMateriales: materiales.length > 0,
      historial,
      tieneHistorial: historial.length > 0,
    };

    return this.renderPdf(
      templateHtml,
      templateData,
      `OT_${orden.codigo || id}.pdf`,
    );
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
