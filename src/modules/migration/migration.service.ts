import { Injectable, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MysqlConnectionService } from './services/mysql-connection.service';
import { CatalogosMigrationService } from './services/catalogos.migration';
import { ClientesMigrationService } from './services/clientes.migration';
import { ContratosMigrationService } from './services/contratos.migration';
import { DocumentosMigrationService } from './services/documentos.migration';
import { FacturacionMigrationService } from './services/facturacion.migration';
import { FacturaDirectaService } from '../facturacion/factura-directa/factura-directa.service';
import {
  TableMappings,
  MigrationStatus,
  MigrationModuleResult,
  ConnectionValidation,
  MigrationOptions,
  MigrationLog,
  SingleClienteMigrationResult,
  MigrationError,
  BulkClienteMigrationResult,
} from './interfaces/mapping.interface';
import { MigrationModule, MigrateClienteOptionsDto } from './dto/migration-config.dto';
import { MigrationGateway } from './migration.gateway';
import { RowDataPacket } from 'mysql2/promise';
import { normalizeDUI } from './utils/transformers';

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  // Estado de la migración
  private status: MigrationStatus = {
    isRunning: false,
    currentModule: null,
    completedModules: [],
    pendingModules: [],
    totalProgress: 0,
    startedAt: null,
    lastUpdatedAt: null,
    results: [],
  };

  // Mapeos de IDs entre MySQL y PostgreSQL
  private mappings: TableMappings = this.createEmptyMappings();

  // Logs de migración
  private logs: MigrationLog[] = [];
  private logIdCounter = 1;

  constructor(
    private readonly mysql: MysqlConnectionService,
    private readonly prisma: PrismaService,
    private readonly catalogosMigration: CatalogosMigrationService,
    private readonly clientesMigration: ClientesMigrationService,
    private readonly contratosMigration: ContratosMigrationService,
    private readonly documentosMigration: DocumentosMigrationService,
    private readonly facturacionMigration: FacturacionMigrationService,
    private readonly facturaDirectaService: FacturaDirectaService,
    @Optional() @Inject(forwardRef(() => MigrationGateway))
    private readonly migrationGateway?: MigrationGateway,
  ) { }

  /**
   * Crea un objeto de mapeos vacío
   */
  private createEmptyMappings(): TableMappings {
    return {
      departamentos: new Map(),
      municipios: new Map(),
      colonias: new Map(),
      estadoCivil: new Map(),
      estadoVivienda: new Map(),
      clientes: new Map(),
      direcciones: new Map(),
      planes: new Map(),
      ciclosFacturacion: new Map(),
      contratos: new Map(),
      facturas: new Map(),
      documentos: new Map(),
    };
  }

  /**
   * Agrega un log
   */
  private addLog(
    level: 'INFO' | 'WARN' | 'ERROR',
    module: string,
    message: string,
    details?: unknown,
  ): void {
    const log: MigrationLog = {
      id: this.logIdCounter++,
      timestamp: new Date(),
      level,
      module,
      message,
      details,
    };
    this.logs.push(log);
    this.migrationGateway?.emitLog(log);

    // Mantener solo los últimos 1000 logs
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }

    // También loguear con NestJS Logger
    switch (level) {
      case 'ERROR':
        this.logger.error(`[${module}] ${message}`, details);
        break;
      case 'WARN':
        this.logger.warn(`[${module}] ${message}`);
        break;
      default:
        this.logger.log(`[${module}] ${message}`);
    }
  }

  /**
   * Valida las conexiones a ambas bases de datos
   */
  async validateConnections(): Promise<ConnectionValidation> {
    this.addLog('INFO', 'validation', 'Validando conexiones...');

    // Validar MySQL
    const mysqlResult = await this.mysql.validateConnection();

    // Validar PostgreSQL (Prisma)
    let postgresResult: ConnectionValidation['postgres'];
    try {
      const result = await this.prisma.$queryRaw<{ version: string }[]>`SELECT VERSION() as version`;
      postgresResult = {
        connected: true,
        version: result[0]?.version,
        database: 'PostgreSQL (Prisma)',
      };
    } catch (error) {
      postgresResult = {
        connected: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }

    // Obtener conteo de tablas MySQL
    const tablesFound = mysqlResult.connected
      ? await this.mysql.getTablesCounts()
      : [];

    const validation: ConnectionValidation = {
      mysql: mysqlResult,
      postgres: postgresResult,
      tablesFound,
    };

    if (mysqlResult.connected && postgresResult.connected) {
      this.addLog('INFO', 'validation', 'Conexiones validadas exitosamente');
    } else {
      this.addLog('ERROR', 'validation', 'Error en validación de conexiones', validation);
    }

    return validation;
  }

  /**
   * Obtiene el estado actual de la migración
   */
  getStatus(): MigrationStatus {
    return { ...this.status };
  }

  /**
   * Obtiene los logs de migración
   */
  getLogs(limit = 100, offset = 0): { logs: MigrationLog[]; total: number } {
    const total = this.logs.length;
    const logs = this.logs.slice(offset, offset + limit);
    return { logs, total };
  }

  /**
   * Obtiene preview de un módulo
   */
  async getPreview(module: MigrationModule): Promise<unknown> {
    switch (module) {
      case MigrationModule.CATALOGOS:
        return this.catalogosMigration.getPreview();
      case MigrationModule.CLIENTES:
        return this.clientesMigration.getPreview();
      case MigrationModule.CONTRATOS:
        return this.contratosMigration.getPreview();
      case MigrationModule.DOCUMENTOS:
        return this.documentosMigration.getPreview();
      case MigrationModule.FACTURACION:
        return this.facturacionMigration.getPreview();
      default:
        throw new Error(`Módulo desconocido: ${module}`);
    }
  }

  /**
   * Ejecuta la migración de un módulo específico
   */
  async executeModule(
    module: MigrationModule,
    options: MigrationOptions,
  ): Promise<MigrationModuleResult> {
    if (this.status.isRunning) {
      throw new Error('Ya hay una migración en curso');
    }

    this.status.isRunning = true;
    this.status.currentModule = module;
    this.status.startedAt = new Date();
    this.status.lastUpdatedAt = new Date();

    this.addLog('INFO', module, `Iniciando migración de módulo: ${module}`);

    try {
      let result: MigrationModuleResult;

      switch (module) {
        case MigrationModule.CATALOGOS:
          result = await this.catalogosMigration.migrate(options, this.mappings);
          break;
        case MigrationModule.CLIENTES: {
          const bulkResult = await this.migrateAllClientesUnified(options);
          result = {
            module: 'clientes',
            success: bulkResult.errorCount === 0,
            totalRecords: bulkResult.totalClients,
            migratedRecords: bulkResult.successCount,
            skippedRecords: 0,
            errors: bulkResult.clientErrors.flatMap(ce => ce.errors),
            duration: bulkResult.duration,
            startedAt: this.status.startedAt || new Date(),
            completedAt: new Date(),
          };
          break;
        }
        case MigrationModule.CONTRATOS:
        case MigrationModule.DOCUMENTOS:
        case MigrationModule.FACTURACION:
          this.addLog('WARN', module, 'Este módulo se ejecuta automáticamente con la migración de clientes');
          result = {
            module,
            success: true,
            totalRecords: 0,
            migratedRecords: 0,
            skippedRecords: 0,
            errors: [],
            duration: 0,
            startedAt: new Date(),
            completedAt: new Date(),
          };
          break;
        default:
          throw new Error(`Módulo desconocido: ${module}`);
      }

      this.status.results.push(result);
      this.status.completedModules.push(module);

      if (result.success) {
        this.addLog(
          'INFO',
          module,
          `Migración completada: ${result.migratedRecords}/${result.totalRecords} registros`,
        );
      } else {
        this.addLog(
          'WARN',
          module,
          `Migración completada con errores: ${result.errors.length} errores`,
          result.errors,
        );
      }

      return result;
    } catch (error) {
      this.addLog(
        'ERROR',
        module,
        `Error en migración: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        error,
      );
      throw error;
    } finally {
      this.status.isRunning = false;
      this.status.currentModule = null;
      this.status.clientProgress = undefined;
      this.status.lastUpdatedAt = new Date();
    }
  }

  /**
   * Ejecuta la migración completa en orden de dependencias
   */
  async executeAll(
    options: MigrationOptions,
    excludeModules: MigrationModule[] = [],
  ): Promise<MigrationModuleResult[]> {
    if (this.status.isRunning) {
      throw new Error('Ya hay una migración en curso');
    }

    // Fases simplificadas: catálogos + pipeline unificado de clientes
    const phases: MigrationModule[] = [MigrationModule.CATALOGOS, MigrationModule.CLIENTES];
    const phasesToRun = phases.filter((m) => !excludeModules.includes(m));

    this.addLog('INFO', 'migration', `Iniciando migración completa de ${phasesToRun.length} fases (catálogos + pipeline unificado de clientes)`);

    // Resetear estado
    this.status = {
      isRunning: true,
      currentModule: null,
      completedModules: [],
      pendingModules: [...phasesToRun],
      totalProgress: 0,
      startedAt: new Date(),
      lastUpdatedAt: new Date(),
      results: [],
    };

    // Resetear mapeos
    this.mappings = this.createEmptyMappings();

    const results: MigrationModuleResult[] = [];

    try {
      for (let i = 0; i < phasesToRun.length; i++) {
        const module = phasesToRun[i];
        this.status.currentModule = module;
        this.status.pendingModules = phasesToRun.slice(i + 1);
        this.status.totalProgress = Math.round((i / phasesToRun.length) * 100);
        this.status.lastUpdatedAt = new Date();

        this.migrationGateway?.emitProgress(this.getStatus());

        this.addLog('INFO', 'migration', `Ejecutando fase ${i + 1}/${phasesToRun.length}: ${module}`);

        let result: MigrationModuleResult;

        switch (module) {
          case MigrationModule.CATALOGOS:
            result = await this.catalogosMigration.migrate(options, this.mappings);
            break;
          case MigrationModule.CLIENTES: {
            const bulkResult = await this.migrateAllClientesUnified(options);
            result = {
              module: 'clientes',
              success: bulkResult.errorCount === 0,
              totalRecords: bulkResult.totalClients,
              migratedRecords: bulkResult.successCount,
              skippedRecords: 0,
              errors: bulkResult.clientErrors.flatMap(ce => ce.errors),
              duration: bulkResult.duration,
              startedAt: this.status.startedAt || new Date(),
              completedAt: new Date(),
            };
            break;
          }
          default:
            throw new Error(`Módulo desconocido: ${module}`);
        }

        results.push(result);
        this.status.results.push(result);
        this.status.completedModules.push(module);

        if (result.success) {
          this.addLog(
            'INFO',
            module,
            `Fase completada: ${result.migratedRecords}/${result.totalRecords} registros en ${result.duration}ms`,
          );
        } else {
          this.addLog(
            'WARN',
            module,
            `Fase completada con ${result.errors.length} errores`,
          );

          if (!options.continueOnError && result.errors.length > 0) {
            throw new Error(`Errores en fase ${module}`);
          }
        }
      }

      this.status.totalProgress = 100;
      this.addLog('INFO', 'migration', 'Migración completa finalizada exitosamente');

      return results;
    } catch (error) {
      this.addLog(
        'ERROR',
        'migration',
        `Migración fallida: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      );
      throw error;
    } finally {
      this.status.isRunning = false;
      this.status.currentModule = null;
      this.status.clientProgress = undefined;
      this.status.lastUpdatedAt = new Date();
      this.migrationGateway?.emitProgress(this.getStatus());
    }
  }

  /**
   * Resetea el estado de la migración
   */
  resetStatus(): void {
    this.status = {
      isRunning: false,
      currentModule: null,
      completedModules: [],
      pendingModules: [],
      totalProgress: 0,
      startedAt: null,
      lastUpdatedAt: null,
      results: [],
    };
    this.mappings = this.createEmptyMappings();
    this.addLog('INFO', 'migration', 'Estado de migración reseteado');
  }

  /**
   * Obtiene estadísticas de mapeo
   */
  getMappingStats(): Record<string, number> {
    return {
      departamentos: this.mappings.departamentos.size,
      municipios: this.mappings.municipios.size,
      colonias: this.mappings.colonias.size,
      estadoCivil: this.mappings.estadoCivil.size,
      estadoVivienda: this.mappings.estadoVivienda.size,
      clientes: this.mappings.clientes.size,
      direcciones: this.mappings.direcciones.size,
      planes: this.mappings.planes.size,
      ciclosFacturacion: this.mappings.ciclosFacturacion.size,
      contratos: this.mappings.contratos.size,
      facturas: this.mappings.facturas.size,
      documentos: this.mappings.documentos.size,
    };
  }

  /**
   * Migración masiva unificada: itera todos los clientes y ejecuta el pipeline completo
   * (cliente → contratos → documentos → facturas) por cada uno usando migrateClienteById().
   */
  private async migrateAllClientesUnified(
    options: MigrationOptions,
  ): Promise<BulkClienteMigrationResult> {
    const startedAt = Date.now();

    // Asegurar catálogos cargados
    if (this.mappings.departamentos.size === 0) {
      this.addLog('INFO', 'clientes-unified', 'Cargando catálogos previo a migración masiva...');
      await this.catalogosMigration.migrate(
        { batchSize: 500, skipExisting: true, dryRun: false, continueOnError: true, maxRetries: 3 },
        this.mappings,
      );
    }

    // Obtener todos los IDs de clientes desde MySQL
    const rows = await this.mysql.query<(RowDataPacket & { id_customers: number })[]>(
      'SELECT id_customers FROM tbl_customers WHERE customers_status IN (0,1,2,4,9,12) ORDER BY id_customers',
    );
    const clientIds = rows.map(r => r.id_customers);

    const concurrency = options.concurrency ?? 5;
    const totalBatches = Math.ceil(clientIds.length / concurrency);

    this.addLog('INFO', 'clientes-unified',
      `Iniciando migración: ${clientIds.length} clientes en ${totalBatches} lotes (concurrency=${concurrency})`);

    let successCount = 0;
    let errorCount = 0;
    const clientErrors: Array<{ mysqlId: number; errors: MigrationError[] }> = [];
    let processed = 0;

    // Inicializar progreso
    this.status.clientProgress = {
      currentClientIndex: 0,
      totalClients: clientIds.length,
      currentMysqlId: null,
      successCount: 0,
      errorCount: 0,
    };

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = Date.now();
      const batch = clientIds.slice(batchIndex * concurrency, (batchIndex + 1) * concurrency);

      this.addLog('INFO', 'clientes-unified',
        `Procesando lote ${batchIndex + 1}/${totalBatches} (${batch.length} clientes)...`);

      // Procesar lote en paralelo
      const results = await Promise.allSettled(
        batch.map(mysqlId =>
          this.migrateClienteById(mysqlId, {
            includeContratos: true,
            includeDocumentos: options.includeDocumentos ?? false,
            includeFacturas: true,
            dryRun: options.dryRun,
          }),
        ),
      );

      // Procesar resultados del lote
      for (let j = 0; j < results.length; j++) {
        const mysqlId = batch[j];
        const settledResult = results[j];

        if (settledResult.status === 'fulfilled') {
          if (settledResult.value.errors.length > 0) {
            errorCount++;
            clientErrors.push({ mysqlId, errors: settledResult.value.errors });
          } else {
            successCount++;
          }
        } else {
          errorCount++;
          clientErrors.push({
            mysqlId,
            errors: [{
              table: 'tbl_customers',
              recordId: mysqlId,
              message: settledResult.reason instanceof Error
                ? settledResult.reason.message
                : 'Error desconocido',
            }],
          });
        }
      }

      processed += batch.length;

      // Log de progreso del lote
      const batchDuration = Date.now() - batchStart;
      const elapsed = Date.now() - startedAt;
      const avgPerBatch = elapsed / (batchIndex + 1);
      const remainingBatches = totalBatches - (batchIndex + 1);
      const estimatedRemaining = Math.round(avgPerBatch * remainingBatches / 1000);

      this.addLog('INFO', 'clientes-unified',
        `Lote ${batchIndex + 1}/${totalBatches} completado en ${batchDuration}ms ` +
        `(${successCount} ok, ${errorCount} errores). ` +
        `Tiempo restante estimado: ${estimatedRemaining}s`);

      // Actualizar progreso WebSocket
      this.status.clientProgress = {
        currentClientIndex: processed,
        totalClients: clientIds.length,
        currentMysqlId: null,
        successCount,
        errorCount,
      };
      this.status.lastUpdatedAt = new Date();
      this.migrationGateway?.emitProgress(this.getStatus());

      // Detener si continueOnError es false y hay errores
      if (!options.continueOnError && errorCount > 0) {
        this.addLog('ERROR', 'clientes-unified',
          `Deteniendo migración por errores en lote ${batchIndex + 1}`);
        break;
      }
    }

    // Limpiar progreso
    this.status.clientProgress = {
      currentClientIndex: clientIds.length,
      totalClients: clientIds.length,
      currentMysqlId: null,
      successCount,
      errorCount,
    };

    const duration = Date.now() - startedAt;
    this.addLog(
      errorCount > 0 ? 'WARN' : 'INFO',
      'clientes-unified',
      `Migración unificada completada: ${successCount} exitosos, ${errorCount} con errores, en ${duration}ms`,
    );

    return {
      totalClients: clientIds.length,
      successCount,
      errorCount,
      clientErrors,
      duration,
    };
  }

  /**
   * Limpia todos los datos dependientes de un cliente en PostgreSQL antes de re-migrar.
   * Respeta el orden de FK constraints (hijos primero).
   * NO elimina el registro base del cliente (será upserted por migrateCustomer).
   */
  private async cleanupClienteData(
    postgresClienteId: number,
  ): Promise<{ deleted: Record<string, number> }> {
    const deleted: Record<string, number> = {};

    await this.prisma.$transaction(async (tx) => {
      // 1. Recopilar IDs necesarios
      const contratos = await tx.atcContrato.findMany({
        where: { id_cliente: postgresClienteId },
        select: { id_contrato: true },
      });
      const contratoIds = contratos.map(c => c.id_contrato);

      const facturasDirectas = await tx.facturaDirecta.findMany({
        where: { id_cliente: postgresClienteId },
        select: { id_factura_directa: true },
      });
      const facturaDirectaIds = facturasDirectas.map(f => f.id_factura_directa);

      const dtes = await tx.dte_emitidos.findMany({
        where: { id_cliente: postgresClienteId },
        select: { id_dte: true },
      });
      const dteIds = dtes.map(d => d.id_dte);

      const cxcs = await tx.cuenta_por_cobrar.findMany({
        where: { id_cliente: postgresClienteId },
        select: { id_cxc: true },
      });
      const cxcIds = cxcs.map(c => c.id_cxc);

      const abonos = cxcIds.length > 0
        ? await tx.abono_cxc.findMany({
            where: { id_cxc: { in: cxcIds } },
            select: { id_abono: true },
          })
        : [];
      const abonoIds = abonos.map(a => a.id_abono);

      // 2. caja_movimiento (via abonos)
      if (abonoIds.length > 0) {
        const r = await tx.caja_movimiento.deleteMany({
          where: { id_abono_cxc: { in: abonoIds } },
        });
        deleted['caja_movimiento'] = r.count;
      }

      // 3. abono_cxc
      if (cxcIds.length > 0) {
        const r = await tx.abono_cxc.deleteMany({
          where: { id_cxc: { in: cxcIds } },
        });
        deleted['abono_cxc'] = r.count;
      }

      // 4. cuenta_por_cobrar
      {
        const r = await tx.cuenta_por_cobrar.deleteMany({
          where: { id_cliente: postgresClienteId },
        });
        deleted['cuenta_por_cobrar'] = r.count;
      }

      // 5. facturaDirectaDetalle
      if (facturaDirectaIds.length > 0) {
        const r = await tx.facturaDirectaDetalle.deleteMany({
          where: { id_factura_directa: { in: facturaDirectaIds } },
        });
        deleted['facturaDirectaDetalle'] = r.count;
      }

      // 6. facturaDirecta
      {
        const r = await tx.facturaDirecta.deleteMany({
          where: { id_cliente: postgresClienteId },
        });
        deleted['facturaDirecta'] = r.count;
      }

      // 7. dte_anulaciones
      if (dteIds.length > 0) {
        const r = await tx.dte_anulaciones.deleteMany({
          where: { id_dte: { in: dteIds } },
        });
        deleted['dte_anulaciones'] = r.count;
      }

      // 8. dte_emitidos_detalle
      if (dteIds.length > 0) {
        const r = await tx.dte_emitidos_detalle.deleteMany({
          where: { id_dte: { in: dteIds } },
        });
        deleted['dte_emitidos_detalle'] = r.count;
      }

      // 9. dte_emitidos
      {
        const r = await tx.dte_emitidos.deleteMany({
          where: { id_cliente: postgresClienteId },
        });
        deleted['dte_emitidos'] = r.count;
      }

      // 10. pago_tarjeta_portal
      {
        const r = await tx.pago_tarjeta_portal.deleteMany({
          where: { id_cliente: postgresClienteId },
        });
        deleted['pago_tarjeta_portal'] = r.count;
      }

      // 11. pago_tarjeta_intent
      {
        const r = await tx.pago_tarjeta_intent.deleteMany({
          where: { id_cliente: postgresClienteId },
        });
        deleted['pago_tarjeta_intent'] = r.count;
      }

      // 12. whatsapp_validacion_comprobante → SET id_contrato = null
      if (contratoIds.length > 0) {
        const r = await tx.whatsapp_validacion_comprobante.updateMany({
          where: { id_contrato: { in: contratoIds } },
          data: { id_contrato: null },
        });
        deleted['whatsapp_validacion_comprobante_nullified'] = r.count;
      }

      // 13. clienteDocumentos
      {
        const r = await tx.clienteDocumentos.deleteMany({
          where: { id_cliente: postgresClienteId },
        });
        deleted['clienteDocumentos'] = r.count;
      }

      // 14. atcContratoInstalacion
      if (contratoIds.length > 0) {
        const r = await tx.atcContratoInstalacion.deleteMany({
          where: { id_contrato: { in: contratoIds } },
        });
        deleted['atcContratoInstalacion'] = r.count;
      }

      // 15. orden_trabajo → SET id_contrato = null (id_contrato es nullable)
      if (contratoIds.length > 0) {
        const r = await tx.orden_trabajo.updateMany({
          where: { id_contrato: { in: contratoIds } },
          data: { id_contrato: null },
        });
        deleted['orden_trabajo_contrato_nullified'] = r.count;
      }

      // 16. atcContrato
      {
        const r = await tx.atcContrato.deleteMany({
          where: { id_cliente: postgresClienteId },
        });
        deleted['atcContrato'] = r.count;
      }

      // 17. clienteDatosFacturacion
      {
        const r = await tx.clienteDatosFacturacion.deleteMany({
          where: { id_cliente: postgresClienteId },
        });
        deleted['clienteDatosFacturacion'] = r.count;
      }

      // 18. clienteDirecciones — solo si no hay orden_trabajo/ticket_soporte referenciando estas direcciones
      const direcciones = await tx.clienteDirecciones.findMany({
        where: { id_cliente: postgresClienteId },
        select: { id_cliente_direccion: true },
      });
      const direccionIds = direcciones.map(d => d.id_cliente_direccion);

      if (direccionIds.length > 0) {
        const otCount = await tx.orden_trabajo.count({
          where: { id_direccion_servicio: { in: direccionIds } },
        });
        const ticketCount = await tx.ticket_soporte.count({
          where: { id_direccion_servicio: { in: direccionIds } },
        });

        if (otCount === 0 && ticketCount === 0) {
          const r = await tx.clienteDirecciones.deleteMany({
            where: { id_cliente: postgresClienteId },
          });
          deleted['clienteDirecciones'] = r.count;
        } else {
          this.addLog(
            'WARN',
            'cleanup',
            `No se eliminan direcciones del cliente ${postgresClienteId}: ${otCount} OTs y ${ticketCount} tickets las referencian`,
          );
        }
      }
    }, { timeout: 30000 });

    return { deleted };
  }

  /**
   * Migra un cliente específico por su ID de MySQL
   */
  async migrateClienteById(
    idCustomer: number,
    options: MigrateClienteOptionsDto,
  ): Promise<SingleClienteMigrationResult> {
    const startedAt = Date.now();
    const allErrors: MigrationError[] = [];

    // Pre-check: asegurar catálogos cargados
    if (this.mappings.departamentos.size === 0) {
      this.addLog('INFO', 'cliente-individual', 'Cargando catálogos previo a migración de cliente...');
      await this.catalogosMigration.migrate(
        { batchSize: 500, skipExisting: true, dryRun: false, continueOnError: true, maxRetries: 3 },
        this.mappings,
      );
    }

    this.addLog('INFO', 'cliente-individual', `Iniciando migración de cliente MySQL ID: ${idCustomer}`);

    // Opciones por defecto para la migración
    const migrationOptions: MigrationOptions = {
      batchSize: 1,
      skipExisting: true,
      dryRun: options.dryRun ?? false,
      continueOnError: true,
      maxRetries: 3,
    };

    // 0. Limpieza previa: si el cliente ya existe en PostgreSQL, eliminar datos dependientes
    if (!migrationOptions.dryRun) {
      try {
        const mysqlCustomer = await this.mysql.queryOne<RowDataPacket & { dui: string }>(
          'SELECT dui FROM tbl_customers WHERE id_customers = ?',
          [idCustomer],
        );
        const dui = normalizeDUI(mysqlCustomer?.dui) || `MIGRADO-${idCustomer}`;
        const existingCliente = await this.prisma.cliente.findUnique({
          where: { dui },
          select: { id_cliente: true },
        });

        if (existingCliente) {
          this.addLog('INFO', 'cliente-individual',
            `Cliente existente encontrado (DUI: ${dui}, ID: ${existingCliente.id_cliente}). Ejecutando limpieza previa...`);
          const { deleted } = await this.cleanupClienteData(existingCliente.id_cliente);
          const totalDeleted = Object.values(deleted).reduce((sum, n) => sum + n, 0);
          this.addLog('INFO', 'cliente-individual',
            `Limpieza completada: ${totalDeleted} registros eliminados`,
            deleted,
          );
        } else {
          this.addLog('INFO', 'cliente-individual', `Cliente nuevo (DUI: ${dui}), no requiere limpieza`);
        }
      } catch (error) {
        this.addLog('ERROR', 'cliente-individual',
          `Error en limpieza previa del cliente ${idCustomer}: ${error instanceof Error ? error.message : error}`,
          error,
        );
        allErrors.push({
          table: 'cleanup',
          recordId: idCustomer,
          message: `Error en limpieza previa: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        });
      }
    }

    // 1. Migrar cliente base (con direcciones y datos facturación)
    const clienteResult = await this.clientesMigration.migrateById(
      idCustomer,
      migrationOptions,
      this.mappings,
    );
    allErrors.push(...clienteResult.errors);

    const result: SingleClienteMigrationResult = {
      ...clienteResult,
      duration: 0,
    };

    // 2. Migrar contratos del cliente (opcional)
    if (options.includeContratos !== false) {
      const contratosResult = await this.migrateContratosForCliente(
        idCustomer,
        clienteResult.cliente.postgresId,
        migrationOptions,
      );
      result.contratos = contratosResult;
      allErrors.push(...(contratosResult.errors || []));

      // 2.5 Generar facturas pendientes para contratos activos migrados
      if (!migrationOptions.dryRun && contratosResult.ids.length > 0) {
        try {
          const facturasGen = await this.generateFacturasForMigratedContratos(
            contratosResult.ids,
            1,
            idCustomer,
          );
          this.addLog('INFO', 'cliente-individual',
            `Facturas generadas: ${facturasGen.generated} contratos procesados`);
          if (facturasGen.errors.length > 0) {
            allErrors.push(...facturasGen.errors);
          }
        } catch (error) {
          this.addLog('WARN', 'cliente-individual',
            `Error generando facturas: ${error instanceof Error ? error.message : error}`);
        }
      }

      // 3. Migrar documentos de los contratos (opcional, requiere contratos)
      if (options.includeDocumentos !== false && contratosResult.ids.length > 0) {
        const documentosResult = await this.migrateDocumentosForContratos(
          contratosResult.mysqlContractIds || [],
          clienteResult.cliente.postgresId,
          migrationOptions,
        );
        result.documentos = documentosResult;
      }
    }

    // 4. Migrar facturas del cliente (opcional)
    if (options.includeFacturas !== false) {
      const facturasResult = await this.migrateFacturasForCliente(
        idCustomer,
        clienteResult.cliente.postgresId,
        migrationOptions,
      );
      result.facturas = facturasResult;
    }

    result.errors = allErrors;
    result.duration = Date.now() - startedAt;

    this.addLog(
      allErrors.length > 0 ? 'WARN' : 'INFO',
      'cliente-individual',
      `Migración de cliente ${idCustomer} completada en ${result.duration}ms`,
    );

    return result;
  }

  /**
   * Migra contratos de un cliente específico
   */
  private async migrateContratosForCliente(
    mysqlCustomerId: number,
    postgresClienteId: number,
    options: MigrationOptions,
  ): Promise<{ total: number; migrated: number; ids: number[]; mysqlContractIds?: number[]; errors?: MigrationError[] }> {
    try {
      const result = await this.contratosMigration.migrateByClienteId(
        mysqlCustomerId,
        postgresClienteId,
        options,
        this.mappings,
      );
      return result;
    } catch (error) {
      this.logger.warn(`Error migrando contratos: ${error}`);
      return { total: 0, migrated: 0, ids: [], errors: [] };
    }
  }

  /**
   * Migra documentos de contratos específicos
   */
  private async migrateDocumentosForContratos(
    mysqlContractIds: number[],
    postgresClienteId: number,
    options: MigrationOptions,
  ): Promise<{ total: number; migrated: number }> {
    try {
      const result = await this.documentosMigration.migrateByContractIds(
        mysqlContractIds,
        postgresClienteId,
        options,
        this.mappings,
      );
      return result;
    } catch (error) {
      this.logger.warn(`Error migrando documentos: ${error}`);
      return { total: 0, migrated: 0 };
    }
  }

  /**
   * Genera facturas pendientes para contratos migrados con estado INSTALADO_ACTIVO.
   * Calcula cuántos meses han pasado desde fecha_inicio_contrato y genera solo cuotas futuras.
   */
  private async generateFacturasForMigratedContratos(
    contratoIds: number[],
    userId: number,
    mysqlCustomerId?: number,
  ): Promise<{ total: number; generated: number; errors: MigrationError[] }> {
    const errors: MigrationError[] = [];
    let generated = 0;

    for (const idContrato of contratoIds) {
      try {
        const contrato = await this.prisma.atcContrato.findUnique({
          where: { id_contrato: idContrato },
          select: {
            id_contrato: true,
            estado: true,
            fecha_inicio_contrato: true,
            meses_contrato: true,
            plan: { select: { meses_contrato: true } },
          },
        });

        if (!contrato || contrato.estado !== 'INSTALADO_ACTIVO') {
          continue;
        }

        const fechaInicio = contrato.fecha_inicio_contrato;
        const mesesContrato = contrato.meses_contrato || contrato.plan?.meses_contrato || 12;

        if (!fechaInicio) {
          this.logger.warn(`Contrato ${idContrato} sin fecha_inicio_contrato, saltando generación de facturas`);
          continue;
        }

        // Calendar-based month diff (accurate, no 30.44 approximation)
        const hoy = new Date();
        const mesesTranscurridos = (hoy.getFullYear() - fechaInicio.getFullYear()) * 12
          + hoy.getMonth() - fechaInicio.getMonth();
        const cuotaMesActual = mesesTranscurridos + 1;

        // Always check last MySQL bill to determine startCuota
        let startCuota: number;
        let endCuota: number;
        let moraAmount = 0;

        if (mysqlCustomerId) {
          const lastBill = await this.mysql.queryOne(
            `SELECT id_bill, periodo_start, periodo_end, bill_status, expiration_date FROM tbl_bill
             WHERE id_customers = ? ORDER BY periodo_end DESC LIMIT 1`,
            [mysqlCustomerId],
          );

          if (lastBill?.periodo_end) {
            // Get mora from last MySQL bill if exists
            if (lastBill.id_bill) {
              const moraDetail = await this.mysql.queryOne(
                `SELECT d.sub_total as mora_base,
                        COALESCE((SELECT SUM(t.sub_total) FROM tbl_bill_details_taxes t
                                  WHERE t.id_bill_details = d.id_details_bill), 0) as mora_iva
                 FROM tbl_bill_details d
                 WHERE d.id_bill = ? AND d.detail_type = 60003
                 LIMIT 1`,
                [lastBill.id_bill],
              );
              if (moraDetail) {
                moraAmount = Number(moraDetail.mora_base || 0) + Number(moraDetail.mora_iva || 0);
              }
            }

            // Determine if last bill is pending/expired
            this.logger.debug(
              `Contrato ${idContrato}: lastBill status=${lastBill.bill_status} (type=${typeof lastBill.bill_status}), expiration=${lastBill.expiration_date}`,
            );
            const isPending = Number(lastBill.bill_status) === 1;
            const isExpired = lastBill.expiration_date
              && new Date(lastBill.expiration_date) < new Date();

            let startMonth: Date;
            if (isPending || isExpired) {
              // Pending bill: regenerate from that bill's month
              startMonth = new Date(lastBill.periodo_start);
              startMonth.setDate(1);
            } else {
              // Paid bill: start from next month
              const lastPeriodEnd = new Date(lastBill.periodo_end);
              startMonth = new Date(lastPeriodEnd);
              startMonth.setDate(1);
              startMonth.setMonth(startMonth.getMonth() + 1);
            }

            // Calculate startCuota from startMonth relative to fechaInicio
            const startDiff = (startMonth.getFullYear() - fechaInicio.getFullYear()) * 12
              + startMonth.getMonth() - fechaInicio.getMonth();
            startCuota = Math.max(startDiff + 1, 1);

            // endCuota: generate all contract months (BORRADOR for future months)
            endCuota = mesesContrato;
          } else {
            // No bills found in MySQL: start from current month
            startCuota = cuotaMesActual;
            endCuota = mesesContrato;
          }
        } else {
          // No mysqlCustomerId: fallback to current month through end of contract
          startCuota = cuotaMesActual;
          endCuota = mesesContrato;
        }

        // For expired-but-active contracts (cuotaMesActual > mesesContrato),
        // extend endCuota to current month so we generate invoices beyond the contract duration
        if (cuotaMesActual > mesesContrato) {
          endCuota = Math.max(endCuota, cuotaMesActual);
        }

        // Validate range
        if (startCuota > endCuota) {
          this.logger.log(`Contrato ${idContrato}: no hay cuotas por generar (start=${startCuota}, end=${endCuota})`);
          continue;
        }

        this.logger.log(
          `Contrato ${idContrato}: generando cuotas ${startCuota}-${endCuota}` +
          (moraAmount > 0 ? ` (mora: $${moraAmount.toFixed(2)})` : ''),
        );

        await this.facturaDirectaService.generarFacturasContrato(
          idContrato, userId, undefined, undefined,
          startCuota,
          endCuota,
          moraAmount > 0 ? { cuota: startCuota, monto: moraAmount } : undefined,
        );

        generated++;
      } catch (error) {
        this.logger.warn(`Error generando facturas para contrato ${idContrato}: ${error instanceof Error ? error.message : error}`);
        errors.push({
          table: 'facturaDirecta',
          recordId: idContrato,
          message: error instanceof Error ? error.message : 'Error generando facturas',
        });
      }
    }

    return { total: contratoIds.length, generated, errors };
  }

  /**
   * Migra facturas de un cliente específico
   */
  private async migrateFacturasForCliente(
    mysqlCustomerId: number,
    postgresClienteId: number,
    options: MigrationOptions,
  ): Promise<{ total: number; migrated: number }> {
    try {
      const result = await this.facturacionMigration.migrateByClienteId(
        mysqlCustomerId,
        postgresClienteId,
        options,
        this.mappings,
      );
      return result;
    } catch (error) {
      this.logger.warn(`Error migrando facturas: ${error}`);
      return { total: 0, migrated: 0 };
    }
  }
}
