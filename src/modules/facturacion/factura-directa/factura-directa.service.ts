// src/modules/facturacion/factura-directa/factura-directa.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

import * as QRCode from 'qrcode';
import {
  CrearFacturaDirectaDto,
  CrearNotaCreditoDto,
  BuscarFacturaDirectaDto,
  BuscarErroresDteDto,
  ItemFacturaDirectaDto,
  TipoDetalleFactura,
  AnularFacturaDirectaDto,
} from './dto';
import {
  FcBuilderService,
  CcfBuilderService,
  FseBuilderService,
  NcBuilderService,
  BuildDteParams,
  EmisorData,
  ReceptorData,
  ItemData,
  AnulacionBuilderService,
  DteOriginalData,
  MotivoAnulacionData,
} from '../dte/builders';
import { DteSignerService } from '../dte/signer';
import { MhTransmitterService, TransmisionResult } from '../dte/transmitter';
import { TipoDte, Ambiente, DteDocument, TipoAnulacion } from '../interfaces';
import { estado_dte, facturaDirecta, Prisma } from '@prisma/client';
import { MailService } from '../../mail/mail.service';

// Utilidad para convertir números a letras
import { numeroALetras, redondearMonto, DECIMALES_ITEM } from '../dte/builders/numero-letras.util';

/**
 * Resultado de la creación de una factura directa
 */
export interface CrearFacturaDirectaResult {
  success: boolean;
  idFactura?: number;
  codigoGeneracion?: string;
  numeroControl?: string;
  numeroFactura?: string;
  estado?: estado_dte;
  selloRecibido?: string;
  totalPagar?: number;
  error?: string;
  errores?: string[];
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Resultado de la anulación de una factura directa
 */
export interface AnularFacturaDirectaResult {
  success: boolean;
  idFactura?: number;
  codigoGeneracionAnulacion?: string;
  estado?: string;
  selloRecibido?: string;
  error?: string;
  errores?: string[];
}

/**
 * Plazos de anulación según tipo de DTE (en días)
 */
const PLAZOS_ANULACION: Record<string, number> = {
  '01': 90, // Factura: 3 meses
  '03': 1, // CCF: 1 día hábil siguiente
  '05': 1, // Nota de Crédito: 1 día
  '06': 1, // Nota de Débito: 1 día
  '07': 1, // Comprobante de Retención: 1 día
  '11': 90, // Factura de Exportación: 3 meses
  '14': 90, // Factura de Sujeto Excluido: 3 meses
};

/**
 * Constante de IVA (13% para El Salvador)
 */
const IVA_RATE = 0.13;

/**
 * Helpers para jsReport (converters de formato decimal)
 * Se registran via la propiedad 'helpers' en la petición a jsReport
 * para garantizar que estén disponibles en todos los templates.
 * Nota: Se usa require('jsrender') porque $ no está disponible automáticamente
 * en el contexto de helpers de jsReport.
 */
const JSRENDER_HELPERS = `
var defined = require('jsrender');
defined.views.converters("dec4", function(val) {
    if (val === null || val === undefined) return "0.0000";
    return Number(val).toFixed(4);
});
defined.views.converters("dec2", function(val) {
    if (val === null || val === undefined) return "0.00";
    return Number(val).toFixed(2);
});
`;

/**
 * Servicio para facturación directa (venta sin contrato)
 *
 * Soporta tipos de DTE:
 * - 01: Factura Consumidor Final (FC)
 * - 03: Comprobante Crédito Fiscal (CCF)
 * - 14: Factura Sujeto Excluido (FSE)
 * - 05: Nota de Crédito (NC)
 * - 06: Nota de Débito (ND) - TODO: implementar
 * - 11: Factura de Exportación (FEX) - TODO: implementar
 */
@Injectable()
export class FacturaDirectaService {
  private readonly logger = new Logger(FacturaDirectaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fcBuilder: FcBuilderService,
    private readonly ccfBuilder: CcfBuilderService,
    private readonly fseBuilder: FseBuilderService,
    private readonly ncBuilder: NcBuilderService,
    private readonly anulacionBuilder: AnulacionBuilderService,
    private readonly signer: DteSignerService,
    private readonly transmitter: MhTransmitterService,
    private readonly mailService: MailService,
  ) { }

  /**
   * Crear una nueva factura directa con DTE
   */
  async crearFactura(
    dto: CrearFacturaDirectaDto,
    idUsuario: number,
    idSucursalUsuario: number | null,
  ): Promise<CrearFacturaDirectaResult> {
    this.logger.log('Iniciando creación de factura directa');

    try {
      // ==================== PASO 1: VALIDACIONES ====================
      const datos = await this.validarYObtenerDatos(dto, idUsuario, idSucursalUsuario);

      // ==================== PASO 2: OBTENER TIPO DE DTE ====================
      const tipoFactura = datos.tipoFactura;
      const tipoDte = tipoFactura.codigo as TipoDte;
      this.logger.log(`Tipo de DTE: ${tipoFactura.nombre} (${tipoDte})`);

      // ==================== PASO 3: CALCULAR TOTALES ====================
      const totalesCalculados = this.calcularTotales(dto.items, tipoDte);

      // ==================== PASO 4: GENERAR IDENTIFICACIÓN ====================
      const codigoGeneracion = uuidv4().toUpperCase();
      const numeroControl = this.generarNumeroControl(tipoDte, datos.sucursal, datos.bloque);
      const numeroFactura = (datos.bloque.actual + 1).toString().padStart(10, '0');

      // ==================== PASO 5: CONSTRUIR DTE ====================
      const buildParams = this.prepararParametrosBuild(
        datos,
        tipoDte,
        codigoGeneracion,
        numeroControl,
        dto,
        totalesCalculados,
      );

      // Soportamos FC (01), CCF (03) y FSE (14)
      if (tipoDte !== '01' && tipoDte !== '03' && tipoDte !== '14') {
        throw new BadRequestException(`Tipo de DTE ${tipoDte} aún no implementado`);
      }

      const builder = tipoDte === '14'
        ? this.fseBuilder
        : tipoDte === '03'
          ? this.ccfBuilder
          : this.fcBuilder;
      const { documento, totales } = builder.build(buildParams);

      this.logger.log(`DTE construido. Total a pagar: $${totales.totalPagar}`);

      // ==================== PASO 6: GUARDAR FACTURA ====================
      const facturaCreada = await this.guardarFactura(
        documento,
        tipoDte,
        codigoGeneracion,
        numeroControl,
        numeroFactura,
        totales,
        datos,
        dto,
        idUsuario,
      );

      // ==================== PASO 7: FIRMAR DTE ====================
      const signResult = await this.signer.firmar(
        datos.generalData.nit!,
        documento,
      );

      if (!signResult.success) {
        await this.actualizarEstadoDte(facturaCreada.id_factura_directa, 'BORRADOR', signResult.error);
        return {
          success: false,
          idFactura: facturaCreada.id_factura_directa,
          codigoGeneracion,
          numeroControl,
          numeroFactura,
          estado: 'BORRADOR',
          error: `Error al firmar: ${signResult.error}`,
        };
      }

      // Actualizar con DTE firmado
      await this.prisma.facturaDirecta.update({
        where: { id_factura_directa: facturaCreada.id_factura_directa },
        data: {
          dte_firmado: signResult.documentoFirmado,
          estado_dte: 'FIRMADO',
        },
      });

      this.logger.log('DTE firmado exitosamente');

      // ==================== PASO 8: TRANSMITIR A MH ====================
      const transmitResult = await this.transmitter.transmitirDte(
        {
          ambiente: datos.generalData.ambiente as Ambiente,
          idEnvio: 1,
          version: datos.tipoFactura?.version || builder.getVersion(),
          tipoDte,
          documento: signResult.documentoFirmado!,
          codigoGeneracion,
        },
        datos.generalData.nit!,
      );

      // ==================== PASO 9: ACTUALIZAR ESTADO FINAL ====================
      await this.actualizarConRespuestaMh(facturaCreada.id_factura_directa, transmitResult);

      // Actualizar correlativo del bloque
      await this.prisma.facturasBloques.update({
        where: { id_bloque: datos.bloque.id_bloque },
        data: { actual: datos.bloque.actual + 1 },
      });

      if (transmitResult.success) {
        this.logger.log(`DTE procesado exitosamente. Sello: ${transmitResult.selloRecibido}`);

        // Enviar factura por correo (asíncrono, no bloquea)
        this.enviarFacturaPorCorreoAsync(facturaCreada.id_factura_directa);

        return {
          success: true,
          idFactura: facturaCreada.id_factura_directa,
          codigoGeneracion,
          numeroControl,
          numeroFactura,
          estado: 'PROCESADO',
          selloRecibido: transmitResult.selloRecibido,
          totalPagar: totales.totalPagar,
        };
      } else {
        return {
          success: false,
          idFactura: facturaCreada.id_factura_directa,
          codigoGeneracion,
          numeroControl,
          numeroFactura,
          estado: 'RECHAZADO',
          totalPagar: totales.totalPagar,
          error: transmitResult.error,
          errores: transmitResult.observaciones,
        };
      }
    } catch (error) {
      this.logger.error(`Error al crear factura: ${error.message}`, error.stack);

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(`Error al crear factura: ${error.message}`);
    }
  }

