import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MysqlConnectionService } from './mysql-connection.service';
import { RowDataPacket } from 'mysql2/promise';
import {
  MysqlOltEquipo,
  MysqlOltMarca,
  MysqlOltModelo,
  MysqlOltTarjeta,
  MysqlOltTrafico,
  MysqlOltRed,
  MysqlCustomerOlt,
  MysqlCustomerOltIp,
  MysqlCustomerOltPhone,
} from '../interfaces/mysql-tables.interface';
import {
  TableMappings,
  MigrationModuleResult,
  MigrationError,
  MigrationOptions,
} from '../interfaces/mapping.interface';

@Injectable()
export class OltMigrationService {
  private readonly logger = new Logger(OltMigrationService.name);

  constructor(
    private readonly mysql: MysqlConnectionService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Migra todos los catálogos OLT (tablas globales).
   * Orden: marcas → modelos → equipos → tarjetas → perfiles tráfico → redes
   */
  async migrateCatalogosOlt(
    options: MigrationOptions,
    mappings: TableMappings,
  ): Promise<MigrationModuleResult> {
    const startedAt = new Date();
    const errors: MigrationError[] = [];
    let totalRecords = 0;
    let migratedRecords = 0;
    let skippedRecords = 0;

    try {
      this.logger.log('Iniciando migración de catálogos OLT...');

      // 1. Marcas (sin dependencias)
      const marcasResult = await this.migrateMarcas(options, mappings);
      totalRecords += marcasResult.total;
      migratedRecords += marcasResult.migrated;
      skippedRecords += marcasResult.skipped;
      errors.push(...marcasResult.errors);

      // 2. Modelos (depende de marcas)
      const modelosResult = await this.migrateModelos(options, mappings);
      totalRecords += modelosResult.total;
      migratedRecords += modelosResult.migrated;
      skippedRecords += modelosResult.skipped;
      errors.push(...modelosResult.errors);

      // 3. Equipos (depende de sucursales - ya existen)
      const equiposResult = await this.migrateEquipos(options, mappings);
      totalRecords += equiposResult.total;
      migratedRecords += equiposResult.migrated;
      skippedRecords += equiposResult.skipped;
      errors.push(...equiposResult.errors);

      // 4. Tarjetas (depende de equipos)
      const tarjetasResult = await this.migrateTarjetas(options, mappings);
      totalRecords += tarjetasResult.total;
      migratedRecords += tarjetasResult.migrated;
      skippedRecords += tarjetasResult.skipped;
      errors.push(...tarjetasResult.errors);

      // 5. Perfiles de tráfico (sin dependencias)
      const traficoResult = await this.migratePerfilesTrafico(options, mappings);
      totalRecords += traficoResult.total;
      migratedRecords += traficoResult.migrated;
      skippedRecords += traficoResult.skipped;
      errors.push(...traficoResult.errors);

      // 6. Redes (sin dependencias)
      const redesResult = await this.migrateRedes(options, mappings);
      totalRecords += redesResult.total;
      migratedRecords += redesResult.migrated;
      skippedRecords += redesResult.skipped;
      errors.push(...redesResult.errors);

      const completedAt = new Date();
      return {
        module: 'catalogos-olt',
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
      this.logger.error('Error en migración de catálogos OLT', error);
      const completedAt = new Date();
      return {
        module: 'catalogos-olt',
        success: false,
        totalRecords,
        migratedRecords,
        skippedRecords,
        errors: [
          ...errors,
          {
            table: 'catalogos-olt',
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
   * Migra datos OLT de un cliente específico:
   * - olt_cliente (asignaciones de puertos)
   * - olt_cliente_ip (IPs asignadas)
   * - olt_cliente_telefono (VoIP)
   */
  async migrateClienteOlt(
    mysqlCustomerId: number,
    postgresClienteId: number,
    mappings: TableMappings,
  ): Promise<{ asignaciones: number; ips: number; telefonos: number; errors: MigrationError[] }> {
    const errors: MigrationError[] = [];
    let asignaciones = 0;
    let ips = 0;
    let telefonos = 0;

    // 1. Asignaciones OLT (solo rows activas: ont_status > 0 o con id_customers asignado)
    try {
      const rows = await this.mysql.query<(MysqlCustomerOlt & RowDataPacket)[]>(
        'SELECT * FROM tbl_customers_olt WHERE id_customers = ? AND (ont_status > 0 OR serviceport_status > 0)',
        [mysqlCustomerId],
      );

      for (const row of rows) {
        try {
          const idTarjeta = mappings.oltTarjetas.get(row.id_parameters_olt_card);
          if (!idTarjeta) {
            errors.push({
              table: 'tbl_customers_olt',
              recordId: row.id_customers_olt,
              message: `Tarjeta OLT no encontrada en mappings: ${row.id_parameters_olt_card}`,
            });
            continue;
          }

          const idModelo = row.id_parameters_olt_brand_model
            ? mappings.oltModelos.get(row.id_parameters_olt_brand_model) || null
            : null;

          let fechaActivacion: Date | null = null;
          if (row.date_activation) {
            const parsed = new Date(row.date_activation);
            if (!isNaN(parsed.getTime())) {
              fechaActivacion = parsed;
            }
          }

          await this.prisma.olt_cliente.upsert({
            where: { legacy_id: row.id_customers_olt },
            update: {
              id_cliente: postgresClienteId,
              id_olt_tarjeta: idTarjeta,
              port: row.port,
              ont: row.ont,
              ont_status: row.ont_status,
              serviceport: row.serviceport,
              serviceport_status: row.serviceport_status,
              id_olt_modelo: idModelo,
              sn: row.sn || null,
              password: row.password || null,
              fecha_activacion: fechaActivacion,
              vlan: row.vlan || null,
              user_vlan: row.user_vlan || null,
              serviceport_tr069: row.serviceport_tr069 || null,
              serviceport_iptv: row.serviceport_iptv || null,
              serviceport_voip: row.serviceport_voip || null,
            },
            create: {
              id_cliente: postgresClienteId,
              id_olt_tarjeta: idTarjeta,
              port: row.port,
              ont: row.ont,
              ont_status: row.ont_status,
              serviceport: row.serviceport,
              serviceport_status: row.serviceport_status,
              id_olt_modelo: idModelo,
              sn: row.sn || null,
              password: row.password || null,
              fecha_activacion: fechaActivacion,
              vlan: row.vlan || null,
              user_vlan: row.user_vlan || null,
              serviceport_tr069: row.serviceport_tr069 || null,
              serviceport_iptv: row.serviceport_iptv || null,
              serviceport_voip: row.serviceport_voip || null,
              legacy_id: row.id_customers_olt,
            },
          });
          asignaciones++;
        } catch (error) {
          errors.push({
            table: 'tbl_customers_olt',
            recordId: row.id_customers_olt,
            message: error instanceof Error ? error.message : 'Error',
          });
        }
      }
    } catch (error) {
      errors.push({
        table: 'tbl_customers_olt',
        recordId: mysqlCustomerId,
        message: `Error consultando OLT: ${error instanceof Error ? error.message : error}`,
      });
    }

    // 2. IPs asignadas
    try {
      const rows = await this.mysql.query<(MysqlCustomerOltIp & RowDataPacket)[]>(
        'SELECT * FROM tbl_customers_olt_network_ip_range WHERE id_customers = ?',
        [mysqlCustomerId],
      );

      for (const row of rows) {
        try {
          const idRed = mappings.oltRedes.get(row.id_customers_olt_network);
          if (!idRed) {
            errors.push({
              table: 'tbl_customers_olt_network_ip_range',
              recordId: row.id_customers_olt_network_ip_range,
              message: `Red OLT no encontrada en mappings: ${row.id_customers_olt_network}`,
            });
            continue;
          }

          await this.prisma.olt_cliente_ip.upsert({
            where: { legacy_id: row.id_customers_olt_network_ip_range },
            update: {
              id_cliente: postgresClienteId,
              id_olt_red: idRed,
              ip: row.ip,
              long_code: row.long_code ? BigInt(row.long_code) : null,
              selected_pri_dns: row.selected_pri_dns || null,
              selected_slv_dns: row.selected_slv_dns || null,
              is_reserved: row.is_reserved_ip === 1,
            },
            create: {
              id_cliente: postgresClienteId,
              id_olt_red: idRed,
              ip: row.ip,
              long_code: row.long_code ? BigInt(row.long_code) : null,
              selected_pri_dns: row.selected_pri_dns || null,
              selected_slv_dns: row.selected_slv_dns || null,
              is_reserved: row.is_reserved_ip === 1,
              legacy_id: row.id_customers_olt_network_ip_range,
            },
          });
          ips++;
        } catch (error) {
          errors.push({
            table: 'tbl_customers_olt_network_ip_range',
            recordId: row.id_customers_olt_network_ip_range,
            message: error instanceof Error ? error.message : 'Error',
          });
        }
      }
    } catch (error) {
      errors.push({
        table: 'tbl_customers_olt_network_ip_range',
        recordId: mysqlCustomerId,
        message: `Error consultando IPs: ${error instanceof Error ? error.message : error}`,
      });
    }

    // 3. Teléfonos VoIP
    try {
      const rows = await this.mysql.query<(MysqlCustomerOltPhone & RowDataPacket)[]>(
        'SELECT * FROM tbl_customers_olt_phones WHERE id_customers = ?',
        [mysqlCustomerId],
      );

      for (const row of rows) {
        try {
          await this.prisma.olt_cliente_telefono.upsert({
            where: { legacy_id: row.id_customers_olt_phones },
            update: {
              id_cliente: postgresClienteId,
              extension: row.extension || null,
              telefono: row.phone || null,
              usuario: row.user || null,
              password: row.password || null,
            },
            create: {
              id_cliente: postgresClienteId,
              extension: row.extension || null,
              telefono: row.phone || null,
              usuario: row.user || null,
              password: row.password || null,
              legacy_id: row.id_customers_olt_phones,
            },
          });
          telefonos++;
        } catch (error) {
          errors.push({
            table: 'tbl_customers_olt_phones',
            recordId: row.id_customers_olt_phones,
            message: error instanceof Error ? error.message : 'Error',
          });
        }
      }
    } catch (error) {
      errors.push({
        table: 'tbl_customers_olt_phones',
        recordId: mysqlCustomerId,
        message: `Error consultando teléfonos VoIP: ${error instanceof Error ? error.message : error}`,
      });
    }

    return { asignaciones, ips, telefonos, errors };
  }

  // ==================== PRIVATE METHODS ====================

  private async migrateMarcas(
    options: MigrationOptions,
    mappings: TableMappings,
  ): Promise<{ total: number; migrated: number; skipped: number; errors: MigrationError[] }> {
    this.logger.log('Migrando marcas OLT...');
    const errors: MigrationError[] = [];
    let migrated = 0;
    let skipped = 0;

    const marcas = await this.mysql.query<(MysqlOltMarca & RowDataPacket)[]>(
      'SELECT * FROM tbl_parameters_olt_brand ORDER BY id_parameters_olt_brand',
    );

    for (const marca of marcas) {
      try {
        if (options.dryRun) {
          migrated++;
          continue;
        }

        const result = await this.prisma.olt_marca.upsert({
          where: { legacy_id: marca.id_parameters_olt_brand },
          update: { nombre: marca.name },
          create: {
            nombre: marca.name,
            legacy_id: marca.id_parameters_olt_brand,
          },
        });

        mappings.oltMarcas.set(marca.id_parameters_olt_brand, result.id_olt_marca);
        migrated++;
      } catch (error) {
        if (options.continueOnError) {
          errors.push({
            table: 'tbl_parameters_olt_brand',
            recordId: marca.id_parameters_olt_brand,
            message: error instanceof Error ? error.message : 'Error',
          });
          skipped++;
        } else {
          throw error;
        }
      }
    }

    this.logger.log(`Marcas OLT migradas: ${migrated}, omitidas: ${skipped}`);
    return { total: marcas.length, migrated, skipped, errors };
  }

  private async migrateModelos(
    options: MigrationOptions,
    mappings: TableMappings,
  ): Promise<{ total: number; migrated: number; skipped: number; errors: MigrationError[] }> {
    this.logger.log('Migrando modelos OLT...');
    const errors: MigrationError[] = [];
    let migrated = 0;
    let skipped = 0;

    const modelos = await this.mysql.query<(MysqlOltModelo & RowDataPacket)[]>(
      'SELECT * FROM tbl_parameters_olt_brand_model ORDER BY id_parameters_olt_brand_model',
    );

    for (const modelo of modelos) {
      try {
        const idMarca = mappings.oltMarcas.get(modelo.id_parameters_olt_brand);
        if (!idMarca) {
          errors.push({
            table: 'tbl_parameters_olt_brand_model',
            recordId: modelo.id_parameters_olt_brand_model,
            message: `Marca no encontrada en mappings: ${modelo.id_parameters_olt_brand}`,
          });
          skipped++;
          continue;
        }

        if (options.dryRun) {
          migrated++;
          continue;
        }

        const result = await this.prisma.olt_modelo.upsert({
          where: { legacy_id: modelo.id_parameters_olt_brand_model },
          update: {
            id_olt_marca: idMarca,
            nombre: modelo.name,
            srvprofile_olt: modelo.srvprofile_olt || null,
          },
          create: {
            id_olt_marca: idMarca,
            nombre: modelo.name,
            srvprofile_olt: modelo.srvprofile_olt || null,
            legacy_id: modelo.id_parameters_olt_brand_model,
          },
        });

        mappings.oltModelos.set(modelo.id_parameters_olt_brand_model, result.id_olt_modelo);
        migrated++;
      } catch (error) {
        if (options.continueOnError) {
          errors.push({
            table: 'tbl_parameters_olt_brand_model',
            recordId: modelo.id_parameters_olt_brand_model,
            message: error instanceof Error ? error.message : 'Error',
          });
          skipped++;
        } else {
          throw error;
        }
      }
    }

    this.logger.log(`Modelos OLT migrados: ${migrated}, omitidos: ${skipped}`);
    return { total: modelos.length, migrated, skipped, errors };
  }

  private async migrateEquipos(
    options: MigrationOptions,
    mappings: TableMappings,
  ): Promise<{ total: number; migrated: number; skipped: number; errors: MigrationError[] }> {
    this.logger.log('Migrando equipos OLT...');
    const errors: MigrationError[] = [];
    let migrated = 0;
    let skipped = 0;

    const equipos = await this.mysql.query<(MysqlOltEquipo & RowDataPacket)[]>(
      'SELECT * FROM tbl_parameters_olt ORDER BY id_parameters_olt',
    );

    // Cargar mapeo de sucursales: id_parameters_agency → id_sucursal
    const sucursales = await this.prisma.sucursales.findMany({
      select: { id_sucursal: true },
    });
    const sucursalIds = new Set(sucursales.map(s => s.id_sucursal));

    for (const equipo of equipos) {
      try {
        if (options.dryRun) {
          migrated++;
          continue;
        }

        // Mapear id_parameters_agency a id_sucursal (mismo ID si existe)
        const idSucursal = sucursalIds.has(equipo.id_parameters_agency)
          ? equipo.id_parameters_agency
          : null;

        if (!idSucursal && equipo.id_parameters_agency) {
          this.logger.warn(
            `Sucursal ${equipo.id_parameters_agency} no encontrada para equipo OLT ${equipo.id_parameters_olt} (${equipo.name}), asignando null`,
          );
        }

        const result = await this.prisma.olt_equipo.upsert({
          where: { legacy_id: equipo.id_parameters_olt },
          update: {
            nombre: equipo.name,
            ip_address: equipo.ip_address,
            id_sucursal: idSucursal,
          },
          create: {
            nombre: equipo.name,
            ip_address: equipo.ip_address,
            id_sucursal: idSucursal,
            legacy_id: equipo.id_parameters_olt,
          },
        });

        mappings.oltEquipos.set(equipo.id_parameters_olt, result.id_olt_equipo);
        migrated++;
      } catch (error) {
        if (options.continueOnError) {
          errors.push({
            table: 'tbl_parameters_olt',
            recordId: equipo.id_parameters_olt,
            message: error instanceof Error ? error.message : 'Error',
          });
          skipped++;
        } else {
          throw error;
        }
      }
    }

    this.logger.log(`Equipos OLT migrados: ${migrated}, omitidos: ${skipped}`);
    return { total: equipos.length, migrated, skipped, errors };
  }

  private async migrateTarjetas(
    options: MigrationOptions,
    mappings: TableMappings,
  ): Promise<{ total: number; migrated: number; skipped: number; errors: MigrationError[] }> {
    this.logger.log('Migrando tarjetas OLT...');
    const errors: MigrationError[] = [];
    let migrated = 0;
    let skipped = 0;

    const tarjetas = await this.mysql.query<(MysqlOltTarjeta & RowDataPacket)[]>(
      'SELECT * FROM tbl_parameters_olt_card ORDER BY id_parameters_olt_card',
    );

    for (const tarjeta of tarjetas) {
      try {
        const idEquipo = mappings.oltEquipos.get(tarjeta.id_parameters_olt);
        if (!idEquipo) {
          errors.push({
            table: 'tbl_parameters_olt_card',
            recordId: tarjeta.id_parameters_olt_card,
            message: `Equipo OLT no encontrado en mappings: ${tarjeta.id_parameters_olt}`,
          });
          skipped++;
          continue;
        }

        if (options.dryRun) {
          migrated++;
          continue;
        }

        const result = await this.prisma.olt_tarjeta.upsert({
          where: { legacy_id: tarjeta.id_parameters_olt_card },
          update: {
            id_olt_equipo: idEquipo,
            nombre: tarjeta.name,
            slot: tarjeta.slot_olt,
            modelo: tarjeta.modelo || null,
          },
          create: {
            id_olt_equipo: idEquipo,
            nombre: tarjeta.name,
            slot: tarjeta.slot_olt,
            modelo: tarjeta.modelo || null,
            legacy_id: tarjeta.id_parameters_olt_card,
          },
        });

        mappings.oltTarjetas.set(tarjeta.id_parameters_olt_card, result.id_olt_tarjeta);
        migrated++;
      } catch (error) {
        if (options.continueOnError) {
          errors.push({
            table: 'tbl_parameters_olt_card',
            recordId: tarjeta.id_parameters_olt_card,
            message: error instanceof Error ? error.message : 'Error',
          });
          skipped++;
        } else {
          throw error;
        }
      }
    }

    this.logger.log(`Tarjetas OLT migradas: ${migrated}, omitidas: ${skipped}`);
    return { total: tarjetas.length, migrated, skipped, errors };
  }

  private async migratePerfilesTrafico(
    options: MigrationOptions,
    mappings: TableMappings,
  ): Promise<{ total: number; migrated: number; skipped: number; errors: MigrationError[] }> {
    this.logger.log('Migrando perfiles de tráfico OLT...');
    const errors: MigrationError[] = [];
    let migrated = 0;
    let skipped = 0;

    const perfiles = await this.mysql.query<(MysqlOltTrafico & RowDataPacket)[]>(
      'SELECT * FROM tbl_parameters_olt_traffic ORDER BY id_parametros_olt_traffic',
    );

    for (const perfil of perfiles) {
      try {
        if (options.dryRun) {
          migrated++;
          continue;
        }

        const result = await this.prisma.olt_perfil_trafico.upsert({
          where: { legacy_id: perfil.id_parametros_olt_traffic },
          update: {
            nombre: perfil.name,
            cir: perfil.cir,
            cbs: perfil.cbs,
            pir: perfil.pir,
            pbs: perfil.pbs,
          },
          create: {
            nombre: perfil.name,
            cir: perfil.cir,
            cbs: perfil.cbs,
            pir: perfil.pir,
            pbs: perfil.pbs,
            legacy_id: perfil.id_parametros_olt_traffic,
          },
        });

        mappings.oltTrafico.set(perfil.id_parametros_olt_traffic, result.id_olt_perfil_trafico);
        migrated++;
      } catch (error) {
        if (options.continueOnError) {
          errors.push({
            table: 'tbl_parameters_olt_traffic',
            recordId: perfil.id_parametros_olt_traffic,
            message: error instanceof Error ? error.message : 'Error',
          });
          skipped++;
        } else {
          throw error;
        }
      }
    }

    this.logger.log(`Perfiles de tráfico OLT migrados: ${migrated}, omitidos: ${skipped}`);
    return { total: perfiles.length, migrated, skipped, errors };
  }

  private async migrateRedes(
    options: MigrationOptions,
    mappings: TableMappings,
  ): Promise<{ total: number; migrated: number; skipped: number; errors: MigrationError[] }> {
    this.logger.log('Migrando redes OLT...');
    const errors: MigrationError[] = [];
    let migrated = 0;
    let skipped = 0;

    const redes = await this.mysql.query<(MysqlOltRed & RowDataPacket)[]>(
      'SELECT * FROM tbl_customers_olt_network ORDER BY id_customers_olt_network',
    );

    for (const red of redes) {
      try {
        if (options.dryRun) {
          migrated++;
          continue;
        }

        const result = await this.prisma.olt_red.upsert({
          where: { legacy_id: red.id_customers_olt_network },
          update: {
            network: red.network,
            netmask: red.netmask,
            cidr: red.cidr,
            gateway: red.gateway,
            pri_dns: red.pri_dns || null,
            slv_dns: red.slv_dns || null,
            proposito: red.purpose_code || null,
          },
          create: {
            network: red.network,
            netmask: red.netmask,
            cidr: red.cidr,
            gateway: red.gateway,
            pri_dns: red.pri_dns || null,
            slv_dns: red.slv_dns || null,
            proposito: red.purpose_code || null,
            legacy_id: red.id_customers_olt_network,
          },
        });

        mappings.oltRedes.set(red.id_customers_olt_network, result.id_olt_red);
        migrated++;
      } catch (error) {
        if (options.continueOnError) {
          errors.push({
            table: 'tbl_customers_olt_network',
            recordId: red.id_customers_olt_network,
            message: error instanceof Error ? error.message : 'Error',
          });
          skipped++;
        } else {
          throw error;
        }
      }
    }

    this.logger.log(`Redes OLT migradas: ${migrated}, omitidas: ${skipped}`);
    return { total: redes.length, migrated, skipped, errors };
  }
}
