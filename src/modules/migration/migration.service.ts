import { Injectable, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MysqlConnectionService } from './services/mysql-connection.service';
import { CatalogosMigrationService } from './services/catalogos.migration';
import { ClientesMigrationService } from './services/clientes.migration';
import { ContratosMigrationService } from './services/contratos.migration';
import { DocumentosMigrationService } from './services/documentos.migration';
import { FacturacionMigrationService } from './services/facturacion.migration';
import { OltMigrationService } from './services/olt.migration';
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
  IdCollisionCheckResult,
  CleanupAllResult,
} from './interfaces/mapping.interface';
import { MigrationModule, MigrateClienteOptionsDto } from './dto/migration-config.dto';
import { MigrationGateway } from './migration.gateway';
import { RowDataPacket } from 'mysql2/promise';
import { normalizeDUI, parseDate } from './utils/transformers';

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
  private oltCatalogsLoaded = false;

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
    private readonly oltMigration: OltMigrationService,
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
      oltEquipos: new Map(),
      oltMarcas: new Map(),
      oltModelos: new Map(),
      oltTarjetas: new Map(),
      oltTrafico: new Map(),
      oltRedes: new Map(),
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
          // Also migrate OLT catalogs
          {
            const oltCatResult = await this.oltMigration.migrateCatalogosOlt(options, this.mappings);
            this.oltCatalogsLoaded = true;
            result.totalRecords += oltCatResult.totalRecords;
            result.migratedRecords += oltCatResult.migratedRecords;
            result.skippedRecords += oltCatResult.skippedRecords;
            result.errors.push(...oltCatResult.errors);
            result.success = result.success && oltCatResult.success;
          }
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
            // Also migrate OLT catalogs right after base catalogs
            {
              const oltCatResult = await this.oltMigration.migrateCatalogosOlt(options, this.mappings);
              this.oltCatalogsLoaded = true;
              result.totalRecords += oltCatResult.totalRecords;
              result.migratedRecords += oltCatResult.migratedRecords;
              result.skippedRecords += oltCatResult.skippedRecords;
              result.errors.push(...oltCatResult.errors);
              result.success = result.success && oltCatResult.success;
            }
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
    this.oltCatalogsLoaded = false;
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
      oltEquipos: this.mappings.oltEquipos.size,
      oltMarcas: this.mappings.oltMarcas.size,
      oltModelos: this.mappings.oltModelos.size,
      oltTarjetas: this.mappings.oltTarjetas.size,
      oltTrafico: this.mappings.oltTrafico.size,
      oltRedes: this.mappings.oltRedes.size,
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
    if (!this.oltCatalogsLoaded) {
      this.addLog('INFO', 'clientes-unified', 'Cargando catálogos OLT previo a migración masiva...');
      await this.oltMigration.migrateCatalogosOlt(
        { batchSize: 500, skipExisting: true, dryRun: false, continueOnError: true, maxRetries: 3 },
        this.mappings,
      );
      this.oltCatalogsLoaded = true;
    }

    // Limpieza masiva si se solicitó
    if (options.cleanBeforeMigration && !options.dryRun) {
      this.addLog('INFO', 'clientes-unified', '⚠️ Ejecutando limpieza masiva de clientes antes de migración...');
      const cleanupResult = await this.cleanupAllClientes(options.concurrency ?? 5);
      this.addLog('INFO', 'clientes-unified',
        `Limpieza completada: ${cleanupResult.totalClientsDeleted} clientes eliminados, ` +
        `${Object.values(cleanupResult.totalRecordsDeleted).reduce((s, n) => s + n, 0)} registros totales`);
      if (cleanupResult.errors.length > 0) {
        this.addLog('WARN', 'clientes-unified',
          `${cleanupResult.errors.length} errores durante limpieza`);
      }
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

    // Resetear secuencia autoincrement para evitar colisiones con futuros inserts
    if (!options.dryRun) {
      try {
        const newSeqVal = await this.clientesMigration.resetClienteSequence();
        this.addLog('INFO', 'clientes-unified', `Secuencia id_cliente reseteada a ${newSeqVal}`);
      } catch (error) {
        this.addLog('WARN', 'clientes-unified',
          `Error reseteando secuencia id_cliente: ${error instanceof Error ? error.message : error}`);
      }
    }

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
   * Limpieza masiva: elimina todos los clientes y sus datos dependientes de PostgreSQL.
   * Procesa en lotes reutilizando cleanupClienteData() para respetar FK constraints.
   */
  async cleanupAllClientes(
    concurrency: number = 5,
  ): Promise<CleanupAllResult> {
    const startedAt = Date.now();
    const errors: MigrationError[] = [];
    const totalRecordsDeleted: Record<string, number> = {};
    let totalClientsDeleted = 0;

    // Obtener todos los IDs de clientes en PostgreSQL
    const clientes = await this.prisma.cliente.findMany({
      select: { id_cliente: true },
      orderBy: { id_cliente: 'asc' },
    });
    const clienteIds = clientes.map(c => c.id_cliente);

    this.addLog('INFO', 'cleanup-all',
      `Iniciando limpieza masiva: ${clienteIds.length} clientes a eliminar (concurrency=${concurrency})`);

    const totalBatches = Math.ceil(clienteIds.length / concurrency);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batch = clienteIds.slice(batchIndex * concurrency, (batchIndex + 1) * concurrency);

      const results = await Promise.allSettled(
        batch.map(id => this.cleanupClienteData(id, true)),
      );

      for (let j = 0; j < results.length; j++) {
        const clienteId = batch[j];
        const result = results[j];

        if (result.status === 'fulfilled') {
          totalClientsDeleted++;
          // Acumular conteos por tabla
          for (const [table, count] of Object.entries(result.value.deleted)) {
            totalRecordsDeleted[table] = (totalRecordsDeleted[table] || 0) + count;
          }
        } else {
          errors.push({
            table: 'cliente',
            recordId: clienteId,
            message: result.reason instanceof Error ? result.reason.message : String(result.reason),
          });
        }
      }

      const processed = Math.min((batchIndex + 1) * concurrency, clienteIds.length);
      this.addLog('INFO', 'cleanup-all',
        `Progreso limpieza: ${processed}/${clienteIds.length} (${totalClientsDeleted} eliminados, ${errors.length} errores)`);

      // Emitir progreso por WebSocket
      this.migrationGateway?.emitProgress(this.getStatus());
    }

    // Resetear secuencia autoincrement
    try {
      const newSeqVal = await this.clientesMigration.resetClienteSequence();
      this.addLog('INFO', 'cleanup-all', `Secuencia id_cliente reseteada a ${newSeqVal}`);
    } catch (error) {
      this.addLog('WARN', 'cleanup-all',
        `Error reseteando secuencia id_cliente: ${error instanceof Error ? error.message : error}`);
    }

    const duration = Date.now() - startedAt;
    this.addLog(
      errors.length > 0 ? 'WARN' : 'INFO',
      'cleanup-all',
      `Limpieza masiva completada: ${totalClientsDeleted}/${clienteIds.length} clientes eliminados en ${duration}ms`,
    );

    return {
      totalClientsProcessed: clienteIds.length,
      totalClientsDeleted,
      totalRecordsDeleted,
      errors,
      duration,
    };
  }

  /**
   * Limpia todos los datos dependientes de un cliente en PostgreSQL antes de re-migrar.
   * Respeta el orden de FK constraints (hijos primero).
   * Si deleteClientRecord=true, también elimina el registro base del cliente
   * (necesario cuando el id_cliente debe cambiar para preservar el ID de MySQL).
   */
  private async cleanupClienteData(
    postgresClienteId: number,
    deleteClientRecord: boolean = false,
  ): Promise<{ deleted: Record<string, number> }> {
    const deleted: Record<string, number> = {};

    await this.prisma.$transaction(async (tx) => {
      // 0. OLT data (no FK dependencies on other client tables)
      {
        const r = await tx.olt_cliente_telefono.deleteMany({
          where: { id_cliente: postgresClienteId },
        });
        deleted['olt_cliente_telefono'] = r.count;
      }
      {
        const r = await tx.olt_cliente_ip.deleteMany({
          where: { id_cliente: postgresClienteId },
        });
        deleted['olt_cliente_ip'] = r.count;
      }
      {
        const r = await tx.olt_cliente.deleteMany({
          where: { id_cliente: postgresClienteId },
        });
        deleted['olt_cliente'] = r.count;
      }

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

      // 18. Limpiar órdenes de trabajo del cliente y sus dependencias
      {
        const ots = await tx.orden_trabajo.findMany({
          where: { id_cliente: postgresClienteId },
          select: { id_orden: true },
        });
        const otIds = ots.map(o => o.id_orden);

        if (otIds.length > 0) {
          // Dependencias non-nullable → DELETE
          const r1 = await tx.ot_historial_estado.deleteMany({
            where: { id_orden: { in: otIds } },
          });
          deleted['ot_historial_estado'] = r1.count;

          const r2 = await tx.ot_actividades.deleteMany({
            where: { id_orden: { in: otIds } },
          });
          deleted['ot_actividades'] = r2.count;

          const r3 = await tx.ot_materiales.deleteMany({
            where: { id_orden: { in: otIds } },
          });
          deleted['ot_materiales'] = r3.count;

          const r4 = await tx.ot_evidencias.deleteMany({
            where: { id_orden: { in: otIds } },
          });
          deleted['ot_evidencias'] = r4.count;

          const r5 = await tx.agenda_visitas.deleteMany({
            where: { id_orden: { in: otIds } },
          });
          deleted['agenda_visitas'] = r5.count;

          const r6 = await tx.reservas_inventario.deleteMany({
            where: { id_orden_trabajo: { in: otIds } },
          });
          deleted['reservas_inventario'] = r6.count;

          // Dependencias nullable → NULLIFY
          await tx.inventario_series.updateMany({
            where: { id_orden_trabajo: { in: otIds } },
            data: { id_orden_trabajo: null },
          });
          await tx.movimientos_inventario.updateMany({
            where: { id_orden_trabajo: { in: otIds } },
            data: { id_orden_trabajo: null },
          });
          await tx.historial_series.updateMany({
            where: { id_orden_trabajo: { in: otIds } },
            data: { id_orden_trabajo: null },
          });
          await tx.sms_historial.updateMany({
            where: { id_orden_trabajo: { in: otIds } },
            data: { id_orden_trabajo: null },
          });

          // DELETE órdenes de trabajo
          const r7 = await tx.orden_trabajo.deleteMany({
            where: { id_cliente: postgresClienteId },
          });
          deleted['orden_trabajo'] = r7.count;
        }
      }

      // 19. Limpiar tickets de soporte del cliente y sus dependencias
      {
        const tickets = await tx.ticket_soporte.findMany({
          where: { id_cliente: postgresClienteId },
          select: { id_ticket: true },
        });
        const ticketIds = tickets.map(t => t.id_ticket);

        if (ticketIds.length > 0) {
          await tx.sms_historial.updateMany({
            where: { id_ticket: { in: ticketIds } },
            data: { id_ticket: null },
          });

          const r = await tx.ticket_soporte.deleteMany({
            where: { id_cliente: postgresClienteId },
          });
          deleted['ticket_soporte'] = r.count;
        }
      }

      // 20. clienteDirecciones
      {
        const r = await tx.clienteDirecciones.deleteMany({
          where: { id_cliente: postgresClienteId },
        });
        deleted['clienteDirecciones'] = r.count;
      }

      // 21. Eliminar registro base del cliente si se solicita (para cambio de ID)
      if (deleteClientRecord) {
        await tx.cliente.delete({ where: { id_cliente: postgresClienteId } });
        deleted['cliente'] = 1;
      }
    }, { timeout: 30000 });

    return { deleted };
  }

  /**
   * Pre-check de colisiones de IDs entre MySQL y PostgreSQL
   */
  async checkClienteIdCollisions(): Promise<IdCollisionCheckResult> {
    return this.clientesMigration.checkIdCollisions();
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
    if (!this.oltCatalogsLoaded) {
      this.addLog('INFO', 'cliente-individual', 'Cargando catálogos OLT previo a migración de cliente...');
      await this.oltMigration.migrateCatalogosOlt(
        { batchSize: 500, skipExisting: true, dryRun: false, continueOnError: true, maxRetries: 3 },
        this.mappings,
      );
      this.oltCatalogsLoaded = true;
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
          const needsIdChange = existingCliente.id_cliente !== idCustomer;
          this.addLog('INFO', 'cliente-individual',
            `Cliente existente encontrado (DUI: ${dui}, ID: ${existingCliente.id_cliente}` +
            `${needsIdChange ? `, necesita cambio a ID: ${idCustomer}` : ''}). Ejecutando limpieza previa...`);
          const { deleted } = await this.cleanupClienteData(existingCliente.id_cliente, needsIdChange);
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
        // Sin limpieza exitosa, la migración fallará por FK constraints o DUI unique
        return {
          cliente: { mysqlId: idCustomer, postgresId: 0, migrated: false, dui: '' },
          direcciones: { total: 0, migrated: 0 },
          datosFacturacion: { migrated: false },
          errors: allErrors,
          duration: Date.now() - startedAt,
        };
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

    // 4. Migrar datos OLT del cliente
    if (!migrationOptions.dryRun) {
      try {
        const oltResult = await this.oltMigration.migrateClienteOlt(
          idCustomer,
          clienteResult.cliente.postgresId,
          this.mappings,
        );
        result.olt = {
          asignaciones: oltResult.asignaciones,
          ips: oltResult.ips,
          telefonos: oltResult.telefonos,
        };
        allErrors.push(...oltResult.errors);
      } catch (error) {
        this.logger.warn(`Error migrando OLT: ${error}`);
        allErrors.push({
          table: 'olt',
          recordId: idCustomer,
          message: `Error migrando OLT: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        });
      }
    }

    // 5. Migrar facturas del cliente (opcional)
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

        const ESTADOS_FACTURABLES = ['INSTALADO_ACTIVO', 'SUSPENDIDO', 'VELOCIDAD_REDUCIDA', 'EN_MORA', 'SUSPENDIDO_TEMPORAL'];
        if (!contrato || !ESTADOS_FACTURABLES.includes(contrato.estado)) {
          continue;
        }

        let fechaInicio = contrato.fecha_inicio_contrato;
        const mesesContrato = contrato.meses_contrato || contrato.plan?.meses_contrato || 12;

        // Safety net: derive fecha_inicio_contrato from earliest MySQL bill if still null
        if (!fechaInicio && mysqlCustomerId) {
          const earliestBill = await this.mysql.queryOne(
            'SELECT MIN(periodo_start) as earliest FROM tbl_bill WHERE id_customers = ? AND periodo_start IS NOT NULL',
            [mysqlCustomerId],
          );
          if (earliestBill?.earliest) {
            const derivedDate = parseDate(earliestBill.earliest);
            if (derivedDate) {
              fechaInicio = derivedDate;
              await this.prisma.atcContrato.update({
                where: { id_contrato: idContrato },
                data: { fecha_inicio_contrato: fechaInicio },
              });
              this.logger.warn(
                `Contrato ${idContrato}: fecha_inicio_contrato derivada de earliest bill: ${fechaInicio.toISOString()}`,
              );
            }
          }
        }

        if (!fechaInicio) {
          this.logger.warn(`Contrato ${idContrato} sin fecha_inicio_contrato y sin bills de referencia, saltando`);
          continue;
        }

        // Buscar última factura pagada en MySQL para determinar punto de partida
        if (!mysqlCustomerId) {
          this.logger.warn(`Contrato ${idContrato}: sin mysqlCustomerId, saltando generación`);
          continue;
        }

        const lastPaidBill = await this.mysql.queryOne<RowDataPacket>(
          `SELECT expiration_date FROM tbl_bill
           WHERE id_customers = ? AND bill_status NOT IN (1, 3) AND expiration_date IS NOT NULL
           ORDER BY periodo_end DESC LIMIT 1`,
          [mysqlCustomerId],
        );

        if (!lastPaidBill?.expiration_date) {
          this.logger.warn(`Contrato ${idContrato}: sin facturas pagadas en MySQL, saltando`);
          continue;
        }

        const lastPaidExpDate = parseDate(lastPaidBill.expiration_date);
        if (!lastPaidExpDate) {
          this.logger.warn(`Contrato ${idContrato}: expiration_date no parseable, saltando`);
          continue;
        }

        const diaVencimiento = lastPaidExpDate.getUTCDate();

        // Calcular meses pendientes entre última pagada y hoy
        const hoy = new Date();
        let mesesPendientes = (hoy.getFullYear() - lastPaidExpDate.getFullYear()) * 12
          + hoy.getMonth() - lastPaidExpDate.getMonth();

        // Si mismo mes o ya pasó, al menos 1 factura para el siguiente mes
        if (mesesPendientes <= 0) mesesPendientes = 1;

        // Calcular cuotas relativas a fechaInicio del contrato
        const firstPendingMonth = new Date(lastPaidExpDate);
        firstPendingMonth.setMonth(firstPendingMonth.getMonth() + 1);

        const startCuota = Math.max(
          (firstPendingMonth.getFullYear() - fechaInicio.getFullYear()) * 12
            + firstPendingMonth.getMonth() - fechaInicio.getMonth() + 1,
          1,
        );
        const endCuota = startCuota + mesesPendientes - 1;

        this.logger.log(
          `Contrato ${idContrato}: última pagada=${lastPaidExpDate.toISOString()}, ` +
          `día vencimiento=${diaVencimiento}, cuotas ${startCuota}-${endCuota} (${mesesPendientes} pendientes)`,
        );

        await this.facturaDirectaService.generarFacturasContrato(
          idContrato, userId, undefined, undefined,
          startCuota,
          endCuota,
          undefined, // sin mora legacy
          true, // skipEstadoCheck
          diaVencimiento,
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