  /**
   * Crear una Nota de Crédito (NC - tipo 05) a partir de un CCF procesado
   *
   * Flujo:
   * 1. Validar factura original (CCF/CR procesado, no anulado)
   * 2. Validar items y cantidades
   * 3. Construir NC usando NcBuilderService
   * 4. Firmar y transmitir a MH
   * 5. Guardar con relación a factura original
   */
  async crearNotaCredito(
    dto: CrearNotaCreditoDto,
    idUsuario: number,
    idSucursalUsuario: number | null,
  ): Promise<CrearFacturaDirectaResult> {
    this.logger.log(`Iniciando creación de Nota de Crédito para factura ${dto.id_factura_original}`);

    try {
      // ==================== PASO 1: VALIDAR FACTURA ORIGINAL ====================
      const { facturaOriginal, generalData, sucursal, bloque, tipoFacturaNC } =
        await this.validarYObtenerDatosNC(dto, idSucursalUsuario);

      // ==================== PASO 2: VALIDAR ITEMS Y CALCULAR TOTALES ====================
      const { itemsValidados, totalesNC } = await this.validarItemsNC(
        dto.items,
        facturaOriginal,
      );

      // ==================== PASO 3: GENERAR IDENTIFICACIÓN ====================
      const codigoGeneracion = uuidv4().toUpperCase();
      const tipoDte: TipoDte = '05';
      const numeroControl = this.generarNumeroControl(tipoDte, sucursal, bloque);
      const numeroFactura = (bloque.actual + 1).toString().padStart(10, '0');

      // ==================== PASO 4: CONSTRUIR DOCUMENTO RELACIONADO ====================
      const documentoRelacionado = {
        tipoDocumento: facturaOriginal.tipoFactura?.codigo || '03',
        tipoGeneracion: 2 as 1 | 2, // 2 = Documento electrónico
        numeroDocumento: facturaOriginal.codigo_generacion!,
        fechaEmision: this.formatDate(facturaOriginal.fecha_creacion),
      };

      // ==================== PASO 5: CONSTRUIR EMISOR Y RECEPTOR ====================
      const emisor = this.construirEmisorActualizado(generalData, sucursal);

      // Receptor de NC es el mismo del CCF original (requiere NIT y NRC)
      const receptor: ReceptorData = this.construirReceptorDesdeFacturaOriginal(facturaOriginal);

      // ==================== PASO 6: CONSTRUIR NC CON BUILDER ====================
      const buildParams: BuildDteParams = {
        ambiente: (generalData.ambiente || '00') as Ambiente,
        version: this.ncBuilder.getVersion(),
        numeroControl,
        codigoGeneracion,
        emisor,
        receptor,
        items: itemsValidados,
        condicionOperacion: 1, // NC siempre es Contado
        observaciones: dto.observaciones,
        documentosRelacionados: [documentoRelacionado],
      };

      const { documento, totales } = this.ncBuilder.build(buildParams);

      this.logger.log(`NC construida. Total a pagar: $${totales.totalPagar}`);

      // ==================== PASO 7: GUARDAR NC EN BD ====================
      const ncCreada = await this.guardarNotaCredito(
        documento,
        tipoDte,
        codigoGeneracion,
        numeroControl,
        numeroFactura,
        totales,
        facturaOriginal,
        generalData,
        sucursal,
        bloque,
        tipoFacturaNC,
        dto,
        idUsuario,
      );

      // ==================== PASO 8: FIRMAR NC ====================
      const signResult = await this.signer.firmar(generalData.nit!, documento);

      if (!signResult.success) {
        await this.actualizarEstadoDte(ncCreada.id_factura_directa, 'BORRADOR', signResult.error);
        return {
          success: false,
          idFactura: ncCreada.id_factura_directa,
          codigoGeneracion,
          numeroControl,
          numeroFactura,
          estado: 'BORRADOR',
          error: `Error al firmar: ${signResult.error}`,
        };
      }

      // Actualizar con NC firmada
      await this.prisma.facturaDirecta.update({
        where: { id_factura_directa: ncCreada.id_factura_directa },
        data: {
          dte_firmado: signResult.documentoFirmado,
          estado_dte: 'FIRMADO',
        },
      });

      this.logger.log('NC firmada exitosamente');

      // ==================== PASO 9: TRANSMITIR A MH ====================
      const transmitResult = await this.transmitter.transmitirDte(
        {
          ambiente: generalData.ambiente as Ambiente,
          idEnvio: 1,
          version: this.ncBuilder.getVersion(),
          tipoDte,
          documento: signResult.documentoFirmado!,
          codigoGeneracion,
        },
        generalData.nit!,
      );

      // ==================== PASO 10: ACTUALIZAR ESTADO FINAL ====================
      await this.actualizarConRespuestaMh(ncCreada.id_factura_directa, transmitResult);

      // Actualizar correlativo del bloque
      await this.prisma.facturasBloques.update({
        where: { id_bloque: bloque.id_bloque },
        data: { actual: bloque.actual + 1 },
      });

      if (transmitResult.success) {
        this.logger.log(`NC procesada exitosamente. Sello: ${transmitResult.selloRecibido}`);

        // Enviar nota de crédito por correo (asíncrono, no bloquea)
        this.enviarFacturaPorCorreoAsync(ncCreada.id_factura_directa);

        return {
          success: true,
          idFactura: ncCreada.id_factura_directa,
          codigoGeneracion,
          numeroControl,
          numeroFactura,
          estado: 'PROCESADO',
          selloRecibido: transmitResult.selloRecibido,
          totalPagar: totales.totalPagar,
        };
      } else {
        return {
          success: false,
          idFactura: ncCreada.id_factura_directa,
          codigoGeneracion,
          numeroControl,
          numeroFactura,
          estado: 'RECHAZADO',
          totalPagar: totales.totalPagar,
          error: transmitResult.error,
          errores: transmitResult.observaciones,
        };
      }
    } catch (error) {
      this.logger.error(`Error al crear NC: ${error.message}`, error.stack);

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(`Error al crear Nota de Crédito: ${error.message}`);
    }
  }

  /**
   * Valida los datos necesarios para crear una NC y obtiene la información requerida
   */
  private async validarYObtenerDatosNC(
    dto: CrearNotaCreditoDto,
    idSucursalUsuario: number | null,
  ) {
    // 1. Obtener factura original con detalles
    const facturaOriginal = await this.prisma.facturaDirecta.findUnique({
      where: { id_factura_directa: dto.id_factura_original },
      include: {
        tipoFactura: true,
        detalles: {
          orderBy: { num_item: 'asc' },
        },
        sucursal: {
          include: {
            Municipio: { include: { Departamento: true } },
            DTETipoEstablecimiento: true,
          },
        },
        clienteDirecto: {
          include: {
            tipoDocumento: true,
            actividadEconomica: true,
            municipio: { include: { Departamento: true } },
          },
        },
        // Obtener NC previas para validar monto disponible
        notasCredito: {
          where: {
            estado_dte: 'PROCESADO',
            estado: { not: 'ANULADO' },
          },
          select: {
            total: true,
          },
        },
      },
    });

    if (!facturaOriginal) {
      throw new NotFoundException(
        `Factura original con ID ${dto.id_factura_original} no encontrada`,
      );
    }

    // 2. Validar tipo de factura (debe ser CCF "03" o Comprobante de Retención "07")
    const tipoOriginal = facturaOriginal.tipoFactura?.codigo;
    if (tipoOriginal !== '03' && tipoOriginal !== '07') {
      throw new BadRequestException(
        `Solo se pueden crear Notas de Crédito para Créditos Fiscales (03) o Comprobantes de Retención (07). ` +
        `El documento seleccionado es tipo ${tipoOriginal} (${facturaOriginal.tipoFactura?.nombre})`,
      );
    }

    // 3. Validar estado del DTE
    if (facturaOriginal.estado_dte !== 'PROCESADO') {
      throw new BadRequestException(
        `La factura original debe estar en estado PROCESADO para crear una NC. ` +
        `Estado actual: ${facturaOriginal.estado_dte}`,
      );
    }

    // 4. Validar que no esté anulada
    if (facturaOriginal.estado === 'ANULADO') {
      throw new BadRequestException(
        'No se puede crear una Nota de Crédito para una factura anulada',
      );
    }

    // 5. Validar que tenga código de generación
    if (!facturaOriginal.codigo_generacion) {
      throw new BadRequestException(
        'La factura original no tiene código de generación. No se puede crear NC.',
      );
    }

    // 6. Obtener datos de la empresa emisora
    const generalData = await this.prisma.generalData.findFirst();
    if (!generalData || !generalData.nit || !generalData.nrc) {
      throw new InternalServerErrorException('No hay datos de empresa configurados');
    }

    // 7. Obtener sucursal
    const idSucursalAUsar = dto.id_sucursal || idSucursalUsuario || facturaOriginal.id_sucursal;
    const sucursal = await this.prisma.sucursales.findUnique({
      where: { id_sucursal: idSucursalAUsar! },
      include: {
        Municipio: { include: { Departamento: true } },
        DTETipoEstablecimiento: true,
      },
    });

    if (!sucursal) {
      throw new BadRequestException('No hay sucursal disponible');
    }

    // 8. Obtener tipo de factura para NC (tipo 05)
    const tipoFacturaNC = await this.prisma.facturasTipos.findFirst({
      where: { codigo: '05' },
    });

    if (!tipoFacturaNC) {
      throw new InternalServerErrorException(
        'No se encontró el tipo de factura para Nota de Crédito (05)',
      );
    }

    // 9. Obtener bloque de numeración para NC
    const bloque = await this.prisma.facturasBloques.findFirst({
      where: {
        id_sucursal: sucursal.id_sucursal,
        estado: 'ACTIVO',
        Tipo: { codigo: '05' },
      },
      include: { Tipo: true },
    });

    if (!bloque) {
      throw new BadRequestException(
        `No hay bloques de facturas disponibles para Notas de Crédito (05) en la sucursal`,
      );
    }

    if (bloque.actual >= bloque.hasta) {
      throw new BadRequestException(`El bloque de NC ${bloque.serie} está agotado`);
    }

    return {
      facturaOriginal,
      generalData,
      sucursal,
      bloque,
      tipoFacturaNC,
    };
  }

  /**
   * Valida los items de la NC y calcula los totales
   */
  private async validarItemsNC(
    itemsDto: CrearNotaCreditoDto['items'],
    facturaOriginal: any,
  ): Promise<{
    itemsValidados: ItemData[];
    totalesNC: {
      totalGravada: number;
      totalExenta: number;
      totalNoSuj: number;
      totalIva: number;
    };
  }> {
    const detallesOriginales = facturaOriginal.detalles as any[];
    const detallesMap = new Map<number, any>(
      detallesOriginales.map((d) => [d.id_detalle, d]),
    );

    const itemsValidados: ItemData[] = [];
    let totalGravada = 0;
    let totalExenta = 0;
    let totalNoSuj = 0;

    for (const itemDto of itemsDto) {
      const detalleOriginal = detallesMap.get(itemDto.id_detalle_original);

      if (!detalleOriginal) {
        throw new BadRequestException(
          `El item con ID ${itemDto.id_detalle_original} no pertenece a la factura original`,
        );
      }

      // Validar cantidad
      const cantidadOriginal = Number(detalleOriginal.cantidad);
      if (itemDto.cantidad > cantidadOriginal) {
        throw new BadRequestException(
          `La cantidad a devolver (${itemDto.cantidad}) excede la cantidad original ` +
          `(${cantidadOriginal}) del item "${detalleOriginal.nombre}"`,
        );
      }

      // Determinar tipo de detalle
      const esGravado = detalleOriginal.tipo_detalle === 'GRAVADO';
      const esExento = detalleOriginal.tipo_detalle === 'EXENTA';
      const esNoSujeto = detalleOriginal.tipo_detalle === 'NOSUJETO';

      // Calcular subtotal del item NC (precio sin IVA * cantidad)
      const precioUnitario = Number(detalleOriginal.precio_sin_iva || detalleOriginal.precio_unitario);
      const subtotalItem = itemDto.cantidad * precioUnitario;

      // Acumular totales
      if (esGravado) {
        totalGravada += subtotalItem;
      } else if (esExento) {
        totalExenta += subtotalItem;
      } else if (esNoSujeto) {
        totalNoSuj += subtotalItem;
      }

      // Construir ItemData para el builder
      itemsValidados.push({
        tipoItem: 2, // Servicio por defecto
        codigo: detalleOriginal.codigo || null,
        descripcion: detalleOriginal.nombre + (detalleOriginal.descripcion ? ` - ${detalleOriginal.descripcion}` : ''),
        cantidad: itemDto.cantidad,
        uniMedida: detalleOriginal.uni_medida || 99,
        precioUnitario,
        descuento: 0, // NC no tiene descuento adicional
        esGravado,
        esExento,
        esNoSujeto,
        idCatalogo: detalleOriginal.id_catalogo,
      });
    }

    // Calcular IVA (13% de gravada)
    const totalIva = totalGravada * IVA_RATE;

    // Validar que el monto total de NC no exceda el disponible
    const totalNCActual = totalGravada + totalExenta + totalNoSuj + totalIva;
    const totalFacturaOriginal = Number(facturaOriginal.total);
    const totalNCPrevias = facturaOriginal.notasCredito?.reduce(
      (sum: number, nc: any) => sum + Number(nc.total),
      0,
    ) || 0;
    const montoDisponible = totalFacturaOriginal - totalNCPrevias;

    if (totalNCActual > montoDisponible + 0.01) { // tolerancia de centavo
      throw new BadRequestException(
        `El monto de la NC ($${totalNCActual.toFixed(2)}) excede el monto disponible ` +
        `($${montoDisponible.toFixed(2)}). Total factura: $${totalFacturaOriginal.toFixed(2)}, ` +
        `NC previas: $${totalNCPrevias.toFixed(2)}`,
      );
    }

    return {
      itemsValidados,
      totalesNC: {
        totalGravada,
        totalExenta,
        totalNoSuj,
        totalIva,
      },
    };
  }

