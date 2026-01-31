import { Injectable } from '@nestjs/common';
import {
  IDteBuilder,
  BuildDteParams,
  BuildDteResult,
} from './dte-builder.interface';
import {
  TipoDte,
  DteFacturaSujetoExcluido,
  DteIdentificacion,
  DteEmisorFSE,
  DteReceptorFSE,
  DteItemFSE,
  DteResumenFSE,
} from '../../interfaces';
import { numeroALetras, redondearMonto, DECIMALES_ITEM } from './numero-letras.util';

/**
 * Builder para Factura Sujeto Excluido (tipo 14)
 *
 * FSE es un documento de COMPRA (comprando A un sujeto excluido), NO de venta.
 *
 * Diferencias clave con FC/CCF:
 * - Emisor: NO incluye tipoEstablecimiento ni nombreComercial
 * - Sujeto Excluido: tipoDocumento usa códigos MH: '36'(NIT), '13'(DUI), '02'(Pasaporte), '37'(Carnet), '03'(Otro)
 * - Cuerpo: Usa campo 'compra' en lugar de ventaGravada/ventaExenta/ventaNoSuj/ivaItem
 * - Resumen: Usa 'descu' en lugar de 'totalDescu', NO incluye campos de venta
 */
@Injectable()
export class FseBuilderService implements IDteBuilder {
  private readonly TIPO_DTE: TipoDte = '14';
  private readonly VERSION = 1;

  getTipoDte(): TipoDte {
    return this.TIPO_DTE;
  }

  getVersion(): number {
    return this.VERSION;
  }

  build(params: BuildDteParams): BuildDteResult {
    if (!params.receptor.numDocumento) {
      throw new Error('Factura Sujeto Excluido requiere documento de identidad del receptor');
    }

    const identificacion = this.buildIdentificacion(params);
    const emisor = this.buildEmisor(params.emisor);
    const sujetoExcluido = this.buildSujetoExcluido(params.receptor);
    const { cuerpoDocumento, totalesItems } = this.buildCuerpoDocumento(params.items);
    const resumen = this.buildResumen(params, totalesItems);

    const documento: DteFacturaSujetoExcluido = {
      identificacion,
      sujetoExcluido,
      emisor,
      cuerpoDocumento,
      resumen,
      apendice: null,
    };

    return {
      documento,
      tipoDte: this.TIPO_DTE,
      totales: {
        totalNoSuj: 0,
        totalExenta: 0,
        totalGravada: 0,
        totalIva: 0,
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

  /**
   * Emisor para FSE - NO incluye tipoEstablecimiento ni nombreComercial
   */
  private buildEmisor(emisor: BuildDteParams['emisor']): DteEmisorFSE {
    return {
      nit: emisor.nit,
      nrc: emisor.nrc,
      nombre: emisor.nombre,
      codActividad: emisor.codActividad,
      descActividad: emisor.descActividad,
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

  /**
   * Sujeto Excluido - Mapea tipoDocumento a códigos MH válidos
   * Códigos válidos: '36'(NIT), '13'(DUI), '02'(Pasaporte), '37'(Carnet Residente), '03'(Otro)
   */
  private buildSujetoExcluido(receptor: BuildDteParams['receptor']): DteReceptorFSE {
    const tipoDocumentoMap: Record<string, string> = {
      '1': '13',   // Código antiguo -> DUI
      '13': '13',  // DUI
      '36': '36',  // NIT
      '02': '02',  // Pasaporte
      '37': '37',  // Carnet Residente
      '03': '03',  // Otro
    };

    const rawTipoDoc = receptor.tipoDocumento || '13';
    const tipoDocumento = tipoDocumentoMap[rawTipoDoc] || '13';

    return {
      tipoDocumento,
      numDocumento: receptor.numDocumento!,
      nombre: receptor.nombre,
      codActividad: receptor.codActividad || '10005',
      descActividad: receptor.descActividad || 'Otros',
      direccion: {
        departamento: receptor.departamento || '01',
        municipio: receptor.municipio || '01',
        complemento: receptor.complemento || 'Sin direccion registrada',
      },
      telefono: receptor.telefono || null,
      correo: receptor.correo || null,
    };
  }

  /**
   * Cuerpo documento FSE - Usa campo 'compra' en lugar de campos de venta
   */
  private buildCuerpoDocumento(items: BuildDteParams['items']): {
    cuerpoDocumento: DteItemFSE[];
    totalesItems: { totalCompra: number; totalDescuento: number };
  } {
    let totalCompra = 0;
    let totalDescuento = 0;

    const cuerpoDocumento: DteItemFSE[] = items.map((item, index) => {
      const subtotal = redondearMonto(item.cantidad * item.precioUnitario, DECIMALES_ITEM);
      const descuento = redondearMonto(item.descuento || 0, DECIMALES_ITEM);
      const compra = redondearMonto(subtotal - descuento, DECIMALES_ITEM);

      totalCompra += compra;
      totalDescuento += descuento;

      return {
        numItem: index + 1,
        tipoItem: item.tipoItem as 1 | 2 | 3 | 4,
        codigo: item.codigo,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        uniMedida: item.uniMedida,
        precioUni: redondearMonto(item.precioUnitario, DECIMALES_ITEM),
        montoDescu: descuento,
        compra: compra,
      };
    });

    return {
      cuerpoDocumento,
      totalesItems: {
        totalCompra: redondearMonto(totalCompra),
        totalDescuento: redondearMonto(totalDescuento),
      },
    };
  }

  /**
   * Resumen FSE - Usa 'descu' (no totalDescu), NO incluye campos de venta
   */
  private buildResumen(
    params: BuildDteParams,
    totales: { totalCompra: number; totalDescuento: number },
  ): DteResumenFSE {
    const subTotal = totales.totalCompra;
    const totalCompra = subTotal;
    const ivaRete1 = params.ivaRetenido || 0;
    const reteRenta = params.rentaRetenido || 0;
    const totalPagar = redondearMonto(totalCompra - ivaRete1 - reteRenta);

    const pagos = params.pagos?.map((p) => ({
      codigo: p.codigo,
      montoPago: redondearMonto(p.monto),
      referencia: p.referencia,
      plazo: p.plazo,
      periodo: p.periodo,
    })) || null;

    return {
      totalCompra,
      descu: totales.totalDescuento,
      totalDescu: totales.totalDescuento,
      subTotal,
      ivaRete1,
      reteRenta,
      totalPagar,
      totalLetras: numeroALetras(totalPagar),
      condicionOperacion: (params.condicionOperacion || 1) as 1 | 2 | 3,
      pagos,
      observaciones: params.observaciones || null,
    };
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatTime(date: Date): string {
    return date.toTimeString().split(' ')[0];
  }
}
