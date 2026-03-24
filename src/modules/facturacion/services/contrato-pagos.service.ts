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
      if (fechaDesde) whereClause.fecha_pago.gte = new Date(fechaDesde);
      if (fechaHasta) {
        const hasta = new Date(fechaHasta);
        hasta.setHours(23, 59, 59, 999);
        whereClause.fecha_pago.lte = hasta;
      }
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

    const [abonos, total] = await Promise.all([
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

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
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

    // Calcular subtotal original (sin descuentos previos)
    const subTotalOriginal = factura.detalles.reduce(
      (sum, d) => sum + Number(d.cantidad) * Number(d.precio_unitario),
      0,
    );

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

    // Distribuir proporcionalmente entre ítems
    const detallesConDescuento = this.distribuirDescuento(factura.detalles, descuentoTotal);

    // Recalcular totales
    const tipoDte = (factura as any).tipoFactura?.codigo || '01';
    const IVA_RATE = 0.13;
    let totalGravada = 0;
    let totalExenta = 0;
    let totalNoSuj = 0;
    let totalIva = 0;

    for (const det of detallesConDescuento) {
      const montoNeto = det.subtotalSinDesc - det.descuento;

      switch (det.tipo_detalle) {
        case 'GRAVADO':
          totalGravada += montoNeto;
          if (tipoDte === '01' || tipoDte === '14') {
            totalIva += montoNeto - montoNeto / (1 + IVA_RATE);
          } else {
            totalIva += montoNeto * IVA_RATE;
          }
          break;
        case 'EXENTA':
          totalExenta += montoNeto;
          break;
        case 'NOSUJETO':
          totalNoSuj += montoNeto;
          break;
      }
    }

    totalGravada = redondearMonto(totalGravada);
    totalExenta = redondearMonto(totalExenta);
    totalNoSuj = redondearMonto(totalNoSuj);
    totalIva = redondearMonto(totalIva);
    const subtotalVentas = redondearMonto(totalGravada + totalExenta + totalNoSuj);
    const subtotal = redondearMonto(subtotalVentas - descuentoTotal);
    const totalNuevo = (tipoDte === '01' || tipoDte === '14')
      ? subtotal
      : redondearMonto(subtotal + totalIva);

    const totalAnterior = Number(factura.total);

    // Actualizar en transacción
    await this.prisma.$transaction(async (tx) => {
      // Actualizar cada detalle
      for (const det of detallesConDescuento) {
        const montoNeto = det.subtotalSinDesc - det.descuento;
        let ivaItem = 0;
        let ventaGravada = 0;

        if (det.tipo_detalle === 'GRAVADO') {
          ventaGravada = montoNeto;
          if (tipoDte === '01' || tipoDte === '14') {
            ivaItem = redondearMonto(montoNeto - montoNeto / (1 + IVA_RATE), 4);
          } else {
            ivaItem = redondearMonto(montoNeto * IVA_RATE, 4);
          }
        }

        await tx.facturaDirectaDetalle.update({
          where: { id_detalle: det.id_detalle },
          data: {
            descuento: redondearMonto(det.descuento),
            venta_gravada: redondearMonto(ventaGravada),
            iva: redondearMonto(ivaItem),
            subtotal: redondearMonto(det.subtotalSinDesc),
            total: redondearMonto(montoNeto),
          },
        });
      }

      // Actualizar factura
      await tx.facturaDirecta.update({
        where: { id_factura_directa: idFactura },
        data: {
          descuento: descuentoTotal,
          descuento_porcentaje: dto.tipoDescuento === 'PORCENTAJE' ? dto.valor : null,
          descuento_motivo: dto.motivo || null,
          descuento_usuario: idUsuario,
          descuento_fecha: new Date(),
          totalGravada,
          totalExenta,
          totalNoSuj,
          iva: totalIva,
          subTotalVentas: subtotalVentas,
          subtotal,
          total: totalNuevo,
          // Reset DTE para que se regenere al firmar
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
        detalles: { orderBy: { num_item: 'asc' } },
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

    // Recalcular totales sin descuento
    let totalGravada = 0;
    let totalExenta = 0;
    let totalNoSuj = 0;
    let totalIva = 0;

    for (const det of factura.detalles) {
      const subtotalItem = Number(det.cantidad) * Number(det.precio_unitario);

      switch (det.tipo_detalle) {
        case 'GRAVADO':
          totalGravada += subtotalItem;
          if (tipoDte === '01' || tipoDte === '14') {
            totalIva += subtotalItem - subtotalItem / (1 + IVA_RATE);
          } else {
            totalIva += subtotalItem * IVA_RATE;
          }
          break;
        case 'EXENTA':
          totalExenta += subtotalItem;
          break;
        case 'NOSUJETO':
          totalNoSuj += subtotalItem;
          break;
      }
    }

    totalGravada = redondearMonto(totalGravada);
    totalExenta = redondearMonto(totalExenta);
    totalNoSuj = redondearMonto(totalNoSuj);
    totalIva = redondearMonto(totalIva);
    const subtotalVentas = redondearMonto(totalGravada + totalExenta + totalNoSuj);
    const totalNuevo = (tipoDte === '01' || tipoDte === '14')
      ? subtotalVentas
      : redondearMonto(subtotalVentas + totalIva);

    await this.prisma.$transaction(async (tx) => {
      // Reset descuento en cada detalle
      for (const det of factura.detalles) {
        const subtotalItem = Number(det.cantidad) * Number(det.precio_unitario);
        let ivaItem = 0;
        let ventaGravada = 0;

        if (det.tipo_detalle === 'GRAVADO') {
          ventaGravada = subtotalItem;
          if (tipoDte === '01' || tipoDte === '14') {
            ivaItem = redondearMonto(subtotalItem - subtotalItem / (1 + IVA_RATE), 4);
          } else {
            ivaItem = redondearMonto(subtotalItem * IVA_RATE, 4);
          }
        }

        await tx.facturaDirectaDetalle.update({
          where: { id_detalle: det.id_detalle },
          data: {
            descuento: 0,
            venta_gravada: redondearMonto(ventaGravada),
            iva: redondearMonto(ivaItem),
            subtotal: redondearMonto(subtotalItem),
            total: redondearMonto(subtotalItem),
          },
        });
      }

      await tx.facturaDirecta.update({
        where: { id_factura_directa: idFactura },
        data: {
          descuento: 0,
          descuento_porcentaje: null,
          descuento_motivo: null,
          descuento_usuario: null,
          descuento_fecha: null,
          totalGravada,
          totalExenta,
          totalNoSuj,
          iva: totalIva,
          subTotalVentas: subtotalVentas,
          subtotal: subtotalVentas,
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

        await tx.cuenta_por_cobrar.update({
          where: { id_cxc: cxc.id_cxc },
          data: {
            monto_total: totalNuevo,
            saldo_pendiente: Math.max(0, nuevoSaldoPendiente),
          },
        });
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
}
