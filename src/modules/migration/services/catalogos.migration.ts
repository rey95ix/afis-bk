import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MysqlConnectionService } from './mysql-connection.service';
import { RowDataPacket } from 'mysql2/promise';
import {
  MysqlDepartamento,
  MysqlMunicipio,
  MysqlColonia,
  MysqlEstadoCivil,
  MysqlEstadoVivienda,
} from '../interfaces/mysql-tables.interface';
import {
  TableMappings,
  MigrationModuleResult,
  MigrationError,
} from '../interfaces/mapping.interface';
import { MigrationOptions } from '../interfaces/mapping.interface';
import { cleanString } from '../utils/transformers';

@Injectable()
export class CatalogosMigrationService {
  private readonly logger = new Logger(CatalogosMigrationService.name);

  constructor(
    private readonly mysql: MysqlConnectionService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Ejecuta la migración completa de catálogos base
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
      this.logger.log('Iniciando migración de catálogos...');

      // 1. Migrar departamentos
      const deptResult = await this.migrateDepartamentos(options, mappings);
      totalRecords += deptResult.total;
      migratedRecords += deptResult.migrated;
      skippedRecords += deptResult.skipped;
      errors.push(...deptResult.errors);

      // 2. Migrar municipios (depende de departamentos)
      const muniResult = await this.migrateMunicipios(options, mappings);
      totalRecords += muniResult.total;
      migratedRecords += muniResult.migrated;
      skippedRecords += muniResult.skipped;
      errors.push(...muniResult.errors);

      // 3. Migrar colonias (depende de municipios)
      const colResult = await this.migrateColonias(options, mappings);
      totalRecords += colResult.total;
      migratedRecords += colResult.migrated;
      skippedRecords += colResult.skipped;
      errors.push(...colResult.errors);

      // 4. Migrar estados civiles
      const ecResult = await this.migrateEstadosCiviles(options, mappings);
      totalRecords += ecResult.total;
      migratedRecords += ecResult.migrated;
      skippedRecords += ecResult.skipped;
      errors.push(...ecResult.errors);

      // 5. Migrar estados de vivienda
      const evResult = await this.migrateEstadosVivienda(options, mappings);
      totalRecords += evResult.total;
      migratedRecords += evResult.migrated;
      skippedRecords += evResult.skipped;
      errors.push(...evResult.errors);

      const completedAt = new Date();

      return {
        module: 'catalogos',
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
      this.logger.error('Error en migración de catálogos', error);
      const completedAt = new Date();

      return {
        module: 'catalogos',
        success: false,
        totalRecords,
        migratedRecords,
        skippedRecords,
        errors: [
          ...errors,
          {
            table: 'catalogos',
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
   * Migra departamentos
   */
  private async migrateDepartamentos(
    options: MigrationOptions,
    mappings: TableMappings,
  ): Promise<{ total: number; migrated: number; skipped: number; errors: MigrationError[] }> {
    this.logger.log('Migrando departamentos...');
    const errors: MigrationError[] = [];
    let migrated = 0;
    let skipped = 0;

    const departamentos = await this.mysql.query<
      (MysqlDepartamento & RowDataPacket)[]
    >('SELECT * FROM tbl_parameters_departament ORDER BY id_parameters_departament');

    for (const dept of departamentos) {
      try {
        if (options.dryRun) {
          this.logger.debug(`[DRY RUN] Migraría departamento: ${dept.name}`);
          migrated++;
          continue;
        }

        const result = await this.prisma.departamentos.upsert({
          where: { id_departamento: dept.id_parameters_departament },
          update: {
            nombre: cleanString(dept.name),
            codigo: dept.codigo_hacienda || null,
            codigo_iso: dept.codigo_hacienda?.padStart(2, '0') || 'SV',
          },
          create: {
            id_departamento: dept.id_parameters_departament,
            nombre: cleanString(dept.name),
            codigo: dept.codigo_hacienda || null,
            codigo_iso: dept.codigo_hacienda?.padStart(2, '0') || 'SV',
          },
        });

        mappings.departamentos.set(dept.id_parameters_departament, result.id_departamento);
        migrated++;
      } catch (error) {
        if (options.continueOnError) {
          errors.push({
            table: 'departamentos',
            recordId: dept.id_parameters_departament,
            message: error instanceof Error ? error.message : 'Error',
          });
          skipped++;
        } else {
          throw error;
        }
      }
    }

    this.logger.log(`Departamentos migrados: ${migrated}, omitidos: ${skipped}`);
    return { total: departamentos.length, migrated, skipped, errors };
  }

  /**
   * Migra municipios
   */
  private async migrateMunicipios(
    options: MigrationOptions,
    mappings: TableMappings,
  ): Promise<{ total: number; migrated: number; skipped: number; errors: MigrationError[] }> {
    this.logger.log('Migrando municipios...');
    const errors: MigrationError[] = [];
    let migrated = 0;
    let skipped = 0;

    const municipios = await this.mysql.query<(RowDataPacket & {
      id_parameters_municipality: number;
      name: string;
      id_parameters_departament: number;
      codigo_hacienda: string;
    })[]>('SELECT * FROM tbl_parameters_municipality ORDER BY id_parameters_municipality');

    for (const muni of municipios) {
      try {
        const idDepto = mappings.departamentos.get(muni.id_parameters_departament) ||
                        muni.id_parameters_departament;

        if (options.dryRun) {
          this.logger.debug(`[DRY RUN] Migraría municipio: ${muni.name}`);
          migrated++;
          continue;
        }

        const result = await this.prisma.municipios.upsert({
          where: { id_municipio: muni.id_parameters_municipality },
          update: {
            nombre: cleanString(muni.name),
            codigo: muni.codigo_hacienda || null,
            id_departamento: idDepto,
          },
          create: {
            id_municipio: muni.id_parameters_municipality,
            nombre: cleanString(muni.name),
            codigo: muni.codigo_hacienda || null,
            id_departamento: idDepto,
          },
        });

        mappings.municipios.set(muni.id_parameters_municipality, result.id_municipio);
        migrated++;
      } catch (error) {
        if (options.continueOnError) {
          errors.push({
            table: 'municipios',
            recordId: muni.id_parameters_municipality,
            message: error instanceof Error ? error.message : 'Error',
          });
          skipped++;
        } else {
          throw error;
        }
      }
    }

    this.logger.log(`Municipios migrados: ${migrated}, omitidos: ${skipped}`);
    return { total: municipios.length, migrated, skipped, errors };
  }

  /**
   * Migra colonias
   */
  private async migrateColonias(
    options: MigrationOptions,
    mappings: TableMappings,
  ): Promise<{ total: number; migrated: number; skipped: number; errors: MigrationError[] }> {
    this.logger.log('Migrando colonias...');
    const errors: MigrationError[] = [];
    let migrated = 0;
    let skipped = 0;

    const colonias = await this.mysql.query<(MysqlColonia & RowDataPacket)[]>(
      'SELECT * FROM tbl_parameters_city ORDER BY id_parameters_city',
    );

    for (const col of colonias) {
      try {
        const idMunicipio = mappings.municipios.get(col.id_parameters_municipality) ||
                           col.id_parameters_municipality;

        if (options.dryRun) {
          this.logger.debug(`[DRY RUN] Migraría colonia: ${col.name}`);
          migrated++;
          continue;
        }

        const result = await this.prisma.colonias.upsert({
          where: { id_colonia: col.id_parameters_city },
          update: {
            nombre: cleanString(col.name),
            id_municipio: idMunicipio,
          },
          create: {
            id_colonia: col.id_parameters_city,
            nombre: cleanString(col.name),
            id_municipio: idMunicipio,
          },
        });

        mappings.colonias.set(col.id_parameters_city, result.id_colonia);
        migrated++;
      } catch (error) {
        if (options.continueOnError) {
          errors.push({
            table: 'colonias',
            recordId: col.id_parameters_city,
            message: error instanceof Error ? error.message : 'Error',
          });
          skipped++;
        } else {
          throw error;
        }
      }
    }

    this.logger.log(`Colonias migradas: ${migrated}, omitidas: ${skipped}`);
    return { total: colonias.length, migrated, skipped, errors };
  }

  /**
   * Migra estados civiles
   */
  private async migrateEstadosCiviles(
    options: MigrationOptions,
    mappings: TableMappings,
  ): Promise<{ total: number; migrated: number; skipped: number; errors: MigrationError[] }> {
    this.logger.log('Migrando estados civiles...');
    const errors: MigrationError[] = [];
    let migrated = 0;
    let skipped = 0;

    const estados = await this.mysql.query<(MysqlEstadoCivil & RowDataPacket)[]>(
      'SELECT * FROM tbl_customers_marital_status ORDER BY id_marital_status',
    );

    for (const estado of estados) {
      try {
        if (options.dryRun) {
          this.logger.debug(`[DRY RUN] Migraría estado civil: ${estado.name}`);
          migrated++;
          continue;
        }

        const codigo = `EC${String(estado.id_marital_status).padStart(2, '0')}`;

        const result = await this.prisma.cat_estado_civil.upsert({
          where: { codigo },
          update: {
            nombre: cleanString(estado.name),
          },
          create: {
            codigo,
            nombre: cleanString(estado.name),
          },
        });

        mappings.estadoCivil.set(estado.id_marital_status, result.id_estado_civil);
        migrated++;
      } catch (error) {
        if (options.continueOnError) {
          errors.push({
            table: 'cat_estado_civil',
            recordId: estado.id_marital_status,
            message: error instanceof Error ? error.message : 'Error',
          });
          skipped++;
        } else {
          throw error;
        }
      }
    }

    this.logger.log(`Estados civiles migrados: ${migrated}, omitidos: ${skipped}`);
    return { total: estados.length, migrated, skipped, errors };
  }

  /**
   * Migra estados de vivienda
   */
  private async migrateEstadosVivienda(
    options: MigrationOptions,
    mappings: TableMappings,
  ): Promise<{ total: number; migrated: number; skipped: number; errors: MigrationError[] }> {
    this.logger.log('Migrando estados de vivienda...');
    const errors: MigrationError[] = [];
    let migrated = 0;
    let skipped = 0;

    const estados = await this.mysql.query<(MysqlEstadoVivienda & RowDataPacket)[]>(
      'SELECT * FROM tbl_customers_house_status ORDER BY id_customers_house_status',
    );

    for (const estado of estados) {
      try {
        if (options.dryRun) {
          this.logger.debug(`[DRY RUN] Migraría estado vivienda: ${estado.name}`);
          migrated++;
          continue;
        }

        const codigo = `EV${String(estado.id_customers_house_status).padStart(2, '0')}`;

        const result = await this.prisma.cat_estado_vivienda.upsert({
          where: { codigo },
          update: {
            nombre: cleanString(estado.name),
          },
          create: {
            codigo,
            nombre: cleanString(estado.name),
          },
        });

        mappings.estadoVivienda.set(estado.id_customers_house_status, result.id_estado_vivienda);
        migrated++;
      } catch (error) {
        if (options.continueOnError) {
          errors.push({
            table: 'cat_estado_vivienda',
            recordId: estado.id_customers_house_status,
            message: error instanceof Error ? error.message : 'Error',
          });
          skipped++;
        } else {
          throw error;
        }
      }
    }

    this.logger.log(`Estados de vivienda migrados: ${migrated}, omitidos: ${skipped}`);
    return { total: estados.length, migrated, skipped, errors };
  }

  /**
   * Obtiene preview de datos a migrar
   */
  async getPreview(): Promise<{
    departamentos: number;
    municipios: number;
    colonias: number;
    estadosCiviles: number;
    estadosVivienda: number;
  }> {
    const [departamentos, municipios, colonias, estadosCiviles, estadosVivienda] =
      await Promise.all([
        this.mysql.getCount('tbl_parameters_departament'),
        this.mysql.getCount('tbl_parameters_municipality'),
        this.mysql.getCount('tbl_parameters_city'),
        this.mysql.getCount('tbl_customers_marital_status'),
        this.mysql.getCount('tbl_customers_house_status'),
      ]);

    return {
      departamentos,
      municipios,
      colonias,
      estadosCiviles,
      estadosVivienda,
    };
  }
}