  /**
   * Construye el receptor desde el JSON del DTE de la factura original
   *
   * IMPORTANTE: Los datos del receptor se extraen del dte_json (documento enviado a MH)
   * para garantizar que la NC use exactamente los mismos datos que fueron aceptados.
   */
  private construirReceptorDesdeFacturaOriginal(facturaOriginal: any): ReceptorData {
    // Intentar obtener datos del JSON del DTE original
    if (facturaOriginal.dte_json) {
      try {
        const dteOriginal = JSON.parse(facturaOriginal.dte_json);
        const receptorJson = dteOriginal.receptor;

        if (receptorJson) {
          // Extraer NIT y NRC del JSON
          const nit = this.sanitizarIdentificador(receptorJson.nit);
          const nrc = this.sanitizarIdentificador(receptorJson.nrc);

          if (!nit || !nrc) {
            throw new BadRequestException(
              'El documento original no tiene NIT o NRC del receptor en el JSON. ' +
              'Las Notas de Crédito requieren estos datos obligatoriamente.',
            );
          }

          return {
            tipoDocumento: '36', // NIT
            numDocumento: nit,
            nit,
            nrc,
            nombre: receptorJson.nombre,
            codActividad: receptorJson.codActividad || null,
            descActividad: receptorJson.descActividad || null,
            nombreComercial: receptorJson.nombreComercial || null,
            telefono: receptorJson.telefono || null,
            correo: receptorJson.correo || null,
            departamento: receptorJson.direccion?.departamento || null,
            municipio: receptorJson.direccion?.municipio || null,
            complemento: receptorJson.direccion?.complemento || null,
          };
        }
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        this.logger.warn(`Error al parsear dte_json de factura ${facturaOriginal.id_factura_directa}: ${error.message}`);
        // Continuar con fallback a datos snapshot
      }
    }

    // Fallback: usar datos snapshot de la factura si no hay JSON disponible
    this.logger.warn(`Usando datos snapshot para receptor de factura ${facturaOriginal.id_factura_directa} (sin dte_json)`);

    const nit = this.sanitizarIdentificador(facturaOriginal.cliente_nit);
    const nrc = this.sanitizarIdentificador(facturaOriginal.cliente_nrc);

    if (!nit || !nrc) {
      throw new BadRequestException(
        'La factura original no tiene NIT o NRC del cliente. ' +
        'Las Notas de Crédito requieren estos datos obligatoriamente.',
      );
    }

    return {
      tipoDocumento: '36',
      numDocumento: nit,
      nit,
      nrc,
      nombre: facturaOriginal.cliente_nombre!,
      codActividad: null,
      descActividad: null,
      nombreComercial: null,
      telefono: facturaOriginal.cliente_telefono || null,
      correo: facturaOriginal.cliente_correo || null,
      departamento: null,
      municipio: null,
      complemento: facturaOriginal.cliente_direccion || null,
    };
  }

  /**
   * Guarda la Nota de Crédito en la BD
   */
  private async guardarNotaCredito(
    documento: DteDocument,
    tipoDte: TipoDte,
    codigoGeneracion: string,
    numeroControl: string,
    numeroFactura: string,
    totales: any,
    facturaOriginal: any,
    generalData: any,
    sucursal: any,
    bloque: any,
    tipoFacturaNC: any,
    dto: CrearNotaCreditoDto,
    idUsuario: number,
  ) {
    // Calcular total en letras
    const totalLetras = numeroALetras(totales.totalPagar);

    return this.prisma.facturaDirecta.create({
      data: {
        // Numeración
        numero_factura: numeroFactura,

        // Snapshot del cliente (heredado de factura original)
        cliente_nombre: facturaOriginal.cliente_nombre,
        cliente_nrc: facturaOriginal.cliente_nrc,
        cliente_nit: facturaOriginal.cliente_nit,
        cliente_direccion: facturaOriginal.cliente_direccion,
        cliente_telefono: facturaOriginal.cliente_telefono,
        cliente_correo: facturaOriginal.cliente_correo,

        // Relaciones
        id_cliente_directo: facturaOriginal.id_cliente_directo,
        id_tipo_factura: tipoFacturaNC.id_tipo_factura,
        id_bloque: bloque.id_bloque,
        id_sucursal: sucursal.id_sucursal,
        id_usuario: idUsuario,

        // Relación con factura original
        id_factura_original: facturaOriginal.id_factura_directa,

        // Totales
        subtotal: totales.totalGravada + totales.totalExenta + totales.totalNoSuj,
        subTotalVentas: totales.totalGravada + totales.totalExenta + totales.totalNoSuj,
        descuento: 0,
        totalNoSuj: totales.totalNoSuj,
        totalExenta: totales.totalExenta,
        totalGravada: totales.totalGravada,
        totalNoGravado: 0,
        iva: totales.totalIva,
        iva_retenido: 0,
        iva_percibido: 0,
        renta_retenido: 0,
        total: totales.totalPagar,
        total_letras: totalLetras,

        // Pagos (NC es siempre contado)
        efectivo: totales.totalPagar,
        condicion_operacion: 1,

        // DTE
        codigo_generacion: codigoGeneracion,
        numero_control: numeroControl,
        dte_json: JSON.stringify(documento),
        estado_dte: 'BORRADOR',

        // Observaciones
        observaciones: dto.observaciones,

        // Detalle de items
        detalles: {
          create: dto.items.map((itemDto, index) => {
            // Obtener detalle original
            const detalleOriginal = facturaOriginal.detalles.find(
              (d: any) => d.id_detalle === itemDto.id_detalle_original,
            );

            const precioUnitario = Number(detalleOriginal.precio_sin_iva || detalleOriginal.precio_unitario);
            const subtotalItem = itemDto.cantidad * precioUnitario;
            const tipo = detalleOriginal.tipo_detalle;
            const ivaItem = tipo === 'GRAVADO' ? subtotalItem * IVA_RATE : 0;

            return {
              num_item: index + 1,
              codigo: detalleOriginal.codigo,
              nombre: detalleOriginal.nombre,
              descripcion: detalleOriginal.descripcion,
              nota: itemDto.motivo || null,
              cantidad: itemDto.cantidad,
              uni_medida: detalleOriginal.uni_medida || 99,
              precio_unitario: precioUnitario,
              precio_sin_iva: precioUnitario,
              precio_con_iva: precioUnitario * (1 + IVA_RATE),
              tipo_detalle: tipo,
              venta_gravada: tipo === 'GRAVADO' ? subtotalItem : 0,
              venta_exenta: tipo === 'EXENTA' ? subtotalItem : 0,
              venta_nosujeto: tipo === 'NOSUJETO' ? subtotalItem : 0,
              venta_nograbada: 0,
              subtotal: subtotalItem,
              descuento: 0,
              iva: ivaItem,
              total: subtotalItem + ivaItem,
              id_catalogo: detalleOriginal.id_catalogo,
            };
          }),
        },
      },
    });
  }

