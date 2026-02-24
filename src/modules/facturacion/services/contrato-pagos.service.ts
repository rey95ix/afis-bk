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
import { RegistrarPagoContratoDto } from '../dto/contrato-pagos.dto';

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
  ) {}

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
          await tx.abono_cxc.create({
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
}
