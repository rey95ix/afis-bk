import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MysqlConnectionService } from './mysql-connection.service';
import { RowDataPacket } from 'mysql2/promise';
import { MysqlBill, MysqlBillDetail } from '../interfaces/mysql-tables.interface';
import {
  TableMappings,
  MigrationModuleResult,
  MigrationError,
  MigrationOptions,
} from '../interfaces/mapping.interface';
import {
  parseDate,
  cleanString,
  cleanStringOrNull,
  mapEstadoFactura,
  mapTipoDTE,
  generateUUID,
  toDecimal,
  getCurrentTime,
  truncateString,
} from '../utils/transformers';

@Injectable()
export class FacturacionMigrationService {
  private readonly logger = new Logger(FacturacionMigrationService.name);
  private readonly DEFAULT_USER_ID = 1; // Usuario administrador por defecto

  constructor(
    private readonly mysql: MysqlConnectionService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Ejecuta la migración completa de facturación
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
      this.logger.log('Iniciando migración de facturación...');

      // Asegurar que existe la sucursal por defecto
      await this.ensureSucursalDefault();

      // Obtener total de facturas
      const totalBills = await this.mysql.getCount('tbl_bill');
      totalRecords = totalBills;

      this.logger.log(`Total de facturas a migrar: ${totalBills}`);

      // Procesar en lotes
      const batchSize = options.batchSize;
      let offset = 0;

      while (offset < totalBills) {
        this.logger.log(
          `Procesando lote ${offset} - ${offset + batchSize} de ${totalBills}...`,
        );

        const bills = await this.mysql.queryPaginated<(MysqlBill & RowDataPacket)[]>(
          'SELECT * FROM tbl_bill ORDER BY id_bill',
          offset,
          batchSize,
        );

        for (const bill of bills) {
          try {
            const result = await this.migrateBill(bill, options, mappings);
            if (result.migrated) {
              migratedRecords++;

              // Migrar detalles de la factura
              await this.migrateBillDetails(bill.id_bill, result.newId, options);
            } else {
              skippedRecords++;
            }
          } catch (error) {
            if (options.continueOnError) {
              errors.push({
                table: 'dte_emitidos',
                recordId: bill.id_bill,
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

      const completedAt = new Date();

      return {
        module: 'facturacion',
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
      this.logger.error('Error en migración de facturación', error);
      const completedAt = new Date();

      return {
        module: 'facturacion',
        success: false,
        totalRecords,
        migratedRecords,
        skippedRecords,
        errors: [
          ...errors,
          {
            table: 'dte_emitidos',
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
   * Asegura que existe una sucursal por defecto
   */
  private async ensureSucursalDefault(): Promise<number> {
    const sucursal = await this.prisma.sucursales.findFirst();
    if (sucursal) {
      return sucursal.id_sucursal;
    }

    const newSucursal = await this.prisma.sucursales.create({
      data: {
        nombre: 'Sucursal Principal',
        cod_estable_MH: 'M001',
        cod_estable: 'M001',
        cod_punto_venta_MH: 'P001',
        cod_punto_venta: 'P001',
      },
    });

    return newSucursal.id_sucursal;
  }

  /**
   * Migra una factura individual
   */
  private async migrateBill(
    bill: MysqlBill,
    options: MigrationOptions,
    mappings: TableMappings,
  ): Promise<{ migrated: boolean; newId: number }> {
    // Obtener cliente mapeado
    const idCliente = bill.id_customers
      ? mappings.clientes.get(bill.id_customers)
      : null;

    if (options.dryRun) {
      this.logger.debug(
        `[DRY RUN] Migraría factura: ${bill.correlative_bill || bill.id_bill}`,
      );
      return { migrated: true, newId: bill.id_bill };
    }

    // Generar código de generación si no existe
    const codigoGeneracion = bill.codigo_generacion || generateUUID();

    // Generar número de control
    const tipoDTE = mapTipoDTE(bill.bill_concept);
    const numeroControl = bill.correlative_bill ||
      `DTE-${tipoDTE}-00000000-${String(bill.id_bill).padStart(15, '0')}`;

    // Calcular montos desde detalles
    const detalles = await this.mysql.query<(MysqlBillDetail & RowDataPacket)[]>(
      'SELECT * FROM tbl_bill_details WHERE id_bill = ?',
      [bill.id_bill],
    );

    let totalGravado = 0;
    let totalExento = 0;
    let iva = 0;

    for (const det of detalles) {
      const subtotal = det.sub_total || 0;
      totalGravado += subtotal;
    }

    // Calcular IVA (13% en El Salvador)
    iva = toDecimal(totalGravado * 0.13);
    const montoTotal = toDecimal(totalGravado + iva);

    // Verificar si ya existe
    const existing = await this.prisma.dte_emitidos.findUnique({
      where: { codigo_generacion: codigoGeneracion },
    });

    if (existing) {
      mappings.facturas.set(bill.id_bill, existing.id_dte);
      return { migrated: false, newId: existing.id_dte };
    }

    // También verificar por número de control
    const existingByControl = await this.prisma.dte_emitidos.findUnique({
      where: { numero_control: truncateString(numeroControl, 31) || 'SIN-NUMERO' },
    });

    if (existingByControl) {
      mappings.facturas.set(bill.id_bill, existingByControl.id_dte);
      return { migrated: false, newId: existingByControl.id_dte };
    }

    const fechaEmision = parseDate(bill.bill_date) || new Date();
    const sucursalId = await this.ensureSucursalDefault();

    const result = await this.prisma.dte_emitidos.create({
      data: {
        codigo_generacion: codigoGeneracion,
        numero_control: truncateString(numeroControl, 31) || `MIG-${bill.id_bill}`,
        tipo_dte: tipoDTE,
        version: 1,
        ambiente: '01', // Producción
        tipo_modelo: 1,
        tipo_operacion: 1,
        fecha_emision: fechaEmision,
        hora_emision: getCurrentTime(),
        tipo_moneda: 'USD',

        // Receptor
        receptor_nombre: truncateString(cleanString(bill.name_customers), 250) || null,
        receptor_complemento: truncateString(cleanString(bill.customers_pay_address), 200) || null,
        receptor_nrc: cleanStringOrNull(bill.nrc),
        receptor_desc_actividad: truncateString(cleanString(bill.economic_activity), 250) || null,

        // Relación con cliente
        id_cliente: idCliente,

        // Montos
        total_gravadas: totalGravado,
        total_exentas: totalExento,
        total_iva: iva,
        monto_total_operacion: montoTotal,
        saldo_favor: 0,
        total_pagar: montoTotal,
        total_letras: '', // Migración histórica sin total en letras
        dte_json: JSON.stringify({ migrated: true, source: 'mysql', id_bill: bill.id_bill }),
        condicion_operacion: 1, // Contado

        // Sucursal
        id_sucursal: sucursalId,

        // Estado
        estado: mapEstadoFactura(bill.bill_status) as any,

        // Campos de MH
        sello_recepcion: cleanStringOrNull(bill.sello_recepcion),
        fecha_recepcion: bill.sello_recepcion ? fechaEmision : null,

        // Auditoría
        id_usuario_crea: this.DEFAULT_USER_ID,
      },
    });

    mappings.facturas.set(bill.id_bill, result.id_dte);
    return { migrated: true, newId: result.id_dte };
  }

  /**
   * Migra los detalles de una factura
   */
  private async migrateBillDetails(
    oldBillId: number,
    newDteId: number,
    options: MigrationOptions,
  ): Promise<void> {
    if (options.dryRun) {
      return;
    }

    const detalles = await this.mysql.query<(MysqlBillDetail & RowDataPacket)[]>(
      'SELECT * FROM tbl_bill_details WHERE id_bill = ? ORDER BY id_details_bill',
      [oldBillId],
    );

    let numItem = 1;

    for (const det of detalles) {
      try {
        const cantidad = det.quantity || 1;
        const precioUnitario = det.unit_price || 0;
        const ventaGravada = det.sub_total || 0;

        await this.prisma.dte_emitidos_detalle.create({
          data: {
            id_dte: newDteId,
            num_item: numItem++,
            tipo_item: 2, // Servicio
            descripcion: truncateString(cleanString(det.name), 1000) || 'Servicio',
            cantidad: cantidad,
            uni_medida: 59, // Servicio
            precio_unitario: toDecimal(precioUnitario),
            monto_descuento: 0,
            venta_no_sujeta: 0,
            venta_exenta: 0,
            venta_gravada: toDecimal(ventaGravada),
            iva_item: toDecimal(ventaGravada * 0.13),
          },
        });
      } catch (error) {
        this.logger.warn(
          `Error migrando detalle de factura ${oldBillId}: ${error}`,
        );
      }
    }
  }

  /**
   * Migra facturas de un cliente específico
   */
  async migrateByClienteId(
    mysqlCustomerId: number,
    postgresClienteId: number,
    options: MigrationOptions,
    mappings: TableMappings,
  ): Promise<{ total: number; migrated: number }> {
    let migrated = 0;

    this.logger.log(`Migrando facturas del cliente MySQL ${mysqlCustomerId}...`);

    // Asegurar sucursal por defecto
    await this.ensureSucursalDefault();

    // Obtener facturas del cliente
    const bills = await this.mysql.query<(MysqlBill & RowDataPacket)[]>(
      'SELECT * FROM tbl_bill WHERE id_customers = ? ORDER BY id_bill',
      [mysqlCustomerId],
    );

    for (const bill of bills) {
      try {
        // Forzar el id_cliente de PostgreSQL
        const result = await this.migrateBillForCliente(bill, postgresClienteId, options, mappings);
        if (result.migrated) {
          migrated++;
          // Migrar detalles
          await this.migrateBillDetails(bill.id_bill, result.newId, options);
        }
      } catch (error) {
        this.logger.warn(`Error migrando factura ${bill.id_bill}: ${error}`);
      }
    }

    this.logger.log(`Facturas migradas para cliente ${mysqlCustomerId}: ${migrated}/${bills.length}`);
    return { total: bills.length, migrated };
  }

  /**
   * Migra una factura para un cliente específico
   */
  private async migrateBillForCliente(
    bill: MysqlBill,
    postgresClienteId: number,
    options: MigrationOptions,
    mappings: TableMappings,
  ): Promise<{ migrated: boolean; newId: number }> {
    if (options.dryRun) {
      this.logger.debug(`[DRY RUN] Migraría factura: ${bill.correlative_bill || bill.id_bill}`);
      return { migrated: true, newId: bill.id_bill };
    }

    // Generar código de generación si no existe
    const codigoGeneracion = bill.codigo_generacion || generateUUID();

    // Verificar si ya existe
    const existing = await this.prisma.dte_emitidos.findUnique({
      where: { codigo_generacion: codigoGeneracion },
    });

    if (existing) {
      mappings.facturas.set(bill.id_bill, existing.id_dte);
      return { migrated: false, newId: existing.id_dte };
    }

    // Generar número de control
    const tipoDTE = mapTipoDTE(bill.bill_concept);
    const numeroControl = bill.correlative_bill ||
      `DTE-${tipoDTE}-00000000-${String(bill.id_bill).padStart(15, '0')}`;

    // Verificar por número de control
    const existingByControl = await this.prisma.dte_emitidos.findUnique({
      where: { numero_control: truncateString(numeroControl, 31) || 'SIN-NUMERO' },
    });

    if (existingByControl) {
      mappings.facturas.set(bill.id_bill, existingByControl.id_dte);
      return { migrated: false, newId: existingByControl.id_dte };
    }

    // Calcular montos desde detalles
    const detalles = await this.mysql.query<(MysqlBillDetail & RowDataPacket)[]>(
      'SELECT * FROM tbl_bill_details WHERE id_bill = ?',
      [bill.id_bill],
    );

    let totalGravado = 0;
    for (const det of detalles) {
      totalGravado += det.sub_total || 0;
    }

    const iva = toDecimal(totalGravado * 0.13);
    const montoTotal = toDecimal(totalGravado + iva);
    const fechaEmision = parseDate(bill.bill_date) || new Date();
    const sucursalId = await this.ensureSucursalDefault();

    const result = await this.prisma.dte_emitidos.create({
      data: {
        codigo_generacion: codigoGeneracion,
        numero_control: truncateString(numeroControl, 31) || `MIG-${bill.id_bill}`,
        tipo_dte: tipoDTE,
        version: 1,
        ambiente: '01',
        tipo_modelo: 1,
        tipo_operacion: 1,
        fecha_emision: fechaEmision,
        hora_emision: getCurrentTime(),
        tipo_moneda: 'USD',
        receptor_nombre: truncateString(cleanString(bill.name_customers), 250) || null,
        receptor_complemento: truncateString(cleanString(bill.customers_pay_address), 200) || null,
        receptor_nrc: cleanStringOrNull(bill.nrc),
        receptor_desc_actividad: truncateString(cleanString(bill.economic_activity), 250) || null,
        id_cliente: postgresClienteId,
        total_gravadas: totalGravado,
        total_exentas: 0,
        total_iva: iva,
        monto_total_operacion: montoTotal,
        saldo_favor: 0,
        total_pagar: montoTotal,
        total_letras: '',
        dte_json: JSON.stringify({ migrated: true, source: 'mysql', id_bill: bill.id_bill }),
        condicion_operacion: 1,
        id_sucursal: sucursalId,
        estado: mapEstadoFactura(bill.bill_status) as any,
        sello_recepcion: cleanStringOrNull(bill.sello_recepcion),
        fecha_recepcion: bill.sello_recepcion ? fechaEmision : null,
        id_usuario_crea: this.DEFAULT_USER_ID,
      },
    });

    mappings.facturas.set(bill.id_bill, result.id_dte);
    return { migrated: true, newId: result.id_dte };
  }

  /**
   * Obtiene preview de datos a migrar
   */
  async getPreview(): Promise<{
    facturas: number;
    detalles: number;
    facturasConDTE: number;
  }> {
    const [facturas, detalles, facturasConDTE] = await Promise.all([
      this.mysql.getCount('tbl_bill'),
      this.mysql.getCount('tbl_bill_details'),
      this.mysql.getCount('tbl_bill', 'codigo_generacion IS NOT NULL'),
    ]);

    return { facturas, detalles, facturasConDTE };
  }
}
