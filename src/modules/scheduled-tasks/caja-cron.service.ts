import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { CajaService } from '../facturacion/caja/caja.service';

@Injectable()
export class CajaCronService {
  private readonly logger = new Logger(CajaCronService.name);

  constructor(
    private readonly cajaService: CajaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Cierre de caja automático diario a las 23:59:50.
   * Usa el usuario del sistema (PORTAL_SYSTEM_USER_ID) para generar el cierre.
   */
  @Cron('50 59 23 * * *')
  async ejecutarCierreUsuarioDiario(): Promise<void> {
    const raw = this.configService.get<string>('PORTAL_SYSTEM_USER_ID');
    if (!raw) {
      this.logger.error('PORTAL_SYSTEM_USER_ID no está configurado en las variables de entorno');
      return;
    }
    const idUsuario = +raw;
    this.logger.log(`Ejecutando cierre de caja automático para usuario #${idUsuario}...`);

    // 1. Cierre de usuario
    try {
      const resultado = await this.cajaService.generarCierreUsuario(idUsuario);
      this.logger.log(
        `Cierre de usuario generado — ID: ${resultado.idCierreUsuario}, ` +
        `Total: $${resultado.totalGeneral}, Movimientos: ${resultado.cantidadMovimientos}`,
      );
    } catch (error) {
      if (error?.status === 400) {
        this.logger.log('No hay movimientos pendientes para cierre de usuario');
      } else {
        this.logger.error(`Error en cierre de usuario automático: ${error.message}`);
      }
    }

    // 2. Cierre diario consolidado
    try {
      const resultadoDiario = await this.cajaService.generarCierreDiario(idUsuario);
      this.logger.log(
        `Cierre diario generado — ID: ${resultadoDiario.idCierreDiario}, ` +
        `Total: $${resultadoDiario.totalGeneral}, Movimientos: ${resultadoDiario.cantidadMovimientos}`,
      );
    } catch (error) {
      if (error?.status === 400) {
        this.logger.log('No hay movimientos pendientes para cierre diario');
        return;
      }
      this.logger.error(`Error en cierre diario automático: ${error.message}`);
    }
  }
}
