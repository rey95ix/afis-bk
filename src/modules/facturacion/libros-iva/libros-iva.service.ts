import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  QueryLibroIvaDto,
  TipoLibroIva,
  LIBRO_A_TIPO_DTE,
  LibroIvaAnexo1RowDto,
  LibroIvaAnexo1ResponseDto,
  TotalesAnexo1,
  LibroIvaAnexo2RowDto,
  LibroIvaAnexo2ResponseDto,
  TotalesAnexo2,
  LibroIvaAnexo5RowDto,
  LibroIvaAnexo5ResponseDto,
  TotalesAnexo5,
} from './dto';
import {
  CLASE_DOCUMENTO_DTE,
  TIPOS_OPERACION,
  TIPOS_INGRESO,
} from './constants/libro-iva.constants';

/**
 * Límite máximo de registros para exportación
 * Evita problemas de memoria en períodos con muchas facturas
 */
const MAX_EXPORT_RECORDS = 50000;

/**
 * Interfaz para resumen consolidado de libros
 */
export interface ResumenLibroIva {
  tipoLibro: TipoLibroIva;
  periodo: {
    fechaInicio: string;
    fechaFin: string;
  };
  totalDocumentos: number;
  totales: TotalesAnexo1 | TotalesAnexo2 | TotalesAnexo5;
}

/**
 * Servicio para generación de Libros de IVA
 * Implementa los anexos requeridos por el Ministerio de Hacienda de El Salvador
 */
@Injectable()
export class LibrosIvaService {
  private readonly logger = new Logger(LibrosIvaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene los datos del libro de IVA según el tipo solicitado
   */
  async getLibroIva(
    queryDto: QueryLibroIvaDto,
  ): Promise<LibroIvaAnexo1ResponseDto | LibroIvaAnexo2ResponseDto | LibroIvaAnexo5ResponseDto> {
    const { tipo_libro } = queryDto;

    switch (tipo_libro) {
      case TipoLibroIva.ANEXO_1:
        return this.getLibroAnexo1(queryDto);
      case TipoLibroIva.ANEXO_2:
        return this.getLibroAnexo2(queryDto);
      case TipoLibroIva.ANEXO_5:
        return this.getLibroAnexo5(queryDto);
      default:
        throw new BadRequestException(`Tipo de libro no soportado: ${tipo_libro}`);
    }
  }

  /**
   * Obtiene el resumen consolidado del libro de IVA
   */
  async getResumen(queryDto: QueryLibroIvaDto): Promise<ResumenLibroIva> {
    const { tipo_libro, fecha_inicio, fecha_fin } = queryDto;
    const tipoDte = LIBRO_A_TIPO_DTE[tipo_libro];
    const where = this.buildWhereClause(queryDto, tipoDte);

    const totalDocumentos = await this.prisma.facturaDirecta.count({ where });

    let totales: TotalesAnexo1 | TotalesAnexo2 | TotalesAnexo5;

    switch (tipo_libro) {
      case TipoLibroIva.ANEXO_1:
        totales = await this.calcularTotalesAnexo1(where);
        break;
      case TipoLibroIva.ANEXO_2:
        totales = await this.calcularTotalesAnexo2(where);
        break;
      case TipoLibroIva.ANEXO_5:
        totales = await this.calcularTotalesAnexo5(where);
        break;
      default:
        // Default a Anexo 1 para evitar errores de compilación
        totales = await this.calcularTotalesAnexo1(where);
    }

    return {
      tipoLibro: tipo_libro,
      periodo: {
        fechaInicio: fecha_inicio,
        fechaFin: fecha_fin,
      },
      totalDocumentos,
      totales,
    };
  }

  /**
   * Obtiene todos los registros sin paginación (para exportación)
   * Limitado a MAX_EXPORT_RECORDS para evitar problemas de memoria
   */
  async getAllRecords(queryDto: QueryLibroIvaDto): Promise<any[]> {
    const { tipo_libro } = queryDto;
    const tipoDte = LIBRO_A_TIPO_DTE[tipo_libro];
    const where = this.buildWhereClause(queryDto, tipoDte);

    const facturas = await this.prisma.facturaDirecta.findMany({
      where,
      take: MAX_EXPORT_RECORDS,
      include: {
        tipoFactura: true,
        sucursal: true,
      },
      orderBy: { fecha_creacion: 'asc' },
    });

    if (facturas.length === MAX_EXPORT_RECORDS) {
      this.logger.warn(
        `Exportación alcanzó el límite de ${MAX_EXPORT_RECORDS} registros. ` +
        `Algunos registros pueden no estar incluidos.`,
      );
    }

    switch (tipo_libro) {
      case TipoLibroIva.ANEXO_1:
        return this.transformToAnexo1Rows(facturas);
      case TipoLibroIva.ANEXO_2:
        return this.transformToAnexo2Rows(facturas);
      case TipoLibroIva.ANEXO_5:
        return this.transformToAnexo5Rows(facturas);
      default:
        return [];
    }
  }

  // ==================== ANEXO 1 - Ventas a Contribuyentes (CCF) ====================

  /**
   * Obtiene el libro Anexo 1 con paginación
   */
  private async getLibroAnexo1(queryDto: QueryLibroIvaDto): Promise<LibroIvaAnexo1ResponseDto> {
    const { page = 1, limit = 50 } = queryDto;
    const skip = (page - 1) * limit;
    const tipoDte = LIBRO_A_TIPO_DTE[TipoLibroIva.ANEXO_1];
    const where = this.buildWhereClause(queryDto, tipoDte);

    const [facturas, total] = await Promise.all([
      this.prisma.facturaDirecta.findMany({
        where,
        skip,
        take: limit,
        include: {
          tipoFactura: true,
          sucursal: true,
        },
        orderBy: { fecha_creacion: 'asc' },
      }),
      this.prisma.facturaDirecta.count({ where }),
    ]);

    const data = this.transformToAnexo1Rows(facturas, skip);
    const totales = await this.calcularTotalesAnexo1(where);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      totales,
    };
  }