  /**
   * Listar facturas directas con paginación y filtros
   */
  async findAll(
    queryDto: BuscarFacturaDirectaDto,
  ): Promise<PaginatedResult<facturaDirecta>> {
    const {
      page = 1,
      limit = 10,
      q,
      id_cliente_directo,
      cliente_nit,
      tipo_dte,
      id_tipo_factura,
      id_sucursal,
      estado_dte,
      estado,
      fecha_inicio,
      fecha_fin,
    } = queryDto;
    const skip = (page - 1) * limit;

    const where: Prisma.facturaDirectaWhereInput = {};

    // Búsqueda general
    if (q) {
      where.OR = [
        { numero_factura: { contains: q, mode: 'insensitive' } },
        { cliente_nombre: { contains: q, mode: 'insensitive' } },
        { codigo_generacion: { contains: q, mode: 'insensitive' } },
        { numero_control: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Filtros específicos
    if (id_cliente_directo) {
      where.id_cliente_directo = id_cliente_directo;
    }
    if (cliente_nit) {
      where.cliente_nit = { contains: cliente_nit, mode: 'insensitive' };
    }
    if (tipo_dte) {
      where.tipoFactura = { codigo: tipo_dte };
    }
    if (id_tipo_factura) {
      where.id_tipo_factura = id_tipo_factura;
    }
    if (id_sucursal) {
      where.id_sucursal = id_sucursal;
    }
    if (estado_dte) {
      where.estado_dte = estado_dte as any;
    }
    if (estado) {
      where.estado = estado as any;
    }
    if (fecha_inicio || fecha_fin) {
      where.fecha_creacion = {};
      if (fecha_inicio) {
        where.fecha_creacion.gte = new Date(fecha_inicio);
      }
      if (fecha_fin) {
        where.fecha_creacion.lte = new Date(fecha_fin + 'T23:59:59');
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.facturaDirecta.findMany({
        where,
        skip,
        take: limit,
        include: {
          tipoFactura: true,
          clienteDirecto: {
            select: { id_cliente_directo: true, nombre: true },
          },
          sucursal: {
            select: { id_sucursal: true, nombre: true },
          },
          usuario: {
            select: { id_usuario: true, nombres: true, apellidos: true },
          },
        },
        orderBy: { fecha_creacion: 'desc' },
      }),
      this.prisma.facturaDirecta.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Obtener una factura por ID con todos sus detalles
   */
  async findOne(id: number): Promise<facturaDirecta> {
    const factura = await this.prisma.facturaDirecta.findUnique({
      where: { id_factura_directa: id },
      include: {
        tipoFactura: true,
        bloque: true,
        clienteDirecto: true,
        sucursal: true,
        usuario: {
          select: { id_usuario: true, nombres: true, apellidos: true },
        },
        detalles: {
          include: {
            catalogo: {
              select: { id_catalogo: true, codigo: true, nombre: true },
            },
          },
          orderBy: { num_item: 'asc' },
        },
        metodoPago: true,
        facturaOriginal: {
          select: {
            id_factura_directa: true,
            numero_factura: true,
            codigo_generacion: true,
          },
        },
        notasCredito: {
          select: {
            id_factura_directa: true,
            numero_factura: true,
            codigo_generacion: true,
          },
        },
      },
    });

    if (!factura) {
      throw new NotFoundException(`Factura con ID ${id} no encontrada`);
    }

    return factura;
  }

  /**
   * Obtener facturas con errores de DTE (rechazadas o fallidas)
   */
  async findErroresDte(queryDto: BuscarErroresDteDto): Promise<PaginatedResult<facturaDirecta>> {
    const { page = 1, limit = 10, id_sucursal, fecha_inicio, fecha_fin } = queryDto;
    const skip = (page - 1) * limit;

    const where: Prisma.facturaDirectaWhereInput = {
      estado_dte: { in: ['BORRADOR', 'RECHAZADO'] },
    };

    if (id_sucursal) {
      where.id_sucursal = id_sucursal;
    }
    if (fecha_inicio || fecha_fin) {
      where.fecha_creacion = {};
      if (fecha_inicio) {
        where.fecha_creacion.gte = new Date(fecha_inicio);
      }
      if (fecha_fin) {
        where.fecha_creacion.lte = new Date(fecha_fin + 'T23:59:59');
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.facturaDirecta.findMany({
        where,
        skip,
        take: limit,
        include: {
          tipoFactura: true,
          sucursal: {
            select: { id_sucursal: true, nombre: true },
          },
        },
        orderBy: { fecha_creacion: 'desc' },
      }),
      this.prisma.facturaDirecta.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Reenviar DTE a MH (para facturas fallidas o rechazadas)
   *
   * IMPORTANTE: Esta función REGENERA el JSON del DTE usando los datos actualizados
   * de la BD, permitiendo que correcciones en el cliente/emisor se reflejen en el reenvío.
   * Se mantiene el mismo codigo_generacion y numero_control original.
   */
  async reenviarDte(id: number, idUsuario: number): Promise<CrearFacturaDirectaResult> {
    this.logger.log(`Iniciando reenvío de DTE para factura ${id}`);

    // ==================== PASO 1: VALIDACIONES ====================
    const facturaBasica = await this.findOne(id);

    if (facturaBasica.estado_dte === 'PROCESADO') {
      throw new BadRequestException('La factura ya fue procesada exitosamente');
    }

    if (facturaBasica.estado === 'ANULADO') {
      throw new BadRequestException('No se puede reenviar una factura anulada');
    }

    if (!facturaBasica.codigo_generacion || !facturaBasica.numero_control) {
      throw new BadRequestException('La factura no tiene código de generación o número de control');
    }

    // ==================== PASO 2: OBTENER DATOS ACTUALIZADOS ====================
    const { factura, generalData } = await this.obtenerDatosParaReenvio(id);
    const tipoDte = factura.tipoFactura?.codigo as TipoDte;

    // Soportamos FC (01), CCF (03) y FSE (14)
    if (tipoDte !== '01' && tipoDte !== '03' && tipoDte !== '14') {
      throw new BadRequestException(`Tipo de DTE ${tipoDte} aún no implementado para reenvío`);
    }

    this.logger.log(`Regenerando DTE tipo ${tipoDte} con datos actualizados`);

    // ==================== PASO 3: CONSTRUIR DTE ACTUALIZADO ====================
    const emisor = this.construirEmisorActualizado(generalData, factura.sucursal);
    const receptor = this.construirReceptorActualizado(factura, tipoDte);
    const items = this.convertirDetallesAItems(factura.detalles);

    const buildParams: BuildDteParams = {
      ambiente: (generalData.ambiente || '00') as Ambiente,
      version: factura.tipoFactura?.version || 1,
      numeroControl: factura.numero_control!, // Mantener el mismo
      codigoGeneracion: factura.codigo_generacion!, // Mantener el mismo
      emisor,
      receptor,
      items,
      condicionOperacion: factura.condicion_operacion || 1,
      observaciones: factura.observaciones || undefined,
    };

    // Seleccionar el builder apropiado
    const builder = tipoDte === '14'
      ? this.fseBuilder
      : tipoDte === '03'
        ? this.ccfBuilder
        : this.fcBuilder;
    const { documento, totales } = builder.build(buildParams);

    this.logger.log(`DTE regenerado. Total a pagar: $${totales.totalPagar}`);

    // ==================== PASO 4: GUARDAR NUEVO JSON ====================
    await this.prisma.facturaDirecta.update({
      where: { id_factura_directa: id },
      data: {
        dte_json: JSON.stringify(documento),
        estado_dte: 'BORRADOR',
      },
    });

    // ==================== PASO 5: FIRMAR DTE ====================
    const signResult = await this.signer.firmar(generalData.nit!, documento);

    if (!signResult.success) {
      await this.actualizarEstadoDte(id, 'BORRADOR', signResult.error);
      return {
        success: false,
        idFactura: id,
        codigoGeneracion: factura.codigo_generacion!,
        numeroControl: factura.numero_control!,
        error: `Error al firmar: ${signResult.error}`,
      };
    }

    // ==================== PASO 6: GUARDAR DTE FIRMADO ====================
    await this.prisma.facturaDirecta.update({
      where: { id_factura_directa: id },
      data: {
        dte_firmado: signResult.documentoFirmado,
        estado_dte: 'FIRMADO',
      },
    });

    this.logger.log('DTE firmado exitosamente');

    // ==================== PASO 7: TRANSMITIR A MH ====================
    const transmitResult = await this.transmitter.transmitirDte(
      {
        ambiente: generalData.ambiente as Ambiente,
        idEnvio: 1,
        version: factura.tipoFactura?.version || builder.getVersion(),
        tipoDte,
        documento: signResult.documentoFirmado!,
        codigoGeneracion: factura.codigo_generacion!,
      },
      generalData.nit!,
    );

    // ==================== PASO 8: ACTUALIZAR RESPUESTA ====================
    await this.actualizarConRespuestaMh(id, transmitResult);

    if (transmitResult.success) {
      this.logger.log(`DTE reenviado exitosamente. Sello: ${transmitResult.selloRecibido}`);

      // Enviar factura por correo (asíncrono, no bloquea)
      this.enviarFacturaPorCorreoAsync(id);

      return {
        success: true,
        idFactura: id,
        codigoGeneracion: factura.codigo_generacion!,
        numeroControl: factura.numero_control!,
        estado: 'PROCESADO',
        selloRecibido: transmitResult.selloRecibido,
        totalPagar: totales.totalPagar,
      };
    } else {
      return {
        success: false,
        idFactura: id,
        codigoGeneracion: factura.codigo_generacion!,
        numeroControl: factura.numero_control!,
        estado: 'RECHAZADO',
        totalPagar: totales.totalPagar,
        error: transmitResult.error,
        errores: transmitResult.observaciones,
      };
    }
  }

  /**
   * Anular una factura directa (DTE)
   *
   * Flujo:
   * 1. Validar que la factura puede ser anulada
   * 2. Preparar datos del emisor y DTE original
   * 3. Construir evento de anulación con AnulacionBuilderService
   * 4. Firmar con DteSignerService
   * 5. Transmitir con MhTransmitterService
   * 6. Actualizar estados en BD
   *
   * Nota: Los datos del responsable se obtienen de GeneralData (empresa)
   *       Los datos del solicitante se obtienen del usuario logueado
   */
  async anularFacturaDirecta(
    id: number,
    dto: AnularFacturaDirectaDto,
    usuario: { id_usuario: number; nombres: string; apellidos: string; dui?: string | null },
  ): Promise<AnularFacturaDirectaResult> {
    this.logger.log(`Iniciando anulación de factura directa ${id}`);

    try {
      // ==================== PASO 1: VALIDACIONES ====================
      const { factura, generalData, sucursal } = await this.validarAnulacion(id, dto);
      //documento
      // ==================== PASO 2: PREPARAR DATOS ====================
      const emisor = this.construirEmisorActualizado(generalData, sucursal);
      const dteOriginalData = this.prepararDteOriginalAnulacion(factura);
      const motivo = this.prepararMotivoAnulacion(dto, generalData, usuario);

      // ==================== PASO 3: CONSTRUIR EVENTO DE ANULACIÓN ====================
      const { evento, codigoGeneracion } = this.anulacionBuilder.build({
        ambiente: generalData.ambiente as Ambiente,
        emisor,
        dteOriginal: dteOriginalData,
        motivo,
      });

      this.logger.log(`Evento de anulación construido: ${codigoGeneracion}`);

      // ==================== PASO 4: FIRMAR EVENTO ====================
      const signResult = await this.signer.firmar(generalData.nit!, evento);

      if (!signResult.success) {
        return {
          success: false,
          idFactura: id,
          codigoGeneracionAnulacion: codigoGeneracion,
          error: `Error al firmar: ${signResult.error}`,
        };
      }

      this.logger.log('Evento de anulación firmado exitosamente');

      // ==================== PASO 5: TRANSMITIR A MH ====================
      const transmitResult = await this.transmitter.transmitirAnulacion(
        {
          ambiente: generalData.ambiente as Ambiente,
          idEnvio: 1,
          version: 2,
          documento: signResult.documentoFirmado!,
        },
        generalData.nit!,
      );

      // ==================== PASO 6: ACTUALIZAR ESTADOS ====================
      if (transmitResult.success) {
        // Actualizar factura a INVALIDADO/ANULADO
        await this.prisma.facturaDirecta.update({
          where: { id_factura_directa: id },
          data: {
            estado_dte: 'INVALIDADO',
            estado: 'ANULADO',
          },
        });

        this.logger.log(
          `Factura directa anulada exitosamente. Sello: ${transmitResult.selloRecibido}`,
        );

        return {
          success: true,
          idFactura: id,
          codigoGeneracionAnulacion: codigoGeneracion,
          estado: 'PROCESADA',
          selloRecibido: transmitResult.selloRecibido,
        };
      } else {
        return {
          success: false,
          idFactura: id,
          codigoGeneracionAnulacion: codigoGeneracion,
          estado: 'RECHAZADA',
          error: transmitResult.error,
          errores: transmitResult.observaciones,
        };
      }
    } catch (error) {
      this.logger.error(`Error al anular factura directa: ${error.message}`, error.stack);

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(`Error al anular factura: ${error.message}`);
    }
  }

  /**
   * Valida que la factura directa puede ser anulada
   */
  private async validarAnulacion(id: number, dto: AnularFacturaDirectaDto) {
    // 1. Obtener factura
    const factura = await this.prisma.facturaDirecta.findUnique({
      where: { id_factura_directa: id },
      include: {
        tipoFactura: true,
        sucursal: {
          include: {
            Municipio: { include: { Departamento: true } },
            DTETipoEstablecimiento: true,
          },
        },
      },
    });

    if (!factura) {
      throw new NotFoundException(`Factura directa ${id} no encontrada`);
    }

    // 2. Verificar estado del DTE
    if (factura.estado_dte !== 'PROCESADO') {
      throw new BadRequestException(
        `La factura no puede ser anulada porque está en estado ${factura.estado_dte}. Solo se pueden anular facturas en estado PROCESADO.`,
      );
    }

    // 3. Verificar que no esté ya anulada
    if (factura.estado === 'ANULADO') {
      throw new ConflictException(
        'La factura ya fue anulada anteriormente.',
      );
    }

    // 4. Verificar que tenga sello de recepción
    if (!factura.sello_recepcion) {
      throw new BadRequestException(
        'La factura no tiene sello de recepción de MH. No puede ser anulada.',
      );
    }

    // 5. Verificar plazo de anulación
    const tipoDte = factura.tipoFactura?.codigo || '01';
    const plazoMaximo = PLAZOS_ANULACION[tipoDte] || 1;
    const fechaRecepcion = factura.fecha_recepcion_mh || factura.fecha_creacion;
    const diasTranscurridos = this.calcularDiasTranscurridos(fechaRecepcion);

    if (diasTranscurridos > plazoMaximo) {
      throw new BadRequestException(
        `El plazo para anular esta factura ha expirado. Plazo máximo: ${plazoMaximo} días. Días transcurridos: ${diasTranscurridos}`,
      );
    }

    // 6. Si tipo es 1 (error), verificar DTE de reemplazo
    if (dto.tipoAnulacion === 1) {
      if (!dto.codigoGeneracionReemplazo) {
        throw new BadRequestException(
          'Para anulación tipo 1 (Error en información) se requiere especificar el DTE de reemplazo',
        );
      }

      const dteReemplazo = await this.prisma.facturaDirecta.findFirst({
        where: { codigo_generacion: dto.codigoGeneracionReemplazo },
      });

      if (!dteReemplazo) {
        throw new BadRequestException(
          `El DTE de reemplazo ${dto.codigoGeneracionReemplazo} no existe`,
        );
      }

      if (dteReemplazo.estado_dte !== 'PROCESADO') {
        throw new BadRequestException(
          `El DTE de reemplazo debe estar en estado PROCESADO (actual: ${dteReemplazo.estado_dte})`,
        );
      }
    }

    // 7. Si tipo es 3 (otro), verificar que tenga motivo
    if (dto.tipoAnulacion === 3 && !dto.motivoAnulacion) {
      throw new BadRequestException(
        'Para anulación tipo 3 (Otro) se requiere especificar el motivo',
      );
    }

    // 8. Obtener datos de la empresa emisora
    const generalData = await this.prisma.generalData.findFirst();
    if (!generalData || !generalData.nit) {
      throw new InternalServerErrorException('No hay datos de empresa configurados');
    }

    return {
      factura,
      generalData,
      sucursal: factura.sucursal,
    };
  }

  /**
   * Prepara los datos del DTE original para el evento de anulación
   */
  private prepararDteOriginalAnulacion(factura: any): DteOriginalData {
    // Parsear el JSON del DTE para obtener datos del receptor
    let receptorData: any = {};
    if (factura.dte_json) {
      try {
        const dteDoc = JSON.parse(factura.dte_json);
        receptorData = dteDoc.receptor || dteDoc.sujetoExcluido || {};
      } catch {
        // Si no se puede parsear, usar datos del snapshot
      }
    }

    return {
      tipoDte: factura.tipoFactura?.codigo as TipoDte || '01',
      codigoGeneracion: factura.codigo_generacion,
      selloRecibido: factura.sello_recepcion,
      numeroControl: factura.numero_control,
      fechaEmision: this.formatDate(factura.fecha_creacion),
      montoIva: Number(factura.iva) || 0,
      tipoDocumentoReceptor: receptorData.tipoDocumento || null,
      numDocumentoReceptor: receptorData.numDocumento || null,
      nombreReceptor: receptorData.nombre || null,
      telefonoReceptor: receptorData.telefono || null,
      correoReceptor: receptorData.correo || null,
    };
  }

  /**
   * Prepara los datos del motivo de anulación
   *
   * - Responsable: datos de la empresa (GeneralData)
   * - Solicitante: datos del usuario logueado
   */
  private prepararMotivoAnulacion(
    dto: AnularFacturaDirectaDto,
    generalData: any,
    usuario: { nombres: string; apellidos: string; dui?: string | null },
  ): MotivoAnulacionData {
    // Responsable: datos de la empresa emisora
    const nombreResponsable = generalData.razon || generalData.nombre_comercial || generalData.nombre_sistema || '';
    const tipoDocResponsable = '36'; // NIT siempre para la empresa
    const numDocResponsable = this.sanitizarIdentificador(generalData.nit) || '';

    // Solicitante: datos del usuario logueado
    const nombreSolicita = `${usuario.nombres} ${usuario.apellidos}`.trim();
    const tipoDocSolicita = '13'; // DUI
    const numDocSolicita = this.sanitizarIdentificador(usuario.dui) || '';

    return {
      tipoAnulacion: dto.tipoAnulacion,
      motivoAnulacion: dto.motivoAnulacion || null,
      nombreResponsable,
      tipoDocResponsable,
      numDocResponsable,
      nombreSolicita,
      tipoDocSolicita,
      numDocSolicita,
      codigoGeneracionReemplazo: dto.codigoGeneracionReemplazo,
    };
  }

  /**
   * Calcula los días transcurridos desde una fecha
   */
  private calcularDiasTranscurridos(fecha: Date): number {
    const hoy = new Date();
    const diffTime = hoy.getTime() - fecha.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Formatea una fecha a YYYY-MM-DD (usando hora local)
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Obtener métodos de pago disponibles
   */
  async getMetodosPago() {
    return this.prisma.metodosPago.findMany({
      where: { estado: 'ACTIVO' },
      orderBy: { nombre: 'asc' },
    });
  }

  /**
   * Obtener datos extras (departamentos, municipios, actividades económicas, etc.)
   */
  async getDatosExtras() {
    const [
      departamentos,
      tiposDocumento,
      actividadesEconomicas,
      tiposFactura,
      sucursales,
    ] = await Promise.all([
      this.prisma.departamentos.findMany({
        where: { estado: 'ACTIVO' },
        include: {
          Municipios: {
            where: { estado: 'ACTIVO' },
            orderBy: { nombre: 'asc' },
          },
        },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.dTETipoDocumentoIdentificacion.findMany({
        where: { estado: 'ACTIVO' },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.dTEActividadEconomica.findMany({
        where: { estado: 'ACTIVO' },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.facturasTipos.findMany({
        where: { estado: 'ACTIVO' },
        orderBy: { id_tipo_factura: 'asc' },
      }),
      this.prisma.sucursales.findMany({
        where: { estado: 'ACTIVO' },
        select: { id_sucursal: true, nombre: true },
        orderBy: { nombre: 'asc' },
      }),
    ]);

    return {
      departamentos,
      tiposDocumento,
      actividadesEconomicas,
      tiposFactura,
      sucursales,
    };
  }

  /**
   * Buscar productos en el catálogo para el selector
   */
  async buscarCatalogo(q: string, limit: number = 20) {
    if (!q || q.length < 2) {
      return { data: [] };
    }

    const data = await this.prisma.catalogo.findMany({
      where: {
        estado: 'ACTIVO',
        OR: [
          { nombre: { contains: q, mode: 'insensitive' } },
          { codigo: { contains: q, mode: 'insensitive' } },
          { descripcion: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id_catalogo: true,
        codigo: true,
        nombre: true,
        descripcion: true,
      },
      take: parseInt(limit.toString(), 10),
      orderBy: { nombre: 'asc' },
    });

    return { data };
  }

  // ==================== MÉTODOS PRIVADOS ====================

  /**
   * Valida los datos de entrada y obtiene la información necesaria
   */
  private async validarYObtenerDatos(dto: CrearFacturaDirectaDto, idUsuario: number, idSucursalUsuario: number | null) {
    // 1. Validar que hay al menos un item
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Debe incluir al menos un item en la factura');
    }

    // 2. Obtener tipo de factura
    const tipoFactura = await this.prisma.facturasTipos.findUnique({
      where: { id_tipo_factura: dto.id_tipo_factura },
    });

    if (!tipoFactura) {
      throw new NotFoundException(`Tipo de factura ${dto.id_tipo_factura} no encontrado`);
    }

    // 3. Validar cliente para CCF
    if (tipoFactura.codigo === '03') {
      if (!dto.cliente_nit || !dto.cliente_nrc) {
        throw new BadRequestException('Para CCF se requiere NIT y NRC del cliente');
      }
    }

    // 4. Validar sujeto excluido para FSE
    if (tipoFactura.codigo === '14') {
      if (!dto.cliente_dui && !dto.cliente_nit) {
        throw new BadRequestException(
          'Para Factura Sujeto Excluido se requiere DUI o NIT del sujeto'
        );
      }
      if (!dto.cliente_nombre) {
        throw new BadRequestException(
          'Para Factura Sujeto Excluido se requiere el nombre del sujeto'
        );
      }
      // Nota: NRC NO es requerido para FSE
    }

    // 4. Obtener datos de la empresa emisora
    const generalData = await this.prisma.generalData.findFirst();

    if (!generalData) {
      throw new InternalServerErrorException('No hay datos de empresa configurados');
    }

    if (!generalData.nit || !generalData.nrc) {
      throw new InternalServerErrorException('La empresa no tiene NIT o NRC configurado');
    }

    // 5. Obtener usuario
    const usuario = await this.prisma.usuarios.findUnique({
      where: { id_usuario: idUsuario },
      include: { roles: true },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // 6. Obtener sucursal (prioridad: sucursal del usuario, luego primera activa)
    const idSucursalAUsar = idSucursalUsuario || null;

    const sucursal = idSucursalAUsar
      ? await this.prisma.sucursales.findUnique({
        where: { id_sucursal: idSucursalAUsar },
        include: {
          Municipio: { include: { Departamento: true } },
          DTETipoEstablecimiento: true,
        },
      })
      : await this.prisma.sucursales.findFirst({
        where: { estado: 'ACTIVO' },
        include: {
          Municipio: { include: { Departamento: true } },
          DTETipoEstablecimiento: true,
        },
      });

    if (!sucursal) {
      throw new BadRequestException('No hay sucursal disponible');
    }

    // 7. Obtener bloque de facturas
    const bloque = await this.prisma.facturasBloques.findFirst({
      where: {
        id_sucursal: sucursal.id_sucursal,
        estado: 'ACTIVO',
        Tipo: {
          codigo: tipoFactura.codigo,
        },
      },
      include: { Tipo: true },
    });

    if (!bloque) {
      throw new BadRequestException(
        `No hay bloques de facturas disponibles para tipo ${tipoFactura.codigo} en la sucursal`,
      );
    }

    if (bloque.actual >= bloque.hasta) {
      throw new BadRequestException(`El bloque de facturas ${bloque.serie} está agotado`);
    }

    // 8. Obtener cliente directo si se proporciona
    let clienteDirecto: any = null;
    if (dto.id_cliente_directo) {
      clienteDirecto = await this.prisma.clienteDirecto.findUnique({
        where: { id_cliente_directo: dto.id_cliente_directo },
        include: {
          tipoDocumento: true,
          actividadEconomica: true,
          municipio: { include: { Departamento: true } },
        },
      });
    }

    return {
      tipoFactura,
      generalData,
      usuario,
      sucursal,
      bloque,
      clienteDirecto,
    };
  }

  /**
   * Calcular totales de la factura
   */
  private calcularTotales(items: ItemFacturaDirectaDto[], tipoDte: TipoDte) {
    let totalGravada = 0;
    let totalExenta = 0;
    let totalNoSuj = 0;
    let totalNoGravado = 0;
    let totalDescuento = 0;
    let totalIva = 0;

    for (const item of items) {
      const tipo = item.tipo_detalle || TipoDetalleFactura.GRAVADO;
      const cantidad = item.cantidad || 0;
      const precioUnitario = item.precio_unitario || 0;
      const descuento = item.descuento || 0;
      const subtotal = cantidad * precioUnitario - descuento;

      totalDescuento += descuento;

      switch (tipo) {
        case TipoDetalleFactura.GRAVADO:
          totalGravada += subtotal;
          // Para FC y FSE, el IVA está incluido en el precio
          if (tipoDte === '01' || tipoDte === '14') {
            const ivaItem = subtotal - subtotal / (1 + IVA_RATE);
            totalIva += ivaItem;
          } else {
            // Para CCF, el IVA se calcula aparte
            totalIva += subtotal * IVA_RATE;
          }
          break;
        case TipoDetalleFactura.EXENTA:
          totalExenta += subtotal;
          break;
        case TipoDetalleFactura.NOSUJETO:
          totalNoSuj += subtotal;
          break;
        case TipoDetalleFactura.NOGRABADO:
          totalNoGravado += subtotal;
          break;
      }
    }

    const subtotalVentas = totalGravada + totalExenta + totalNoSuj;
    const subtotal = subtotalVentas - totalDescuento;
    const totalPagar = (tipoDte === '01' || tipoDte === '14')
      ? subtotal // FC y FSE: IVA incluido
      : subtotal + totalIva; // CCF: IVA aparte

    return {
      totalGravada,
      totalExenta,
      totalNoSuj,
      totalNoGravado,
      totalDescuento,
      totalIva,
      subtotalVentas,
      subtotal,
      totalPagar,
    };
  }

  /**
   * Genera el número de control del DTE
   */
  private generarNumeroControl(tipoDte: TipoDte, sucursal: any, bloque: any): string {
    const codEstable = (sucursal.cod_estable_MH || 'M001').substring(0, 4);
    const codPuntoVenta = (sucursal.cod_punto_venta_MH || 'P001').substring(0, 4);
    const correlativo = (bloque.actual + 1).toString().padStart(15, '0');

    return `DTE-${tipoDte}-${codEstable}${codPuntoVenta}-${correlativo}`;
  }

  /**
   * Prepara los parámetros para el builder de DTE
   */
  private prepararParametrosBuild(
    datos: any,
    tipoDte: TipoDte,
    codigoGeneracion: string,
    numeroControl: string,
    dto: CrearFacturaDirectaDto,
    totalesCalculados: any,
  ): BuildDteParams {
    const { generalData, sucursal, clienteDirecto } = datos;

    // Preparar datos del emisor
    const emisor: EmisorData = {
      nit: generalData.nit!,
      nrc: generalData.nrc!,
      nombre: generalData.razon || generalData.nombre_sistema,
      codActividad: generalData.cod_actividad || '62010',
      descActividad: generalData.desc_actividad || 'Actividades de programación informática',
      nombreComercial: generalData.nombre_comercial || null,
      tipoEstablecimiento: sucursal.DTETipoEstablecimiento?.codigo || '01',
      telefono: generalData.contactos || '',
      correo: generalData.correo || '',
      departamento: sucursal.Municipio?.Departamento?.codigo || '06',
      municipio: sucursal.Municipio?.codigo || '14',
      complemento: sucursal.complemento || generalData.direccion || '',
      codEstableMH: sucursal.cod_estable_MH || null,
      codEstable: sucursal.cod_estable || null,
      codPuntoVentaMH: sucursal.cod_punto_venta_MH || null,
      codPuntoVenta: sucursal.cod_punto_venta || null,
    };

    // Preparar datos del receptor
    let receptor: ReceptorData;

    if (tipoDte === '01') {
      // FC: receptor puede ser null o simplificado
      receptor = {
        tipoDocumento: clienteDirecto?.tipoDocumento?.codigo || null,
        numDocumento: dto.cliente_dui || dto.cliente_nit || clienteDirecto?.dui || clienteDirecto?.nit || null,
        nit: dto.cliente_nit || clienteDirecto?.nit || null,
        nrc: null, // FC no requiere NRC
        nombre: dto.cliente_nombre || clienteDirecto?.nombre || null,
        codActividad: null,
        descActividad: null,
        nombreComercial: null,
        telefono: dto.cliente_telefono || clienteDirecto?.telefono || null,
        correo: dto.cliente_correo || clienteDirecto?.correo || null,
        departamento: clienteDirecto?.municipio?.Departamento?.codigo || null,
        municipio: clienteDirecto?.municipio?.codigo || null,
        complemento: dto.cliente_direccion || clienteDirecto?.direccion || null,
      };
    } else if (tipoDte === '14') {
      // FSE: sujetoExcluido - requiere documento pero NO NRC
      receptor = {
        tipoDocumento: dto.id_tipo_documento_cliente?.toString() || clienteDirecto?.tipoDocumento?.codigo || '13', // Default: DUI
        numDocumento: dto.cliente_dui || dto.cliente_nit || clienteDirecto?.dui || clienteDirecto?.nit!,
        nit: null,
        nrc: null,
        nombre: dto.cliente_nombre || clienteDirecto?.nombre!,
        codActividad: clienteDirecto?.actividadEconomica?.codigo || null,
        descActividad: clienteDirecto?.actividadEconomica?.nombre || null,
        nombreComercial: null,
        telefono: dto.cliente_telefono || clienteDirecto?.telefono || null,
        correo: dto.cliente_correo || clienteDirecto?.correo || null,
        departamento: clienteDirecto?.municipio?.Departamento?.codigo || '01',
        municipio: clienteDirecto?.municipio?.codigo || '01',
        complemento: dto.cliente_direccion || clienteDirecto?.direccion || 'Sin dirección registrada',
      };
    } else {
      // CCF: receptor obligatorio con NIT y NRC
      receptor = {
        tipoDocumento: dto.id_tipo_documento_cliente?.toString() || clienteDirecto?.tipoDocumento?.codigo || '36',
        numDocumento: dto.cliente_nit || clienteDirecto?.nit!,
        nit: dto.cliente_nit || clienteDirecto?.nit!,
        nrc: dto.cliente_nrc || clienteDirecto?.registro_nrc!,
        nombre: dto.cliente_nombre || clienteDirecto?.nombre!,
        codActividad: clienteDirecto?.actividadEconomica?.codigo || null,
        descActividad: clienteDirecto?.actividadEconomica?.nombre || null,
        nombreComercial: null,
        telefono: dto.cliente_telefono || clienteDirecto?.telefono || null,
        correo: dto.cliente_correo || clienteDirecto?.correo || null,
        departamento: clienteDirecto?.municipio?.Departamento?.codigo || null,
        municipio: clienteDirecto?.municipio?.codigo || null,
        complemento: dto.cliente_direccion || clienteDirecto?.direccion || null,
      };
    }

    // Preparar items
    const itemsData: ItemData[] = dto.items.map((item) => {
      const tipo = item.tipo_detalle || TipoDetalleFactura.GRAVADO;
      return {
        tipoItem: 2, // Servicio por defecto
        codigo: item.codigo || null,
        descripcion: item.nombre + (item.descripcion ? ` - ${item.descripcion}` : ''),
        cantidad: item.cantidad,
        uniMedida: item.uni_medida || 99,
        precioUnitario: item.precio_unitario,
        descuento: item.descuento || 0,
        esGravado: tipo === TipoDetalleFactura.GRAVADO,
        esExento: tipo === TipoDetalleFactura.EXENTA,
        esNoSujeto: tipo === TipoDetalleFactura.NOSUJETO,
        idCatalogo: item.id_catalogo,
      };
    });

    return {
      ambiente: (generalData.ambiente || '00') as Ambiente,
      version: datos.tipoFactura?.version || 1,
      numeroControl,
      codigoGeneracion,
      emisor,
      receptor,
      items: itemsData,
      condicionOperacion: dto.condicion_operacion || 1,
      // pagos: dto.pagos?.map((p) => ({
      //   codigo: p.codigo,
      //   monto: redondearMonto(p.monto || 0),
      //   referencia: p.referencia,
      //   plazo: null,
      // })),
      observaciones: dto.observaciones,
      // FSE: retenciones
      ivaRetenido: dto.iva_retenido || 0,
      rentaRetenido: dto.renta_retenido || 0,
    };
  }

  /**
   * Guarda la factura en la BD
   */
  private async guardarFactura(
    documento: DteDocument,
    tipoDte: TipoDte,
    codigoGeneracion: string,
    numeroControl: string,
    numeroFactura: string,
    totales: any,
    datos: any,
    dto: CrearFacturaDirectaDto,
    idUsuario: number,
  ) {
    const { sucursal, bloque, clienteDirecto } = datos;

    // Calcular total en letras
    const totalLetras = numeroALetras(totales.totalPagar);

    return this.prisma.facturaDirecta.create({
      data: {
        // Numeración
        numero_factura: numeroFactura,

        // Snapshot del cliente
        cliente_nombre: dto.cliente_nombre || clienteDirecto?.nombre,
        cliente_nrc: dto.cliente_nrc || clienteDirecto?.registro_nrc,
        cliente_nit: dto.cliente_nit || clienteDirecto?.nit,
        cliente_direccion: dto.cliente_direccion || clienteDirecto?.direccion,
        cliente_telefono: dto.cliente_telefono || clienteDirecto?.telefono,
        cliente_correo: dto.cliente_correo || clienteDirecto?.correo,

        // Relaciones
        id_cliente_directo: dto.id_cliente_directo,
        id_tipo_factura: dto.id_tipo_factura,
        id_bloque: bloque.id_bloque,
        id_sucursal: sucursal.id_sucursal,
        id_usuario: idUsuario,
        id_metodo_pago: dto.id_metodo_pago,

        // Totales
        subtotal: totales.subtotal,
        subTotalVentas: totales.subtotalVentas,
        descuento: totales.totalDescuento,
        totalNoSuj: totales.totalNoSuj,
        totalExenta: totales.totalExenta,
        totalGravada: totales.totalGravada,
        totalNoGravado: totales.totalNoGravado,
        iva: totales.totalIva,
        iva_retenido: dto.iva_retenido || 0,
        iva_percibido: dto.iva_percibido || 0,
        renta_retenido: dto.renta_retenido || 0,
        total: totales.totalPagar,
        total_letras: totalLetras,

        // Pagos
        efectivo: dto.efectivo || 0,
        tarjeta: dto.tarjeta || 0,
        cheque: dto.cheque || 0,
        transferencia: dto.transferencia || 0,
        condicion_operacion: dto.condicion_operacion || 1,

        // Exportación (si aplica)
        flete: dto.flete || 0,
        seguro: dto.seguro || 0,
        recintoFiscal: dto.recintoFiscal,
        regimen: dto.regimen,
        codIncoterms: dto.codIncoterms,
        descIncoterms: dto.descIncoterms,
        tipoItemExpor: dto.tipoItemExpor,

        // Documento relacionado (para NC/ND)
        id_factura_original: dto.id_factura_original,

        // DTE
        codigo_generacion: codigoGeneracion,
        numero_control: numeroControl,
        dte_json: JSON.stringify(documento),
        estado_dte: 'BORRADOR',

        // Observaciones
        observaciones: dto.observaciones,

        // Detalle de items
        detalles: {
          create: dto.items.map((item, index) => {
            const tipo = item.tipo_detalle || TipoDetalleFactura.GRAVADO;
            const cantidad = item.cantidad || 0;
            const precioUnitario = item.precio_unitario || 0;
            const descuento = item.descuento || 0;
            const subtotalItem = cantidad * precioUnitario;
            const totalItem = subtotalItem - descuento;

            // Para FC y FSE: IVA incluido en precio. Para CCF: IVA aparte
            const ivaIncluido = tipoDte === '01' || tipoDte === '14';

            return {
              num_item: index + 1,
              codigo: item.codigo,
              nombre: item.nombre,
              descripcion: item.descripcion,
              nota: item.nota,
              cantidad,
              uni_medida: item.uni_medida || 99,
              precio_unitario: precioUnitario,
              precio_sin_iva: ivaIncluido ? precioUnitario / (1 + IVA_RATE) : precioUnitario,
              precio_con_iva: ivaIncluido ? precioUnitario : precioUnitario * (1 + IVA_RATE),
              tipo_detalle: tipo,
              venta_gravada: tipo === TipoDetalleFactura.GRAVADO ? totalItem : 0,
              venta_exenta: tipo === TipoDetalleFactura.EXENTA ? totalItem : 0,
              venta_nosujeto: tipo === TipoDetalleFactura.NOSUJETO ? totalItem : 0,
              venta_nograbada: tipo === TipoDetalleFactura.NOGRABADO ? totalItem : 0,
              subtotal: subtotalItem,
              descuento,
              iva: tipo === TipoDetalleFactura.GRAVADO
                ? (ivaIncluido ? totalItem - totalItem / (1 + IVA_RATE) : totalItem * IVA_RATE)
                : 0,
              total: totalItem,
              id_catalogo: item.id_catalogo,
              id_descuento: item.id_descuento,
            };
          }),
        },
      },
    });
  }

  /**
   * Actualiza el estado del DTE
   */
  private async actualizarEstadoDte(
    idFactura: number,
    estado: estado_dte,
    error?: string,
  ) {
    await this.prisma.facturaDirecta.update({
      where: { id_factura_directa: idFactura },
      data: {
        estado_dte: estado,
        ultimo_error_dte: error?.toString(),
        intentos_dte: { increment: 1 },
      },
    });
  }

  /**
   * Actualiza la factura con la respuesta de MH
   */
  private async actualizarConRespuestaMh(
    idFactura: number,
    result: TransmisionResult,
  ) {
    await this.prisma.facturaDirecta.update({
      where: { id_factura_directa: idFactura },
      data: {
        estado_dte: result.success ? 'PROCESADO' : 'RECHAZADO',
        sello_recepcion: result.selloRecibido,
        fecha_recepcion_mh: result.fechaProcesamiento,
        codigo_msg_mh: result.codigoMsg,
        descripcion_msg_mh: result.descripcionMsg,
        observaciones_mh: result.observaciones?.join('\n'),
        ultimo_error_dte: result.error,
        intentos_dte: { increment: 1 },
      },
    });
  }

  /**
   * Obtiene todos los datos necesarios para regenerar el DTE en un reenvío
   */
  private async obtenerDatosParaReenvio(idFactura: number) {
    // Obtener factura con todas las relaciones necesarias
    const factura = await this.prisma.facturaDirecta.findUnique({
      where: { id_factura_directa: idFactura },
      include: {
        tipoFactura: true,
        bloque: { include: { Tipo: true } },
        detalles: {
          include: {
            catalogo: {
              select: { id_catalogo: true, codigo: true, nombre: true },
            },
          },
          orderBy: { num_item: 'asc' },
        },
        sucursal: {
          include: {
            Municipio: { include: { Departamento: true } },
            DTETipoEstablecimiento: true,
          },
        },
        clienteDirecto: {
          include: {
            tipoDocumento: true,
            actividadEconomica: true,
            municipio: { include: { Departamento: true } },
          },
        },
      },
    });

    if (!factura) {
      throw new NotFoundException(`Factura con ID ${idFactura} no encontrada`);
    }

    // Obtener datos del emisor (empresa)
    const generalData = await this.prisma.generalData.findFirst();
    if (!generalData) {
      throw new InternalServerErrorException('No hay datos de empresa configurados');
    }

    if (!generalData.nit || !generalData.nrc) {
      throw new InternalServerErrorException('La empresa no tiene NIT o NRC configurado');
    }

    return { factura, generalData };
  }

  /**
   * Convierte los detalles de factura almacenados a ItemData para el builder
   */
  private convertirDetallesAItems(detalles: any[]): ItemData[] {
    return detalles.map((detalle) => ({
      tipoItem: 2, // Servicio por defecto
      codigo: detalle.codigo || null,
      descripcion: detalle.nombre + (detalle.descripcion ? ` - ${detalle.descripcion}` : ''),
      cantidad: Number(detalle.cantidad),
      uniMedida: detalle.uni_medida || 99,
      precioUnitario: Number(detalle.precio_unitario),
      descuento: Number(detalle.descuento) || 0,
      esGravado: detalle.tipo_detalle === TipoDetalleFactura.GRAVADO,
      esExento: detalle.tipo_detalle === TipoDetalleFactura.EXENTA,
      esNoSujeto: detalle.tipo_detalle === TipoDetalleFactura.NOSUJETO,
      idCatalogo: detalle.id_catalogo,
    }));
  }

  /**
   * Sanitiza identificadores (DUI, NIT, NRC) eliminando guiones y espacios
   * Ejemplo: "12-12-12 -23-23" → "1212122323"
   */
  private sanitizarIdentificador(valor: string | null | undefined): string | null {
    if (!valor) return null;
    return valor.replace(/[-\s]/g, '');
  }

  /**
   * Construye ReceptorData actualizado priorizando datos frescos de clienteDirecto
   * con fallback a snapshot almacenado en la factura
   */
  private construirReceptorActualizado(factura: any, tipoDte: TipoDte): ReceptorData {
    const clienteDirecto = factura.clienteDirecto;

    if (tipoDte === '01') {
      // FC: receptor puede ser null o simplificado
      return {
        tipoDocumento: clienteDirecto?.tipoDocumento?.codigo || null,
        numDocumento: this.sanitizarIdentificador(clienteDirecto?.dui || clienteDirecto?.nit || factura.cliente_nit),
        nit: this.sanitizarIdentificador(clienteDirecto?.nit || factura.cliente_nit),
        nrc: this.sanitizarIdentificador(clienteDirecto?.registro_nrc || factura.cliente_nrc) || '',
        nombre: clienteDirecto?.nombre || factura.cliente_nombre || null,
        codActividad: null,
        descActividad: null,
        nombreComercial: null,
        telefono: clienteDirecto?.telefono || factura.cliente_telefono || null,
        correo: clienteDirecto?.correo || factura.cliente_correo || null,
        departamento: clienteDirecto?.municipio?.Departamento?.codigo || null,
        municipio: clienteDirecto?.municipio?.codigo || null,
        complemento: clienteDirecto?.direccion || factura.cliente_direccion || null,
      };
    } else if (tipoDte === '14') {
      // FSE: sujetoExcluido - requiere documento pero NO NRC
      return {
        tipoDocumento: clienteDirecto?.tipoDocumento?.codigo || '13', // Default: DUI
        numDocumento: this.sanitizarIdentificador(clienteDirecto?.nit || clienteDirecto?.dui || factura.cliente_nit) || '',
        nit: null,
        nrc: null,
        nombre: clienteDirecto?.nombre || factura.cliente_nombre!,
        codActividad: clienteDirecto?.actividadEconomica?.codigo || null,
        descActividad: clienteDirecto?.actividadEconomica?.nombre || null,
        nombreComercial: null,
        telefono: clienteDirecto?.telefono || factura.cliente_telefono || null,
        correo: clienteDirecto?.correo || factura.cliente_correo || null,
        departamento: clienteDirecto?.municipio?.Departamento?.codigo || '01',
        municipio: clienteDirecto?.municipio?.codigo || '01',
        complemento: clienteDirecto?.direccion || factura.cliente_direccion || 'Sin dirección registrada',
      };
    } else {
      // CCF: receptor obligatorio con NIT y NRC
      return {
        tipoDocumento: clienteDirecto?.tipoDocumento?.codigo || '36',
        numDocumento: this.sanitizarIdentificador(clienteDirecto?.nit || factura.cliente_nit) || '',
        nit: this.sanitizarIdentificador(clienteDirecto?.nit || factura.cliente_nit) || '',
        nrc: this.sanitizarIdentificador(clienteDirecto?.registro_nrc || factura.cliente_nrc) || '',
        nombre: clienteDirecto?.nombre || factura.cliente_nombre!,
        codActividad: clienteDirecto?.actividadEconomica?.codigo || null,
        descActividad: clienteDirecto?.actividadEconomica?.nombre || null,
        nombreComercial: null,
        telefono: clienteDirecto?.telefono || factura.cliente_telefono || null,
        correo: clienteDirecto?.correo || factura.cliente_correo || null,
        departamento: clienteDirecto?.municipio?.Departamento?.codigo || null,
        municipio: clienteDirecto?.municipio?.codigo || null,
        complemento: clienteDirecto?.direccion || factura.cliente_direccion || null,
      };
    }
  }

  /**
   * Construye EmisorData desde los datos actualizados de generalData y sucursal
   */
  private construirEmisorActualizado(generalData: any, sucursal: any): EmisorData {
    return {
      nit: this.sanitizarIdentificador(generalData.nit) || '',
      nrc: this.sanitizarIdentificador(generalData.nrc) || '',
      nombre: generalData.razon || generalData.nombre_sistema,
      codActividad: generalData.cod_actividad || '62010',
      descActividad: generalData.desc_actividad || 'Actividades de programación informática',
      nombreComercial: generalData.nombre_comercial || null,
      tipoEstablecimiento: sucursal.DTETipoEstablecimiento?.codigo || '01',
      telefono: generalData.contactos || '',
      correo: generalData.correo || '',
      departamento: sucursal.Municipio?.Departamento?.codigo || '06',
      municipio: sucursal.Municipio?.codigo || '14',
      complemento: sucursal.complemento || generalData.direccion || '',
      codEstableMH: sucursal.cod_estable_MH || null,
      codEstable: sucursal.cod_estable || null,
      codPuntoVentaMH: sucursal.cod_punto_venta_MH || null,
      codPuntoVenta: sucursal.cod_punto_venta || null,
    };
  }

  // ==================== GENERACIÓN DE PDF ====================

  /**
   * Genera un PDF del DTE usando jsReport
   * Soporta todos los tipos: FC(01), CCF(03), NC(05), ND(06), FEX(11), FSE(14)
   * @param id ID de la factura/documento
   * @returns Buffer con el PDF generado
   */
  async generatePdf(id: number): Promise<Buffer> {
    // 1. Obtener documento con todas las relaciones
    const factura = await this.findOne(id);

    // 2. Validar que existe el JSON del DTE
    if (!factura.dte_json) {
      throw new BadRequestException(
        'El documento no tiene un DTE generado. No se puede generar PDF.',
      );
    }

    // 3. Parsear el JSON del DTE
    let dteDocument: any;
    try {
      dteDocument = JSON.parse(factura.dte_json as string);
    } catch {
      throw new BadRequestException('El JSON del DTE está corrupto.');
    }

    // 4. Obtener tipo de DTE y seleccionar template
    const tipoDte = dteDocument.identificacion?.tipoDte;
    const templateFile = this.getTemplateForTipoDte(tipoDte);
    const templatePath = path.join(process.cwd(), 'templates/facturacion', templateFile);

    if (!fs.existsSync(templatePath)) {
      throw new NotFoundException(
        `Plantilla para tipo ${tipoDte} no encontrada: ${templateFile}`,
      );
    }

    const templateHtml = fs.readFileSync(templatePath, 'utf-8');

    // 5. Preparar datos según el tipo de DTE
    const templateData = await this.prepareTemplateData(dteDocument, factura, tipoDte);

    // 6. Enviar a jsReport
    const API_REPORT = process.env.API_REPORT || 'https://reports.edal.group/api/report';

    try {
      const response = await axios.post(
        API_REPORT,
        {
          template: {
            content: templateHtml,
            engine: 'jsrender',
            recipe: 'chrome-pdf',
            helpers: JSRENDER_HELPERS,
          },
          data: templateData,
          options: {
            reportName: `${this.getNombreTipoDte(tipoDte)}_${factura.numero_control || id}`,
          },
        },
        {
          responseType: 'arraybuffer',
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000,
        },
      );

      this.logger.log(`PDF generado - Tipo: ${tipoDte}, ID: ${id}`);
      return Buffer.from(response.data);
    } catch (error) {
      this.logger.error(`Error generando PDF [${tipoDte}] ID ${id}:`, error);
      throw new BadRequestException(
        'Error al generar el PDF. Por favor intente nuevamente.',
      );
    }
  }

  /**
   * Selecciona el template HTML según el tipo de DTE
   */
  private getTemplateForTipoDte(tipoDte: string): string {
    const templateMap: Record<string, string> = {
      '01': 'dte-factura.html',     // FC - Factura Consumidor Final
      '03': 'dte-factura.html',     // CCF - Comprobante Crédito Fiscal
      '05': 'dte-nota.html',        // NC - Nota de Crédito
      '06': 'dte-nota.html',        // ND - Nota de Débito
      '11': 'dte-exportacion.html', // FEX - Factura Exportación
      '14': 'dte-excluido.html',    // FSE - Factura Sujeto Excluido
    };

    const template = templateMap[tipoDte];
    if (!template) {
      throw new BadRequestException(`Tipo de DTE no soportado: ${tipoDte}`);
    }
    return template;
  }

  /**
   * Prepara los datos del DTE para el template
   */
  private async prepareTemplateData(
    dteDocument: any,
    factura: any,
    tipoDte: string,
  ): Promise<Record<string, any>> {
    // Flags de tipo
    const esFC = tipoDte === '01';
    const esCCF = tipoDte === '03';
    const esNC = tipoDte === '05';
    const esND = tipoDte === '06';
    const esFEX = tipoDte === '11';
    const esFSE = tipoDte === '14';
    const esNota = esNC || esND;

    // Color según tipo
    const colorMap: Record<string, string> = {
      '01': '#e8f5e9', // Verde claro - FC
      '03': '#e3f2fd', // Azul claro - CCF
      '05': '#fff3e0', // Naranja claro - NC
      '06': '#fce4ec', // Rosa claro - ND
      '11': '#f3e5f5', // Púrpura claro - FEX
      '14': '#efebe9', // Gris claro - FSE
    };

    // URL QR para verificación MH
    const qrUrl = await this.buildQrUrl(dteDocument, factura);
    return {
      // Tipo de documento
      tipoDte,
      esFC,
      esCCF,
      esNC,
      esND,
      esFEX,
      esFSE,
      esNota,
      nombreFactura: this.getNombreTipoDte(tipoDte),
      colorBack: colorMap[tipoDte] || '#f5f5f5',

      // Identificación
      identificacion: {
        ...dteDocument.identificacion,
        tipoModelo: dteDocument.identificacion?.tipoModelo === 1 ? 'Previo' : 'Diferido',
        tipoOperacion: dteDocument.identificacion?.tipoOperacion === 1 ? 'Normal' : 'Contingencia',
      },

      // Emisor
      emisor: dteDocument.emisor,

      // Receptor (varía según tipo)
      receptor: esFSE ? dteDocument.sujetoExcluido : dteDocument.receptor,

      // Items
      cuerpoDocumento: dteDocument.cuerpoDocumento || [],

      // Resumen
      resumen: dteDocument.resumen,

      // Documento relacionado (para NC/ND)
      documentoRelacionado: esNota ? dteDocument.documentoRelacionado : null,

      // Datos de exportación (para FEX)
      exportacion: esFEX
        ? {
          flete: dteDocument.resumen?.flete,
          seguro: dteDocument.resumen?.seguro,
          codIncoterms: dteDocument.otrosDocumentos?.codIncoterms,
          descIncoterms: dteDocument.otrosDocumentos?.descIncoterms,
        }
        : null,

      // Estado DTE
      selloRecibido: factura.sello_recepcion || '',
      esValidoMH: factura.estado_dte === 'PROCESADO',
      estadoDte: factura.estado_dte,

      // QR
      qr: qrUrl,

      // Condición y método de pago
      condicionOperacion: this.getCondicionLabel(dteDocument.resumen?.condicionOperacion),
      metodoPago: (factura as any).metodoPago?.nombre || 'Efectivo',

      // Vendedor
      vendedor: (factura as any).usuario
        ? `${(factura as any).usuario.nombres} ${(factura as any).usuario.apellidos}`
        : '',

      // Observaciones
      nota: dteDocument.extension?.observaciones || factura.observaciones || '',

      // Código cliente (usa el ID del cliente directo)
      codigoCliente: factura.id_cliente_directo?.toString() || '',

      // Correlativo formateado
      correlativo: factura.numero_factura || '',
    };
  }

  /**
   * Obtiene el nombre legible del tipo de DTE
   */
  private getNombreTipoDte(tipoDte: string): string {
    const tipos: Record<string, string> = {
      '01': 'FACTURA CONSUMIDOR FINAL',
      '03': 'COMPROBANTE DE CRÉDITO FISCAL',
      '05': 'NOTA DE CRÉDITO',
      '06': 'NOTA DE DÉBITO',
      '11': 'FACTURA DE EXPORTACIÓN',
      '14': 'FACTURA SUJETO EXCLUIDO',
    };
    return tipos[tipoDte] || 'DOCUMENTO TRIBUTARIO';
  }

  /**
   * Obtiene la etiqueta de condición de operación
   */
  private getCondicionLabel(condicion: number): string {
    const condiciones: Record<number, string> = {
      1: 'Contado',
      2: 'Crédito',
      3: 'Otro',
    };
    return condiciones[condicion] || 'Contado';
  }

  /**
   * Construye la URL del QR para verificación en el portal del MH
   */
  private async buildQrUrl(dteDocument: any, factura: any): Promise<string> {
    if (factura.estado_dte !== 'PROCESADO') return '';

    const { ambiente, codigoGeneracion, fecEmi } = dteDocument.identificacion || {};
    if (!codigoGeneracion || !fecEmi) return '';

    const baseUrl = 'https://admin.factura.gob.sv/consultaPublica';

    const data = `${baseUrl}?ambiente=${ambiente}&codGen=${codigoGeneracion}&fechaEmi=${fecEmi}`;
    return await QRCode.toDataURL(data);
  }

  /**
   * Reenvía la factura por correo electrónico al cliente
   */
  async reenviarCorreo(idFactura: number): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    const factura = await this.prisma.facturaDirecta.findUnique({
      where: { id_factura_directa: idFactura },
      include: { clienteDirecto: true },
    });

    if (!factura) {
      return { success: false, error: 'Factura no encontrada' };
    }

    // Validar email
    const emailDestino = factura.clienteDirecto?.correo || factura.cliente_correo;
    if (!emailDestino) {
      return { success: false, error: 'No hay correo electrónico registrado para el cliente' };
    }

    // Validar que tenga DTE procesado
    if (!factura.dte_json || !factura.numero_control) {
      return { success: false, error: 'La factura no tiene DTE generado' };
    }

    try {
      // Generar PDF
      const pdfBuffer = await this.generatePdf(idFactura);

      // Construir JSON completo con firma y sello
      let dteJsonCompleto = factura.dte_json;
      try {
        const dteObj = JSON.parse(factura.dte_json);
        if (factura.dte_firmado) {
          dteObj.firmaElectronica = factura.dte_firmado;
        }
        if (factura.sello_recepcion) {
          dteObj.selloRecibido = factura.sello_recepcion;
        }
        dteJsonCompleto = JSON.stringify(dteObj, null, 4);
      } catch (parseError) {
        this.logger.warn(`Error parseando dte_json, se enviará sin firma/sello`);
      }

      // Enviar correo
      await this.mailService.sendFacturaEmail(
        emailDestino,
        factura.cliente_nombre || 'Cliente',
        factura.numero_control,
        factura.codigo_generacion || '',
        pdfBuffer,
        dteJsonCompleto,
      );

      this.logger.log(`Factura ${idFactura}: Correo reenviado a ${emailDestino}`);
      return { success: true, message: `Correo enviado a ${emailDestino}` };
    } catch (error) {
      this.logger.error(`Factura ${idFactura}: Error reenviando correo: ${error.message}`);
      return { success: false, error: 'Error al enviar el correo' };
    }
  }

  /**
   * Envía la factura por correo de forma asíncrona (fire-and-forget)
   * No bloquea el flujo principal si falla
   */
  private enviarFacturaPorCorreoAsync(idFactura: number): void {
    (async () => {
      try {
        const factura = await this.prisma.facturaDirecta.findUnique({
          where: { id_factura_directa: idFactura },
          include: { clienteDirecto: true },
        });

        if (!factura) return;

        // Determinar email destino (priorizar email de la factura, luego del cliente)
        const emailDestino = factura.clienteDirecto?.correo || factura.cliente_correo;

        if (!emailDestino) {
          this.logger.warn(
            `Factura ${idFactura}: No hay email de cliente para enviar DTE`,
          );
          return;
        }

        if (!factura.dte_json || !factura.numero_control) {
          this.logger.warn(
            `Factura ${idFactura}: Faltan datos para enviar DTE`,
          );
          return;
        }

        // Generar PDF
        const pdfBuffer = await this.generatePdf(idFactura);

        // Construir JSON completo con firma y sello para el correo
        let dteJsonCompleto = factura.dte_json;
        try {
          const dteObj = JSON.parse(factura.dte_json);
          if (factura.dte_firmado) {
            dteObj.firmaElectronica = factura.dte_firmado;
          }
          if (factura.sello_recepcion) {
            dteObj.selloRecibido = factura.sello_recepcion;
          }
          dteJsonCompleto = JSON.stringify(dteObj, null, 4);
        } catch (parseError) {
          this.logger.warn(
            `Factura ${idFactura}: Error parseando dte_json, se enviará sin firma/sello`,
          );
        }

        // Enviar correo
        await this.mailService.sendFacturaEmail(
          emailDestino,
          factura.cliente_nombre || 'Cliente',
          factura.numero_control,
          factura.codigo_generacion || '',
          pdfBuffer,
          dteJsonCompleto,
        );

        this.logger.log(
          `Factura ${idFactura}: DTE enviado por correo a ${emailDestino}`,
        );
      } catch (error) {
        this.logger.error(
          `Factura ${idFactura}: Error enviando DTE por correo: ${error.message}`,
        );
      }
    })();
  }
}
