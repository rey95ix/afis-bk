import { Injectable, Logger } from '@nestjs/common';
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
    private readonly facturaDirectaService: FacturaDirectaService,
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

      // Generar facturas pendientes después de migrar contratos
      if (module === MigrationModule.CONTRATOS && !options.dryRun) {
        const contratosActivos = await this.prisma.atcContrato.findMany({
          where: { estado: 'INSTALADO_ACTIVO' },
          select: { id_contrato: true },
        });

        if (contratosActivos.length > 0) {
          const facturasResult = await this.generateFacturasForMigratedContratos(
            contratosActivos.map(c => c.id_contrato),
            1,
          );
          this.addLog('INFO', 'contratos',
            `Facturas pendientes generadas para ${facturasResult.generated} contratos`);
        }
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

        // Generar facturas pendientes después de migrar contratos
        if (module === MigrationModule.CONTRATOS && !options.dryRun) {
          const contratosActivos = await this.prisma.atcContrato.findMany({
            where: { estado: 'INSTALADO_ACTIVO' },
            select: { id_contrato: true },
          });

          if (contratosActivos.length > 0) {
            const facturasResult = await this.generateFacturasForMigratedContratos(
              contratosActivos.map(c => c.id_contrato),
              1,
            );
            this.addLog('INFO', 'contratos',
              `Facturas pendientes generadas para ${facturasResult.generated} contratos`);
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

        // Calcular meses transcurridos
        const hoy = new Date();
        const diffMs = hoy.getTime() - fechaInicio.getTime();
        const mesesTranscurridos = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44));
        const cuotaInicial = Math.min(mesesTranscurridos + 1, mesesContrato + 1);

        if (cuotaInicial > mesesContrato) {
          // Contrato vencido pero activo: generar 1 factura del siguiente mes
          if (mysqlCustomerId) {
            const lastBill = await this.mysql.queryOne(
              `SELECT id_bill, periodo_start, periodo_end, bill_status, expiration_date FROM tbl_bill
               WHERE id_customers = ? ORDER BY periodo_end DESC LIMIT 1`,
              [mysqlCustomerId],
            );

            if (lastBill?.periodo_end) {
              const lastPeriodEnd = new Date(lastBill.periodo_end);

              // Obtener mora de la última factura MySQL si existe
              let moraAmount = 0;
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

              // Determinar si la última factura está pendiente de pago
              const isPending = lastBill.bill_status === 2;
              const isExpired = lastBill.expiration_date
                && new Date(lastBill.expiration_date) < new Date();

              let startMonth: Date;
              if (isPending || isExpired) {
                // Factura pendiente: generar desde el mes de esa factura
                startMonth = new Date(lastBill.periodo_start);
                startMonth.setDate(1);
              } else {
                // Factura pagada: generar desde el mes siguiente
                startMonth = new Date(lastPeriodEnd);
                startMonth.setDate(1);
                startMonth.setMonth(startMonth.getMonth() + 1);
              }

              // Calcular mes siguiente al último periodo (siempre generar hasta aquí)
              const nextMonth = new Date(lastPeriodEnd);
              nextMonth.setDate(1);
              nextMonth.setMonth(nextMonth.getMonth() + 1);

              // Calcular cuotas correspondientes
              const startDiff = (startMonth.getFullYear() - fechaInicio.getFullYear()) * 12
                               + startMonth.getMonth() - fechaInicio.getMonth();
              const startCuota = startDiff + 1;

              const endDiff = (nextMonth.getFullYear() - fechaInicio.getFullYear()) * 12
                             + nextMonth.getMonth() - fechaInicio.getMonth();
              const endCuota = endDiff + 1;

              const cuotaCount = endCuota - startCuota + 1;
              this.logger.log(
                `Contrato ${idContrato}: vencido pero activo. Generando ${cuotaCount} factura(s) cuota ${startCuota}${startCuota !== endCuota ? `-${endCuota}` : ''} (última MySQL: ${isPending || isExpired ? 'pendiente' : 'pagada'}${moraAmount > 0 ? `, mora: $${moraAmount.toFixed(2)}` : ''})`,
              );
              await this.facturaDirectaService.generarFacturasContrato(
                idContrato, userId, undefined, undefined,
                startCuota,
                endCuota,
                moraAmount > 0 ? { cuota: startCuota, monto: moraAmount } : undefined,
              );
              generated++;
              continue;
            }
          }

          this.logger.log(`Contrato ${idContrato}: todas las cuotas ya vencieron (${mesesTranscurridos} meses de ${mesesContrato})`);
          continue;
        }

        this.logger.log(`Contrato ${idContrato}: generando cuotas desde ${cuotaInicial} hasta ${mesesContrato}`);

        await this.facturaDirectaService.generarFacturasContrato(
          idContrato,
          userId,
          undefined,
          undefined,
          cuotaInicial,
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
