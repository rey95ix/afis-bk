import { Injectable } from '@nestjs/common';
import {
  IDteBuilder,
  BuildDteParams,
  BuildDteResult,
} from './dte-builder.interface';
import {
  TipoDte,
  DteFacturaExportacion,
  DteIdentificacion,
  DteEmisor,
  DteReceptorFEX,
  DteItemFEX,
  DteResumenFEX,
} from '../../interfaces';
import { numeroALetras, redondearMonto, DECIMALES_ITEM } from './numero-letras.util';

/**
 * Parámetros adicionales para FEX
 */
export interface FexParams extends BuildDteParams {
  // Datos de exportación
  codPais?: string;       // Código país destino (CAT-020)
  nombrePais?: string;
  flete?: number;
  seguro?: number;
  codIncoterms?: string;  // Código Incoterms (CAT-025)
  descIncoterms?: string;
  codExportacion?: number; // 1=Nacional, 2=Centroamérica, 3=Fuera CA
  recinto?: string;       // Recinto fiscal
  regimen?: string;       // Régimen
  tipoPersona?: number;   // 1=Natural, 2=Jurídica
}

/**
 * Builder para Factura de Exportación (tipo 11)
 *
 * Características específicas de FEX:
 * - Operaciones de exportación (ventas fuera del país)
 * - NO aplica IVA (operaciones exentas por exportación)
 * - Requiere datos del país destino
 * - Puede incluir flete, seguro, Incoterms
 * - Código de exportación según destino
 */
@Injectable()
export class FexBuilderService implements IDteBuilder {
  private readonly TIPO_DTE: TipoDte = '11';
  private readonly VERSION = 1;

  getTipoDte(): TipoDte {
    return this.TIPO_DTE;
  }

  getVersion(): number {
    return this.VERSION;
  }

  build(params: BuildDteParams): BuildDteResult {
    const fexParams = params as FexParams;

    const identificacion = this.buildIdentificacion(params);
    const emisor = this.buildEmisor(params.emisor);
    const receptor = this.buildReceptor(params.receptor, fexParams);
    const { cuerpoDocumento, totalesItems } = this.buildCuerpoDocumento(params.items);
    const resumen = this.buildResumen(fexParams, totalesItems);

    const documento: DteFacturaExportacion = {
      identificacion,
      emisor,
      receptor,
      otrosDocumentos: null,
      ventaTercero: null,
      cuerpoDocumento,
      resumen,
      apendice: null,
    };

    return {
      documento,
      tipoDte: this.TIPO_DTE,
      totales: {
        totalNoSuj: totalesItems.totalNoSuj,
        totalExenta: totalesItems.totalExenta,
        totalGravada: totalesItems.totalGravada,
        totalIva: 0, // FEX no tiene IVA
        totalPagar: resumen.totalPagar,
      },
    };
  }

  private buildIdentificacion(params: BuildDteParams): DteIdentificacion {
    const now = new Date();

    return {
      version: params.version,
      ambiente: params.ambiente,
      tipoDte: this.TIPO_DTE,
      numeroControl: params.numeroControl,
      codigoGeneracion: params.codigoGeneracion,
      tipoModelo: (params.tipoModelo || 1) as 1 | 2,
      tipoOperacion: (params.tipoOperacion || 1) as 1 | 2,
      tipoContingencia: params.tipoContingencia || null,
      motivoContin: params.motivoContin || null,
      fecEmi: this.formatDate(now),
      horEmi: this.formatTime(now),
      tipoMoneda: 'USD',
    };
  }

  private buildEmisor(emisor: BuildDteParams['emisor']): DteEmisor {
    return {
      nit: emisor.nit,
      nrc: emisor.nrc,
      nombre: emisor.nombre,
      codActividad: emisor.codActividad,
      descActividad: emisor.descActividad,
      nombreComercial: emisor.nombreComercial,
      tipoEstablecimiento: emisor.tipoEstablecimiento,
      direccion: {
        departamento: emisor.departamento,
        municipio: emisor.municipio,
        complemento: emisor.complemento,
      },
      telefono: emisor.telefono,
      codPuntoVentaMH: emisor.codPuntoVentaMH,
      codPuntoVenta: emisor.codPuntoVenta,
      codEstableMH: emisor.codEstableMH,
      codEstable: emisor.codEstable,
      correo: emisor.correo,
    };
  }

  private buildReceptor(receptor: BuildDteParams['receptor'], params: FexParams): DteReceptorFEX {
    return {
      tipoDocumento: receptor.tipoDocumento || null,
      numDocumento: receptor.numDocumento || null,
      nombre: receptor.nombre,
      descActividad: receptor.descActividad || null,
      codPais: params.codPais || '9303', // Default: USA
      nombrePais: params.nombrePais || 'ESTADOS UNIDOS DE AMERICA',
      complemento: receptor.complemento || 'Sin dirección registrada',
      tipoPersona: params.tipoPersona || null,
      telefono: receptor.telefono || null,
      correo: receptor.correo || null,
    };
  }

