import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { FacturaDirectaService } from '../facturacion/factura-directa/factura-directa.service';

/**
 * Cron que regenera facturas + CxC para cuotas de contrato que fueron anuladas.
 *
 * Cuando un operador anula una factura de contrato (ej. por haberla aplicado al
 * cliente equivocado), la CxC asociada queda en estado ANULADA y la cuota queda
 * "perdida". Este cron detecta esos casos y crea una nueva factura BORRADOR +
 * CxC PENDIENTE con el mismo periodo/monto, para que la deuda pueda volver a
 * cobrarse en un flujo normal.
 *
 * Criterios para regenerar (todos deben cumplirse):
 *   - facturaDirecta.estado = 'ANULADO'
 *   - id_contrato IS NOT NULL y numero_cuota IS NOT NULL
 *   - anulacion_motivo NO corresponde a "Error en información del documento"
 *     ni a "Rescindir la operación" (esos tipos de anulación ya implican un DTE
 *     reemplazo o el fin del contrato, no se regenera)
 *   - No existe otra factura ACTIVO para el mismo contrato + numero_cuota
 *     (idempotencia: evita duplicados si el cron corrió antes o si un pago
 *     posterior generó la siguiente cuota)
 *   - El contrato está en un estado vigente (validado dentro del service)
 *
 * Se ejecuta todos los días a las 01:00 AM para no competir con el cierre de
 * caja (23:59:50).
 */
@Injectable()
export class RegenerarCuotasAnuladasCronService {
  private readonly logger = new Logger(RegenerarCuotasAnuladasCronService.name);

  // Textos exactos que devuelve obtenerMotivoAnulacionTexto() en FacturaDirectaService
  // para tipoAnulacion 1 y 2. Si el motivo almacenado coincide con uno de estos,
  // NO se regenera la cuota.
  private readonly MOTIVOS_SIN_REGENERACION: readonly string[] = [
    'Error en información del documento',
    'Rescindir la operación',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly facturaDirectaService: FacturaDirectaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Regenera cuotas anuladas. Corre diariamente a la 01:00 AM.
   */
  @Cron('0 0 1 * * *', { timeZone: 'America/El_Salvador' })
  async ejecutar(): Promise<void> {
    const raw = this.configService.get<string>('PORTAL_SYSTEM_USER_ID');
    if (!raw) {
      this.logger.error(
        'PORTAL_SYSTEM_USER_ID no está configurado — no se puede ejecutar regeneración de cuotas anuladas',
      );
      return;
    }
    const idUsuarioSistema = +raw;

    this.logger.log('Iniciando escaneo de cuotas de contrato anuladas a regenerar...');

    // 1. Buscar candidatas
    let candidatas: Array<{
      id_factura_directa: number;
      id_contrato: number | null;
      numero_cuota: number | null;
      anulacion_motivo: string | null;
    }>;

    try {
      candidatas = await this.prisma.facturaDirecta.findMany({
        where: {
          estado: 'ANULADO',
          id_contrato: { not: null },
          numero_cuota: { not: null },
          // Descartamos anulaciones cuyo motivo corresponde a tipo 1 / tipo 2
          anulacion_motivo: {
            notIn: this.MOTIVOS_SIN_REGENERACION as string[],
          },
        },
        select: {
          id_factura_directa: true,
          id_contrato: true,
          numero_cuota: true,
          anulacion_motivo: true,
        },
        orderBy: { fecha_anulacion: 'asc' },
      });
    } catch (error: any) {
      this.logger.error(
        `Error al consultar facturas anuladas candidatas: ${error?.message}`,
        error?.stack,
      );
      return;
    }

    if (candidatas.length === 0) {
      this.logger.log('No hay cuotas anuladas pendientes de regeneración');
      return;
    }

    this.logger.log(`Encontradas ${candidatas.length} facturas anuladas candidatas a regeneración`);

    // 2. Filtrar las que ya tienen una factura viva para la misma cuota
    //    (hacer la verificación NOT EXISTS aquí para dejar el log claro)
    const aRegenerar: typeof candidatas = [];
    for (const c of candidatas) {
      if (c.id_contrato == null || c.numero_cuota == null) continue;

      const existeViva = await this.prisma.facturaDirecta.count({
        where: {
          id_contrato: c.id_contrato,
          numero_cuota: c.numero_cuota,
          estado: 'ACTIVO',
        },
      });

      if (existeViva > 0) {
        this.logger.debug(
          `Skip factura #${c.id_factura_directa} — ya existe otra factura ACTIVA para ` +
            `contrato ${c.id_contrato} cuota ${c.numero_cuota}`,
        );
        continue;
      }

      aRegenerar.push(c);
    }

    if (aRegenerar.length === 0) {
      this.logger.log('Todas las candidatas ya tienen factura viva — nada que regenerar');
      return;
    }

    // 3. Regenerar una por una en transacciones independientes
    let exitosas = 0;
    let fallidas = 0;

    for (const c of aRegenerar) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await this.facturaDirectaService.regenerarCuotaContratoAnulada(
            c.id_factura_directa,
            idUsuarioSistema,
            tx,
          );
        });
        exitosas++;
      } catch (error: any) {
        fallidas++;
        this.logger.error(
          `Error al regenerar factura #${c.id_factura_directa} ` +
            `(contrato ${c.id_contrato}, cuota ${c.numero_cuota}): ${error?.message}`,
        );
      }
    }

    this.logger.log(
      `Regeneración completada — candidatas: ${candidatas.length}, ` +
        `a regenerar: ${aRegenerar.length}, exitosas: ${exitosas}, fallidas: ${fallidas}`,
    );
  }
}
