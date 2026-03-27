import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CxcService } from '../../cxc/cxc.service';
import { MoraService, MoraConfig } from './mora.service';
import { FacturaDirectaService } from '../factura-directa/factura-directa.service';
import { MinioService } from '../../minio/minio.service';
import { ComprobanteAnalyzerService } from '../../whatsapp-chat/validacion-comprobante/comprobante-analyzer.service';
import { Prisma } from '@prisma/client';
import { RegistrarPagoContratoDto, AplicarDescuentoFacturaDto } from '../dto/contrato-pagos.dto';
import { AbonosListadoDto } from '../dto/abonos-listado.dto';
import { redondearMonto } from '../dte/builders/numero-letras.util';
import { convertToUTC } from 'src/common/helpers/dates.helper';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// INTERFACES
// ============================================

export interface FacturaContratoItem {
  idFactura: number;
  numeroCuota: number | null;
  totalCuotas: number | null;
  periodoInicio: string | null;
  periodoFin: string | null;
  fechaVencimiento: string | null;
  total: number;
  descuento: number;
  montoMora: number;
  montoAbonado: number;
  saldoPendiente: number;
  estadoPago: string;
  estadoDte: string;
  esInstalacion: boolean;
  fechaAcuerdoPago: string | null;
  tipoDte: string | null;
  numeroFactura: string | null;
  estado: string;
  cxc: {
    idCxc: number;
    estado: string;
  } | null;
}

export interface DistribucionPagoItem {
  idFactura: number;
  cuota: number | null;
  montoAplicado: number;
  saldoAnterior: number;
  saldoPosterior: number;
  estadoResultante: string;
  firmadaEnMh: boolean;
}

export interface DistribucionPagoResult {
  items: DistribucionPagoItem[];
  montoTotal: number;
  montoDistribuido: number;
  montoSobrante: number;
}

export interface MoraAplicadaResult {
  facturasAfectadas: number;
  totalMoraAplicada: number;
  detalle: Array<{
    idFactura: number;
    cuota: number | null;
    moraAnterior: number;
    moraCalculada: number;
    incremento: number;
  }>;
}

// ============================================
// SERVICE
// ============================================

@Injectable()
export class ContratoPagosService {
  private readonly logger = new Logger(ContratoPagosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cxcService: CxcService,
    private readonly moraService: MoraService,
    private readonly facturaDirectaService: FacturaDirectaService,
    private readonly minioService: MinioService,
    private readonly comprobanteAnalyzer: ComprobanteAnalyzerService,
  ) { }

  /**
   * Analizar comprobante de pago: sube imagen a MinIO y extrae datos con IA
   */
  async analizarComprobante(file: Express.Multer.File) {
    const timestamp = Date.now();
    const objectName = `comprobantes-pago/${timestamp}-${file.originalname}`;

    const { url } = await this.minioService.uploadFile(file, objectName);

    const resultado = await this.comprobanteAnalyzer.extractComprobanteData(
      file.buffer,
      file.mimetype,
    );

    return {
      ...resultado,
      comprobanteUrl: url,
    };
  }

  /**
   * Obtener facturas de un contrato con estado de pago y CxC
   */
  async obtenerFacturasContrato(idContrato: number): Promise<FacturaContratoItem[]> {
    const contrato = await this.prisma.atcContrato.findUnique({
      where: { id_contrato: idContrato },
    });

    if (!contrato) {
      throw new NotFoundException(`Contrato #${idContrato} no encontrado`);
    }

    const facturas = await this.prisma.facturaDirecta.findMany({
      where: {
        id_contrato: idContrato,
      },
      include: {
        cuenta_por_cobrar: {
          include: {
            abonos: {
              where: { activo: true },
              orderBy: { fecha_pago: 'desc' },
            },
          },
        },
        tipoFactura: { select: { codigo: true } },
      },
      orderBy: [
        { es_instalacion: 'desc' },
        { numero_cuota: 'asc' },
      ],
    });

    const ahora = new Date();

    return facturas.map((f) => {
      const cxc = f.cuenta_por_cobrar;
      const montoAbonado = cxc ? Number(cxc.total_abonado) : 0;
      const saldoPendiente = cxc ? Number(cxc.saldo_pendiente) : Number(f.total);

      // Compute visual estado_pago
      let estadoPago: string = f.estado_pago;
      if (
        f.estado_pago === 'PENDIENTE' &&
        f.fecha_vencimiento &&
        f.fecha_vencimiento < ahora
      ) {
        estadoPago = 'VENCIDA';
      }

      return {
        idFactura: f.id_factura_directa,
        numeroCuota: f.numero_cuota,
        totalCuotas: f.total_cuotas,
        periodoInicio: f.periodo_inicio?.toISOString() || null,
        periodoFin: f.periodo_fin?.toISOString() || null,
        fechaVencimiento: f.fecha_vencimiento?.toISOString() || null,
        total: Number(f.total),
        descuento: Number(f.descuento),
        montoMora: Number(f.monto_mora),
        montoAbonado,
        saldoPendiente,
        estadoPago,
        estadoDte: f.estado_dte,
        esInstalacion: f.es_instalacion,
        fechaAcuerdoPago: cxc?.fecha_acuerdo_pago?.toISOString() || null,
        tipoDte: (f as any).tipoFactura?.codigo || null,
        numeroFactura: f.numero_factura || null,
        estado: f.estado,
        cxc: cxc
          ? { idCxc: cxc.id_cxc, estado: cxc.estado }
          : null,
      };
    });
  }

