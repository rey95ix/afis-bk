import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MysqlConnectionService } from './mysql-connection.service';
import { cliente } from '@prisma/client';

export interface ImportResult {
  tableName: string;
  totalRecords: number;
  importedRecords: number;
  failedRecords: number;
  errors: Array<{ record: number; error: string }>;
}

export interface DatabaseInfo {
  tables: Array<{
    name: string;
    columns: Array<{
      columnName: string;
      dataType: string;
      isNullable: string;
      columnKey: string;
    }>;
    recordCount: number;
  }>;
}

@Injectable()
export class ImportDataService {
  private readonly logger = new Logger(ImportDataService.name);

  constructor(
    private readonly mysqlService: MysqlConnectionService,
    private readonly prismaService: PrismaService,
  ) { }

  /**
   * Conecta a la base de datos MySQL
   */ 
  async connectToMysql( ): Promise<{ success: boolean; message: string }> {
    try {
      await this.mysqlService.initializeConnection({
        host: 'localhost',
        port: 3306,
        user: 'cas_user',
        password: 'G6Q75EQN',
        database: 'AFIS_DB',
      });
      return {
        success: true,
        message: 'Conexión exitosa a MySQL',
      };
    } catch (error) {
      this.logger.error('Error al conectar a MySQL:', error);
      return {
        success: false,
        message: `Error: ${error.message}`,
      };
    }
  }

  /**
   * Obtiene información de la base de datos MySQL
   */
  async getDatabaseInfo(): Promise<DatabaseInfo> {
    try {
      const tables = await this.mysqlService.getTables();
      const databaseInfo: DatabaseInfo = { tables: [] };

      for (const tableName of tables) {
        const columns = await this.mysqlService.getTableColumns(tableName);
        const data = await this.mysqlService.getTableData(tableName, 1);
        const recordCount = await this.getTableRecordCount(tableName);

        databaseInfo.tables.push({
          name: tableName,
          columns,
          recordCount,
        });
      }

      return databaseInfo;
    } catch (error) {
      this.logger.error('Error al obtener información de la base de datos:', error);
      throw error;
    }
  }

  /**
   * Obtiene el conteo de registros de una tabla
   */
  private async getTableRecordCount(tableName: string): Promise<number> {
    const result = await this.mysqlService.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${tableName}`,
    );
    return Number(result[0].count);
  }

  /**
   * Importa datos de una tabla MySQL a PostgreSQL
   * Esta es una función genérica que necesitará ser personalizada
   * según la estructura específica de las tablas
   */
  async importTable( 
  ): Promise<ImportResult> {
    const tableName = "tbl_customers";
    const result: ImportResult = {
      tableName,
      totalRecords: 0,
      importedRecords: 0,
      failedRecords: 0,
      errors: [],
    };

    try {
      // Obtener todos los datos de la tabla MySQL
      console.log("Iniciando importación de tabla:");
      const data = await this.mysqlService.getTableData("tbl_customers");
      result.totalRecords = data.length;
      console.log("Iniciando importación de tabla:", tableName, "Registros encontrados:", result.totalRecords);

      this.logger.log(
        `Iniciando importación de ${result.totalRecords} registros de ${tableName}`,
      );

      // Importar cada registro
      for (let i = 0; i < data.length; i++) {
        try {
          const record = data[i];       
          const references = await this.mysqlService.getTableDataRaw("select * from tbl_customers_references where id_customers = " + record.id_customers); 
          const cliente: any = {
            id_cliente: record.id_customers,
            id_usuario: 1,
            titular: record.name,
            fecha_nacimiento: record.birth_date,
            dui: record.dui,
            nit: record.nit,
            empresa_trabajo: record.company_job ?? '',
            correo_electronico: record.mail,
            telefono1: record.phone,
            telefono2: record.cellphone,
            referencia1: references[0]?.name ?? '',
            referencia1_telefono: references[0]?.phone_job ?? references[0]?.cellphone ?? '',
            referencia2: references[1]?.name ?? '',
            referencia2_telefono: references[1]?.phone_job ?? references[1]?.cellphone ?? '',
          }
          await this.prismaService.cliente.create({ data: cliente });


        } catch (error) {
          result.failedRecords++;
          result.errors.push({
            record: i + 1,
            error: error.message,
          });
          this.logger.error(`Error al importar registro ${i + 1}:`, error);
        }
      }

      return result;
    } catch (error) {
      this.logger.error('Error durante la importación:', error);
      throw error;
    }
  }

  /**
   * Aplica mapeo de campos
   */
  private applyFieldMapping(
    record: any,
    mapping: Record<string, string>,
  ): any {
    const mappedRecord: any = {};

    for (const [sourceField, targetField] of Object.entries(mapping)) {
      if (record.hasOwnProperty(sourceField)) {
        mappedRecord[targetField] = record[sourceField];
      }
    }

    return mappedRecord;
  }

  /**
   * Importa un registro individual
   * NOTA: Esta función debe ser personalizada según tu modelo Prisma
   */
  private async importRecord(
    targetModel: string,
    record: any,
    _userId: number,
  ): Promise<any> {
    // Esta es una implementación genérica
    // Necesitarás personalizarla según tus modelos específicos

    // Ejemplo: Si targetModel es 'producto', usarías:
    // return await this.prismaService.producto.create({ data: record });

    this.logger.warn(
      `importRecord debe ser personalizado para el modelo: ${targetModel}`,
    );

    // Por ahora, retorna el registro sin importar
    return record;
  }

  /**
   * Obtiene una vista previa de los datos de una tabla
   */
  async previewTableData(
    tableName: string,
    limit: number = 10,
  ): Promise<any[]> {
    return await this.mysqlService.getTableData(tableName, limit);
  }

  /**
   * Verifica el estado de la conexión MySQL
   */
  async checkConnection(): Promise<{
    connected: boolean;
    message: string;
  }> {
    const isConnected = await this.mysqlService.isConnected();
    return {
      connected: isConnected,
      message: isConnected
        ? 'Conexión MySQL activa'
        : 'No hay conexión MySQL activa',
    };
  }
}
