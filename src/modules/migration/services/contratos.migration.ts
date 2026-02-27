import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MysqlConnectionService } from './mysql-connection.service';
import { RowDataPacket } from 'mysql2/promise';
import {
  MysqlContract,
  MysqlPlan,
  MysqlCustomerService,
} from '../interfaces/mysql-tables.interface';
import {
  TableMappings,
  MigrationModuleResult,
  MigrationError,
  MigrationOptions,
} from '../interfaces/mapping.interface';
import {
  cleanString,
  cleanStringOrNull,
  mapEstadoContrato,
  generateContractCode,
  toDecimal,
  parseDate,
} from '../utils/transformers';

@Injectable()
export class ContratosMigrationService {
  private readonly logger = new Logger(ContratosMigrationService.name);
  private readonly DEFAULT_PLAN_ID = 1;
  private readonly DEFAULT_CICLO_ID = 1;
  private readonly DEFAULT_USER_ID = 1; // Usuario administrador por defecto

  constructor(
    private readonly mysql: MysqlConnectionService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Ejecuta la migración completa de contratos
   */
  async migrate(
    options: MigrationOptions,
    mappings: TableMappings,
  ): Promise<MigrationModuleResult> {
    const startedAt = new Date();
    const errors: MigrationError[] = [];
    let totalRecords = 0;
    let migratedRecords = 0;
    let skippedRecords = 0;

    try {
      this.logger.log('Iniciando migración de contratos...');

      // 1. Migrar planes
      const planesResult = await this.migratePlanes(options, mappings);
      totalRecords += planesResult.total;
      migratedRecords += planesResult.migrated;
      skippedRecords += planesResult.skipped;
      errors.push(...planesResult.errors);

      // 2. Crear ciclos de facturación por defecto
      await this.ensureCiclosFacturacion(options, mappings);

      // 3. Migrar contratos
      const contratosResult = await this.migrateContratos(options, mappings);
      totalRecords += contratosResult.total;
      migratedRecords += contratosResult.migrated;
      skippedRecords += contratosResult.skipped;
      errors.push(...contratosResult.errors);

      const completedAt = new Date();

      return {
        module: 'contratos',
        success: errors.length === 0,
        totalRecords,
        migratedRecords,
        skippedRecords,
        errors,
        duration: completedAt.getTime() - startedAt.getTime(),
        startedAt,
        completedAt,
      };
    } catch (error) {
      this.logger.error('Error en migración de contratos', error);
      const completedAt = new Date();

      return {
        module: 'contratos',
        success: false,
        totalRecords,
        migratedRecords,
        skippedRecords,
        errors: [
          ...errors,
          {
            table: 'contratos',
            recordId: 0,
            message: error instanceof Error ? error.message : 'Error desconocido',
          },
        ],
        duration: completedAt.getTime() - startedAt.getTime(),
        startedAt,
        completedAt,
      };
    }
  }

  /**
   * Migra planes de servicio
   */
  private async migratePlanes(
    options: MigrationOptions,
    mappings: TableMappings,
  ): Promise<{ total: number; migrated: number; skipped: number; errors: MigrationError[] }> {
    this.logger.log('Migrando planes...');
    const errors: MigrationError[] = [];
    let migrated = 0;
    let skipped = 0;

    // Asegurar que existe al menos un tipo de plan
    let tipoPlanId = 1;
    try {
      const tipoPlan = await this.prisma.atcTipoPlan.findFirst();
      if (!tipoPlan) {
        // Primero asegurar que existe un tipo de servicio
        let tipoServicioId = 1;
        const tipoServicio = await this.prisma.atcTipoServicio.findFirst();
        if (!tipoServicio) {
          const newTipoServicio = await this.prisma.atcTipoServicio.create({
            data: {
              nombre: 'Internet',
              codigo: 'INT',
            },
          });
          tipoServicioId = newTipoServicio.id_tipo_servicio;
        } else {
          tipoServicioId = tipoServicio.id_tipo_servicio;
        }

        const newTipoPlan = await this.prisma.atcTipoPlan.create({
          data: {
            nombre: 'Internet Fibra Óptica',
            codigo: 'FTTH',
            id_tipo_servicio: tipoServicioId,
          },
        });
        tipoPlanId = newTipoPlan.id_tipo_plan;
      } else {
        tipoPlanId = tipoPlan.id_tipo_plan;
      }
    } catch (e) {
      this.logger.warn('Error obteniendo tipo de plan, usando ID 1');
    }

    const planes = await this.mysql.query<(MysqlPlan & RowDataPacket)[]>(
      'SELECT * FROM tbl_customers_plan ORDER BY id_customers_plan',
    );

    for (const plan of planes) {
      try {
        if (options.dryRun) {
          this.logger.debug(`[DRY RUN] Migraría plan: ${plan.name}`);
          migrated++;
          continue;
        }

        // Consultar tasa de impuesto real desde MySQL y calcular precio CON IVA
        const impuesto = await this.getTaxRateForPlan(plan.id_customers_plan);
        const precioConIva = toDecimal(plan.pay * (1 + impuesto));

        const result = await this.prisma.atcPlan.upsert({
          where: { id_plan: plan.id_customers_plan },
          update: {
            nombre: cleanString(plan.name) || 'Plan sin nombre',
            descripcion: cleanStringOrNull(plan.description),
            precio: precioConIva,
            meses_contrato: plan.month_contract || 12,
          },
          create: {
            id_plan: plan.id_customers_plan,
            nombre: cleanString(plan.name) || 'Plan sin nombre',
            descripcion: cleanStringOrNull(plan.description),
            precio: precioConIva,
            id_tipo_plan: tipoPlanId,
            meses_contrato: plan.month_contract || 12,
          },
        });

        mappings.planes.set(plan.id_customers_plan, result.id_plan);
        migrated++;
      } catch (error) {
        if (options.continueOnError) {
          errors.push({
            table: 'atcPlan',
            recordId: plan.id_customers_plan,
            message: error instanceof Error ? error.message : 'Error',
          });
          skipped++;
        } else {
          throw error;
        }
      }
    }

    this.logger.log(`Planes migrados: ${migrated}, omitidos: ${skipped}`);
    return { total: planes.length, migrated, skipped, errors };
  }

  /**
   * Asegura que existen ciclos de facturación
   */
  private async ensureCiclosFacturacion(
    options: MigrationOptions,
    mappings: TableMappings,
  ): Promise<void> {
    this.logger.log('Verificando ciclos de facturación...');

    if (options.dryRun) {
      this.logger.debug('[DRY RUN] Verificaría ciclos de facturación');
      return;
    }

    // Verificar si existen ciclos
    const existingCiclos = await this.prisma.atcCicloFacturacion.findMany();

    if (existingCiclos.length === 0) {
      // Crear ciclos por defecto (4 ciclos típicos)
      const ciclos = [
        { nombre: 'Ciclo 1 - día 1', dia_corte: 1, dia_vencimiento: 15, periodo_inicio: 1, periodo_fin: 30 },
        { nombre: 'Ciclo 2 - día 8', dia_corte: 8, dia_vencimiento: 22, periodo_inicio: 8, periodo_fin: 7 },
        { nombre: 'Ciclo 3 - día 15', dia_corte: 15, dia_vencimiento: 29, periodo_inicio: 15, periodo_fin: 14 },
        { nombre: 'Ciclo 4 - día 22', dia_corte: 22, dia_vencimiento: 6, periodo_inicio: 22, periodo_fin: 21 },
      ];

      for (const ciclo of ciclos) {
        const created = await this.prisma.atcCicloFacturacion.create({ data: ciclo });
        this.logger.log(`Ciclo creado: ${ciclo.nombre}`);

        // Mapear el primer ciclo como default
        if (!mappings.ciclosFacturacion.has(1)) {
          mappings.ciclosFacturacion.set(1, created.id_ciclo);
        }
      }
    } else {
      // Mapear ciclos existentes
      for (const ciclo of existingCiclos) {
        mappings.ciclosFacturacion.set(ciclo.id_ciclo, ciclo.id_ciclo);
      }
    }
  }

  /**
   * Migra contratos
   */
  private async migrateContratos(
    options: MigrationOptions,
    mappings: TableMappings,
  ): Promise<{ total: number; migrated: number; skipped: number; errors: MigrationError[] }> {
    this.logger.log('Migrando contratos...');
    const errors: MigrationError[] = [];
    let migrated = 0;
    let skipped = 0;

    const totalContratos = await this.mysql.getCount('tbl_customers_contract');
    this.logger.log(`Total de contratos a migrar: ${totalContratos}`);

    const batchSize = options.batchSize;
    let offset = 0;
    let sequence = 1;

    while (offset < totalContratos) {
      const contracts = await this.mysql.queryPaginated<(MysqlContract & RowDataPacket)[]>(
        'SELECT * FROM tbl_customers_contract ORDER BY id_customers_contract',
        offset,
        batchSize,
      );

      for (const contract of contracts) {
        try {
          const idCliente = mappings.clientes.get(contract.id_customers);
          if (!idCliente) {
            this.logger.warn(`Cliente no encontrado para contrato: ${contract.id_customers}`);
            skipped++;
            continue;
          }

          // Obtener servicio asociado para obtener plan y ciclo
          const service = await this.mysql.queryOne<MysqlCustomerService & RowDataPacket>(
            'SELECT * FROM tbl_customers_service WHERE id_customers = ? LIMIT 1',
            [contract.id_customers],
          );

          // Buscar dirección del cliente (solo si NO es dryRun)
          let idDireccion = 1;
          if (!options.dryRun) {
            const direccion = await this.prisma.clienteDirecciones.findFirst({
              where: { id_cliente: idCliente },
            });
            if (direccion) {
              idDireccion = direccion.id_cliente_direccion;
            } else {
              // Crear una dirección por defecto
              const newDir = await this.prisma.clienteDirecciones.create({
                data: {
                  id_cliente: idCliente,
                  direccion: 'Dirección migrada - pendiente actualizar',
                  id_municipio: 1,
                  id_departamento: 1,
                },
              });
              idDireccion = newDir.id_cliente_direccion;
            }
          }

          // Obtener plan
          const idPlan = service?.id_customers_plan
            ? (mappings.planes.get(service.id_customers_plan) || this.DEFAULT_PLAN_ID)
            : this.DEFAULT_PLAN_ID;

          // Obtener ciclo
          const idCiclo = service?.id_customers_cycle
            ? (mappings.ciclosFacturacion.get(service.id_customers_cycle) || this.DEFAULT_CICLO_ID)
            : this.DEFAULT_CICLO_ID;

          // Generar código único
          const codigo = contract.number_contract || generateContractCode(sequence++);

          if (options.dryRun) {
            this.logger.debug(`[DRY RUN] Migraría contrato: ${codigo}`);
            migrated++;
            continue;
          }

          // Verificar si el código ya existe
          const existingContract = await this.prisma.atcContrato.findUnique({
            where: { codigo },
          });

          if (existingContract) {
            // Usar el código modificado
            const newCodigo = `${codigo}-MIG${contract.id_customers_contract}`;

            const result = await this.prisma.atcContrato.create({
              data: {
                codigo: newCodigo,
                id_cliente: idCliente,
                id_plan: idPlan,
                id_ciclo: idCiclo,
                id_direccion_servicio: idDireccion,
                id_usuario_creador: this.DEFAULT_USER_ID,
                fecha_venta: service?.date_sale ? parseDate(service.date_sale) ?? new Date() : new Date(),
                fecha_instalacion: service?.date_installation ? parseDate(service.date_installation) ?? undefined : undefined,
                fecha_inicio_contrato: service?.date_contract_start ? parseDate(service.date_contract_start) ?? undefined : undefined,
                fecha_fin_contrato: service?.date_contract_end ? parseDate(service.date_contract_end) ?? undefined : undefined,
                meses_contrato: service?.contract_month || 12,
                estado: mapEstadoContrato(contract.status_contract) as any,
              },
            });

            mappings.contratos.set(contract.id_customers_contract, result.id_contrato);
          } else {
            const result = await this.prisma.atcContrato.create({
              data: {
                codigo,
                id_cliente: idCliente,
                id_plan: idPlan,
                id_ciclo: idCiclo,
                id_direccion_servicio: idDireccion,
                id_usuario_creador: this.DEFAULT_USER_ID,
                fecha_venta: service?.date_sale ? parseDate(service.date_sale) ?? new Date() : new Date(),
                fecha_instalacion: service?.date_installation ? parseDate(service.date_installation) ?? undefined : undefined,
                fecha_inicio_contrato: service?.date_contract_start ? parseDate(service.date_contract_start) ?? undefined : undefined,
                fecha_fin_contrato: service?.date_contract_end ? parseDate(service.date_contract_end) ?? undefined : undefined,
                meses_contrato: service?.contract_month || 12,
                estado: mapEstadoContrato(contract.status_contract) as any,
              },
            });

            mappings.contratos.set(contract.id_customers_contract, result.id_contrato);
          }

          migrated++;
        } catch (error) {
          if (options.continueOnError) {
            errors.push({
              table: 'atcContrato',
              recordId: contract.id_customers_contract,
              message: error instanceof Error ? error.message : 'Error',
            });
            skipped++;
          } else {
            throw error;
          }
        }
      }

      offset += batchSize;
    }

    this.logger.log(`Contratos migrados: ${migrated}, omitidos: ${skipped}`);
    return { total: totalContratos, migrated, skipped, errors };
  }

  /**
   * Migra contratos de un cliente específico
   */
  async migrateByClienteId(
    mysqlCustomerId: number,
    postgresClienteId: number,
    options: MigrationOptions,
    mappings: TableMappings,
  ): Promise<{ total: number; migrated: number; ids: number[]; mysqlContractIds: number[]; errors: MigrationError[] }> {
    const errors: MigrationError[] = [];
    const migratedIds: number[] = [];
    const mysqlContractIds: number[] = [];
    let migrated = 0;

    this.logger.log(`Migrando contratos del cliente MySQL ${mysqlCustomerId}...`);

    // Asegurar ciclos de facturación
    await this.ensureCiclosFacturacion(options, mappings);

    // Obtener contratos del cliente
    const contracts = await this.mysql.query<(MysqlContract & RowDataPacket)[]>(
      'SELECT * FROM tbl_customers_contract WHERE id_customers = ? ORDER BY id_customers_contract',
      [mysqlCustomerId],
    );

    let sequence = Date.now();

    for (const contract of contracts) {
      try {
        mysqlContractIds.push(contract.id_customers_contract);

        // Obtener servicio asociado para obtener plan y ciclo
        const service = await this.mysql.queryOne<MysqlCustomerService & RowDataPacket>(
          'SELECT * FROM tbl_customers_service WHERE id_customers = ? LIMIT 1',
          [contract.id_customers],
        );

        // Si el plan no está mapeado, migrarlo primero
        if (service?.id_customers_plan && !mappings.planes.has(service.id_customers_plan)) {
          const plan = await this.mysql.queryOne<MysqlPlan & RowDataPacket>(
            'SELECT * FROM tbl_customers_plan WHERE id_customers_plan = ?',
            [service.id_customers_plan],
          );
          if (plan) {
            await this.migrateSinglePlan(plan, options, mappings);
          }
        }

        // Buscar dirección del cliente (solo si NO es dryRun)
        let idDireccion: number | null = 1;
        if (!options.dryRun) {
          const direccion = await this.prisma.clienteDirecciones.findFirst({
            where: { id_cliente: postgresClienteId },
          });
          if (direccion) {
            idDireccion = direccion.id_cliente_direccion;
          } else {
            // Crear una dirección por defecto
            const newDir = await this.prisma.clienteDirecciones.create({
              data: {
                id_cliente: postgresClienteId,
                direccion: 'Dirección migrada - pendiente actualizar',
                id_municipio: 1,
                id_departamento: 1,
              },
            });
            idDireccion = newDir.id_cliente_direccion;
          }
        }

        // Obtener plan
        const idPlan = service?.id_customers_plan
          ? (mappings.planes.get(service.id_customers_plan) || this.DEFAULT_PLAN_ID)
          : this.DEFAULT_PLAN_ID;

        // Obtener ciclo
        const idCiclo = service?.id_customers_cycle
          ? (mappings.ciclosFacturacion.get(service.id_customers_cycle) || this.DEFAULT_CICLO_ID)
          : this.DEFAULT_CICLO_ID;

        // Generar código único
        const codigo = contract.number_contract || generateContractCode(sequence++);

        if (options.dryRun) {
          this.logger.debug(`[DRY RUN] Migraría contrato: ${codigo}`);
          migrated++;
          migratedIds.push(contract.id_customers_contract);
          continue;
        }

        // Verificar si el código ya existe
        const existingContract = await this.prisma.atcContrato.findUnique({
          where: { codigo },
        });

        let finalCodigo = codigo;
        if (existingContract) {
          finalCodigo = `${codigo}-MIG${contract.id_customers_contract}`;
        }

        const result = await this.prisma.atcContrato.create({
          data: {
            codigo: finalCodigo,
            id_cliente: postgresClienteId,
            id_plan: idPlan,
            id_ciclo: idCiclo,
            id_direccion_servicio: idDireccion,
            id_usuario_creador: this.DEFAULT_USER_ID,
            fecha_venta: service?.date_sale ? parseDate(service.date_sale) ?? new Date() : new Date(),
            fecha_instalacion: service?.date_installation ? parseDate(service.date_installation) ?? undefined : undefined,
            fecha_inicio_contrato: service?.date_contract_start ? parseDate(service.date_contract_start) ?? undefined : undefined,
            fecha_fin_contrato: service?.date_contract_end ? parseDate(service.date_contract_end) ?? undefined : undefined,
            meses_contrato: service?.contract_month || 12,
            estado: mapEstadoContrato(contract.status_contract) as any,
          },
        });

        mappings.contratos.set(contract.id_customers_contract, result.id_contrato);
        migratedIds.push(result.id_contrato);
        migrated++;
      } catch (error) {
        errors.push({
          table: 'atcContrato',
          recordId: contract.id_customers_contract,
          message: error instanceof Error ? error.message : 'Error',
        });
      }
    }

    this.logger.log(`Contratos migrados para cliente ${mysqlCustomerId}: ${migrated}/${contracts.length}`);
    return { total: contracts.length, migrated, ids: migratedIds, mysqlContractIds, errors };
  }

  /**
   * Migra un plan individual
   */
  private async migrateSinglePlan(
    plan: MysqlPlan,
    options: MigrationOptions,
    mappings: TableMappings,
  ): Promise<void> {
    if (mappings.planes.has(plan.id_customers_plan)) {
      return;
    }

    // Obtener tipo de plan
    let tipoPlanId = 1;
    try {
      const tipoPlan = await this.prisma.atcTipoPlan.findFirst();
      if (tipoPlan) {
        tipoPlanId = tipoPlan.id_tipo_plan;
      }
    } catch (e) {
      // Usar default
    }

    if (options.dryRun) {
      return;
    }

    // Consultar tasa de impuesto real desde MySQL y calcular precio CON IVA
    const impuesto = await this.getTaxRateForPlan(plan.id_customers_plan);
    const precioConIva = toDecimal(plan.pay * (1 + impuesto));

    const result = await this.prisma.atcPlan.upsert({
      where: { id_plan: plan.id_customers_plan },
      update: {
        nombre: cleanString(plan.name) || 'Plan sin nombre',
        descripcion: cleanStringOrNull(plan.description),
        precio: precioConIva,
        meses_contrato: plan.month_contract || 12,
      },
      create: {
        id_plan: plan.id_customers_plan,
        nombre: cleanString(plan.name) || 'Plan sin nombre',
        descripcion: cleanStringOrNull(plan.description),
        precio: precioConIva,
        id_tipo_plan: tipoPlanId,
        meses_contrato: plan.month_contract || 12,
      },
    });

    mappings.planes.set(plan.id_customers_plan, result.id_plan);
  }

  /**
   * Consulta la tasa de impuesto desde MySQL para un plan específico
   */
  private async getTaxRateForPlan(idCustomersPlan: number): Promise<number> {
    try {
      const result = await this.mysql.query<RowDataPacket[]>(
        `SELECT SUM(tbt.value) AS impuesto
         FROM tbl_parameters_taxes tbt
         JOIN tbl_customers_plan_taxes tcpt ON tbt.id_parameters_taxes = tcpt.id_parameters_taxes
         WHERE tbt.status_taxes = 1 AND tcpt.id_customers_plan = ?`,
        [idCustomersPlan],
      );
      const impuesto = result[0]?.impuesto;
      return impuesto != null && !isNaN(Number(impuesto)) ? Number(impuesto) : 0.13;
    } catch (e) {
      this.logger.warn(`No se pudo obtener impuesto para plan ${idCustomersPlan}, usando 0.13 por defecto`);
      return 0.13;
    }
  }

  /**
   * Obtiene preview de datos a migrar
   */
  async getPreview(): Promise<{
    planes: number;
    contratos: number;
    servicios: number;
  }> {
    const [planes, contratos, servicios] = await Promise.all([
      this.mysql.getCount('tbl_customers_plan'),
      this.mysql.getCount('tbl_customers_contract'),
      this.mysql.getCount('tbl_customers_service'),
    ]);

    return { planes, contratos, servicios };
  }
}