  /**
   * Registrar pago distribuido en las facturas de un contrato
   */
  async registrarPagoContrato(
    idContrato: number,
    dto: RegistrarPagoContratoDto,
    idUsuario: number,
  ): Promise<DistribucionPagoResult> {
    const contrato = await this.prisma.atcContrato.findUnique({
      where: { id_contrato: idContrato },
    });

    if (!contrato) {
      throw new NotFoundException(`Contrato #${idContrato} no encontrado`);
    }

    // Obtener CxCs pendientes del contrato ordenadas por fecha vencimiento
    const cxcs = await this.prisma.cuenta_por_cobrar.findMany({
      where: {
        id_contrato: idContrato,
        estado: { notIn: ['PAGADA_TOTAL', 'ANULADA'] },
      },
      include: {
        facturaDirecta: true,
      },
      orderBy: { fecha_vencimiento: 'asc' },
    });
    if (cxcs.length === 0) {
      throw new BadRequestException('No hay facturas pendientes de pago para este contrato');
    }
    console.log(cxcs[0])

    const montoTotal = dto.monto;
    let montoRestante = montoTotal;
    const items: DistribucionPagoItem[] = [];

    // Distribuir pago secuencialmente — todo en una sola transacción
    // No usamos cxcService.registrarAbono() porque abre su propia tx interna
    const resultado = await this.prisma.$transaction(
      async (tx) => {
        for (const cxc of cxcs) {
          if (montoRestante <= 0) break;

          const saldoPendienteDecimal = new Prisma.Decimal(cxc.saldo_pendiente.toString());
          const montoAplicarNum = Math.min(montoRestante, Number(saldoPendienteDecimal));
          const montoAplicar = new Prisma.Decimal(montoAplicarNum.toFixed(2));

          const saldoPosterior = saldoPendienteDecimal.minus(montoAplicar);
          const totalAbonado = new Prisma.Decimal(cxc.total_abonado.toString()).plus(montoAplicar);
          const nuevoEstadoCxc = saldoPosterior.lte(0) ? 'PAGADA_TOTAL' : 'PAGADA_PARCIAL';
          const estadoPagoFactura = saldoPosterior.lte(0) ? 'PAGADO' : 'PARCIAL';

          // 1. Crear abono
          const abonoCreado = await tx.abono_cxc.create({
            data: {
              id_cxc: cxc.id_cxc,
              monto: montoAplicar,
              saldo_anterior: saldoPendienteDecimal,
              saldo_posterior: saldoPosterior,
              metodo_pago: dto.metodoPago,
              referencia: dto.referencia,
              comprobante_url: dto.comprobanteUrl,
              fecha_pago: new Date(),
              id_usuario: idUsuario,
              observaciones: dto.observaciones,
            },
          });

          // 1.1 Registrar movimiento de caja
          await tx.caja_movimiento.create({
            data: {
              id_usuario: idUsuario,
              id_cliente: contrato.id_cliente,
              monto: montoAplicar,
              metodo_pago: dto.metodoPago,
              id_abono_cxc: abonoCreado.id_abono,
            },
          });

          // 2. Actualizar CxC
          await tx.cuenta_por_cobrar.update({
            where: { id_cxc: cxc.id_cxc },
            data: {
              saldo_pendiente: saldoPosterior,
              total_abonado: totalAbonado,
              estado: nuevoEstadoCxc,
            },
          });

          // 3. Actualizar estado de pago de la factura
          await tx.facturaDirecta.update({
            where: { id_factura_directa: cxc.id_factura_directa },
            data: { estado_pago: estadoPagoFactura },
          });

          const saldoPosteriorNum = Number(saldoPosterior);
          items.push({
            idFactura: cxc.id_factura_directa,
            cuota: cxc.facturaDirecta.numero_cuota,
            montoAplicado: montoAplicarNum,
            saldoAnterior: Number(saldoPendienteDecimal),
            saldoPosterior: saldoPosteriorNum,
            estadoResultante: saldoPosterior.lte(0) ? 'PAGADO' : 'PARCIAL',
            firmadaEnMh: false,
          });

          montoRestante = Math.round((montoRestante - montoAplicarNum) * 100) / 100;
        }

        return items;
      },
      { timeout: 60000 },
    );

    // Firma diferida: para facturas que quedaron 100% pagadas, firmar y enviar (fuera de tx)
    for (const item of resultado) {
      if (item.estadoResultante === 'PAGADO') {
        try {
          const firmaResult = await this.facturaDirectaService.firmarYEnviarFactura(
            item.idFactura,
            idUsuario,
          );
          item.firmadaEnMh = firmaResult.success;
        } catch (error) {
          this.logger.error(
            `Error al firmar factura #${item.idFactura}: ${error.message}`,
          );
          // No bloquear el flujo si falla la firma
        }
      }
    }

    // Generar siguiente factura si la última fue pagada completamente
    for (const item of resultado) {
      if (item.estadoResultante === 'PAGADO') {
        try {
          await this.generarSiguienteFacturaSiUltima(item.idFactura, idContrato, idUsuario);
        } catch (error) {
          this.logger.error(
            `Error al generar siguiente factura tras pago de #${item.idFactura}: ${error.message}`,
          );
        }
      }
    }

    await this.prisma.logAction(
      'REGISTRAR_PAGO_CONTRATO',
      idUsuario,
      `Pago de $${montoTotal} distribuido en contrato #${idContrato}. Facturas afectadas: ${resultado.length}`,
    );

    return {
      items: resultado,
      montoTotal,
      montoDistribuido: Math.round((montoTotal - montoRestante) * 100) / 100,
      montoSobrante: montoRestante,
    };
  }

  /**
   * Aplicar mora a las CxC vencidas de un contrato
   */
  async aplicarMoraContrato(
    idContrato: number,
    idUsuario: number,
  ): Promise<MoraAplicadaResult> {
    const config = await this.moraService.obtenerConfiguracionMora(idContrato);

    if (!config) {
      return { facturasAfectadas: 0, totalMoraAplicada: 0, detalle: [] };
    }

    const ahora = new Date();
    const diasGraciaMs = config.dias_gracia * 24 * 60 * 60 * 1000;

    // Obtener CxCs vencidas (pasó fecha vencimiento + días de gracia, no EN_ACUERDO, no pagadas)
    const cxcs = await this.prisma.cuenta_por_cobrar.findMany({
      where: {
        id_contrato: idContrato,
        estado: { notIn: ['PAGADA_TOTAL', 'ANULADA'] },
        mora_exonerada: false,
        fecha_vencimiento: { lt: new Date(ahora.getTime() - diasGraciaMs) },
        // Excluir las que tienen acuerdo de pago vigente
        OR: [
          { fecha_acuerdo_pago: null },
          { fecha_acuerdo_pago: { lt: ahora } },
        ],
      },
      include: {
        facturaDirecta: true,
      },
    });

    const detalle: MoraAplicadaResult['detalle'] = [];
    let totalMoraAplicada = 0;

    for (const cxc of cxcs) {
      const factura = cxc.facturaDirecta;
      const diasAtraso = Math.floor(
        (ahora.getTime() - cxc.fecha_vencimiento.getTime()) / (1000 * 60 * 60 * 24),
      );
      const montoOriginal = Number(cxc.monto_total);
      const moraAnterior = Number(cxc.monto_mora);

      // Calcular mora usando la lógica del MoraService
      let moraCalculada = this.calcularMoraInterna(
        config,
        montoOriginal,
        diasAtraso,
        moraAnterior,
      );
      moraCalculada = Math.round(moraCalculada * 100) / 100;

      if (moraCalculada > moraAnterior) {
        const incremento = Math.round((moraCalculada - moraAnterior) * 100) / 100;

        // Actualizar CxC y factura atomicamente en una transacción
        await this.prisma.$transaction(async (tx) => {
          await tx.cuenta_por_cobrar.update({
            where: { id_cxc: cxc.id_cxc },
            data: {
              saldo_pendiente: { increment: incremento },
              monto_mora: moraCalculada,
            },
          });

          await tx.facturaDirecta.update({
            where: { id_factura_directa: cxc.id_factura_directa },
            data: {
              monto_mora: moraCalculada,
              estado_pago: factura.estado_pago === 'EN_ACUERDO' ? 'EN_ACUERDO' : 'VENCIDA',
            },
          });
        });

        detalle.push({
          idFactura: cxc.id_factura_directa,
          cuota: factura.numero_cuota,
          moraAnterior,
          moraCalculada,
          incremento,
        });

        totalMoraAplicada += incremento;
      }
    }

    if (detalle.length > 0) {
      this.logger.log(
        `Mora aplicada a contrato #${idContrato}: $${totalMoraAplicada} en ${detalle.length} facturas`,
      );
    }

    return {
      facturasAfectadas: detalle.length,
      totalMoraAplicada: Math.round(totalMoraAplicada * 100) / 100,
      detalle,
    };
  }

  /**
   * Registrar acuerdo de pago para una factura
   */
  async registrarAcuerdoPago(
    idFactura: number,
    fechaAcuerdo: Date,
    idUsuario: number,
    observaciones?: string,
  ) {
    const cxc = await this.prisma.cuenta_por_cobrar.findFirst({
      where: { id_factura_directa: idFactura },
    });

    if (!cxc) {
      throw new NotFoundException(`No se encontró CxC para factura #${idFactura}`);
    }

    if (cxc.estado === 'PAGADA_TOTAL') {
      throw new BadRequestException('La factura ya está pagada');
    }

    await this.prisma.$transaction(async (tx) => {
      // Guardar vencimiento original si no tiene
      const fechaVencimientoOriginal = cxc.fecha_vencimiento_original || cxc.fecha_vencimiento;

      await tx.cuenta_por_cobrar.update({
        where: { id_cxc: cxc.id_cxc },
        data: {
          fecha_vencimiento: fechaAcuerdo,
          fecha_acuerdo_pago: fechaAcuerdo,
          fecha_vencimiento_original: fechaVencimientoOriginal,
          observaciones: observaciones
            ? `${cxc.observaciones ? cxc.observaciones + '\n' : ''}Acuerdo de pago: ${observaciones}`
            : cxc.observaciones,
        },
      });

      await tx.facturaDirecta.update({
        where: { id_factura_directa: idFactura },
        data: { estado_pago: 'EN_ACUERDO' },
      });
    });

    await this.prisma.logAction(
      'REGISTRAR_ACUERDO_PAGO',
      idUsuario,
      `Acuerdo de pago registrado para factura #${idFactura}. Nueva fecha: ${fechaAcuerdo.toISOString().split('T')[0]}`,
    );

    return { message: 'Acuerdo de pago registrado exitosamente' };
  }

