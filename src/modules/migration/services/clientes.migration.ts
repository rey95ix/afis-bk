import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MysqlConnectionService } from './mysql-connection.service';
import { RowDataPacket } from 'mysql2/promise';
import {
  MysqlCustomer,
  MysqlCustomerLocation,
  MysqlCustomerReference,
} from '../interfaces/mysql-tables.interface';
import {
  TableMappings,
  MigrationModuleResult,
  MigrationError,
  MigrationOptions,
  SingleClienteMigrationResult,
} from '../interfaces/mapping.interface';
import {
  parseDate,
  combinePhones,
  cleanString,
  cleanStringOrNull,
  mapEstadoCliente,
  mapTipoPersona,
  normalizeDUI,
  normalizeNIT,
  combineAddress,
} from '../utils/transformers';

@Injectable()
export class ClientesMigrationService {
  private readonly logger = new Logger(ClientesMigrationService.name);
  private readonly DEFAULT_USER_ID = 1; // Usuario por defecto para FK

  constructor(
    private readonly mysql: MysqlConnectionService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Ejecuta la migración completa de clientes
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
      this.logger.log('Iniciando migración de clientes...');

      // 1. Obtener total de clientes
      const totalClientes = await this.mysql.getCount('tbl_customers');
      totalRecords = totalClientes;

      this.logger.log(`Total de clientes a migrar: ${totalClientes}`);

      // 2. Procesar en lotes
      const batchSize = options.batchSize;
      let offset = 0;

      while (offset < totalClientes) {
        this.logger.log(`Procesando lote ${offset} - ${offset + batchSize}...`);

        const customers = await this.mysql.queryPaginated<
          (MysqlCustomer & RowDataPacket)[]
        >(
          'SELECT * FROM tbl_customers ORDER BY id_customers',
          offset,
          batchSize,
        );

        for (const customer of customers) {
          try {
            const result = await this.migrateCustomer(customer, options, mappings);
            if (result.migrated) {
              migratedRecords++;
            } else {
              skippedRecords++;
            }
          } catch (error) {
            if (options.continueOnError) {
              errors.push({
                table: 'cliente',
                recordId: customer.id_customers,
                message: error instanceof Error ? error.message : 'Error',
              });
              skippedRecords++;
            } else {
              throw error;
            }
          }
        }

        offset += batchSize;
      }

      // 3. Migrar direcciones de clientes
      this.logger.log('Migrando direcciones de clientes...');
      const dirResult = await this.migrateClienteDirecciones(options, mappings);
      errors.push(...dirResult.errors);

      // 4. Migrar datos de facturación
      this.logger.log('Migrando datos de facturación de clientes...');
      const facResult = await this.migrateClienteDatosFacturacion(options, mappings);
      errors.push(...facResult.errors);

      const completedAt = new Date();

      return {
        module: 'clientes',
        success: errors.length === 0,
        totalRecords: totalRecords + dirResult.total + facResult.total,
        migratedRecords: migratedRecords + dirResult.migrated + facResult.migrated,
        skippedRecords: skippedRecords + dirResult.skipped + facResult.skipped,
        errors,
        duration: completedAt.getTime() - startedAt.getTime(),
        startedAt,
        completedAt,
      };
    } catch (error) {
      this.logger.error('Error en migración de clientes', error);
      const completedAt = new Date();

      return {
        module: 'clientes',
        success: false,
        totalRecords,
        migratedRecords,
        skippedRecords,
        errors: [
          ...errors,
          {
            table: 'cliente',
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
   * Migra un cliente individual
   */
  private async migrateCustomer(
    customer: MysqlCustomer,
    options: MigrationOptions,
    mappings: TableMappings,
  ): Promise<{ migrated: boolean; newId: number }> {
    // Obtener referencias del cliente
    const referencias = await this.mysql.query<(MysqlCustomerReference & RowDataPacket)[]>(
      'SELECT * FROM tbl_customers_references WHERE id_customers = ? LIMIT 2',
      [customer.id_customers],
    );

    const ref1 = referencias[0];
    const ref2 = referencias[1];

    // Preparar datos de teléfono
    const phones = combinePhones(customer.phone, customer.cellphone, customer.whatsapp);

    // Preparar DUI único (necesario porque es @unique en Prisma)
    const dui = normalizeDUI(customer.dui) || `MIGRADO-${customer.id_customers}`;

    // Mapear estado civil y vivienda
    const idEstadoCivil = customer.id_customers_marital_status
      ? mappings.estadoCivil.get(customer.id_customers_marital_status)
      : null;
    const idEstadoVivienda = customer.id_house_status
      ? mappings.estadoVivienda.get(customer.id_house_status)
      : null;

    if (options.dryRun) {
      this.logger.debug(`[DRY RUN] Migraría cliente: ${customer.name} (ID: ${customer.id_customers})`);
      return { migrated: true, newId: customer.id_customers };
    }

    const result = await this.prisma.cliente.upsert({
      where: { dui },
      update: {
        titular: cleanString(customer.name) || 'Sin nombre',
        fecha_nacimiento: parseDate(customer.birth_date) || new Date('1900-01-01'),
        nit: cleanStringOrNull(customer.nit),
        empresa_trabajo: cleanString(customer.company_job) || '',
        correo_electronico: cleanString(customer.mail) || '',
        telefono1: phones.telefono1 || '',
        telefono2: phones.telefono2,
        referencia1: cleanString(ref1?.name) || '',
        referencia1_telefono: cleanString(ref1?.cellphone || ref1?.phone_job) || '',
        referencia2: cleanString(ref2?.name) || '',
        referencia2_telefono: cleanString(ref2?.cellphone || ref2?.phone_job) || '',
        id_estado_civil: idEstadoCivil,
        id_estado_vivienda: idEstadoVivienda,
        nombre_conyuge: cleanStringOrNull(customer.name_sp),
        telefono_conyuge: cleanStringOrNull(customer.cellphone_sp),
        estado: mapEstadoCliente(customer.customers_status) as any,
      },
      create: {
        id_usuario: this.DEFAULT_USER_ID,
        titular: cleanString(customer.name) || 'Sin nombre',
        fecha_nacimiento: parseDate(customer.birth_date) || new Date('1900-01-01'),
        dui,
        nit: cleanStringOrNull(customer.nit),
        empresa_trabajo: cleanString(customer.company_job) || '',
        correo_electronico: cleanString(customer.mail) || '',
        telefono1: phones.telefono1 || '',
        telefono2: phones.telefono2,
        referencia1: cleanString(ref1?.name) || '',
        referencia1_telefono: cleanString(ref1?.cellphone || ref1?.phone_job) || '',
        referencia2: cleanString(ref2?.name) || '',
        referencia2_telefono: cleanString(ref2?.cellphone || ref2?.phone_job) || '',
        id_estado_civil: idEstadoCivil,
        id_estado_vivienda: idEstadoVivienda,
        nombre_conyuge: cleanStringOrNull(customer.name_sp),
        telefono_conyuge: cleanStringOrNull(customer.cellphone_sp),
        estado: mapEstadoCliente(customer.customers_status) as any,
      },
    });

    // Guardar mapeo de IDs
    mappings.clientes.set(customer.id_customers, result.id_cliente);

    return { migrated: true, newId: result.id_cliente };
  }

  /**
   * Migra direcciones de clientes
   */
  private async migrateClienteDirecciones(
    options: MigrationOptions,
    mappings: TableMappings,
  ): Promise<{ total: number; migrated: number; skipped: number; errors: MigrationError[] }> {
    const errors: MigrationError[] = [];
    let migrated = 0;
    let skipped = 0;

    const locations = await this.mysql.query<(MysqlCustomerLocation & RowDataPacket)[]>(
      'SELECT * FROM tbl_customers_location ORDER BY id_customers_location',
    );

    for (const loc of locations) {
      try {
        const idCliente = mappings.clientes.get(loc.id_customers);
        if (!idCliente) {
          this.logger.warn(`Cliente no encontrado para dirección: ${loc.id_customers}`);
          skipped++;
          continue;
        }

        // Obtener municipio y departamento de la colonia
        const colonia = loc.id_parameters_city
          ? await this.mysql.queryOne<RowDataPacket & {
              id_parameters_municipality: number;
            }>(
              'SELECT id_parameters_municipality FROM tbl_parameters_city WHERE id_parameters_city = ?',
              [loc.id_parameters_city],
            )
          : null;

        const municipio = colonia?.id_parameters_municipality
          ? await this.mysql.queryOne<RowDataPacket & {
              id_parameters_departament: number;
            }>(
              'SELECT id_parameters_departament FROM tbl_parameters_municipality WHERE id_parameters_municipality = ?',
              [colonia.id_parameters_municipality],
            )
          : null;

        const idMunicipio = colonia?.id_parameters_municipality
          ? (mappings.municipios.get(colonia.id_parameters_municipality) || 1)
          : 1;
        const idDepartamento = municipio?.id_parameters_departament
          ? (mappings.departamentos.get(municipio.id_parameters_departament) || 1)
          : 1;
        const idColonia = loc.id_parameters_city
          ? (mappings.colonias.get(loc.id_parameters_city) || null)
          : null;

        if (options.dryRun) {
          this.logger.debug(`[DRY RUN] Migraría dirección para cliente: ${idCliente}`);
          migrated++;
          continue;
        }

        const direccion = combineAddress(loc.address, loc.avenue, loc.street);

        const result = await this.prisma.clienteDirecciones.create({
          data: {
            id_cliente: idCliente,
            direccion,
            id_colonia: idColonia,
            id_municipio: idMunicipio,
            id_departamento: idDepartamento,
            usar_para_instalacion: loc.address_type === 1,
            usar_para_facturacion: loc.address_type === 2,
          },
        });

        mappings.direcciones.set(loc.id_customers_location, result.id_cliente_direccion);
        migrated++;
      } catch (error) {
        if (options.continueOnError) {
          errors.push({
            table: 'clienteDirecciones',
            recordId: loc.id_customers_location,
            message: error instanceof Error ? error.message : 'Error',
          });
          skipped++;
        } else {
          throw error;
        }
      }
    }

    this.logger.log(`Direcciones migradas: ${migrated}, omitidas: ${skipped}`);
    return { total: locations.length, migrated, skipped, errors };
  }

  /**
   * Migra datos de facturación de clientes
   */
  private async migrateClienteDatosFacturacion(
    options: MigrationOptions,
    mappings: TableMappings,
  ): Promise<{ total: number; migrated: number; skipped: number; errors: MigrationError[] }> {
    const errors: MigrationError[] = [];
    let migrated = 0;
    let skipped = 0;

    // Solo crear datos de facturación para clientes que tienen NIT o NRC
    const customers = await this.mysql.query<(MysqlCustomer & RowDataPacket)[]>(
      `SELECT * FROM tbl_customers
       WHERE (nit IS NOT NULL AND nit != '')
          OR (nrc IS NOT NULL AND nrc != '')
       ORDER BY id_customers`,
    );

    for (const customer of customers) {
      try {
        const idCliente = mappings.clientes.get(customer.id_customers);
        if (!idCliente) {
          skipped++;
          continue;
        }

        if (options.dryRun) {
          this.logger.debug(`[DRY RUN] Migraría datos facturación para cliente: ${idCliente}`);
          migrated++;
          continue;
        }

        await this.prisma.clienteDatosFacturacion.create({
          data: {
            id_cliente: idCliente,
            tipo: mapTipoPersona(customer.tipo_persona),
            nombre_empresa: cleanString(customer.name) || 'Sin nombre',
            nit: normalizeNIT(customer.nit),
            nrc: cleanStringOrNull(customer.nrc),
            telefono: cleanStringOrNull(customer.phone),
            correo_electronico: cleanStringOrNull(customer.mail),
          },
        });

        migrated++;
      } catch (error) {
        if (options.continueOnError) {
          errors.push({
            table: 'clienteDatosFacturacion',
            recordId: customer.id_customers,
            message: error instanceof Error ? error.message : 'Error',
          });
          skipped++;
        } else {
          throw error;
        }
      }
    }

    this.logger.log(`Datos facturación migrados: ${migrated}, omitidos: ${skipped}`);
    return { total: customers.length, migrated, skipped, errors };
  }

  /**
   * Migra un cliente específico por su ID de MySQL
   */
  async migrateById(
    idCustomer: number,
    options: MigrationOptions,
    mappings: TableMappings,
  ): Promise<SingleClienteMigrationResult> {
    const startedAt = Date.now();
    const errors: MigrationError[] = [];

    // 1. Buscar cliente en MySQL
    const customer = await this.mysql.queryOne<MysqlCustomer & RowDataPacket>(
      'SELECT * FROM tbl_customers WHERE id_customers = ?',
      [idCustomer],
    );

    if (!customer) {
      throw new NotFoundException(`Cliente no encontrado en MySQL: ${idCustomer}`);
    }

    this.logger.log(`Migrando cliente individual: ${customer.name} (ID: ${idCustomer})`);

    // 2. Migrar cliente base
    const clienteResult = await this.migrateCustomer(customer, options, mappings);
    const dui = normalizeDUI(customer.dui) || `MIGRADO-${customer.id_customers}`;

    // 3. Migrar direcciones de este cliente específico
    const direccionesResult = await this.migrateClienteDireccionesById(
      idCustomer,
      clienteResult.newId,
      options,
      mappings,
    );
    errors.push(...direccionesResult.errors);

    // 4. Migrar datos de facturación de este cliente específico
    const datosFacturacionResult = await this.migrateClienteDatosFacturacionById(
      customer,
      clienteResult.newId,
      options,
    );
    if (datosFacturacionResult.error) {
      errors.push(datosFacturacionResult.error);
    }

    return {
      cliente: {
        mysqlId: idCustomer,
        postgresId: clienteResult.newId,
        migrated: clienteResult.migrated,
        dui,
      },
      direcciones: {
        total: direccionesResult.total,
        migrated: direccionesResult.migrated,
      },
      datosFacturacion: {
        migrated: datosFacturacionResult.migrated,
      },
      errors,
      duration: Date.now() - startedAt,
    };
  }

  /**
   * Migra direcciones de un cliente específico
   */
  private async migrateClienteDireccionesById(
    mysqlCustomerId: number,
    postgresClienteId: number,
    options: MigrationOptions,
    mappings: TableMappings,
  ): Promise<{ total: number; migrated: number; errors: MigrationError[] }> {
    const errors: MigrationError[] = [];
    let migrated = 0;

    const locations = await this.mysql.query<(MysqlCustomerLocation & RowDataPacket)[]>(
      'SELECT * FROM tbl_customers_location WHERE id_customers = ? ORDER BY id_customers_location',
      [mysqlCustomerId],
    );

    for (const loc of locations) {
      try {
        // Obtener municipio y departamento de la colonia
        const colonia = loc.id_parameters_city
          ? await this.mysql.queryOne<RowDataPacket & {
              id_parameters_municipality: number;
            }>(
              'SELECT id_parameters_municipality FROM tbl_parameters_city WHERE id_parameters_city = ?',
              [loc.id_parameters_city],
            )
          : null;

        const municipio = colonia?.id_parameters_municipality
          ? await this.mysql.queryOne<RowDataPacket & {
              id_parameters_departament: number;
            }>(
              'SELECT id_parameters_departament FROM tbl_parameters_municipality WHERE id_parameters_municipality = ?',
              [colonia.id_parameters_municipality],
            )
          : null;

        const idMunicipio = colonia?.id_parameters_municipality
          ? (mappings.municipios.get(colonia.id_parameters_municipality) || 1)
          : 1;
        const idDepartamento = municipio?.id_parameters_departament
          ? (mappings.departamentos.get(municipio.id_parameters_departament) || 1)
          : 1;
        const idColonia = loc.id_parameters_city
          ? (mappings.colonias.get(loc.id_parameters_city) || null)
          : null;

        if (options.dryRun) {
          this.logger.debug(`[DRY RUN] Migraría dirección para cliente: ${postgresClienteId}`);
          migrated++;
          continue;
        }

        const direccion = combineAddress(loc.address, loc.avenue, loc.street);

        const result = await this.prisma.clienteDirecciones.create({
          data: {
            id_cliente: postgresClienteId,
            direccion,
            id_colonia: idColonia,
            id_municipio: idMunicipio,
            id_departamento: idDepartamento,
            usar_para_instalacion: loc.address_type === 1,
            usar_para_facturacion: loc.address_type === 2,
          },
        });

        mappings.direcciones.set(loc.id_customers_location, result.id_cliente_direccion);
        migrated++;
      } catch (error) {
        errors.push({
          table: 'clienteDirecciones',
          recordId: loc.id_customers_location,
          message: error instanceof Error ? error.message : 'Error',
        });
      }
    }

    return { total: locations.length, migrated, errors };
  }

  /**
   * Migra datos de facturación de un cliente específico
   */
  private async migrateClienteDatosFacturacionById(
    customer: MysqlCustomer,
    postgresClienteId: number,
    options: MigrationOptions,
  ): Promise<{ migrated: boolean; error?: MigrationError }> {
    // Solo crear si tiene NIT o NRC
    if ((!customer.nit || customer.nit === '') && (!customer.nrc || customer.nrc === '')) {
      return { migrated: false };
    }

    try {
      if (options.dryRun) {
        this.logger.debug(`[DRY RUN] Migraría datos facturación para cliente: ${postgresClienteId}`);
        return { migrated: true };
      }

      await this.prisma.clienteDatosFacturacion.create({
        data: {
          id_cliente: postgresClienteId,
          tipo: mapTipoPersona(customer.tipo_persona),
          nombre_empresa: cleanString(customer.name) || 'Sin nombre',
          nit: normalizeNIT(customer.nit),
          nrc: cleanStringOrNull(customer.nrc),
          telefono: cleanStringOrNull(customer.phone),
          correo_electronico: cleanStringOrNull(customer.mail),
        },
      });

      return { migrated: true };
    } catch (error) {
      return {
        migrated: false,
        error: {
          table: 'clienteDatosFacturacion',
          recordId: customer.id_customers,
          message: error instanceof Error ? error.message : 'Error',
        },
      };
    }
  }

  /**
   * Obtiene preview de datos a migrar
   */
  async getPreview(): Promise<{
    clientes: number;
    direcciones: number;
    referencias: number;
  }> {
    const [clientes, direcciones, referencias] = await Promise.all([
      this.mysql.getCount('tbl_customers'),
      this.mysql.getCount('tbl_customers_location'),
      this.mysql.getCount('tbl_customers_references'),
    ]);

    return { clientes, direcciones, referencias };
  }
}