  /**
   * Transforma facturas a filas del Anexo 1
   */
  private transformToAnexo1Rows(facturas: any[], startIndex = 0): LibroIvaAnexo1RowDto[] {
    return facturas.map((factura, index) => {
      const tipoOperacion = this.calcularTipoOperacion(factura);

      return {
        fila: startIndex + index + 1,
        fechaEmision: this.formatDateDDMMYYYY(factura.fecha_creacion),
        claseDocumento: CLASE_DOCUMENTO_DTE,
        tipoDocumento: factura.tipoFactura?.codigo || '03',
        numeroResolucion: factura.numero_control || '',
        numeroSerie: factura.sello_recepcion || '',
        numeroDocumento: this.formatCodigoGeneracion(factura.codigo_generacion),
        controlInterno: '', // Vacío para DTEs
        nitNrc: this.sanitizeIdentificador(factura.cliente_nit || factura.cliente_nrc) || '',
        nombreCliente: (factura.cliente_nombre || '').toUpperCase(),
        ventasExentas: this.formatMonto(factura.totalExenta),
        ventasNoSujetas: this.formatMonto(factura.totalNoSuj),
        ventasGravadas: this.formatMonto(factura.totalGravada),
        debitoFiscal: this.formatMonto(factura.iva),
        ventasTerceros: '0.00',
        debitoTerceros: '0.00',
        totalVentas: this.formatMonto(factura.total),
        duiCliente: '', // Vacío para CCF
        tipoOperacion: tipoOperacion.toString(),
        tipoIngreso: TIPOS_INGRESO.SERVICIOS.toString(), // Default: servicios
        numeroAnexo: '1',
      };
    });
  }

  /**
   * Calcula totales del Anexo 1
   */
  private async calcularTotalesAnexo1(where: Prisma.facturaDirectaWhereInput): Promise<TotalesAnexo1> {
    const result = await this.prisma.facturaDirecta.aggregate({
      where,
      _sum: {
        totalExenta: true,
        totalNoSuj: true,
        totalGravada: true,
        iva: true,
        total: true,
      },
    });

    return {
      ventasExentas: this.formatMonto(result._sum.totalExenta),
      ventasNoSujetas: this.formatMonto(result._sum.totalNoSuj),
      ventasGravadas: this.formatMonto(result._sum.totalGravada),
      debitoFiscal: this.formatMonto(result._sum.iva),
      totalVentas: this.formatMonto(result._sum.total),
    };
  }