  private buildCuerpoDocumento(items: BuildDteParams['items']): {
    cuerpoDocumento: DteItemFEX[];
    totalesItems: {
      totalNoSuj: number;
      totalExenta: number;
      totalGravada: number;
      totalDescuento: number;
    };
  } {
    let totalNoSuj = 0;
    let totalExenta = 0;
    let totalGravada = 0;
    let totalDescuento = 0;

    const cuerpoDocumento: DteItemFEX[] = items.map((item, index) => {
      // 4 decimales para items
      const subtotal = redondearMonto(item.cantidad * item.precioUnitario, DECIMALES_ITEM);
      const descuento = redondearMonto(item.descuento || 0, DECIMALES_ITEM);
      const montoNeto = redondearMonto(subtotal - descuento, DECIMALES_ITEM);

      // En exportación, todo es exento de IVA
      let ventaNoSuj = 0;
      let ventaExenta = 0;
      let ventaGravada = 0;

      if (item.esNoSujeto) {
        ventaNoSuj = montoNeto;
        totalNoSuj += montoNeto;
      } else {
        // En FEX, por defecto todo es exento
        ventaExenta = montoNeto;
        totalExenta += montoNeto;
      }

      totalDescuento += descuento;

      return {
        numItem: index + 1,
        tipoItem: item.tipoItem as 1 | 2 | 3 | 4,
        numeroDocumento: null,
        codigo: item.codigo,
        codTributo: null,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        uniMedida: item.uniMedida,
        precioUni: redondearMonto(item.precioUnitario, DECIMALES_ITEM),
        montoDescu: redondearMonto(descuento, DECIMALES_ITEM),
        ventaNoSuj: redondearMonto(ventaNoSuj, DECIMALES_ITEM),
        ventaExenta: redondearMonto(ventaExenta, DECIMALES_ITEM),
        ventaGravada: redondearMonto(ventaGravada, DECIMALES_ITEM),
        tributos: null, // Sin tributos en exportación
        psv: 0,
        noGravado: 0,
        ivaItem: 0, // Sin IVA en exportación
      };
    });

    return {
      cuerpoDocumento,
      totalesItems: {
        totalNoSuj: redondearMonto(totalNoSuj),
        totalExenta: redondearMonto(totalExenta),
        totalGravada: redondearMonto(totalGravada),
        totalDescuento: redondearMonto(totalDescuento),
      },
    };
  }

  private buildResumen(
    params: FexParams,
    totales: {
      totalNoSuj: number;
      totalExenta: number;
      totalGravada: number;
      totalDescuento: number;
    },
  ): DteResumenFEX {
    const subTotalVentas = redondearMonto(
      totales.totalNoSuj + totales.totalExenta + totales.totalGravada,
    );

    const flete = redondearMonto(params.flete || 0);
    const seguro = redondearMonto(params.seguro || 0);

    const montoTotalOperacion = redondearMonto(
      subTotalVentas - totales.totalDescuento + flete + seguro,
    );
    const totalPagar = montoTotalOperacion;

    const pagos = params.pagos?.map((p) => ({
      codigo: p.codigo,
      montoPago: redondearMonto(p.monto),
      referencia: p.referencia,
      plazo: p.plazo,
      periodo: p.periodo,
    })) || null;

    return {
      totalNoSuj: totales.totalNoSuj,
      totalExenta: totales.totalExenta,
      totalGravada: totales.totalGravada,
      subTotalVentas,
      descuNoSuj: 0,
      descuExenta: 0,
      descuGravada: 0,
      porcentajeDescuento: 0,
      totalDescu: totales.totalDescuento,
      totalCompra: null,
      porcentComision: null,
      comision: null,
      flete,
      seguro,
      descIncoterms: params.descIncoterms || null,
      codIncoterms: params.codIncoterms || null,
      observaciones: params.observaciones || null,
      montoTotalOperacion,
      totalPagar,
      totalLetras: numeroALetras(totalPagar),
      condicionOperacion: (params.condicionOperacion || 1) as 1 | 2 | 3,
      pagos,
      codExportacion: params.codExportacion || 3, // Default: Fuera de Centroamérica
      recinto: params.recinto || null,
      regimen: params.regimen || null,
      numPagoElectronico: params.numPagoElectronico || null,
    };
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private formatTime(date: Date): string {
    return date.toTimeString().split(' ')[0];
  }
}
