import { Injectable } from '@nestjs/common';
import {
  IDteBuilder,
  BuildDteParams,
  BuildDteResult,
} from './dte-builder.interface';
import {
  TipoDte,
  DteCreditoFiscal,
  DteIdentificacion,
  DteEmisor,
  DteReceptorCCF,
  DteItemCCF,
  DteResumenCCF,
  DteExtension,
  Tributo,
} from '../../interfaces';
import { numeroALetras, redondearMonto, DECIMALES_ITEM } from './numero-letras.util';

/**
 * Builder para Comprobante de Crédito Fiscal (tipo 03)
 *
 * Características específicas de CCF:
 * - NO tiene ivaItem por línea (el IVA se calcula globalmente)
 * - Tiene ivaPerci1 en el resumen (IVA percibido)
 * - Receptor OBLIGATORIO con NIT y NRC
 * - Precios sin IVA (IVA se suma al final)
 * - Tributos pueden aplicar por item
 */
@Injectable()
export class CcfBuilderService implements IDteBuilder {
  private readonly TIPO_DTE: TipoDte = '03';
  private readonly VERSION = 3;
  private readonly IVA_RATE = 0.13; // 13% IVA El Salvador
  private readonly IVA_CODE = '20'; // Código de tributo IVA

  getTipoDte(): TipoDte {
    return this.TIPO_DTE;
  }

  getVersion(): number {
    return this.VERSION;
  }

  build(params: BuildDteParams): BuildDteResult {
    // Validar que el receptor tenga NIT y NRC (obligatorio para CCF)
    if (!params.receptor.nit || !params.receptor.nrc) {
      throw new Error('CCF requiere receptor con NIT y NRC');
    }

    // Construir cada sección del DTE
    const identificacion = this.buildIdentificacion(params);
    const emisor = this.buildEmisor(params.emisor);
    const receptor = this.buildReceptor(params.receptor);
    const { cuerpoDocumento, totalesItems } = this.buildCuerpoDocumento(params.items);
    const resumen = this.buildResumen(params, totalesItems);
    const extension = this.buildExtension(params.observaciones);

    const documento: DteCreditoFiscal = {
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

  private buildReceptor(receptor: BuildDteParams['receptor']): DteReceptorCCF {
    return {
      nit: receptor.nit!,
      nrc: receptor.nrc!,
      nombre: receptor.nombre,
      codActividad: receptor.codActividad || '10005', // Default: OTROS
      descActividad: receptor.descActividad || 'Otros',
      nombreComercial: receptor.nombreComercial || null,
      direccion: {
        departamento: receptor.departamento || '01',
        municipio: receptor.municipio || '01',
        complemento: receptor.complemento || 'Sin dirección registrada',
      },
      telefono: receptor.telefono || '',
      correo: receptor.correo || '',
    };
  }

  private buildCuerpoDocumento(items: BuildDteParams['items']): {
    cuerpoDocumento: DteItemCCF[];
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
    let totalDescuento = 0;

    const cuerpoDocumento: DteItemCCF[] = items.map((item, index) => {
      // Calcular subtotal del item (en CCF los precios son SIN IVA) - 4 decimales para items
      const subtotal = redondearMonto(item.cantidad * item.precioUnitario, DECIMALES_ITEM);
      const descuento = redondearMonto(item.descuento || 0, DECIMALES_ITEM);
      const montoNeto = redondearMonto(subtotal - descuento, DECIMALES_ITEM);

      // Determinar tipo de venta
      let ventaNoSuj = 0;
      let ventaExenta = 0;
      let ventaGravada = 0;
      let tributos: string[] | null = null;

      if (item.esNoSujeto) {
        ventaNoSuj = montoNeto;
        totalNoSuj += montoNeto;
      } else if (item.esExento) {
        ventaExenta = montoNeto;
        totalExenta += montoNeto;
      } else {
        // Gravado con IVA - en CCF se indica el tributo que aplica
        ventaGravada = montoNeto;
        totalGravada += montoNeto;
        tributos = [this.IVA_CODE]; // Código 20 = IVA 13%
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
        tributos,
        psv: 0,
        noGravado: 0,
      };
    });

    // Calcular IVA global sobre ventas gravadas
    const totalIva = redondearMonto(totalGravada * this.IVA_RATE);

    return {
      cuerpoDocumento,
      totalesItems: {
        totalNoSuj: redondearMonto(totalNoSuj),
        totalExenta: redondearMonto(totalExenta),
        totalGravada: redondearMonto(totalGravada),
        totalIva,
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
  ): DteResumenCCF {
    const subTotalVentas = redondearMonto(
      totales.totalNoSuj + totales.totalExenta + totales.totalGravada,
    );
    const subTotal = redondearMonto(subTotalVentas - totales.totalDescuento);

    // Construir tributos del resumen (IVA)
    const tributos: Tributo[] | null =
      totales.totalIva > 0
        ? [
            {
              codigo: this.IVA_CODE,
              descripcion: 'Impuesto al Valor Agregado 13%',
              valor: totales.totalIva,
            },
          ]
        : null;

    // En CCF: montoTotalOperacion = subTotal + IVA
    const montoTotalOperacion = redondearMonto(subTotal + totales.totalIva);
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
      tributos,
      subTotal,
      ivaPerci1: 0, // IVA percibido (cuando aplique)
      ivaRete1: 0, // IVA retenido
      reteRenta: 0, // Retención de renta
      montoTotalOperacion,
      totalNoGravado: 0,
      totalPagar,
      totalLetras: numeroALetras(totalPagar),
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
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  private formatTime(date: Date): string {
    return date.toTimeString().split(' ')[0]; // HH:MM:SS
  }
}
