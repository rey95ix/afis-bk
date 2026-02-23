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
import { CxcService } from '../../cxc/cxc.service';
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
import { TipoDte, Ambiente, DteDocument } from '../interfaces';
import { estado_dte, facturaDirecta, Prisma } from '@prisma/client';
import { MailService } from '../../mail/mail.service';
import { MovimientosBancariosService } from '../../bancos/movimientos-bancarios/movimientos-bancarios.service';

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
 * Iconos SVG base64 para redes sociales en templates de factura.
 * Se usan como data URIs en <img src="..."> dentro del HTML del PDF.
 */
const SOCIAL_ICONS = {
  facebook: 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>').toString('base64'),
  instagram: 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#E4405F"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>').toString('base64'),
  whatsapp: 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>').toString('base64'),
  telefono: 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#333333"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>').toString('base64'),
  web: 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#333333"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>').toString('base64'),
};

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
    private readonly cxcService: CxcService,
    private readonly movimientosBancariosService: MovimientosBancariosService,
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
      const totalesCalculados = this.calcularTotales(dto.items, tipoDte, dto);

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

        // Crear CxC si es factura a crédito
        if ((dto.condicion_operacion || 1) === 2 && dto.id_cliente_directo) {
          try {
            const cxc = await this.cxcService.crearCuentaPorCobrar({
              id_factura_directa: facturaCreada.id_factura_directa,
              id_cliente_directo: dto.id_cliente_directo,
              monto_total: totales.totalPagar,
              dias_credito: dto.dias_credito || 30,
              fecha_emision: facturaCreada.fecha_creacion,
              id_sucursal: datos.sucursal.id_sucursal,
              id_usuario: idUsuario,
            });

            // Registrar abono inicial si se proporcionó
            if ((dto.abono_monto ?? 0) > 0 && dto.abono_medio_pago) {
              try {
                // Mapear TARJETA → DEPOSITO cuando hay cuenta bancaria (patrón existente)
                let metodoPago = dto.abono_medio_pago as any;
                if (metodoPago === 'TARJETA' && dto.abono_id_cuenta_bancaria) {
                  metodoPago = 'DEPOSITO';
                }

                await this.cxcService.registrarAbono(
                  cxc.id_cxc,
                  {
                    monto: dto.abono_monto,
                    metodo_pago: metodoPago,
                    id_cuenta_bancaria: dto.abono_id_cuenta_bancaria || undefined,
                    observaciones: `Abono inicial al crear factura #${facturaCreada.numero_factura || facturaCreada.id_factura_directa}`,
                  } as any,
                  idUsuario,
                );
                this.logger.log(`Abono inicial de $${dto.abono_monto} registrado para CxC #${cxc.id_cxc}`);
              } catch (abonoError) {
                this.logger.error(`Error al registrar abono inicial para CxC #${cxc.id_cxc}: ${abonoError.message}`);
                // No bloquear la factura si falla el abono
              }
            }
          } catch (error) {
            this.logger.error(`Error al crear CxC para factura #${facturaCreada.id_factura_directa}: ${error.message}`);
            // No bloquear la factura si falla la CxC
          }
        }

        // Crear movimientos bancarios para pagos no-efectivo (contado)
        if ((dto.condicion_operacion || 1) === 1) {
          await this.crearMovimientosBancarios(facturaCreada.id_factura_directa, dto, idUsuario, facturaCreada.numero_factura || '');
        }

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

    // Excluir facturas proyectadas de contratos sin datos DTE
    where.NOT = {
      id_cliente: { gt: 0 },
      id_cliente_directo: null,
      codigo_generacion: null,
      numero_control: null,
    };

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
      console.log('Firmando evento de anulación...');
      console.log(evento);
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
        // Actualizar factura con datos de anulación
        await this.prisma.facturaDirecta.update({
          where: { id_factura_directa: id },
          data: {
            estado_dte: 'INVALIDADO',
            estado: 'ANULADO',
            anulacion_codigo_generacion: codigoGeneracion,
            anulacion_sello_recepcion: transmitResult.selloRecibido,
            anulacion_json: JSON.stringify(evento),
            anulacion_firmada: signResult.documentoFirmado,
            fecha_anulacion: new Date(),
            anulacion_motivo:
              dto.motivoAnulacion || this.obtenerMotivoAnulacionTexto(dto.tipoAnulacion),
            anulacion_codigo_msg: transmitResult.codigoMsg || null,
            anulacion_descripcion_msg: transmitResult.descripcionMsg || null,
          },
        });

        this.logger.log(
          `Factura directa anulada exitosamente. Sello: ${transmitResult.selloRecibido}`,
        );

        // Anular CxC asociada si existe
        await this.cxcService.anularCxcPorFactura(id);

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
   * Obtiene el texto descriptivo para el tipo de anulación
   */
  private obtenerMotivoAnulacionTexto(tipoAnulacion: number): string {
    switch (tipoAnulacion) {
      case 1:
        return 'Error en información del documento';
      case 2:
        return 'Rescindir la operación';
      case 3:
        return 'Otro motivo';
      default:
        return 'Motivo no especificado';
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
    let dteDoc: any = null;
    if (factura.dte_json) {
      try {
        dteDoc = JSON.parse(factura.dte_json);
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
      fechaEmision: dteDoc.identificacion.fecEmi,
      montoIva: Number(factura.iva) || 0,
      tipoDocumentoReceptor: receptorData.tipoDocumento || '36',
      numDocumentoReceptor: receptorData.numDocumento || receptorData.nit || '',
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

    // 3.5. Validar cliente para factura a crédito
    if ((dto.condicion_operacion || 1) === 2 && !dto.id_cliente_directo) {
      throw new BadRequestException('Las facturas a crédito requieren un cliente registrado');
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
  private calcularTotales(items: ItemFacturaDirectaDto[], tipoDte: TipoDte, factura: CrearFacturaDirectaDto) {
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
    let totalPagar = (tipoDte === '01' || tipoDte === '14')
      ? subtotal // FC y FSE: IVA incluido
      : subtotal + totalIva; // CCF: IVA aparte
    if (factura.iva_retenido && factura.iva_retenido > 0) {
      totalPagar -= factura.iva_retenido;
    }
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
        descripcion: item.nombre + (item.nota ? ` - ${item.nota}` : ''),
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
      // Descuentos por tipo (CCF)
      descuNoSuj: dto.descuNoSuj || 0,
      descuExenta: dto.descuExenta || 0,
      descuGravada: dto.descuGravada || 0,
      porcentajeDescuento: dto.porcentajeDescuento || 0,
      // IVA percibido
      ivaPercibido: dto.iva_percibido || 0,
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
        id_cuenta_tarjeta: dto.id_cuenta_tarjeta || null,
        id_cuenta_cheque: dto.id_cuenta_cheque || null,
        id_cuenta_transferencia: dto.id_cuenta_transferencia || null,
        condicion_operacion: dto.condicion_operacion || 1,
        dias_credito: (dto.condicion_operacion || 1) === 2 ? (dto.dias_credito || 30) : null,
        fecha_pago_estimada: (dto.condicion_operacion || 1) === 2
          ? new Date(Date.now() + ((dto.dias_credito || 30) * 24 * 60 * 60 * 1000))
          : null,
        estado_pago: (dto.condicion_operacion || 1) === 2 ? 'PENDIENTE' : 'PAGADO',

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
   * Crear movimientos bancarios ENTRADA para pagos no-efectivo (tarjeta, cheque, transferencia)
   * Se ejecuta solo en facturas de contado. Errores se loguean pero NO bloquean la factura.
   */
  private async crearMovimientosBancarios(
    idFactura: number,
    dto: CrearFacturaDirectaDto,
    idUsuario: number,
    numeroFactura: string,
  ): Promise<void> {
    const pagos: { monto: number; idCuenta?: number; metodo: 'DEPOSITO' | 'CHEQUE' | 'TRANSFERENCIA'; label: string }[] = [
      { monto: dto.tarjeta || 0, idCuenta: dto.id_cuenta_tarjeta, metodo: 'DEPOSITO', label: 'tarjeta' },
      { monto: dto.cheque || 0, idCuenta: dto.id_cuenta_cheque, metodo: 'CHEQUE', label: 'cheque' },
      { monto: dto.transferencia || 0, idCuenta: dto.id_cuenta_transferencia, metodo: 'TRANSFERENCIA', label: 'transferencia' },
    ];

    for (const pago of pagos) {
      if (pago.monto > 0 && pago.idCuenta) {
        try {
          const hoy = new Date().toISOString().split('T')[0];
          const detalles: Record<string, any> = {};
          if (pago.metodo === 'TRANSFERENCIA') {
            detalles.transferencia = { fecha_transferencia: hoy };
          } else if (pago.metodo === 'CHEQUE') {
            detalles.cheque = { numero_cheque: 'N/A', beneficiario: 'Pago factura', fecha_emision: hoy };
          } else if (pago.metodo === 'DEPOSITO') {
            detalles.deposito = { tipo_deposito: 'EFECTIVO', fecha_deposito: hoy };
          }
          await this.movimientosBancariosService.crearMovimiento(
            {
              id_cuenta_bancaria: pago.idCuenta,
              tipo_movimiento: 'ENTRADA',
              metodo: pago.metodo,
              monto: pago.monto,
              modulo_origen: 'VENTAS',
              documento_origen_id: idFactura,
              descripcion: `Pago ${pago.label} - Factura directa #${numeroFactura}`,
              ...detalles,
            },
            idUsuario,
          );
        } catch (error) {
          this.logger.error(`Error al crear movimiento bancario (${pago.label}) para factura #${numeroFactura}: ${error.message}`);
          // No bloquear la factura si falla el movimiento bancario
        }
      }
    }
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
      tipoItem: 2, // TODO: Servicio por defecto
      codigo: detalle.codigo || null,
      descripcion: detalle.nombre + (detalle.nota ? ` - ${detalle.nota}` : ''),
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
        codActividad: clienteDirecto?.actividadEconomica?.codigo || null,
        descActividad: clienteDirecto?.actividadEconomica?.nombre || null,
        nombreComercial: clienteDirecto?.nombreComercial || null,
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
        nombreComercial: clienteDirecto?.nombreComercial || null,
        telefono: clienteDirecto?.telefono?.length > 0 ? clienteDirecto?.telefono : null,
        correo: clienteDirecto?.correo?.length > 0 ? clienteDirecto?.correo : null,
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
    const templateFile = (factura as any).tipoFactura?.template_html || this.getTemplateForTipoDte(tipoDte);
    const templatePath = path.join(process.cwd(), 'templates/facturacion', templateFile);

    if (!fs.existsSync(templatePath)) {
      throw new NotFoundException(
        `Plantilla para tipo ${tipoDte} no encontrada: ${templateFile}`,
      );
    }

    const templateHtml = fs.readFileSync(templatePath, 'utf-8');

    // 5. Obtener datos generales (branding, redes sociales)
    const generalData = await this.prisma.generalData.findFirst();

    // 6. Preparar datos según el tipo de DTE
    const templateData = await this.prepareTemplateData(dteDocument, factura, tipoDte, generalData);

    // 7. Enviar a jsReport
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
            chrome: {
              marginTop: '1cm',
              marginBottom: '1cm',
              marginLeft: '0.5cm',
              marginRight: '0.5cm',
            }
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
    generalData?: any,
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
    let receptor = {
      ...esFSE ? dteDocument.sujetoExcluido : dteDocument.receptor,
      tipoDocumento: 'NIT' // Forzar NIT en el template
    }
    const documento = await this.prisma.dTETipoDocumentoIdentificacion.findFirst({
      where: { codigo: receptor.tipoDocumento },
    });
    if (documento) {
      receptor.tipoDocumento = documento.nombre;
    }
    // URL QR para verificación MH
    const qrUrl = await this.buildQrUrl(dteDocument, factura);
    dteDocument.emisor.tipoEstablecimiento = 'Casa Matriz'; // Forzar etiqueta en el template
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
      colorBack: generalData?.color_icono || '#f5f5f5',

      // Identificación
      identificacion: {
        ...dteDocument.identificacion,
        tipoModelo: dteDocument.identificacion?.tipoModelo === 1 ? 'Previo' : 'Diferido',
        tipoOperacion: dteDocument.identificacion?.tipoOperacion === 1 ? 'Normal' : 'Contingencia',
      },

      // Emisor
      emisor: dteDocument.emisor,

      // Receptor (varía según tipo)
      receptor,

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

      // Branding e iconos
      iconInvoice: (factura as any).sucursal?.icono_factura || generalData?.icono_factura || '',

      // Redes sociales (desde GeneralData)
      url_facebook: generalData?.url_facebook || '',
      perfil_facebook: generalData?.perfil_facebook || '',
      url_instagram: generalData?.url_instagram || '',
      perfil_instagram: generalData?.perfil_instagram || '',
      url_web: generalData?.url_pagina_web || '',
      whatsapp: generalData?.whatsapp || '',

      // Iconos de redes sociales (SVG inline base64)
      facebook_icon: SOCIAL_ICONS.facebook,
      instagram_icon: SOCIAL_ICONS.instagram,
      whatsapp_icon: SOCIAL_ICONS.whatsapp,
      telefono_icon: SOCIAL_ICONS.telefono,
      web_icon: SOCIAL_ICONS.web,
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

  // ====================================================================
  // FACTURAS PROYECTADAS DE CONTRATO
  // ====================================================================

  /**
   * Genera todas las facturas proyectadas para un contrato recién activado.
   * Las facturas se crean como BORRADOR sin firmar ni enviar a MH.
   *
   * Firma y envía a MH una factura proyectada que ya está 100% pagada.
   * Asigna bloque, numero_factura, construye DTE, firma y transmite.
   */
  async firmarYEnviarFactura(
    idFactura: number,
    idUsuario: number,
  ): Promise<CrearFacturaDirectaResult> {
    this.logger.log(`Iniciando firma diferida para factura #${idFactura}`);

    // 1. Cargar factura con relaciones
    const factura = await this.prisma.facturaDirecta.findUnique({
      where: { id_factura_directa: idFactura },
      include: {
        contrato: {
          include: { cliente: { include: { datosfacturacion: { where: { estado: 'ACTIVO' }, take: 1 } } } },
        },
        detalles: { orderBy: { num_item: 'asc' } },
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
      throw new NotFoundException(`Factura #${idFactura} no encontrada`);
    }

    if (factura.estado_dte === 'PROCESADO') {
      this.logger.warn(`Factura #${idFactura} ya fue procesada en MH`);
      return {
        success: true,
        idFactura,
        codigoGeneracion: factura.codigo_generacion || undefined,
        numeroControl: factura.numero_control || undefined,
        estado: 'PROCESADO',
        selloRecibido: factura.sello_recepcion || undefined,
      };
    }

    // 2. Obtener generalData y sucursal
    const generalData = await this.prisma.generalData.findFirst();
    if (!generalData || !generalData.nit || !generalData.nrc) {
      throw new InternalServerErrorException('No hay datos de empresa configurados (NIT/NRC)');
    }

    const sucursal = factura.sucursal;

    // 3. Determinar tipo de DTE (FC o CCF según datos de facturación)
    const datosFacturacion = factura.contrato?.cliente?.datosfacturacion?.[0];
    const tieneNitNrc = datosFacturacion?.nit && datosFacturacion?.nrc;
    const tipoDte: TipoDte = tieneNitNrc ? '03' : '01';

    // 4. Obtener tipo de factura y bloque
    const tipoFactura = await this.prisma.facturasTipos.findFirst({
      where: { codigo: tipoDte },
    });
    if (!tipoFactura) {
      throw new BadRequestException(`Tipo de factura ${tipoDte} no encontrado`);
    }

    const bloque = await this.prisma.facturasBloques.findFirst({
      where: {
        id_sucursal: sucursal.id_sucursal,
        estado: 'ACTIVO',
        Tipo: { codigo: tipoDte },
      },
      include: { Tipo: true },
    });

    if (!bloque) {
      throw new BadRequestException(`No hay bloques de facturas para tipo ${tipoDte} en la sucursal`);
    }

    if (bloque.actual >= bloque.hasta) {
      throw new BadRequestException(`El bloque de facturas ${bloque.serie} está agotado`);
    }

    // 5. Generar identificación
    const codigoGeneracion = factura.codigo_generacion || uuidv4().toUpperCase();
    const numeroControl = this.generarNumeroControl(tipoDte, sucursal, bloque);
    const numeroFactura = (bloque.actual + 1).toString().padStart(10, '0');

    // 6. Construir DTE
    const emisor = this.construirEmisorActualizado(generalData, sucursal);
    const items = this.convertirDetallesAItems(factura.detalles);

    // Receptor: usar snapshot de la factura o cliente directo
    let receptor: ReceptorData;
    if (factura.clienteDirecto) {
      receptor = this.construirReceptorActualizado(factura, tipoDte);
    } else {
      // Para facturas de contrato, construir receptor desde datos de facturación
      receptor = {
        tipoDocumento: tieneNitNrc ? '36' : null,
        numDocumento: this.sanitizarIdentificador(factura.cliente_nit) || null,
        nit: this.sanitizarIdentificador(factura.cliente_nit) || null,
        nrc: this.sanitizarIdentificador(factura.cliente_nrc) || '',
        nombre: factura.cliente_nombre || '',
        codActividad: null,
        descActividad: null,
        nombreComercial: null,
        telefono: factura.cliente_telefono || null,
        correo: factura.cliente_correo || null,
        departamento: null,
        municipio: null,
        complemento: factura.cliente_direccion || null,
      };
    }

    const buildParams: BuildDteParams = {
      ambiente: (generalData.ambiente || '00') as Ambiente,
      version: tipoDte === '03' ? this.ccfBuilder.getVersion() : this.fcBuilder.getVersion(),
      numeroControl,
      codigoGeneracion,
      emisor,
      receptor,
      items,
      condicionOperacion: 1, // Contado (ya está pagada)
    };

    const builder = tipoDte === '03' ? this.ccfBuilder : this.fcBuilder;
    const { documento, totales } = builder.build(buildParams);

    // 7. Actualizar factura con datos del DTE
    await this.prisma.facturaDirecta.update({
      where: { id_factura_directa: idFactura },
      data: {
        numero_factura: numeroFactura,
        id_bloque: bloque.id_bloque,
        id_tipo_factura: tipoFactura.id_tipo_factura,
        codigo_generacion: codigoGeneracion,
        numero_control: numeroControl,
        dte_json: JSON.stringify(documento),
        total_letras: numeroALetras(totales.totalPagar),
      },
    });

    // 8. Firmar DTE
    const signResult = await this.signer.firmar(generalData.nit!, documento);
    if (!signResult.success) {
      await this.actualizarEstadoDte(idFactura, 'BORRADOR', signResult.error);
      return {
        success: false,
        idFactura,
        codigoGeneracion,
        numeroControl,
        estado: 'BORRADOR',
        error: `Error al firmar: ${signResult.error}`,
      };
    }

    await this.prisma.facturaDirecta.update({
      where: { id_factura_directa: idFactura },
      data: { dte_firmado: signResult.documentoFirmado, estado_dte: 'FIRMADO' },
    });

    // 9. Transmitir a MH
    const transmitResult = await this.transmitter.transmitirDte(
      {
        ambiente: generalData.ambiente as Ambiente,
        idEnvio: 1,
        version: tipoFactura.version || builder.getVersion(),
        tipoDte,
        documento: signResult.documentoFirmado!,
        codigoGeneracion,
      },
      generalData.nit!,
    );

    // 10. Actualizar estado final
    await this.actualizarConRespuestaMh(idFactura, transmitResult);

    // Actualizar correlativo del bloque
    await this.prisma.facturasBloques.update({
      where: { id_bloque: bloque.id_bloque },
      data: { actual: bloque.actual + 1 },
    });

    if (transmitResult.success) {
      this.logger.log(`Factura #${idFactura} firmada y transmitida. Sello: ${transmitResult.selloRecibido}`);
      this.enviarFacturaPorCorreoAsync(idFactura);

      return {
        success: true,
        idFactura,
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
        idFactura,
        codigoGeneracion,
        numeroControl,
        estado: 'RECHAZADO',
        error: transmitResult.error,
        errores: transmitResult.observaciones,
      };
    }
  }

  /**
   * @param idContrato ID del contrato
   * @param userId ID del usuario que genera
   * @param idSucursal ID de sucursal (opcional, se usa la primera activa si no se especifica)
   * @param tx Cliente de transacción Prisma (opcional)
   * @returns IDs de facturas creadas e ID de factura de instalación si aplica
   */
  async generarFacturasContrato(
    idContrato: number,
    userId: number,
    idSucursal?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<{ facturaIds: number[]; instalacionId?: number }> {
    const db = tx || this.prisma;

    // 1. Cargar contrato con relaciones necesarias
    const contrato = await db.atcContrato.findUnique({
      where: { id_contrato: idContrato },
      include: {
        cliente: {
          include: {
            datosfacturacion: {
              where: { estado: 'ACTIVO' },
              take: 1,
            },
          },
        },
        plan: true,
        ciclo: true,
      },
    });

    if (!contrato) {
      throw new NotFoundException(`Contrato ${idContrato} no encontrado`);
    }

    if (contrato.estado !== 'INSTALADO_ACTIVO') {
      throw new BadRequestException(
        `Contrato ${idContrato} no está en estado INSTALADO_ACTIVO (estado: ${contrato.estado})`,
      );
    }

    if (!contrato.plan) {
      throw new BadRequestException(`Contrato ${idContrato} no tiene plan asignado`);
    }

    if (!contrato.ciclo) {
      throw new BadRequestException(`Contrato ${idContrato} no tiene ciclo de facturación`);
    }

    const datosFacturacion = contrato.cliente?.datosfacturacion?.[0];
    if (!datosFacturacion) {
      throw new BadRequestException(
        `Cliente del contrato ${idContrato} no tiene datos de facturación activos`,
      );
    }

    // 2. Verificar idempotencia: si ya tiene facturas proyectadas, skip
    const facturasExistentes = await db.facturaDirecta.count({
      where: { id_contrato: idContrato },
    });

    if (facturasExistentes > 0) {
      this.logger.warn(
        `Contrato ${idContrato} ya tiene ${facturasExistentes} facturas. Saltando generación.`,
      );
      return { facturaIds: [] };
    }

    // 3. Obtener sucursal
    const sucursal = idSucursal
      ? await db.sucursales.findUnique({ where: { id_sucursal: idSucursal } })
      : await db.sucursales.findFirst({ where: { estado: 'ACTIVO' } });

    if (!sucursal) {
      throw new BadRequestException('No hay sucursal disponible para generar facturas');
    }

    // 4. Calcular fecha_fin_contrato y actualizar
    const fechaInicio = contrato.fecha_inicio_contrato || new Date();
    const mesesContrato = contrato.meses_contrato || contrato.plan.meses_contrato || 12;
    const fechaFinContrato = new Date(fechaInicio);
    fechaFinContrato.setMonth(fechaFinContrato.getMonth() + mesesContrato);

    await db.atcContrato.update({
      where: { id_contrato: idContrato },
      data: { fecha_fin_contrato: fechaFinContrato },
    });

    // 5. Extraer datos del plan
    const precioBase = Number(contrato.plan.precio);
    const aplicaIva = contrato.plan.aplica_iva;
    const porcentajeIva = Number(contrato.plan.porcentaje_iva || 13);
    const costoInstalacion = Number(contrato.costo_instalacion || 0);
    const facturarInstalacionSeparada = contrato.facturar_instalacion_separada;

    // 6. Snapshot de datos de facturación del cliente
    const clienteSnapshot = {
      cliente_nombre: datosFacturacion.nombre_empresa,
      cliente_nit: datosFacturacion.nit,
      cliente_nrc: datosFacturacion.nrc,
      cliente_direccion: datosFacturacion.direccion_facturacion,
      cliente_telefono: datosFacturacion.telefono,
      cliente_correo: datosFacturacion.correo_electronico,
    };

    const facturaIds: number[] = [];
    let instalacionId: number | undefined;

    // 7. Generar facturas de cuotas mensuales
    for (let cuota = 1; cuota <= mesesContrato; cuota++) {
      const { periodoInicio, periodoFin, fechaVencimiento } = this.calcularFechasPeriodo(
        fechaInicio,
        cuota,
        contrato.ciclo,
      );

      // Líneas de detalle
      const detalles: Array<{
        num_item: number;
        nombre: string;
        descripcion: string;
        cantidad: number;
        uni_medida: number;
        precio_unitario: number;
        precio_sin_iva: number;
        precio_con_iva: number;
        tipo_detalle: any;
        venta_gravada: number;
        venta_exenta: number;
        subtotal: number;
        iva: number;
        total: number;
      }> = [];

      let numItem = 1;

      // Línea de servicio mensual
      const precioSinIva = aplicaIva ? redondearMonto(precioBase / (1 + porcentajeIva / 100)) : precioBase;
      const ivaServicio = aplicaIva ? redondearMonto(precioBase - precioSinIva) : 0;

      detalles.push({
        num_item: numItem++,
        nombre: `${contrato.plan.nombre} - Cuota ${cuota}/${mesesContrato}`,
        descripcion: `Servicio ${contrato.plan.nombre} - Período ${periodoInicio.toLocaleDateString('es-SV')} al ${periodoFin.toLocaleDateString('es-SV')}`,
        cantidad: 1,
        uni_medida: 99,
        precio_unitario: redondearMonto(precioSinIva, DECIMALES_ITEM),
        precio_sin_iva: redondearMonto(precioSinIva, DECIMALES_ITEM),
        precio_con_iva: redondearMonto(precioBase, DECIMALES_ITEM),
        tipo_detalle: aplicaIva ? 'GRAVADO' : 'EXENTA',
        venta_gravada: aplicaIva ? redondearMonto(precioSinIva) : 0,
        venta_exenta: aplicaIva ? 0 : redondearMonto(precioBase),
        subtotal: redondearMonto(precioSinIva),
        iva: redondearMonto(ivaServicio),
        total: redondearMonto(precioBase),
      });

      // Si cuota 1 y NO facturar_instalacion_separada, incluir instalación
      if (cuota === 1 && !facturarInstalacionSeparada && costoInstalacion > 0) {
        const instalacionSinIva = aplicaIva
          ? redondearMonto(costoInstalacion / (1 + porcentajeIva / 100))
          : costoInstalacion;
        const ivaInstalacion = aplicaIva ? redondearMonto(costoInstalacion - instalacionSinIva) : 0;

        detalles.push({
          num_item: numItem++,
          nombre: 'Instalación del servicio',
          descripcion: `Costo de instalación - ${contrato.plan.nombre}`,
          cantidad: 1,
          uni_medida: 99,
          precio_unitario: redondearMonto(instalacionSinIva, DECIMALES_ITEM),
          precio_sin_iva: redondearMonto(instalacionSinIva, DECIMALES_ITEM),
          precio_con_iva: redondearMonto(costoInstalacion, DECIMALES_ITEM),
          tipo_detalle: aplicaIva ? 'GRAVADO' : 'EXENTA',
          venta_gravada: aplicaIva ? redondearMonto(instalacionSinIva) : 0,
          venta_exenta: aplicaIva ? 0 : redondearMonto(costoInstalacion),
          subtotal: redondearMonto(instalacionSinIva),
          iva: redondearMonto(ivaInstalacion),
          total: redondearMonto(costoInstalacion),
        });
      }

      // Calcular totales de la factura
      const totalGravada = redondearMonto(detalles.reduce((s, d) => s + d.venta_gravada, 0));
      const totalExenta = redondearMonto(detalles.reduce((s, d) => s + d.venta_exenta, 0));
      const subtotal = redondearMonto(totalGravada + totalExenta);
      const ivaTotal = redondearMonto(detalles.reduce((s, d) => s + d.iva, 0));
      const total = redondearMonto(subtotal + ivaTotal);

      const factura = await db.facturaDirecta.create({
        data: {
          // Sin numero_factura, bloque ni tipo (se asignan al firmar)
          numero_factura: null,
          id_bloque: null,
          id_tipo_factura: null,

          // Contrato y cliente
          id_contrato: idContrato,
          id_cliente: contrato.id_cliente,
          id_cliente_facturacion: datosFacturacion.id_cliente_datos_facturacion,
          ...clienteSnapshot,

          // Período
          periodo_inicio: periodoInicio,
          periodo_fin: periodoFin,
          fecha_vencimiento: fechaVencimiento,
          numero_cuota: cuota,
          total_cuotas: mesesContrato,
          es_instalacion: false,

          // Montos
          subtotal: subtotal,
          subTotalVentas: subtotal,
          totalGravada: totalGravada,
          totalExenta: totalExenta,
          iva: ivaTotal,
          total: total,

          // Condición crédito
          condicion_operacion: 2,

          // Estado
          estado_dte: 'BORRADOR',
          estado_pago: 'PENDIENTE',

          // Auditoría
          id_sucursal: sucursal.id_sucursal,
          id_usuario: userId,

          // Detalle
          detalles: {
            create: detalles.map((d) => ({
              num_item: d.num_item,
              nombre: d.nombre,
              descripcion: d.descripcion,
              cantidad: d.cantidad,
              uni_medida: d.uni_medida,
              precio_unitario: d.precio_unitario,
              precio_sin_iva: d.precio_sin_iva,
              precio_con_iva: d.precio_con_iva,
              tipo_detalle: d.tipo_detalle,
              venta_gravada: d.venta_gravada,
              venta_exenta: d.venta_exenta,
              subtotal: d.subtotal,
              iva: d.iva,
              total: d.total,
            })),
          },
        },
      });

      // Auto-crear CxC para la factura proyectada
      await this.cxcService.crearCxcParaFacturaContrato(
        {
          id_factura_directa: factura.id_factura_directa,
          id_cliente: contrato.id_cliente,
          id_contrato: idContrato,
          total: factura.total,
          fecha_vencimiento: fechaVencimiento,
        },
        sucursal.id_sucursal,
        userId,
        db as any,
      );

      facturaIds.push(factura.id_factura_directa);
    }

    // 8. Si facturar_instalacion_separada y hay costo, crear factura aparte
    if (facturarInstalacionSeparada && costoInstalacion > 0) {
      const instalacionSinIva = aplicaIva
        ? redondearMonto(costoInstalacion / (1 + porcentajeIva / 100))
        : costoInstalacion;
      const ivaInstalacion = aplicaIva ? redondearMonto(costoInstalacion - instalacionSinIva) : 0;

      const totalGravada = aplicaIva ? redondearMonto(instalacionSinIva) : 0;
      const totalExenta = aplicaIva ? 0 : redondearMonto(costoInstalacion);
      const subtotal = redondearMonto(totalGravada + totalExenta);
      const total = redondearMonto(subtotal + ivaInstalacion);

      const { periodoInicio, periodoFin, fechaVencimiento } = this.calcularFechasPeriodo(
        fechaInicio,
        1,
        contrato.ciclo,
      );

      const facturaInstalacion = await db.facturaDirecta.create({
        data: {
          numero_factura: null,
          id_bloque: null,
          id_tipo_factura: null,

          id_contrato: idContrato,
          id_cliente: contrato.id_cliente,
          id_cliente_facturacion: datosFacturacion.id_cliente_datos_facturacion,
          ...clienteSnapshot,

          periodo_inicio: periodoInicio,
          periodo_fin: periodoFin,
          fecha_vencimiento: fechaVencimiento,
          numero_cuota: null,
          total_cuotas: null,
          es_instalacion: true,

          subtotal: subtotal,
          subTotalVentas: subtotal,
          totalGravada: totalGravada,
          totalExenta: totalExenta,
          iva: ivaInstalacion,
          total: total,

          condicion_operacion: 2,

          estado_dte: 'BORRADOR',
          estado_pago: 'PENDIENTE',

          id_sucursal: sucursal.id_sucursal,
          id_usuario: userId,

          detalles: {
            create: [
              {
                num_item: 1,
                nombre: 'Instalación del servicio',
                descripcion: `Costo de instalación - ${contrato.plan.nombre}`,
                cantidad: 1,
                uni_medida: 99,
                precio_unitario: redondearMonto(instalacionSinIva, DECIMALES_ITEM),
                precio_sin_iva: redondearMonto(instalacionSinIva, DECIMALES_ITEM),
                precio_con_iva: redondearMonto(costoInstalacion, DECIMALES_ITEM),
                tipo_detalle: aplicaIva ? 'GRAVADO' : 'EXENTA',
                venta_gravada: totalGravada,
                venta_exenta: totalExenta,
                subtotal: subtotal,
                iva: ivaInstalacion,
                total: total,
              },
            ],
          },
        },
      });

      instalacionId = facturaInstalacion.id_factura_directa;

      // Auto-crear CxC para factura de instalación
      await this.cxcService.crearCxcParaFacturaContrato(
        {
          id_factura_directa: facturaInstalacion.id_factura_directa,
          id_cliente: contrato.id_cliente,
          id_contrato: idContrato,
          total: facturaInstalacion.total,
          fecha_vencimiento: fechaVencimiento,
        },
        sucursal.id_sucursal,
        userId,
        db as any,
      );

      facturaIds.push(instalacionId);
    }

    this.logger.log(
      `Contrato ${idContrato}: generadas ${facturaIds.length} facturas proyectadas` +
        (instalacionId ? ` (incluye factura de instalación #${instalacionId})` : ''),
    );

    return { facturaIds, instalacionId };
  }

  /**
   * Calcula las fechas de periodo e inicio/fin para una cuota dada.
   * Maneja edge cases como día 31 en meses cortos.
   */
  private calcularFechasPeriodo(
    fechaInicioContrato: Date,
    cuota: number,
    ciclo: { dia_corte: number; dia_vencimiento: number; periodo_inicio: number; periodo_fin: number },
  ): { periodoInicio: Date; periodoFin: Date; fechaVencimiento: Date } {
    // Calcular el mes base: mes de inicio + (cuota - 1)
    const baseDate = new Date(fechaInicioContrato);
    baseDate.setMonth(baseDate.getMonth() + (cuota - 1));

    const year = baseDate.getFullYear();
    const month = baseDate.getMonth(); // 0-indexed

    // Periodo inicio: día periodo_inicio del mes actual
    const periodoInicio = this.crearFechaSegura(year, month, ciclo.periodo_inicio);

    // Periodo fin: día periodo_fin del mes actual (o siguiente si periodo_fin < periodo_inicio)
    let periodoFinMonth = month;
    let periodoFinYear = year;
    if (ciclo.periodo_fin < ciclo.periodo_inicio) {
      // El período cruza al mes siguiente
      periodoFinMonth = month + 1;
      if (periodoFinMonth > 11) {
        periodoFinMonth = 0;
        periodoFinYear = year + 1;
      }
    }
    const periodoFin = this.crearFechaSegura(periodoFinYear, periodoFinMonth, ciclo.periodo_fin);

    // Fecha vencimiento: día vencimiento del mes siguiente al período
    let vencimientoMonth = month + 1;
    let vencimientoYear = year;
    if (vencimientoMonth > 11) {
      vencimientoMonth = 0;
      vencimientoYear = year + 1;
    }
    const fechaVencimiento = this.crearFechaSegura(vencimientoYear, vencimientoMonth, ciclo.dia_vencimiento);

    return { periodoInicio, periodoFin, fechaVencimiento };
  }

  /**
   * Crea una fecha manejando días que no existen en ciertos meses
   * (ej: día 31 en febrero → último día de febrero)
   */
  private crearFechaSegura(year: number, month: number, day: number): Date {
    // Obtener el último día del mes
    const ultimoDia = new Date(year, month + 1, 0).getDate();
    const diaFinal = Math.min(day, ultimoDia);
    return new Date(year, month, diaFinal);
  }
}
