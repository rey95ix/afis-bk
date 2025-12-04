import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Configuración de mora obtenida de la BD
 */
export interface MoraConfig {
  id_mora_config: number;
  codigo: string;
  nombre: string;
  tipo_calculo: 'MONTO_FIJO' | 'PORCENTAJE_SALDO' | 'PORCENTAJE_MONTO_ORIGINAL';
  valor: Decimal;
  dias_gracia: number;
  mora_maxima: Decimal | null;
  porcentaje_maximo: Decimal | null;
  frecuencia: 'UNICA' | 'DIARIA' | 'SEMANAL' | 'MENSUAL';
  es_acumulativa: boolean;
  activo: boolean;
}

/**
 * Factura vencida para cálculo de mora
 */
export interface FacturaVencida {
  id_dte: number;
  codigo_generacion: string;
  total_pagar: Decimal;
  fecha_emision: Date;
  fecha_vencimiento: Date;
  mora_acumulada: number; // Mora ya aplicada anteriormente
}

/**
 * Resultado del cálculo de mora
 */
export interface CalculoMoraResult {
  aplicaMora: boolean;
  montoMora: number;
  diasAtraso: number;
  facturasAfectadas: Array<{
    id_dte: number;
    montoOriginal: number;
    moraCalculada: number;
    diasAtraso: number;
  }>;
  config?: MoraConfig;
}

/**
 * Servicio para cálculo y gestión de mora
 *
 * La mora se aplica a facturas vencidas según la configuración establecida.
 * Prioridad de configuración:
 * 1. Configuración específica del contrato (atcContrato.id_mora_config)
 * 2. Configuración por defecto de la empresa (GeneralData.id_mora_config_default)
 * 3. Sin mora si no hay configuración
 */