  /**
   * Cancelar acuerdo de pago
   */
  async cancelarAcuerdoPago(idFactura: number, idUsuario: number) {
    const cxc = await this.prisma.cuenta_por_cobrar.findFirst({
      where: { id_factura_directa: idFactura },
    });

    if (!cxc) {
      throw new NotFoundException(`No se encontró CxC para factura #${idFactura}`);
    }

    if (!cxc.fecha_acuerdo_pago) {
      throw new BadRequestException('La factura no tiene acuerdo de pago');
    }

    await this.prisma.$transaction(async (tx) => {
      const fechaOriginal = cxc.fecha_vencimiento_original || cxc.fecha_vencimiento;
      const ahora = new Date();
      const nuevoEstado = fechaOriginal < ahora ? 'VENCIDA' : 'PENDIENTE';

      await tx.cuenta_por_cobrar.update({
        where: { id_cxc: cxc.id_cxc },
        data: {
          fecha_vencimiento: fechaOriginal,
          fecha_acuerdo_pago: null,
          fecha_vencimiento_original: null,
        },
      });

      const totalAbonado = Number(cxc.total_abonado);
      const estadoPagoFactura = totalAbonado > 0 ? 'PARCIAL' : nuevoEstado;

      await tx.facturaDirecta.update({
        where: { id_factura_directa: idFactura },
        data: { estado_pago: estadoPagoFactura },
      });
    });

    await this.prisma.logAction(
      'CANCELAR_ACUERDO_PAGO',
      idUsuario,
      `Acuerdo de pago cancelado para factura #${idFactura}`,
    );

    return { message: 'Acuerdo de pago cancelado' };
  }

  /**
   * Revertir acuerdos vencidos (llamar al cargar la pantalla)
   */
  async revertirAcuerdosVencidos(idContrato: number): Promise<number> {
    const ahora = new Date();

    const cxcsConAcuerdo = await this.prisma.cuenta_por_cobrar.findMany({
      where: {
        id_contrato: idContrato,
        fecha_acuerdo_pago: { lt: ahora },
        estado: { notIn: ['PAGADA_TOTAL', 'ANULADA'] },
      },
      include: { facturaDirecta: true },
    });

    const vencidos = cxcsConAcuerdo.filter(
      (cxc) => cxc.facturaDirecta.estado_pago === 'EN_ACUERDO',
    );

    for (const cxc of vencidos) {
      const fechaOriginal = cxc.fecha_vencimiento_original || cxc.fecha_vencimiento;
      const totalAbonado = Number(cxc.total_abonado);

      await this.prisma.$transaction(async (tx) => {
        await tx.cuenta_por_cobrar.update({
          where: { id_cxc: cxc.id_cxc },
          data: {
            fecha_vencimiento: fechaOriginal,
            fecha_acuerdo_pago: null,
            fecha_vencimiento_original: null,
          },
        });

        await tx.facturaDirecta.update({
          where: { id_factura_directa: cxc.id_factura_directa },
          data: { estado_pago: totalAbonado > 0 ? 'PARCIAL' : 'VENCIDA' },
        });
      });
    }

    return vencidos.length;
  }

  // ============================================
  // ESTADO DE CUENTA
  // ============================================

  /**
   * Obtener estado de cuenta completo de un contrato
   */
  async obtenerEstadoCuentaContrato(idContrato: number) {
    const contrato = await this.prisma.atcContrato.findUnique({
      where: { id_contrato: idContrato },
      include: {
        cliente: {
          include: {
            direcciones: {
              where: { usar_para_facturacion: true, estado: 'ACTIVO' },
              take: 1,
              include: {
                colonias: true,
                municipio: true,
                departamento: true,
              },
            },
            datosfacturacion: {
              where: { estado: 'ACTIVO' },
              take: 1,
            },
          },
        },
        plan: {
          include: {
            tipoPlan: {
              include: {
                tipoServicio: true,
              },
            },
          },
        },
        ciclo: true,
        direccionServicio: {
          include: {
            colonias: true,
            municipio: true,
            departamento: true,
          },
        },
        instalacion: true,
      },
    });

    if (!contrato) {
      throw new NotFoundException(`Contrato #${idContrato} no encontrado`);
    }

    const abonosAgg = await this.prisma.abono_cxc.aggregate({
      where: {
        cuentaPorCobrar: { id_contrato: idContrato },
        activo: true,
      },
      _sum: { monto: true },
      _count: { id_abono: true },
    });

    const dirFacturacion = contrato.cliente.direcciones[0] || null;
    const datosFacturacion = contrato.cliente.datosfacturacion[0] || null;
    const dirServicio = contrato.direccionServicio;

    return {
      cliente: {
        id: contrato.cliente.id_cliente,
        nombre: contrato.cliente.titular,
        estado: contrato.cliente.estado,
        dui: contrato.cliente.dui,
        nit: contrato.cliente.nit,
        correo: contrato.cliente.correo_electronico,
        telefono1: contrato.cliente.telefono1,
        telefono2: contrato.cliente.telefono2,
        codigoCliente: contrato.cliente.id_cliente,
        direccionFacturacion: dirFacturacion?.direccion || null,
        coloniaFacturacion: dirFacturacion?.colonias?.nombre || null,
        municipioFacturacion: dirFacturacion?.municipio?.nombre || null,
        departamentoFacturacion: dirFacturacion?.departamento?.nombre || null,
        tipoFactura: datosFacturacion?.tipo || null,
        nrc: datosFacturacion?.nrc || null,
      },
      contrato: {
        id: contrato.id_contrato,
        codigo: contrato.codigo,
        estado: contrato.estado,
        fechaVenta: contrato.fecha_venta?.toISOString() || null,
        fechaInstalacion: contrato.fecha_instalacion?.toISOString() || null,
        fechaInicioContrato: contrato.fecha_inicio_contrato?.toISOString() || null,
        fechaFinContrato: contrato.fecha_fin_contrato?.toISOString() || null,
        mesesContrato: contrato.meses_contrato,
        costoInstalacion: contrato.costo_instalacion ? Number(contrato.costo_instalacion) : null,
        direccionServicio: dirServicio?.direccion || null,
        coloniaServicio: dirServicio?.colonias?.nombre || null,
        municipioServicio: dirServicio?.municipio?.nombre || null,
        departamentoServicio: dirServicio?.departamento?.nombre || null,
      },
      plan: {
        id: contrato.plan.id_plan,
        nombre: contrato.plan.nombre,
        precio: Number(contrato.plan.precio),
        tipoServicio: contrato.plan.tipoPlan?.tipoServicio?.nombre || null,
        tipoPlan: contrato.plan.tipoPlan?.nombre || null,
        velocidadBajada: contrato.plan.velocidad_bajada,
        velocidadSubida: contrato.plan.velocidad_subida,
      },
      ciclo: {
        id: contrato.ciclo.id_ciclo,
        nombre: contrato.ciclo.nombre,
        diaCorte: contrato.ciclo.dia_corte,
        diaVencimiento: contrato.ciclo.dia_vencimiento,
      },
      instalacion: contrato.instalacion
        ? {
          fechaInstalacion: contrato.instalacion.fecha_instalacion?.toISOString() || null,
          instalado: contrato.instalacion.instalado,
          wifiNombre: contrato.instalacion.wifi_nombre,
          macOnu: contrato.instalacion.mac_onu,
          numeroSerieOnu: contrato.instalacion.numero_serie_onu,
          potenciaOnu: contrato.instalacion.potencia_onu,
        }
        : null,
      resumen: {
        totalAbonos: Number(abonosAgg._sum.monto || 0),
        cantidadAbonos: abonosAgg._count.id_abono,
      },
    };
  }

