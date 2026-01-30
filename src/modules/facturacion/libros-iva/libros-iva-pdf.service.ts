import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { LibrosIvaService, ResumenLibroIva } from './libros-iva.service';
import { QueryLibroIvaDto, TipoLibroIva } from './dto';
import { NOMBRES_ANEXOS } from './constants/libro-iva.constants';
import { PrismaService } from 'src/modules/prisma/prisma.service';

/**
 * Servicio para generación de PDFs de Libros de IVA
 * Usa jsReport para renderizado
 */
@Injectable()
export class LibrosIvaPdfService implements OnModuleInit {
  private readonly logger = new Logger(LibrosIvaPdfService.name);
  private readonly API_REPORT: string;

  constructor(
    private readonly librosIvaService: LibrosIvaService,
    private readonly prisma: PrismaService,
  ) {
    this.API_REPORT = process.env.API_REPORT || '';
  }

  onModuleInit() {
    if (!this.API_REPORT) {
      this.logger.warn('API_REPORT no configurado. La generación de PDFs no estará disponible.');
    }
  }

  /**
   * Genera el PDF del libro de IVA según el tipo
   */
  async generatePdf(queryDto: QueryLibroIvaDto): Promise<Buffer> {
    const { tipo_libro } = queryDto;

    // Validar configuración
    if (!this.API_REPORT) {
      throw new BadRequestException(
        'La generación de PDFs no está configurada. Contacte al administrador.',
      );
    }

    this.logger.log(`Generando PDF para ${tipo_libro}`);

    // Obtener todos los registros
    const records = await this.librosIvaService.getAllRecords(queryDto);
    const resumen = await this.librosIvaService.getResumen(queryDto);

    // Obtener datos de la empresa
    const empresa = await this.prisma.generalData.findFirst();

    // Cargar template HTML con manejo de errores
    const templateFile = this.getTemplateFile(tipo_libro);
    const templatePath = path.join(process.cwd(), 'templates/libros-iva', templateFile);

    let templateHtml: string;
    try {
      if (!fs.existsSync(templatePath)) {
        throw new BadRequestException(
          `Plantilla no encontrada: ${templateFile}. Verifique que existe en templates/libros-iva/`,
        );
      }
      templateHtml = fs.readFileSync(templatePath, 'utf-8');
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error leyendo template ${templateFile}:`, error.message);
      throw new BadRequestException('Error al cargar la plantilla del reporte.');
    }

    // Preparar datos para el template
    const templateData = this.prepareTemplateData(tipo_libro, records, resumen, empresa, queryDto);

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
              landscape: true, // Horizontal para tablas anchas
              marginTop: '1cm',
              marginBottom: '1cm',
              marginLeft: '0.5cm',
              marginRight: '0.5cm',
            },
          },
          data: templateData,
          options: {
            reportName: this.getFilename(tipo_libro, queryDto.fecha_inicio, queryDto.fecha_fin),
          },
        },
        {
          responseType: 'arraybuffer',
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000, // 60 segundos para libros grandes
        },
      );

      this.logger.log(`PDF generado - Tipo: ${tipo_libro}, Registros: ${records.length}`);
      return Buffer.from(response.data);
    } catch (error) {
      // Evitar exponer información sensible del servicio externo
      this.logger.error(`Error generando PDF [${tipo_libro}]:`, {
        message: error.message,
        status: error.response?.status,
      });
      throw new BadRequestException('Error al generar el PDF. Por favor intente nuevamente.');
    }
  }

  /**
   * Obtiene el nombre del archivo de template según el tipo de libro
   */
  private getTemplateFile(tipoLibro: TipoLibroIva): string {
    const templates: Record<TipoLibroIva, string> = {
      [TipoLibroIva.ANEXO_1]: 'libro-iva-anexo1.html',
      [TipoLibroIva.ANEXO_2]: 'libro-iva-anexo2.html',
      [TipoLibroIva.ANEXO_5]: 'libro-iva-anexo5.html',
    };
    return templates[tipoLibro];
  }

  /**
   * Prepara los datos para el template
   */
  private prepareTemplateData(
    tipoLibro: TipoLibroIva,
    records: any[],
    resumen: ResumenLibroIva,
    empresa: any,
    queryDto: QueryLibroIvaDto,
  ): Record<string, any> {
    return {
      // Información del libro
      titulo: NOMBRES_ANEXOS[tipoLibro],
      tipoLibro,
      numeroAnexo: tipoLibro.replace('ANEXO_', ''),

      // Período
      fechaInicio: this.formatDateLong(queryDto.fecha_inicio),
      fechaFin: this.formatDateLong(queryDto.fecha_fin),
      periodoCorto: `${queryDto.fecha_inicio} al ${queryDto.fecha_fin}`,

      // Empresa emisora
      empresa: {
        nombre: empresa?.razon || empresa?.nombre_comercial || 'EMPRESA',
        nit: empresa?.nit || '',
        nrc: empresa?.nrc || '',
        direccion: empresa?.direccion || '',
        telefono: empresa?.contactos || '',
      },

      // Datos
      registros: records,
      totalRegistros: records.length,

      // Totales
      totales: resumen.totales,

      // Metadatos
      fechaGeneracion: new Date().toLocaleDateString('es-SV', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),

      // Flags para condicionales en template
      esAnexo1: tipoLibro === TipoLibroIva.ANEXO_1,
      esAnexo2: tipoLibro === TipoLibroIva.ANEXO_2,
      esAnexo5: tipoLibro === TipoLibroIva.ANEXO_5,
    };
  }

  /**
   * Formatea fecha en formato largo
   */
  private formatDateLong(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('es-SV', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /**
   * Obtiene el nombre del archivo PDF
   */
  getFilename(tipoLibro: TipoLibroIva, fechaInicio: string, fechaFin: string): string {
    const nombres: Record<TipoLibroIva, string> = {
      [TipoLibroIva.ANEXO_1]: 'Libro_IVA_Anexo1_CCF',
      [TipoLibroIva.ANEXO_2]: 'Libro_IVA_Anexo2_Facturas',
      [TipoLibroIva.ANEXO_5]: 'Libro_IVA_Anexo5_FSE',
    };

    const fechaFormateada = `${fechaInicio}_${fechaFin}`.replace(/-/g, '');
    return `${nombres[tipoLibro]}_${fechaFormateada}.pdf`;
  }
}
