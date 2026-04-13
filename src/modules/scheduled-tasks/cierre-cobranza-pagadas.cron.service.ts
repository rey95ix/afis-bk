import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CobranzaService } from '../facturacion/cobranza/cobranza.service';

/**
 * Cron que auto-cierra asignaciones de cobranza cuyas facturas ya fueron pagadas
 * por otro canal (caja, abonos CxC, etc.).
 *
 * Busca `cobranza_asignacion` en estado `ACTIVA` cuyo `facturaDirecta.estado_pago`
 * sea `PAGADO`, y llama a `CobranzaService.cerrar()` con estado `CERRADA_PAGADA`.
 * El método de pago detectado se incorpora al campo `motivo` (el DTO existente no
 * tiene un campo dedicado para ello).
 *
 * Prioridad para determinar el método de pago:
 *   1. Último `abono_cxc.metodo_pago` (facturas crédito pagadas via abonos).
 *   2. `facturaDirecta.metodoPago.nombre` (facturas contado).
 *   3. Inferencia por montos (efectivo/tarjeta/cheque/transferencia).
 *   4. 'NO_IDENTIFICADO' si nada aplica.
 *
 * Se ejecuta cada 30 minutos.
 */
@Injectable()
export class CierreCobranzaPagadasCronService {
  private readonly logger = new Logger(CierreCobranzaPagadasCronService.name);
  private ejecutando = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cobranzaService: CobranzaService,
    private readonly configService: ConfigService,
  ) {}

  @Cron('0 */30 * * * *', { timeZone: 'America/El_Salvador' })
  async ejecutar(): Promise<void> {
    if (this.ejecutando) {
      this.logger.warn('Auto-cierre de cobranza ya en ejecución, omitiendo...');
      return;
    }
    this.ejecutando = true;
    try {
      await this.ejecutarInterno();
    } finally {
      this.ejecutando = false;
    }
  }

  private async ejecutarInterno(): Promise<void> {
    const raw = this.configService.get<string>('PORTAL_SYSTEM_USER_ID');
    if (!raw) {
      this.logger.error(
        'PORTAL_SYSTEM_USER_ID no está configurado — no se puede ejecutar auto-cierre de cobranza',
      );
      return;
    }
    const idUsuarioSistema = +raw;

    this.logger.log('Iniciando escaneo de asignaciones de cobranza con factura pagada...');

    let candidatas: Awaited<ReturnType<typeof this.buscarCandidatas>>;
    try {
      candidatas = await this.buscarCandidatas();
    } catch (error: any) {
      this.logger.error(
        `Error al consultar asignaciones candidatas: ${error?.message}`,
        error?.stack,
      );
      return;
    }

    if (candidatas.length === 0) {
      this.logger.log('No hay asignaciones de cobranza pendientes de auto-cierre');
      return;
    }

    this.logger.log(`Encontradas ${candidatas.length} asignaciones candidatas a cierre automático`);

    let exitosas = 0;
    let fallidas = 0;

    for (const asig of candidatas) {
      const factura = asig.facturaDirecta;
      const metodo = this.determinarMetodoPago(factura);
      const identificador = factura.numero_factura ?? `#${factura.id_factura_directa}`;
      const motivo = `Auto-cierre: factura ${identificador} pagada. Método: ${metodo}`;

      try {
        await this.cobranzaService.cerrar(
          asig.id_asignacion,
          { estado: 'CERRADA_PAGADA', motivo },
          idUsuarioSistema,
        );
        exitosas++;
      } catch (error: any) {
        fallidas++;
        this.logger.error(
          `Error al auto-cerrar asignación #${asig.id_asignacion} ` +
            `(factura ${identificador}): ${error?.message}`,
        );
      }
    }

    this.logger.log(
      `Auto-cierre de cobranza completado — candidatas: ${candidatas.length}, ` +
        `exitosas: ${exitosas}, fallidas: ${fallidas}`,
    );
  }

  private buscarCandidatas() {
    return this.prisma.cobranza_asignacion.findMany({
      where: {
        estado: 'ACTIVA',
        facturaDirecta: { estado_pago: 'PAGADO' },
      },
      select: {
        id_asignacion: true,
        facturaDirecta: {
          select: {
            id_factura_directa: true,
            numero_factura: true,
            efectivo: true,
            tarjeta: true,
            cheque: true,
            transferencia: true,
            metodoPago: { select: { nombre: true } },
            cuenta_por_cobrar: {
              select: {
                abonos: {
                  orderBy: { fecha_pago: 'desc' },
                  take: 1,
                  select: { metodo_pago: true },
                },
              },
            },
          },
        },
      },
    });
  }

  private determinarMetodoPago(factura: {
    efectivo: any;
    tarjeta: any;
    cheque: any;
    transferencia: any;
    metodoPago: { nombre: string } | null;
    cuenta_por_cobrar: {
      abonos: { metodo_pago: string }[];
    } | null;
  }): string {
    const ultimoAbono = factura.cuenta_por_cobrar?.abonos?.[0];
    if (ultimoAbono?.metodo_pago) {
      return ultimoAbono.metodo_pago;
    }

    if (factura.metodoPago?.nombre) {
      return factura.metodoPago.nombre;
    }

    const montos: Array<[string, any]> = [
      ['EFECTIVO', factura.efectivo],
      ['TARJETA', factura.tarjeta],
      ['CHEQUE', factura.cheque],
      ['TRANSFERENCIA', factura.transferencia],
    ];
    for (const [nombre, monto] of montos) {
      if (monto != null && Number(monto) > 0) {
        return nombre;
      }
    }

    return 'NO_IDENTIFICADO';
  }
}
