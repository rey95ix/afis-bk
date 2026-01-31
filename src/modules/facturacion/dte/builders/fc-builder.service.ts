import { Injectable } from '@nestjs/common';
import {
  IDteBuilder,
  BuildDteParams,
  BuildDteResult,
} from './dte-builder.interface';
import {
  TipoDte,
  DteFacturaConsumidor,
  DteIdentificacion,
  DteEmisor,
  DteReceptorFC,
  DteItemFC,
  DteResumenFC,
  DteExtension,
} from '../../interfaces';
import { numeroALetras, redondearMonto, DECIMALES_ITEM } from './numero-letras.util';

/**
 * Builder para Factura Consumidor Final (tipo 01)
 *
 * Características específicas de FC:
 * - ivaItem en cada línea del cuerpo
 * - totalIva en el resumen
 * - Receptor puede ser null (consumidor final anónimo)
 * - IVA incluido en los precios
 */
@Injectable()
export class FcBuilderService implements IDteBuilder {
  private readonly TIPO_DTE: TipoDte = '01';
  private readonly VERSION = 1;
  private readonly IVA_RATE = 0.13; // 13% IVA El Salvador

  getTipoDte(): TipoDte {
    return this.TIPO_DTE;
  }

  getVersion(): number {
    return this.VERSION;
  }

  build(params: BuildDteParams): BuildDteResult {
    // Construir cada sección del DTE
    const identificacion = this.buildIdentificacion(params);
    const emisor = this.buildEmisor(params.emisor);
    const receptor = this.buildReceptor(params.receptor);
    const { cuerpoDocumento, totalesItems } = this.buildCuerpoDocumento(params.items);
    const resumen = this.buildResumen(params, totalesItems);
    const extension = this.buildExtension(params.observaciones);

    const documento: DteFacturaConsumidor = {
      identificacion,
      documentoRelacionado: params.documentosRelacionados || null,
      emisor,
      receptor,
      otrosDocumentos: null,
      ventaTercero: null,
      cuerpoDocumento,
      resumen,
      extension,
      apendice: null,
    };

    return {
      documento,
      tipoDte: this.TIPO_DTE,
      totales: {
        totalNoSuj: totalesItems.totalNoSuj,
        totalExenta: totalesItems.totalExenta,
        totalGravada: totalesItems.totalGravada,
        totalIva: totalesItems.totalIva,
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

  private buildReceptor(receptor: BuildDteParams['receptor']): DteReceptorFC {
    // En FC el receptor puede ser completamente null (consumidor final)
    if (!receptor.nombre && !receptor.numDocumento) {
      return {
        tipoDocumento: null,
        numDocumento: null,
        nrc: null,
        nombre: null,
        codActividad: null,
        descActividad: null,
        direccion: null,
        telefono: null,
        correo: null,
      };
    }

    return {
      tipoDocumento: receptor.tipoDocumento,
      numDocumento: receptor.numDocumento,
      nrc: null, // FC no usa NRC del receptor
      nombre: receptor.nombre,
      codActividad: receptor.codActividad,
      descActividad: receptor.descActividad,
      direccion:
        receptor.departamento && receptor.municipio
          ? {
              departamento: receptor.departamento,
              municipio: receptor.municipio,
              complemento: receptor.complemento || '',
            }
          : null,
      telefono: receptor.telefono,
      correo: receptor.correo,
    };
  }

  private buildCuerpoDocumento(items: BuildDteParams['items']): {
    cuerpoDocumento: DteItemFC[];
    totalesItems: {
      totalNoSuj: number;
      totalExenta: number;
      totalGravada: number;
      totalIva: number;
      totalDescuento: number;
    };
  } {
    let totalNoSuj = 0;
    let totalExenta = 0;
    let totalGravada = 0;
    let totalIva = 0;
    let totalDescuento = 0;

    const cuerpoDocumento: DteItemFC[] = items.map((item, index) => {
      // Calcular subtotal del item (4 decimales para items)
      const subtotal = redondearMonto(item.cantidad * item.precioUnitario, DECIMALES_ITEM);
      const descuento = redondearMonto(item.descuento || 0, DECIMALES_ITEM);
      const montoNeto = redondearMonto(subtotal - descuento, DECIMALES_ITEM);

      // Determinar tipo de venta y calcular IVA
      let ventaNoSuj = 0;
      let ventaExenta = 0;
      let ventaGravada = 0;
      let ivaItem = 0;

      if (item.esNoSujeto) {
        ventaNoSuj = montoNeto;
        totalNoSuj += montoNeto;
      } else if (item.esExento) {
        ventaExenta = montoNeto;
        totalExenta += montoNeto;
      } else {
        // Gravado: en FC el precio incluye IVA, hay que extraerlo
        // Precio con IVA / 1.13 = Precio sin IVA
        // IVA = Precio con IVA - Precio sin IVA
        const montoSinIva = redondearMonto(montoNeto / (1 + this.IVA_RATE), DECIMALES_ITEM);
        ivaItem = redondearMonto(montoNeto - montoSinIva, DECIMALES_ITEM);
        ventaGravada = montoNeto;
        totalGravada += montoNeto;
        totalIva += ivaItem;
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
        tributos: null,
        psv: 0,
        noGravado: 0,
        ivaItem: redondearMonto(ivaItem, DECIMALES_ITEM),
      };
    });

    return {
      cuerpoDocumento,
      totalesItems: {
        totalNoSuj: redondearMonto(totalNoSuj),
        totalExenta: redondearMonto(totalExenta),
        totalGravada: redondearMonto(totalGravada),
        totalIva: redondearMonto(totalIva),
        totalDescuento: redondearMonto(totalDescuento),
      },
    };
  }

  private buildResumen(
    params: BuildDteParams,
    totales: {
      totalNoSuj: number;
      totalExenta: number;
      totalGravada: number;
      totalIva: number;
      totalDescuento: number;
    },
  ): DteResumenFC {
    const subTotalVentas = redondearMonto(
      totales.totalNoSuj + totales.totalExenta + totales.totalGravada,
    );
    const subTotal = redondearMonto(subTotalVentas - totales.totalDescuento);

    // En FC: montoTotalOperacion = subTotal + IVA
    const montoTotalOperacion = redondearMonto(subTotal );
    const totalPagar = montoTotalOperacion;

    // Construir pagos si existen
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
      tributos: null,
      subTotal,
      ivaRete1: 0,
      reteRenta: 0,
      montoTotalOperacion,
      totalNoGravado: 0,
      totalPagar,
      totalLetras: numeroALetras(totalPagar),
      totalIva: totales.totalIva,
      saldoFavor: 0,
      condicionOperacion: (params.condicionOperacion || 1) as 1 | 2 | 3,
      pagos,
      numPagoElectronico: params.numPagoElectronico || null,
    };
  }

  private buildExtension(observaciones?: string): DteExtension | null {
    if (!observaciones) return null;

    return {
      nombEntrega: null,
      docuEntrega: null,
      nombRecibe: null,
      docuRecibe: null,
      observaciones,
      placaVehiculo: null,
    };
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatTime(date: Date): string {
    return date.toTimeString().split(' ')[0]; // HH:MM:SS
  }
}