  // ==================== ANEXO 2 - Ventas a Consumidor Final (Factura) ====================

  /**
   * Obtiene el libro Anexo 2 con paginación
   */
  private async getLibroAnexo2(queryDto: QueryLibroIvaDto): Promise<LibroIvaAnexo2ResponseDto> {
    const { page = 1, limit = 50 } = queryDto;
    const skip = (page - 1) * limit;
    const tipoDte = LIBRO_A_TIPO_DTE[TipoLibroIva.ANEXO_2];
    const where = this.buildWhereClause(queryDto, tipoDte);

    const [facturas, total] = await Promise.all([
      this.prisma.facturaDirecta.findMany({
        where,
        skip,
        take: limit,
        include: {
          tipoFactura: true,
          sucursal: true,
        },
        orderBy: { fecha_creacion: 'asc' },
      }),
      this.prisma.facturaDirecta.count({ where }),
    ]);

    const data = this.transformToAnexo2Rows(facturas, skip);
    const totales = await this.calcularTotalesAnexo2(where);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      totales,
    };
  }

  /**
   * Transforma facturas a filas del Anexo 2
   */
  private transformToAnexo2Rows(facturas: any[], startIndex = 0): LibroIvaAnexo2RowDto[] {
    return facturas.map((factura, index) => ({
      fila: startIndex + index + 1,
      fechaEmision: this.formatDateDDMMYYYY(factura.fecha_creacion),
      claseDocumento: CLASE_DOCUMENTO_DTE,
      tipoDocumento: factura.tipoFactura?.codigo || '01',
      numeroResolucion: factura.numero_control || '',
      serieDel: factura.sello_recepcion || '',
      serieAl: factura.sello_recepcion || '', // Mismo valor para DTE individual
      numeroDocumentoDel: this.formatCodigoGeneracion(factura.codigo_generacion),
      numeroDocumentoAl: this.formatCodigoGeneracion(factura.codigo_generacion), // Mismo valor
      numeroMaquina: '', // Vacío para DTEs
      ventasExentas: this.formatMonto(factura.totalExenta),
      ventasNoSujetas: this.formatMonto(factura.totalNoSuj),
      ventasGravadas: this.formatMonto(factura.totalGravada),
      exportacionesCa: '0.00',
      exportacionesFueraCa: '0.00',
      exportacionesServicios: '0.00',
      ventasZonasFrancas: '0.00',
      totalVentas: this.formatMonto(factura.total),
      numeroAnexo: '2',
    }));
  }

  /**
   * Calcula totales del Anexo 2
   */
  private async calcularTotalesAnexo2(where: Prisma.facturaDirectaWhereInput): Promise<TotalesAnexo2> {
    const result = await this.prisma.facturaDirecta.aggregate({
      where,
      _sum: {
        totalExenta: true,
        totalNoSuj: true,
        totalGravada: true,
        total: true,
      },
    });

    return {
      ventasExentas: this.formatMonto(result._sum.totalExenta),
      ventasNoSujetas: this.formatMonto(result._sum.totalNoSuj),
      ventasGravadas: this.formatMonto(result._sum.totalGravada),
      totalVentas: this.formatMonto(result._sum.total),
    };
  }

  // ==================== ANEXO 5 - Ventas a Sujeto Excluido (FSE) ====================

  /**
   * Obtiene el libro Anexo 5 con paginación
   */
  private async getLibroAnexo5(queryDto: QueryLibroIvaDto): Promise<LibroIvaAnexo5ResponseDto> {
    const { page = 1, limit = 50 } = queryDto;
    const skip = (page - 1) * limit;
    const tipoDte = LIBRO_A_TIPO_DTE[TipoLibroIva.ANEXO_5];
    const where = this.buildWhereClause(queryDto, tipoDte);

    const [facturas, total] = await Promise.all([
      this.prisma.facturaDirecta.findMany({
        where,
        skip,
        take: limit,
        include: {
          tipoFactura: true,
          sucursal: true,
        },
        orderBy: { fecha_creacion: 'asc' },
      }),
      this.prisma.facturaDirecta.count({ where }),
    ]);

    const data = this.transformToAnexo5Rows(facturas, skip);
    const totales = await this.calcularTotalesAnexo5(where);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      totales,
    };
  }

  /**
   * Transforma facturas a filas del Anexo 5
   */
  private transformToAnexo5Rows(facturas: any[], startIndex = 0): LibroIvaAnexo5RowDto[] {
    return facturas.map((factura, index) => ({
      fila: startIndex + index + 1,
      fechaEmision: this.formatDateDDMMYYYY(factura.fecha_creacion),
      claseDocumento: CLASE_DOCUMENTO_DTE,
      tipoDocumento: factura.tipoFactura?.codigo || '14',
      numeroResolucion: factura.numero_control || '',
      numeroSerie: factura.sello_recepcion || '',
      numeroDocumento: this.formatCodigoGeneracion(factura.codigo_generacion),
      controlInterno: '', // Vacío para DTEs
      duiNit: this.sanitizeIdentificador(factura.cliente_nit) || '',
      nombreSujeto: (factura.cliente_nombre || '').toUpperCase(),
      montoCompra: this.formatMonto(factura.totalGravada),
      ivaRetenido: this.formatMonto(factura.iva_retenido),
      total: this.formatMonto(factura.total),
      numeroAnexo: '5',
    }));
  }

  /**
   * Calcula totales del Anexo 5
   */
  private async calcularTotalesAnexo5(where: Prisma.facturaDirectaWhereInput): Promise<TotalesAnexo5> {
    const result = await this.prisma.facturaDirecta.aggregate({
      where,
      _sum: {
        totalGravada: true,
        iva_retenido: true,
        total: true,
      },
    });

    return {
      montoCompra: this.formatMonto(result._sum.totalGravada),
      ivaRetenido: this.formatMonto(result._sum.iva_retenido),
      total: this.formatMonto(result._sum.total),
    };
  }

  // ==================== MÉTODOS AUXILIARES ====================

  /**
   * Construye la cláusula WHERE para las consultas
   */
  private buildWhereClause(queryDto: QueryLibroIvaDto, tipoDte: string): Prisma.facturaDirectaWhereInput {
    const { fecha_inicio, fecha_fin, id_sucursal, solo_procesados = true } = queryDto;

    const where: Prisma.facturaDirectaWhereInput = {
      tipoFactura: { codigo: tipoDte },
      fecha_creacion: {
        gte: new Date(fecha_inicio),
        lte: new Date(fecha_fin + 'T23:59:59'),
      },
      estado: 'ACTIVO', // Excluir anulados
    };

    if (solo_procesados) {
      where.estado_dte = 'PROCESADO';
    }

    if (id_sucursal) {
      where.id_sucursal = id_sucursal;
    }

    return where;
  }

  /**
   * Formatea fecha a DD/MM/AAAA
   */
  private formatDateDDMMYYYY(date: Date): string {
    if (!date) return '';
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Formatea monto a string con 2 decimales
   */
  private formatMonto(value: any): string {
    if (value === null || value === undefined) return '0.00';
    const num = typeof value === 'object' && value.toNumber ? value.toNumber() : Number(value);
    if (isNaN(num)) return '0.00';
    return num.toFixed(2);
  }

  /**
   * Formatea código de generación (elimina guiones)
   */
  private formatCodigoGeneracion(codigo: string | null): string {
    if (!codigo) return '';
    return codigo.replace(/-/g, '');
  }

  /**
   * Sanitiza identificadores (elimina guiones y espacios)
   */
  private sanitizeIdentificador(value: string | null): string {
    if (!value) return '';
    return value.replace(/[-\s]/g, '');
  }

  /**
   * Calcula el tipo de operación según los montos de la factura
   */
  private calcularTipoOperacion(factura: any): number {
    const gravadas = Number(factura.totalGravada) > 0;
    const exentas = Number(factura.totalExenta) > 0;
    const noSujetas = Number(factura.totalNoSuj) > 0;

    if (gravadas && (exentas || noSujetas)) return TIPOS_OPERACION.MIXTAS;
    if (gravadas) return TIPOS_OPERACION.GRAVADAS;
    if (exentas) return TIPOS_OPERACION.EXENTAS;
    if (noSujetas) return TIPOS_OPERACION.NO_SUJETAS;
    return TIPOS_OPERACION.GRAVADAS; // Default
  }
}
