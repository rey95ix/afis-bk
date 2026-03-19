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
  IdCollisionCheckResult,
  IdCollision,
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
   * @deprecated Usar MigrationService.migrateAllClientesUnified() que itera clientes individualmente con pipeline completo
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
   * Migra un cliente individual, preservando el ID original de MySQL como id_cliente en PostgreSQL.
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

    const targetId = customer.id_customers;

    if (options.dryRun) {
      this.logger.debug(`[DRY RUN] Migraría cliente: ${customer.name} (MySQL ID: ${targetId} → PG id_cliente: ${targetId})`);
      mappings.clientes.set(targetId, targetId);
      return { migrated: true, newId: targetId };
    }

    // Campos comunes para create/update
    const clienteData = {
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
    };

    // Buscar por DUI y por ID destino
    const [existingByDui, existingById] = await Promise.all([
      this.prisma.cliente.findUnique({ where: { dui }, select: { id_cliente: true, dui: true } }),
      this.prisma.cliente.findUnique({ where: { id_cliente: targetId }, select: { id_cliente: true, dui: true } }),
    ]);

    // Caso A: ID destino ocupado por un cliente con DUI diferente
    if (existingById && existingById.dui !== dui) {
      this.logger.error(
        `COLISIÓN: id_cliente=${targetId} ya está ocupado por DUI="${existingById.dui}", ` +
        `pero MySQL ID ${targetId} tiene DUI="${dui}". Omitiendo cliente.`,
      );
      return { migrated: false, newId: 0 };
    }

    // Caso B: DUI existe con el mismo ID → solo UPDATE
    if (existingByDui && existingByDui.id_cliente === targetId) {
      await this.prisma.cliente.update({
        where: { id_cliente: targetId },
        data: clienteData,
      });
      mappings.clientes.set(targetId, targetId);
      return { migrated: true, newId: targetId };
    }

    // Caso C: DUI existe con ID diferente → fue migrado previamente con autoincrement.
    // El registro viejo ya fue limpiado por cleanupClienteData en migrateClienteById (con deleteClientRecord=true).
    // Si aún existe aquí (migración batch sin cleanup previo), eliminarlo con limpieza completa de ~21 tablas FK.
    if (existingByDui && existingByDui.id_cliente !== targetId) {
      this.logger.warn(
        `DUI="${dui}" existe con id_cliente=${existingByDui.id_cliente}, ` +
        `pero necesita id_cliente=${targetId}. Eliminando registro viejo con todas las dependencias.`,
      );
      const oldId = existingByDui.id_cliente;

      await this.prisma.$transaction(async (tx) => {
        // 0. OLT data
        await tx.olt_comando.deleteMany({ where: { id_cliente: oldId } });
        await tx.olt_cambio_equipo.deleteMany({ where: { id_cliente: oldId } });
        await tx.olt_cliente_telefono.deleteMany({ where: { id_cliente: oldId } });
        await tx.olt_cliente_ip.deleteMany({ where: { id_cliente: oldId } });
        await tx.olt_cliente.deleteMany({ where: { id_cliente: oldId } });

        // 1. Recopilar IDs necesarios
        const contratos = await tx.atcContrato.findMany({ where: { id_cliente: oldId }, select: { id_contrato: true } });
        const contratoIds = contratos.map(c => c.id_contrato);

        const facturasDirectas = await tx.facturaDirecta.findMany({ where: { id_cliente: oldId }, select: { id_factura_directa: true } });
        const facturaDirectaIds = facturasDirectas.map(f => f.id_factura_directa);

        const dtes = await tx.dte_emitidos.findMany({ where: { id_cliente: oldId }, select: { id_dte: true } });
        const dteIds = dtes.map(d => d.id_dte);

        const cxcs = await tx.cuenta_por_cobrar.findMany({ where: { id_cliente: oldId }, select: { id_cxc: true } });
        const cxcIds = cxcs.map(c => c.id_cxc);

        const abonos = cxcIds.length > 0
          ? await tx.abono_cxc.findMany({ where: { id_cxc: { in: cxcIds } }, select: { id_abono: true } })
          : [];
        const abonoIds = abonos.map(a => a.id_abono);

        // 2. caja_movimiento (via abonos)
        if (abonoIds.length > 0) {
          await tx.caja_movimiento.deleteMany({ where: { id_abono_cxc: { in: abonoIds } } });
        }

        // 3. abono_cxc
        if (cxcIds.length > 0) {
          await tx.abono_cxc.deleteMany({ where: { id_cxc: { in: cxcIds } } });
        }

        // 4. cuenta_por_cobrar
        await tx.cuenta_por_cobrar.deleteMany({ where: { id_cliente: oldId } });

        // 5. facturaDirectaDetalle
        if (facturaDirectaIds.length > 0) {
          await tx.facturaDirectaDetalle.deleteMany({ where: { id_factura_directa: { in: facturaDirectaIds } } });
        }

        // 6. facturaDirecta
        await tx.facturaDirecta.deleteMany({ where: { id_cliente: oldId } });

        // 7. dte_anulaciones
        if (dteIds.length > 0) {
          await tx.dte_anulaciones.deleteMany({ where: { id_dte: { in: dteIds } } });
        }

        // 8. dte_emitidos_detalle
        if (dteIds.length > 0) {
          await tx.dte_emitidos_detalle.deleteMany({ where: { id_dte: { in: dteIds } } });
        }

        // 9. dte_emitidos
        await tx.dte_emitidos.deleteMany({ where: { id_cliente: oldId } });

        // 10. pago_tarjeta_portal & pago_tarjeta_intent
        await tx.pago_tarjeta_portal.deleteMany({ where: { id_cliente: oldId } });
        await tx.pago_tarjeta_intent.deleteMany({ where: { id_cliente: oldId } });

        // 11. whatsapp_validacion_comprobante → nullify contrato refs
        if (contratoIds.length > 0) {
          await tx.whatsapp_validacion_comprobante.updateMany({ where: { id_contrato: { in: contratoIds } }, data: { id_contrato: null } });
        }

        // 12. clienteDocumentos
        await tx.clienteDocumentos.deleteMany({ where: { id_cliente: oldId } });

        // 13. atcContratoInstalacion
        if (contratoIds.length > 0) {
          await tx.atcContratoInstalacion.deleteMany({ where: { id_contrato: { in: contratoIds } } });
        }

        // 14. orden_trabajo → nullify contrato refs
        if (contratoIds.length > 0) {
          await tx.orden_trabajo.updateMany({ where: { id_contrato: { in: contratoIds } }, data: { id_contrato: null } });
        }

        // 15. atcContrato
        await tx.atcContrato.deleteMany({ where: { id_cliente: oldId } });

        // 16. clienteDatosFacturacion
        await tx.clienteDatosFacturacion.deleteMany({ where: { id_cliente: oldId } });

        // 17. Órdenes de trabajo y dependencias
        const ots = await tx.orden_trabajo.findMany({ where: { id_cliente: oldId }, select: { id_orden: true } });
        const otIds = ots.map(o => o.id_orden);
        if (otIds.length > 0) {
          await tx.ot_historial_estado.deleteMany({ where: { id_orden: { in: otIds } } });
          await tx.ot_actividades.deleteMany({ where: { id_orden: { in: otIds } } });
          await tx.ot_materiales.deleteMany({ where: { id_orden: { in: otIds } } });
          await tx.ot_evidencias.deleteMany({ where: { id_orden: { in: otIds } } });
          await tx.agenda_visitas.deleteMany({ where: { id_orden: { in: otIds } } });
          await tx.reservas_inventario.deleteMany({ where: { id_orden_trabajo: { in: otIds } } });
          await tx.inventario_series.updateMany({ where: { id_orden_trabajo: { in: otIds } }, data: { id_orden_trabajo: null } });
          await tx.movimientos_inventario.updateMany({ where: { id_orden_trabajo: { in: otIds } }, data: { id_orden_trabajo: null } });
          await tx.historial_series.updateMany({ where: { id_orden_trabajo: { in: otIds } }, data: { id_orden_trabajo: null } });
          await tx.sms_historial.updateMany({ where: { id_orden_trabajo: { in: otIds } }, data: { id_orden_trabajo: null } });
          await tx.orden_trabajo.deleteMany({ where: { id_cliente: oldId } });
        }

        // 18. Tickets de soporte
        const tickets = await tx.ticket_soporte.findMany({ where: { id_cliente: oldId }, select: { id_ticket: true } });
        if (tickets.length > 0) {
          await tx.sms_historial.updateMany({ where: { id_ticket: { in: tickets.map(t => t.id_ticket) } }, data: { id_ticket: null } });
          await tx.ticket_soporte.deleteMany({ where: { id_cliente: oldId } });
        }

        // 19. clienteDirecciones
        await tx.clienteDirecciones.deleteMany({ where: { id_cliente: oldId } });

        // 20. Eliminar cliente
        await tx.cliente.delete({ where: { id_cliente: oldId } });
      }, { timeout: 30000 });
    }

    // Caso D (o continuación de C): Crear con ID explícito
    await this.prisma.cliente.create({
      data: {
        id_cliente: targetId,
        id_usuario: this.DEFAULT_USER_ID,
        dui,
        ...clienteData,
      },
    });

    mappings.clientes.set(targetId, targetId);
    return { migrated: true, newId: targetId };
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

        // Buscar dirección existente con el mismo texto para este cliente
        const existing = await this.prisma.clienteDirecciones.findFirst({
          where: {
            id_cliente: idCliente,
            direccion,
          },
        });

        if (existing) {
          // Merge flags: activar el flag que corresponda sin desactivar el existente
          const updateData: Record<string, boolean> = {};
          if (loc.address_type === 1 && !existing.usar_para_instalacion) {
            updateData.usar_para_instalacion = true;
          }
          if (loc.address_type === 2 && !existing.usar_para_facturacion) {
            updateData.usar_para_facturacion = true;
          }
          if (Object.keys(updateData).length > 0) {
            await this.prisma.clienteDirecciones.update({
              where: { id_cliente_direccion: existing.id_cliente_direccion },
              data: updateData,
            });
          }
          mappings.direcciones.set(loc.id_customers_location, existing.id_cliente_direccion);
          this.logger.debug(
            `Dirección duplicada fusionada para cliente ${idCliente}: "${direccion}"`,
          );
        } else {
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
        }
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

        // Buscar dirección existente con el mismo texto para este cliente
        const existing = await this.prisma.clienteDirecciones.findFirst({
          where: {
            id_cliente: postgresClienteId,
            direccion,
          },
        });

        if (existing) {
          // Merge flags: activar el flag que corresponda sin desactivar el existente
          const updateData: Record<string, boolean> = {};
          if (loc.address_type === 1 && !existing.usar_para_instalacion) {
            updateData.usar_para_instalacion = true;
          }
          if (loc.address_type === 2 && !existing.usar_para_facturacion) {
            updateData.usar_para_facturacion = true;
          }
          if (Object.keys(updateData).length > 0) {
            await this.prisma.clienteDirecciones.update({
              where: { id_cliente_direccion: existing.id_cliente_direccion },
              data: updateData,
            });
          }
          mappings.direcciones.set(loc.id_customers_location, existing.id_cliente_direccion);
          this.logger.debug(
            `Dirección duplicada fusionada para cliente ${postgresClienteId}: "${direccion}"`,
          );
        } else {
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
        }
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

  /**
   * Pre-check: detecta colisiones de IDs entre MySQL y PostgreSQL
   * antes de ejecutar la migración con IDs preservados.
   */
  async checkIdCollisions(): Promise<IdCollisionCheckResult> {
    // Obtener todos los clientes de MySQL
    const mysqlClients = await this.mysql.query<(RowDataPacket & { id_customers: number; dui: string })[]>(
      'SELECT id_customers, dui FROM tbl_customers ORDER BY id_customers',
    );

    // Obtener todos los clientes de PostgreSQL
    const pgClients = await this.prisma.cliente.findMany({
      select: { id_cliente: true, dui: true },
    });

    // Indexar PostgreSQL por ID y por DUI
    const pgById = new Map<number, { id_cliente: number; dui: string }>();
    const pgByDui = new Map<string, { id_cliente: number; dui: string }>();
    for (const pg of pgClients) {
      pgById.set(pg.id_cliente, pg);
      pgByDui.set(pg.dui, pg);
    }

    const collisions: IdCollision[] = [];

    for (const mysql of mysqlClients) {
      const mysqlDui = normalizeDUI(mysql.dui) || `MIGRADO-${mysql.id_customers}`;
      const targetId = mysql.id_customers;

      // Check 1: ID destino ocupado por DUI diferente
      const occupant = pgById.get(targetId);
      if (occupant && occupant.dui !== mysqlDui) {
        collisions.push({
          mysqlId: targetId,
          mysqlDui,
          existingPostgresId: occupant.id_cliente,
          existingPostgresDui: occupant.dui,
          type: 'ID_OCCUPIED_DIFFERENT_DUI',
        });
      }

      // Check 2: DUI existe con ID diferente
      const duiMatch = pgByDui.get(mysqlDui);
      if (duiMatch && duiMatch.id_cliente !== targetId) {
        collisions.push({
          mysqlId: targetId,
          mysqlDui,
          existingPostgresId: duiMatch.id_cliente,
          existingPostgresDui: duiMatch.dui,
          type: 'DUI_EXISTS_DIFFERENT_ID',
        });
      }
    }

    return {
      totalMysqlClients: mysqlClients.length,
      collisions,
      safeCount: mysqlClients.length - new Set(collisions.map(c => c.mysqlId)).size,
    };
  }

  /**
   * Resetea la secuencia autoincrement de cliente.id_cliente
   * al valor MAX(id_cliente) + 1 para evitar colisiones con futuros inserts.
   */
  async resetClienteSequence(): Promise<number> {
    const result = await this.prisma.$queryRaw<[{ setval: bigint }]>`
      SELECT setval(
        pg_get_serial_sequence('cliente', 'id_cliente'),
        COALESCE((SELECT MAX(id_cliente) FROM cliente), 0) + 1,
        false
      ) as setval
    `;
    const newVal = Number(result[0].setval);
    this.logger.log(`Secuencia cliente.id_cliente reseteada a ${newVal}`);
    return newVal;
  }
}