  /**
   * Obtener historial de abonos de un contrato
   */
  async listarAbonos(dto: AbonosListadoDto) {
    const { page = 1, limit = 20, search, fechaDesde, fechaHasta, metodoPago } = dto;
    const skip = (page - 1) * limit;

    const whereClause: any = {
      activo: true,
      ...(metodoPago && { metodo_pago: metodoPago }),
    };

    if (fechaDesde || fechaHasta) {
      whereClause.fecha_pago = {};
      if (fechaDesde) whereClause.fecha_pago.gte = convertToUTC(fechaDesde);
      if (fechaHasta) whereClause.fecha_pago.lte = convertToUTC(fechaHasta, 'fin');
    }

    if (search) {
      whereClause.cuentaPorCobrar = {
        contrato: {
          OR: [
            { codigo: { contains: search, mode: 'insensitive' } },
            { cliente: { titular: { contains: search, mode: 'insensitive' } } },
          ],
        },
      };
    }

    const [abonos, total, totalesPorMetodo] = await Promise.all([
      this.prisma.abono_cxc.findMany({
        where: whereClause,
        include: {
          usuario: {
            select: { nombres: true, apellidos: true },
          },
          cuentaPorCobrar: {
            include: {
              contrato: {
                select: {
                  codigo: true,
                  cliente: {
                    select: { titular: true },
                  },
                },
              },
              facturaDirecta: {
                select: {
                  numero_cuota: true,
                  periodo_inicio: true,
                  periodo_fin: true,
                  es_instalacion: true,
                },
              },
            },
          },
        },
        orderBy: { fecha_pago: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.abono_cxc.count({ where: whereClause }),
      this.prisma.abono_cxc.groupBy({
        by: ['metodo_pago'],
        where: whereClause,
        _sum: { monto: true },
        _count: { id_abono: true },
      }),
    ]);

    const data = abonos.map((a) => ({
      idAbono: a.id_abono,
      monto: Number(a.monto),
      saldoAnterior: Number(a.saldo_anterior),
      saldoPosterior: Number(a.saldo_posterior),
      metodoPago: a.metodo_pago,
      referencia: a.referencia,
      fechaPago: a.fecha_pago.toISOString(),
      observaciones: a.observaciones,
      usuario: a.usuario
        ? `${a.usuario.nombres} ${a.usuario.apellidos}`
        : null,
      cliente: a.cuentaPorCobrar.contrato?.cliente?.titular || null,
      contrato: a.cuentaPorCobrar.contrato?.codigo || null,
      factura: {
        numeroCuota: a.cuentaPorCobrar.facturaDirecta.numero_cuota,
        periodoInicio: a.cuentaPorCobrar.facturaDirecta.periodo_inicio?.toISOString() || null,
        periodoFin: a.cuentaPorCobrar.facturaDirecta.periodo_fin?.toISOString() || null,
        esInstalacion: a.cuentaPorCobrar.facturaDirecta.es_instalacion,
      },
    }));

    const resumenMetodos = totalesPorMetodo.map((g) => ({
      metodoPago: g.metodo_pago,
      total: Number(g._sum.monto) || 0,
      cantidad: g._count.id_abono,
    }));

    const totalGeneral = resumenMetodos.reduce((sum, r) => sum + r.total, 0);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      resumen: {
        porMetodo: resumenMetodos,
        totalGeneral,
      },
    };
  }

  async obtenerAbonosContrato(idContrato: number) {
    const contrato = await this.prisma.atcContrato.findUnique({
      where: { id_contrato: idContrato },
    });

    if (!contrato) {
      throw new NotFoundException(`Contrato #${idContrato} no encontrado`);
    }

    const abonos = await this.prisma.abono_cxc.findMany({
      where: {
        cuentaPorCobrar: { id_contrato: idContrato },
        activo: true,
      },
      include: {
        usuario: {
          select: { nombres: true, apellidos: true },
        },
        cuentaPorCobrar: {
          include: {
            facturaDirecta: {
              select: {
                numero_cuota: true,
                periodo_inicio: true,
                periodo_fin: true,
                es_instalacion: true,
              },
            },
          },
        },
      },
      orderBy: { fecha_pago: 'desc' },
    });

    return abonos.map((a) => ({
      idAbono: a.id_abono,
      monto: Number(a.monto),
      saldoAnterior: Number(a.saldo_anterior),
      saldoPosterior: Number(a.saldo_posterior),
      metodoPago: a.metodo_pago,
      referencia: a.referencia,
      fechaPago: a.fecha_pago.toISOString(),
      observaciones: a.observaciones,
      usuario: a.usuario
        ? `${a.usuario.nombres} ${a.usuario.apellidos}`
        : null,
      factura: {
        numeroCuota: a.cuentaPorCobrar.facturaDirecta.numero_cuota,
        periodoInicio: a.cuentaPorCobrar.facturaDirecta.periodo_inicio?.toISOString() || null,
        periodoFin: a.cuentaPorCobrar.facturaDirecta.periodo_fin?.toISOString() || null,
        esInstalacion: a.cuentaPorCobrar.facturaDirecta.es_instalacion,
      },
    }));
  }

  // ============================================
  // DESCUENTOS POR FACTURA
  // ============================================

  /**
   * Aplicar descuento a una factura (antes de firmar por MH)
   */
  async aplicarDescuentoFactura(
    idFactura: number,
    dto: AplicarDescuentoFacturaDto,
    idUsuario: number,
  ) {
    const factura = await this.prisma.facturaDirecta.findUnique({
      where: { id_factura_directa: idFactura },
      include: {
        detalles: { orderBy: { num_item: 'asc' } },
        cuenta_por_cobrar: true,
        tipoFactura: { select: { codigo: true } },
      },
    });

    if (!factura) {
      throw new NotFoundException(`Factura #${idFactura} no encontrada`);
    }

    if (factura.estado !== 'ACTIVO') {
      throw new BadRequestException('Solo se puede aplicar descuento a facturas activas');
    }

    if (factura.estado_dte === 'PROCESADO') {
      throw new BadRequestException('No se puede aplicar descuento a una factura firmada por MH');
    }

    if (factura.estado_pago === 'PAGADO') {
      throw new BadRequestException('No se puede aplicar descuento a una factura ya pagada');
    }

    // Verificar y resolver id_bloque si no está asignado
    if (!factura.id_bloque) {
      // Determinar tipo de cliente desde datos de facturación
      let tipoCliente: string | null = null;

      if (factura.id_cliente_facturacion) {
        const datosFacturacion = await this.prisma.clienteDatosFacturacion.findUnique({
          where: { id_cliente_datos_facturacion: factura.id_cliente_facturacion },
          select: { tipo: true },
        });
        tipoCliente = datosFacturacion?.tipo || null;
      }

      if (!tipoCliente && factura.id_cliente) {
        const datosFacturacion = await this.prisma.clienteDatosFacturacion.findFirst({
          where: { id_cliente: factura.id_cliente, estado: 'ACTIVO' },
          select: { tipo: true },
        });
        tipoCliente = datosFacturacion?.tipo || null;
      }

      // PERSONA → codigo '01' (Consumidor Final), EMPRESA → codigo '03' (CCF)
      const codigoTipo = tipoCliente === 'EMPRESA' ? '03' : '01';

      const bloque = await this.prisma.facturasBloques.findFirst({
        where: {
          estado: 'ACTIVO',
          Tipo: { codigo: codigoTipo },
        },
        select: { id_bloque: true, id_tipo_factura: true },
      });

      if (!bloque) {
        throw new BadRequestException(
          `No se encontró un bloque de facturas activo para tipo ${codigoTipo === '01' ? 'Consumidor Final' : 'CCF'}`,
        );
      }

      await this.prisma.facturaDirecta.update({
        where: { id_factura_directa: idFactura },
        data: {
          id_bloque: bloque.id_bloque,
          id_tipo_factura: bloque.id_tipo_factura,
        },
      });

      // Actualizar datos locales para el resto del cálculo
      factura.id_bloque = bloque.id_bloque;
      factura.id_tipo_factura = bloque.id_tipo_factura;
      (factura as any).tipoFactura = { codigo: codigoTipo };
    }

    // Calcular subtotales BRUTOS por tipo de detalle (sin descuentos)
    const tipoDte = (factura as any).tipoFactura?.codigo || '01';
    const IVA_RATE = 0.13;

    const subTotalOriginal = Number(factura.subTotalVentas);
    // Calcular descuento total
    let descuentoTotal: number;
    if (dto.tipoDescuento === 'PORCENTAJE') {
      descuentoTotal = redondearMonto(subTotalOriginal * dto.valor / 100);
    } else {
      descuentoTotal = dto.valor;
    }


    if (descuentoTotal >= subTotalOriginal) {
      throw new BadRequestException('El descuento no puede ser igual o mayor al subtotal de la factura');
    }



    // Cálculo de IVA según tipo de DTE
    let totalIva: number;
    let totalNuevo: number;

    const descuGravada = subTotalOriginal - descuentoTotal;
    if (tipoDte === '01') {
      totalIva = redondearMonto(descuGravada - (descuGravada / (1 + IVA_RATE)));
      totalNuevo = descuGravada;
    } else {
      totalIva = redondearMonto(descuGravada * IVA_RATE);
      totalNuevo = redondearMonto(descuGravada + totalIva);
    }

    const totalAnterior = Number(factura.total);

    // Actualizar en transacción
    await this.prisma.$transaction(async (tx) => {
      // Resetear descuento a nivel de ítems (el descuento es solo a nivel de encabezado/resumen DTE)


      // Actualizar factura con totales y descuentos a nivel de encabezado
      await tx.facturaDirecta.update({
        where: { id_factura_directa: idFactura },
        data: {
          descuento: descuentoTotal,
          descuento_porcentaje: dto.tipoDescuento === 'PORCENTAJE' ? dto.valor : null,
          descuento_motivo: dto.motivo || null,
          descuento_usuario: idUsuario,
          descuento_fecha: new Date(),
          descuGravada,
          iva: totalIva,
          total: totalNuevo,
          dte_json: null,
          dte_firmado: null,
          estado_dte: 'BORRADOR',
        },
      });

      // Actualizar CxC
      if (factura.cuenta_por_cobrar) {
        const cxc = factura.cuenta_por_cobrar;
        const totalAbonado = Number(cxc.total_abonado);
        const nuevoSaldoPendiente = redondearMonto(totalNuevo - totalAbonado);

        let nuevoEstadoCxc = cxc.estado;
        let nuevoEstadoPago = factura.estado_pago;

        if (nuevoSaldoPendiente <= 0) {
          nuevoEstadoCxc = 'PAGADA_TOTAL';
          nuevoEstadoPago = 'PAGADO';
        }

        await tx.cuenta_por_cobrar.update({
          where: { id_cxc: cxc.id_cxc },
          data: {
            monto_total: totalNuevo,
            saldo_pendiente: Math.max(0, nuevoSaldoPendiente),
          },
        });

        if (nuevoEstadoPago !== factura.estado_pago) {
          await tx.facturaDirecta.update({
            where: { id_factura_directa: idFactura },
            data: { estado_pago: nuevoEstadoPago },
          });
        }
      }
    });

    await this.prisma.logAction(
      'APLICAR_DESCUENTO_FACTURA',
      idUsuario,
      `Descuento aplicado a factura #${idFactura}: ${dto.tipoDescuento === 'PORCENTAJE' ? dto.valor + '%' : '$' + dto.valor}. Total: $${totalAnterior} → $${totalNuevo}`,
    );

    return { totalAnterior, totalNuevo, descuento: descuentoTotal };
  }

  /**
   * Eliminar descuento de una factura
   */
  async eliminarDescuentoFactura(idFactura: number, idUsuario: number) {
    const factura = await this.prisma.facturaDirecta.findUnique({
      where: { id_factura_directa: idFactura },
      include: {
        cuenta_por_cobrar: true,
        tipoFactura: { select: { codigo: true } },
      },
    });

    if (!factura) {
      throw new NotFoundException(`Factura #${idFactura} no encontrada`);
    }

    if (factura.estado !== 'ACTIVO') {
      throw new BadRequestException('Solo se puede modificar facturas activas');
    }

    if (factura.estado_dte === 'PROCESADO') {
      throw new BadRequestException('No se puede modificar una factura firmada por MH');
    }

    if (Number(factura.descuento) === 0) {
      throw new BadRequestException('La factura no tiene descuento aplicado');
    }

    const totalAnterior = Number(factura.total);
    const tipoDte = (factura as any).tipoFactura?.codigo || '01';
    const IVA_RATE = 0.13;

    // subTotalVentas no fue modificado por aplicarDescuentoFactura, usarlo para restaurar
    const subTotalVentas = Number(factura.subTotalVentas);

    // Recalcular IVA y total sin descuento (misma lógica que aplicarDescuentoFactura con descuento=0)
    let totalIva: number;
    let totalNuevo: number;

    if (tipoDte === '01') {
      totalIva = redondearMonto(subTotalVentas - (subTotalVentas / (1 + IVA_RATE)));
      totalNuevo = subTotalVentas;
    } else {
      totalIva = redondearMonto(subTotalVentas * IVA_RATE);
      totalNuevo = redondearMonto(subTotalVentas + totalIva);
    }

    await this.prisma.$transaction(async (tx) => {
      // Revertir solo los campos que aplicarDescuentoFactura modificó
      await tx.facturaDirecta.update({
        where: { id_factura_directa: idFactura },
        data: {
          descuento: 0,
          descuento_porcentaje: null,
          descuento_motivo: null,
          descuento_usuario: null,
          descuento_fecha: null,
          descuGravada: 0,
          iva: totalIva,
          total: totalNuevo,
          dte_json: null,
          dte_firmado: null,
          estado_dte: 'BORRADOR',
        },
      });

      // Revertir CxC
      if (factura.cuenta_por_cobrar) {
        const cxc = factura.cuenta_por_cobrar;
        const totalAbonado = Number(cxc.total_abonado);
        const nuevoSaldoPendiente = redondearMonto(totalNuevo - totalAbonado);

        // Revertir estado si aplicarDescuentoFactura lo cambió a PAGADO
        let nuevoEstadoCxc = cxc.estado;
        let nuevoEstadoPago: any = factura.estado_pago;

        if (nuevoSaldoPendiente > 0) {
          nuevoEstadoCxc = totalAbonado > 0 ? 'PAGADA_PARCIAL' : 'PENDIENTE';
          nuevoEstadoPago = totalAbonado > 0 ? 'ABONO' : 'PENDIENTE';
        }

        await tx.cuenta_por_cobrar.update({
          where: { id_cxc: cxc.id_cxc },
          data: {
            monto_total: totalNuevo,
            saldo_pendiente: Math.max(0, nuevoSaldoPendiente),
            estado: nuevoEstadoCxc,
          },
        });

        if (nuevoEstadoPago !== factura.estado_pago) {
          await tx.facturaDirecta.update({
            where: { id_factura_directa: idFactura },
            data: { estado_pago: nuevoEstadoPago },
          });
        }
      }
    });

    await this.prisma.logAction(
      'ELIMINAR_DESCUENTO_FACTURA',
      idUsuario,
      `Descuento eliminado de factura #${idFactura}. Total: $${totalAnterior} → $${totalNuevo}`,
    );

    return { totalAnterior, totalNuevo, descuento: 0 };
  }

  /**
   * Eliminar mora de una factura
   */
  async eliminarMoraFactura(idFactura: number, idUsuario: number) {
    const factura = await this.prisma.facturaDirecta.findUnique({
      where: { id_factura_directa: idFactura },
      include: {
        cuenta_por_cobrar: true,
      },
    });

    if (!factura) {
      throw new NotFoundException(`Factura #${idFactura} no encontrada`);
    }

    if (factura.estado !== 'ACTIVO') {
      throw new BadRequestException('Solo se puede modificar facturas activas');
    }

    const moraActual = Number(factura.monto_mora);

    if (moraActual <= 0) {
      throw new BadRequestException('La factura no tiene mora aplicada');
    }

    const cxc = factura.cuenta_por_cobrar;
    if (!cxc) {
      throw new BadRequestException('La factura no tiene cuenta por cobrar asociada');
    }

    const saldoActual = Number(cxc.saldo_pendiente);
    const totalAbonado = Number(cxc.total_abonado);
    const nuevoSaldo = redondearMonto(saldoActual - moraActual);

    // Determinar nuevo estado
    let nuevoEstadoPago: any = factura.estado_pago;
    let nuevoEstadoCxc = cxc.estado;

    if (factura.estado_pago !== 'EN_ACUERDO') {
      if (nuevoSaldo <= 0) {
        nuevoEstadoPago = 'PAGADO';
        nuevoEstadoCxc = 'PAGADA_TOTAL';
      } else if (totalAbonado > 0) {
        nuevoEstadoPago = 'PARCIAL';
        nuevoEstadoCxc = 'PAGADA_PARCIAL';
      } else {
        nuevoEstadoPago = 'PENDIENTE';
        nuevoEstadoCxc = 'PENDIENTE';
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.cuenta_por_cobrar.update({
        where: { id_cxc: cxc.id_cxc },
        data: {
          saldo_pendiente: Math.max(0, nuevoSaldo),
          monto_mora: 0,
          mora_exonerada: true,
          estado: nuevoEstadoCxc,
        },
      });

      await tx.facturaDirecta.update({
        where: { id_factura_directa: idFactura },
        data: {
          monto_mora: 0,
          estado_pago: nuevoEstadoPago,
        },
      });
    });

    await this.prisma.logAction(
      'ELIMINAR_MORA_FACTURA',
      idUsuario,
      `Mora eliminada de factura #${idFactura}. Mora: $${moraActual}, Saldo: $${saldoActual} → $${Math.max(0, nuevoSaldo)}`,
    );

    return {
      moraEliminada: moraActual,
      saldoAnterior: saldoActual,
      saldoNuevo: Math.max(0, nuevoSaldo),
    };
  }

  /**
   * Distribuir descuento proporcionalmente entre ítems
   */
  private distribuirDescuento(
    detalles: any[],
    descuentoTotal: number,
  ): Array<{ id_detalle: number; tipo_detalle: string; subtotalSinDesc: number; descuento: number }> {
    const totalBruto = detalles.reduce(
      (sum, d) => sum + Number(d.cantidad) * Number(d.precio_unitario),
      0,
    );

    let acumulado = 0;
    const resultado = detalles.map((d, index) => {
      const subtotalSinDesc = Number(d.cantidad) * Number(d.precio_unitario);
      const peso = subtotalSinDesc / totalBruto;
      let descuentoItem: number;

      if (index === detalles.length - 1) {
        // Último ítem absorbe diferencia de redondeo
        descuentoItem = redondearMonto(descuentoTotal - acumulado);
      } else {
        descuentoItem = redondearMonto(descuentoTotal * peso);
        acumulado += descuentoItem;
      }

      return {
        id_detalle: d.id_detalle,
        tipo_detalle: d.tipo_detalle,
        subtotalSinDesc,
        descuento: descuentoItem,
      };
    });

    return resultado;
  }

  // ============================================
  // HELPERS PRIVADOS
  // ============================================

  /**
   * Cálculo interno de mora (replica la lógica de MoraService para aplicar a CxC individual)
   */
  private calcularMoraInterna(
    config: MoraConfig,
    montoOriginal: number,
    diasAtraso: number,
    moraAcumulada: number,
  ): number {
    const valor = Number(config.valor);
    const baseCalculo = config.es_acumulativa
      ? montoOriginal + moraAcumulada
      : montoOriginal;

    let mora = 0;

    switch (config.tipo_calculo) {
      case 'MONTO_FIJO':
        mora = this.calcularMoraFija(valor, config.frecuencia, diasAtraso);
        break;
      case 'PORCENTAJE_SALDO':
        mora = this.calcularMoraPorcentaje(baseCalculo, valor, config.frecuencia, diasAtraso);
        break;
      case 'PORCENTAJE_MONTO_ORIGINAL':
        mora = this.calcularMoraPorcentaje(montoOriginal, valor, config.frecuencia, diasAtraso);
        break;
    }

    // Topes
    if (config.mora_maxima) {
      mora = Math.min(mora, Number(config.mora_maxima));
    }
    if (config.porcentaje_maximo) {
      mora = Math.min(mora, montoOriginal * (Number(config.porcentaje_maximo) / 100));
    }

    return mora;
  }

  private calcularMoraFija(montoFijo: number, frecuencia: string, diasAtraso: number): number {
    switch (frecuencia) {
      case 'UNICA': return montoFijo;
      case 'DIARIA': return montoFijo * diasAtraso;
      case 'SEMANAL': return montoFijo * Math.ceil(diasAtraso / 7);
      case 'MENSUAL': return montoFijo * Math.ceil(diasAtraso / 30);
      default: return montoFijo;
    }
  }

  private calcularMoraPorcentaje(base: number, porcentaje: number, frecuencia: string, diasAtraso: number): number {
    const moraPorPeriodo = base * (porcentaje / 100);
    switch (frecuencia) {
      case 'UNICA': return moraPorPeriodo;
      case 'DIARIA': return moraPorPeriodo * diasAtraso;
      case 'SEMANAL': return moraPorPeriodo * Math.ceil(diasAtraso / 7);
      case 'MENSUAL': return moraPorPeriodo * Math.ceil(diasAtraso / 30);
      default: return moraPorPeriodo;
    }
  }

  // ============================================
  // ENVÍO MANUAL A MH
  // ============================================

  async enviarFacturaMh(idFactura: number, idUsuario: number) {
    this.logger.log(`Envío manual a MH para factura #${idFactura}`);

    const factura = await this.prisma.facturaDirecta.findUnique({
      where: { id_factura_directa: idFactura },
      select: {
        id_factura_directa: true,
        estado: true,
        estado_dte: true,
        codigo_generacion: true,
      },
    });

    if (!factura) {
      throw new NotFoundException(`Factura #${idFactura} no encontrada`);
    }

    if (factura.estado !== 'ACTIVO') {
      throw new BadRequestException('Solo se pueden enviar a MH facturas con estado ACTIVO');
    }

    if (factura.estado_dte === 'PROCESADO') {
      throw new BadRequestException('La factura ya fue procesada exitosamente en MH');
    }

    if (factura.estado_dte === 'INVALIDADO') {
      throw new BadRequestException('La factura fue invalidada y no puede enviarse a MH');
    }

    // Si ya tiene codigo_generacion, es un reintento (ya pasó por firmarYEnviarFactura antes)
    if (factura.codigo_generacion) {
      return this.facturaDirectaService.reenviarDte(idFactura, idUsuario);
    }

    // Primera firma: asignar bloque, construir DTE, firmar y transmitir
    return this.facturaDirectaService.firmarYEnviarFactura(idFactura, idUsuario);
  }

  /**
   * Genera la siguiente factura del contrato si la factura pagada era la última pendiente.
   */
  private async generarSiguienteFacturaSiUltima(
    idFacturaPagada: number,
    idContrato: number,
    idUsuario: number,
  ): Promise<void> {
    // Verificar si existen más facturas pendientes para este contrato
    const pendientes = await this.prisma.facturaDirecta.count({
      where: {
        id_contrato: idContrato,
        id_factura_directa: { not: idFacturaPagada },
        estado: 'ACTIVO',
        estado_pago: { in: ['PENDIENTE', 'PARCIAL', 'VENCIDA', 'EN_ACUERDO'] },
      },
    });

    if (pendientes > 0) return;

    // Cargar la factura pagada con sus detalles
    const facturaPagada = await this.prisma.facturaDirecta.findUnique({
      where: { id_factura_directa: idFacturaPagada },
      include: { detalles: true },
    });

    if (!facturaPagada || !facturaPagada.id_contrato) return;

    // Calcular fechas del siguiente mes
    const addOneMonth = (date: Date): Date => {
      const result = new Date(date);
      const originalDay = result.getDate();
      result.setMonth(result.getMonth() + 1);
      // Manejar desborde de mes (ej: 31 enero → 28 feb)
      if (result.getDate() !== originalDay) {
        result.setDate(0); // Último día del mes anterior
      }
      return result;
    };

    const nuevoPeriodoInicio = facturaPagada.periodo_inicio
      ? addOneMonth(new Date(facturaPagada.periodo_inicio))
      : null;
    const nuevoPeriodoFin = facturaPagada.periodo_fin
      ? addOneMonth(new Date(facturaPagada.periodo_fin))
      : null;
    const nuevaFechaVencimiento = facturaPagada.fecha_vencimiento
      ? addOneMonth(new Date(facturaPagada.fecha_vencimiento))
      : null;
    const nuevaCuota = facturaPagada.numero_cuota != null
      ? facturaPagada.numero_cuota + 1
      : null;

    // Crear la nueva factura
    const nuevaFactura = await this.prisma.facturaDirecta.create({
      data: {
        // Campos frescos
        numero_factura: null,
        id_bloque: null,
        id_tipo_factura: null,
        fecha_de_pago: null,
        estado: 'ACTIVO',
        estado_pago: 'PENDIENTE',
        estado_dte: 'BORRADOR',
        intentos_dte: 0,
        ultimo_error_dte: null,
        monto_mora: 0,
        descuento: 0,
        descuento_porcentaje: null,
        descuento_motivo: null,
        descuento_usuario: null,
        descuento_fecha: null,
        efectivo: 0,
        tarjeta: 0,
        cheque: 0,
        transferencia: 0,
        id_cuenta_tarjeta: null,
        id_cuenta_cheque: null,
        id_cuenta_transferencia: null,
        id_metodo_pago: null,
        codigo_generacion: uuidv4().toUpperCase(),
        numero_control: null,
        dte_json: null,
        dte_firmado: null,
        sello_recepcion: null,
        fecha_recepcion_mh: null,
        codigo_msg_mh: null,
        descripcion_msg_mh: null,
        observaciones_mh: null,
        anulacion_codigo_generacion: null,
        anulacion_sello_recepcion: null,
        anulacion_json: null,
        anulacion_firmada: null,
        fecha_anulacion: null,
        anulacion_motivo: null,
        anulacion_codigo_msg: null,
        anulacion_descripcion_msg: null,
        total_letras: null,
        observaciones: null,
        id_factura_original: null,
        dias_credito: null,
        fecha_pago_estimada: null,

        // Fechas del nuevo periodo
        periodo_inicio: nuevoPeriodoInicio,
        periodo_fin: nuevoPeriodoFin,
        fecha_vencimiento: nuevaFechaVencimiento,
        numero_cuota: nuevaCuota,

        // Copiados de la factura original
        id_contrato: facturaPagada.id_contrato,
        id_cliente: facturaPagada.id_cliente,
        id_cliente_facturacion: facturaPagada.id_cliente_facturacion,
        id_cliente_directo: facturaPagada.id_cliente_directo,
        id_sucursal: facturaPagada.id_sucursal,
        id_usuario: idUsuario,
        total_cuotas: facturaPagada.total_cuotas,
        es_instalacion: facturaPagada.es_instalacion,
        condicion_operacion: facturaPagada.condicion_operacion,
        cliente_nombre: facturaPagada.cliente_nombre,
        cliente_nrc: facturaPagada.cliente_nrc,
        cliente_nit: facturaPagada.cliente_nit,
        cliente_direccion: facturaPagada.cliente_direccion,
        cliente_giro: facturaPagada.cliente_giro,
        cliente_telefono: facturaPagada.cliente_telefono,
        cliente_correo: facturaPagada.cliente_correo,
        subtotal: facturaPagada.subtotal,
        subTotalVentas: facturaPagada.subTotalVentas,
        totalNoSuj: facturaPagada.totalNoSuj,
        totalExenta: facturaPagada.totalExenta,
        totalGravada: facturaPagada.totalGravada,
        totalNoGravado: facturaPagada.totalNoGravado,
        descuNoSuj: facturaPagada.descuNoSuj,
        descuExenta: facturaPagada.descuExenta,
        descuGravada: facturaPagada.descuGravada,
        iva: facturaPagada.iva,
        iva_retenido: facturaPagada.iva_retenido,
        iva_percibido: facturaPagada.iva_percibido,
        renta_retenido: facturaPagada.renta_retenido,
        total: facturaPagada.total,
        flete: facturaPagada.flete,
        seguro: facturaPagada.seguro,

        // Detalles (copiar líneas de la factura original)
        detalles: {
          create: facturaPagada.detalles.map((d) => ({
            num_item: d.num_item,
            codigo: d.codigo,
            nombre: d.nombre,
            descripcion: d.descripcion,
            nota: d.nota,
            cantidad: d.cantidad,
            uni_medida: d.uni_medida,
            precio_unitario: d.precio_unitario,
            precio_sin_iva: d.precio_sin_iva,
            precio_con_iva: d.precio_con_iva,
            tipo_detalle: d.tipo_detalle,
            venta_gravada: d.venta_gravada,
            venta_exenta: d.venta_exenta,
            venta_nosujeto: d.venta_nosujeto,
            venta_nograbada: d.venta_nograbada,
            subtotal: d.subtotal,
            descuento: d.descuento,
            iva: d.iva,
            total: d.total,
            id_catalogo: d.id_catalogo,
            id_descuento: d.id_descuento,
          })),
        },
      },
    });

    // Crear cuenta por cobrar para la nueva factura
    if (nuevaFechaVencimiento) {
      await this.cxcService.crearCxcParaFacturaContrato(
        {
          id_factura_directa: nuevaFactura.id_factura_directa,
          id_cliente: facturaPagada.id_cliente!,
          id_contrato: facturaPagada.id_contrato!,
          total: nuevaFactura.total,
          fecha_vencimiento: nuevaFechaVencimiento,
        },
        facturaPagada.id_sucursal,
        idUsuario,
      );
    }

    this.logger.log(
      `Factura #${nuevaFactura.id_factura_directa} (cuota ${nuevaCuota}) generada automáticamente para contrato #${idContrato}`,
    );
  }

  // ============================================
  // DETECCIÓN Y CORRECCIÓN DE FACTURAS DUPLICADAS
  // ============================================

  /**
   * Detecta contratos donde la primera factura fue duplicada.
   * Retorna solo los IDs de contrato afectados.
   */
  async detectarFacturasDuplicadas(): Promise<{ idsContratos: number[] }> {
    const duplicados: Array<{ id_contrato: number }> = await this.prisma.$queryRawUnsafe(`
      SELECT DISTINCT fd.id_contrato
      FROM "facturaDirecta" fd
      WHERE fd.id_contrato IS NOT NULL
        AND fd.fecha_vencimiento IS NOT NULL
        AND fd.estado = 'ACTIVO'
      GROUP BY fd.id_contrato, fd.fecha_vencimiento, fd.periodo_inicio, fd.periodo_fin
      HAVING COUNT(*) > 1
        AND MIN(fd.id_factura_directa) = (
          SELECT MIN(f2.id_factura_directa)
          FROM "facturaDirecta" f2
          WHERE f2.id_contrato = fd.id_contrato
            AND f2.fecha_vencimiento IS NOT NULL
            AND f2.estado = 'ACTIVO'
        )
      ORDER BY fd.id_contrato
    `);

    return { idsContratos: duplicados.map((d) => d.id_contrato) };
  }

  /**
   * Obtiene detalle completo de duplicados para uso interno de corrección.
   */
  private async obtenerDuplicadosDetallados() {
    const duplicados: Array<{
      id_contrato: number;
      fecha_vencimiento: Date;
      periodo_inicio: Date;
      periodo_fin: Date;
      total_facturas: number;
      facturas_ids: number[];
      cuotas: (number | null)[];
    }> = await this.prisma.$queryRawUnsafe(`
      SELECT
        fd.id_contrato,
        fd.fecha_vencimiento,
        fd.periodo_inicio,
        fd.periodo_fin,
        COUNT(*)::int AS total_facturas,
        ARRAY_AGG(fd.id_factura_directa ORDER BY fd.id_factura_directa) AS facturas_ids,
        ARRAY_AGG(fd.numero_cuota ORDER BY fd.id_factura_directa) AS cuotas
      FROM "facturaDirecta" fd
      WHERE fd.id_contrato IS NOT NULL
        AND fd.fecha_vencimiento IS NOT NULL
        AND fd.estado = 'ACTIVO'
      GROUP BY fd.id_contrato, fd.fecha_vencimiento, fd.periodo_inicio, fd.periodo_fin
      HAVING COUNT(*) > 1
        AND MIN(fd.id_factura_directa) = (
          SELECT MIN(f2.id_factura_directa)
          FROM "facturaDirecta" f2
          WHERE f2.id_contrato = fd.id_contrato
            AND f2.fecha_vencimiento IS NOT NULL
            AND f2.estado = 'ACTIVO'
        )
      ORDER BY fd.id_contrato, fd.fecha_vencimiento
    `);

    const resultado: Array<{
      idContrato: number;
      fechaVencimiento: string;
      periodoInicio: string;
      periodoFin: string;
      totalFacturas: number;
      idsFacturas: number[];
      cuotas: (number | null)[];
      idFacturaCorregir: number;
      fechasDestino: {
        fechaVencimiento: string;
        periodoInicio: string;
        periodoFin: string;
      };
      conflicto: boolean;
      detalleConflicto?: string;
    }> = [];

    for (const dup of duplicados) {
      const idFacturaCorregir = dup.facturas_ids[0]; // menor ID

      const targetFechaVencimiento = this.restarUnMes(new Date(dup.fecha_vencimiento));
      const targetPeriodoInicio = this.restarUnMes(new Date(dup.periodo_inicio));
      const targetPeriodoFin = this.restarUnMes(new Date(dup.periodo_fin));

      // Verificar conflicto: ¿ya existe factura activa en la fecha destino?
      const existente = await this.prisma.facturaDirecta.findFirst({
        where: {
          id_contrato: dup.id_contrato,
          fecha_vencimiento: targetFechaVencimiento,
          periodo_inicio: targetPeriodoInicio,
          periodo_fin: targetPeriodoFin,
          estado: 'ACTIVO',
          id_factura_directa: { not: idFacturaCorregir },
        },
        select: { id_factura_directa: true },
      });

      resultado.push({
        idContrato: dup.id_contrato,
        fechaVencimiento: dup.fecha_vencimiento.toISOString(),
        periodoInicio: dup.periodo_inicio.toISOString(),
        periodoFin: dup.periodo_fin.toISOString(),
        totalFacturas: dup.total_facturas,
        idsFacturas: dup.facturas_ids,
        cuotas: dup.cuotas,
        idFacturaCorregir,
        fechasDestino: {
          fechaVencimiento: targetFechaVencimiento.toISOString(),
          periodoInicio: targetPeriodoInicio.toISOString(),
          periodoFin: targetPeriodoFin.toISOString(),
        },
        conflicto: !!existente,
        detalleConflicto: existente
          ? `Ya existe factura #${existente.id_factura_directa} en la fecha destino`
          : undefined,
      });
    }

    return resultado;
  }

  /**
   * Corrige facturas duplicadas retrocediendo la original un mes.
   */
  async corregirFacturasDuplicadas(idsContratos?: number[], idUsuario?: number) {
    let grupos = await this.obtenerDuplicadosDetallados();

    if (idsContratos && idsContratos.length > 0) {
      const set = new Set(idsContratos);
      grupos = grupos.filter((g) => set.has(g.idContrato));
    }

    const corregidos: Array<{
      idContrato: number;
      idFactura: number;
      fechasOriginales: { fechaVencimiento: string; periodoInicio: string; periodoFin: string };
      fechasNuevas: { fechaVencimiento: string; periodoInicio: string; periodoFin: string };
      cxcActualizada: boolean;
    }> = [];

    const conflictos: Array<{
      idContrato: number;
      idFactura: number;
      razon: string;
    }> = [];

    for (const grupo of grupos) {
      if (grupo.conflicto) {
        conflictos.push({
          idContrato: grupo.idContrato,
          idFactura: grupo.idFacturaCorregir,
          razon: grupo.detalleConflicto || 'Conflicto de fecha destino',
        });
        continue;
      }

      try {
        const targetFechaVencimiento = new Date(grupo.fechasDestino.fechaVencimiento);
        const targetPeriodoInicio = new Date(grupo.fechasDestino.periodoInicio);
        const targetPeriodoFin = new Date(grupo.fechasDestino.periodoFin);

        await this.prisma.$transaction(async (tx) => {
          // Re-validar conflicto dentro de la transacción
          const existente = await tx.facturaDirecta.findFirst({
            where: {
              id_contrato: grupo.idContrato,
              fecha_vencimiento: targetFechaVencimiento,
              periodo_inicio: targetPeriodoInicio,
              periodo_fin: targetPeriodoFin,
              estado: 'ACTIVO',
              id_factura_directa: { not: grupo.idFacturaCorregir },
            },
            select: { id_factura_directa: true },
          });

          if (existente) {
            throw new Error(
              `Conflicto: ya existe factura #${existente.id_factura_directa} en la fecha destino`,
            );
          }

          // Actualizar facturaDirecta
          await tx.facturaDirecta.update({
            where: { id_factura_directa: grupo.idFacturaCorregir },
            data: {
              fecha_vencimiento: targetFechaVencimiento,
              periodo_inicio: targetPeriodoInicio,
              periodo_fin: targetPeriodoFin,
            },
          });

          // Actualizar cuenta_por_cobrar (si existe)
          await tx.cuenta_por_cobrar.updateMany({
            where: { id_factura_directa: grupo.idFacturaCorregir },
            data: {
              fecha_vencimiento: targetFechaVencimiento,
              fecha_emision: targetPeriodoInicio,
            },
          });
        });

        const cxc = await this.prisma.cuenta_por_cobrar.findUnique({
          where: { id_factura_directa: grupo.idFacturaCorregir },
          select: { id_cxc: true },
        });

        corregidos.push({
          idContrato: grupo.idContrato,
          idFactura: grupo.idFacturaCorregir,
          fechasOriginales: {
            fechaVencimiento: grupo.fechaVencimiento,
            periodoInicio: grupo.periodoInicio,
            periodoFin: grupo.periodoFin,
          },
          fechasNuevas: {
            fechaVencimiento: grupo.fechasDestino.fechaVencimiento,
            periodoInicio: grupo.fechasDestino.periodoInicio,
            periodoFin: grupo.fechasDestino.periodoFin,
          },
          cxcActualizada: !!cxc,
        });

        this.logger.log(
          `Factura #${grupo.idFacturaCorregir} del contrato #${grupo.idContrato} corregida: fechas retrocedidas 1 mes`,
        );
      } catch (error) {
        conflictos.push({
          idContrato: grupo.idContrato,
          idFactura: grupo.idFacturaCorregir,
          razon: error.message || 'Error desconocido',
        });
      }
    }

    return {
      totalDetectados: grupos.length,
      totalCorregidos: corregidos.length,
      totalConflictos: conflictos.length,
      corregidos,
      conflictos,
    };
  }

  private restarUnMes(fecha: Date): Date {
    const d = new Date(fecha);
    d.setMonth(d.getMonth() - 1);
    return d;
  }
}
