import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MysqlConnectionService } from './services/mysql-connection.service';
import { CatalogosMigrationService } from './services/catalogos.migration';
import { ClientesMigrationService } from './services/clientes.migration';
import { ContratosMigrationService } from './services/contratos.migration';
import { DocumentosMigrationService } from './services/documentos.migration';
import { FacturacionMigrationService } from './services/facturacion.migration';
import {
  TableMappings,
  MigrationStatus,
  MigrationModuleResult,
  ConnectionValidation,
  MigrationOptions,
  MigrationLog,
  SingleClienteMigrationResult,
  MigrationError,
} from './interfaces/mapping.interface';
import { MigrationModule, MigrateClienteOptionsDto } from './dto/migration-config.dto';

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
  ) {}

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
        case MigrationModule.CLIENTES:
          result = await this.clientesMigration.migrate(options, this.mappings);
          break;
        case MigrationModule.CONTRATOS:
          result = await this.contratosMigration.migrate(options, this.mappings);
          break;
        case MigrationModule.DOCUMENTOS:
          result = await this.documentosMigration.migrate(options, this.mappings);
          break;
        case MigrationModule.FACTURACION:
          result = await this.facturacionMigration.migrate(options, this.mappings);
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

    // Orden de módulos según dependencias
    const moduleOrder: MigrationModule[] = [
      MigrationModule.CATALOGOS,
      MigrationModule.CLIENTES,
      MigrationModule.CONTRATOS,
      MigrationModule.DOCUMENTOS,
      MigrationModule.FACTURACION,
    ];

    // Filtrar módulos excluidos
    const modulesToRun = moduleOrder.filter(
      (m) => !excludeModules.includes(m),
    );

    this.addLog('INFO', 'migration', `Iniciando migración completa de ${modulesToRun.length} módulos`);

    // Resetear estado
    this.status = {
      isRunning: true,
      currentModule: null,
      completedModules: [],
      pendingModules: [...modulesToRun],
      totalProgress: 0,
      startedAt: new Date(),
      lastUpdatedAt: new Date(),
      results: [],
    };

    // Resetear mapeos
    this.mappings = this.createEmptyMappings();

    const results: MigrationModuleResult[] = [];

    try {
      for (let i = 0; i < modulesToRun.length; i++) {
        const module = modulesToRun[i];
        this.status.currentModule = module;
        this.status.pendingModules = modulesToRun.slice(i + 1);
        this.status.totalProgress = Math.round((i / modulesToRun.length) * 100);
        this.status.lastUpdatedAt = new Date();

        this.addLog('INFO', 'migration', `Ejecutando módulo ${i + 1}/${modulesToRun.length}: ${module}`);

        // Ejecutar módulo (sin actualizar el estado general ya que lo manejamos aquí)
        let result: MigrationModuleResult;

        switch (module) {
          case MigrationModule.CATALOGOS:
            result = await this.catalogosMigration.migrate(options, this.mappings);
            break;
          case MigrationModule.CLIENTES:
            result = await this.clientesMigration.migrate(options, this.mappings);
            break;
          case MigrationModule.CONTRATOS:
            result = await this.contratosMigration.migrate(options, this.mappings);
            break;
          case MigrationModule.DOCUMENTOS:
            result = await this.documentosMigration.migrate(options, this.mappings);
            break;
          case MigrationModule.FACTURACION:
            result = await this.facturacionMigration.migrate(options, this.mappings);
            break;
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
            `Módulo completado: ${result.migratedRecords}/${result.totalRecords} registros en ${result.duration}ms`,
          );
        } else {
          this.addLog(
            'WARN',
            module,
            `Módulo completado con ${result.errors.length} errores`,
          );

          // Si no continuar en error, detener
          if (!options.continueOnError && result.errors.length > 0) {
            throw new Error(`Errores en módulo ${module}`);
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
      this.status.lastUpdatedAt = new Date();
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
   * Migra un cliente específico por su ID de MySQL
   */
  async migrateClienteById(
    idCustomer: number,
    options: MigrateClienteOptionsDto,
  ): Promise<SingleClienteMigrationResult> {
    const startedAt = Date.now();
    const allErrors: MigrationError[] = [];

    this.addLog('INFO', 'cliente-individual', `Iniciando migración de cliente MySQL ID: ${idCustomer}`);

    // Opciones por defecto para la migración
    const migrationOptions: MigrationOptions = {
      batchSize: 1,
      skipExisting: true,
      dryRun: options.dryRun ?? false,
      continueOnError: true,
      maxRetries: 3,
    };

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