@Injectable()
export class MoraService {
  private readonly logger = new Logger(MoraService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene la configuración de mora aplicable a un contrato
   *
   * @param idContrato ID del contrato
   * @returns Configuración de mora o null si no hay configuración activa
   */
  async obtenerConfiguracionMora(idContrato: number): Promise<MoraConfig | null> {
    // 1. Buscar configuración específica del contrato
    const contrato = await this.prisma.atcContrato.findUnique({
      where: { id_contrato: idContrato },
      include: {
        moraConfig: true,
      },
    });

    if (contrato?.moraConfig?.activo) {
      this.logger.debug(`Usando configuración de mora del contrato: ${contrato.moraConfig.codigo}`);
      return contrato.moraConfig as MoraConfig;
    }

    // 2. Buscar configuración por defecto de la empresa
    const generalData = await this.prisma.generalData.findFirst({
      include: {
        moraConfigDefault: true,
      },
    });

    if (generalData?.moraConfigDefault?.activo) {
      this.logger.debug(
        `Usando configuración de mora por defecto: ${generalData.moraConfigDefault.codigo}`,
      );
      return generalData.moraConfigDefault as MoraConfig;
    }

    this.logger.debug('No hay configuración de mora activa');
    return null;
  }

  /**
   * Obtiene las facturas vencidas pendientes de un contrato
   *
   * @param idContrato ID del contrato
   * @param config Configuración de mora para considerar días de gracia
   * @returns Lista de facturas vencidas
   */
  async obtenerFacturasVencidas(
    idContrato: number,
    config: MoraConfig,
  ): Promise<FacturaVencida[]> {
    const hoy = new Date();
    const fechaLimite = new Date(hoy);
    fechaLimite.setDate(fechaLimite.getDate() - config.dias_gracia);

    // Buscar DTEs procesados del contrato que estén vencidos
    // Una factura se considera vencida si:
    // - Estado es PROCESADO (no anulada)
    // - Fecha de emisión + días de gracia < hoy
    // - No está pagada (esto requeriría un modelo de pagos, por ahora asumimos no pagadas)
    const facturas = await this.prisma.dte_emitidos.findMany({
      where: {
        id_contrato: idContrato,
        estado: 'PROCESADO',
        fecha_emision: {
          lt: fechaLimite,
        },
      },
      select: {
        id_dte: true,
        codigo_generacion: true,
        total_pagar: true,
        fecha_emision: true,
      },
    });

    return facturas.map((f) => ({
      id_dte: f.id_dte,
      codigo_generacion: f.codigo_generacion,
      total_pagar: f.total_pagar,
      fecha_emision: f.fecha_emision,
      fecha_vencimiento: this.calcularFechaVencimiento(f.fecha_emision, config.dias_gracia),
      mora_acumulada: 0, // TODO: Obtener de un modelo de mora aplicada si existe
    }));
  }

  /**
   * Calcula la mora total a aplicar basado en facturas vencidas
   *
   * @param idContrato ID del contrato
   * @returns Resultado del cálculo de mora
   */
  async calcularMora(idContrato: number): Promise<CalculoMoraResult> {
    const config = await this.obtenerConfiguracionMora(idContrato);

    if (!config) {
      return {
        aplicaMora: false,
        montoMora: 0,
        diasAtraso: 0,
        facturasAfectadas: [],
      };
    }

    const facturasVencidas = await this.obtenerFacturasVencidas(idContrato, config);

    if (facturasVencidas.length === 0) {
      return {
        aplicaMora: false,
        montoMora: 0,
        diasAtraso: 0,
        facturasAfectadas: [],
        config,
      };
    }

    const hoy = new Date();
    let moraTotal = 0;
    let maxDiasAtraso = 0;
    const facturasAfectadas: CalculoMoraResult['facturasAfectadas'] = [];

    for (const factura of facturasVencidas) {
      const diasAtraso = this.calcularDiasAtraso(factura.fecha_vencimiento, hoy);
      maxDiasAtraso = Math.max(maxDiasAtraso, diasAtraso);

      const montoOriginal = Number(factura.total_pagar);
      let moraFactura = this.calcularMoraFactura(
        config,
        montoOriginal,
        diasAtraso,
        factura.mora_acumulada,
      );

      // Aplicar topes si existen
      moraFactura = this.aplicarTopes(config, moraFactura, montoOriginal);

      facturasAfectadas.push({
        id_dte: factura.id_dte,
        montoOriginal,
        moraCalculada: moraFactura,
        diasAtraso,
      });

      moraTotal += moraFactura;
    }

    // Redondear a 2 decimales
    moraTotal = Math.round(moraTotal * 100) / 100;

    this.logger.log(
      `Mora calculada para contrato ${idContrato}: $${moraTotal} (${facturasAfectadas.length} facturas)`,
    );

    return {
      aplicaMora: moraTotal > 0,
      montoMora: moraTotal,
      diasAtraso: maxDiasAtraso,
      facturasAfectadas,
      config,
    };
  }

  /**
   * Calcula la mora para una factura individual
   */
  private calcularMoraFactura(
    config: MoraConfig,
    montoOriginal: number,
    diasAtraso: number,
    moraAcumulada: number,
  ): number {
    const valor = Number(config.valor);
    let mora = 0;

    // Base de cálculo según si es acumulativa
    const baseCalculo = config.es_acumulativa
      ? montoOriginal + moraAcumulada
      : montoOriginal;

    // Calcular mora según tipo
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

    return mora;
  }

  /**
   * Calcula mora con monto fijo según frecuencia
   */
  private calcularMoraFija(
    montoFijo: number,
    frecuencia: MoraConfig['frecuencia'],
    diasAtraso: number,
  ): number {
    switch (frecuencia) {
      case 'UNICA':
        return montoFijo;

      case 'DIARIA':
        return montoFijo * diasAtraso;

      case 'SEMANAL':
        return montoFijo * Math.ceil(diasAtraso / 7);

      case 'MENSUAL':
        return montoFijo * Math.ceil(diasAtraso / 30);

      default:
        return montoFijo;
    }
  }

  /**
   * Calcula mora con porcentaje según frecuencia
   */
  private calcularMoraPorcentaje(
    base: number,
    porcentaje: number,
    frecuencia: MoraConfig['frecuencia'],
    diasAtraso: number,
  ): number {
    const moraPorPeriodo = base * (porcentaje / 100);

    switch (frecuencia) {
      case 'UNICA':
        return moraPorPeriodo;

      case 'DIARIA':
        return moraPorPeriodo * diasAtraso;

      case 'SEMANAL':
        return moraPorPeriodo * Math.ceil(diasAtraso / 7);

      case 'MENSUAL':
        return moraPorPeriodo * Math.ceil(diasAtraso / 30);

      default:
        return moraPorPeriodo;
    }
  }

  /**
   * Aplica los topes máximos configurados
   */
  private aplicarTopes(
    config: MoraConfig,
    mora: number,
    montoOriginal: number,
  ): number {
    let moraFinal = mora;

    // Tope de mora máxima absoluta
    if (config.mora_maxima) {
      const maxAbsoluta = Number(config.mora_maxima);
      moraFinal = Math.min(moraFinal, maxAbsoluta);
    }

    // Tope de porcentaje máximo sobre monto original
    if (config.porcentaje_maximo) {
      const maxPorcentaje = montoOriginal * (Number(config.porcentaje_maximo) / 100);
      moraFinal = Math.min(moraFinal, maxPorcentaje);
    }

    return moraFinal;
  }

  /**
   * Calcula los días de atraso
   */
  private calcularDiasAtraso(fechaVencimiento: Date, fechaActual: Date): number {
    const diffTime = fechaActual.getTime() - fechaVencimiento.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  /**
   * Calcula la fecha de vencimiento de una factura
   */
  private calcularFechaVencimiento(fechaEmision: Date, diasGracia: number): Date {
    const fechaVencimiento = new Date(fechaEmision);
    fechaVencimiento.setDate(fechaVencimiento.getDate() + diasGracia);
    return fechaVencimiento;
  }
}
