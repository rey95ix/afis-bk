import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createPool, Pool, PoolConnection } from 'mysql2/promise';

@Injectable()
export class MysqlConnectionService implements OnModuleDestroy {
  private readonly logger = new Logger(MysqlConnectionService.name);
  private pool: Pool;

  /**
   * Inicializa la conexión al pool de MySQL
   * @param config Configuración de conexión MySQL
   */
  async initializeConnection(config: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  }): Promise<void> {
    try {
      this.pool = createPool({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
      });

      // Verificar la conexión
      const connection = await this.pool.getConnection();
      this.logger.log(
        `Conexión a MySQL establecida: ${config.host}:${config.port}/${config.database}`,
      );
      connection.release();
    } catch (error) {
      this.logger.error('Error al conectar con MySQL:', error);
      throw error;
    }
  }

  /**
   * Obtiene una conexión del pool
   */
  async getConnection(): Promise<PoolConnection> {
    if (!this.pool) {
      throw new Error(
        'Pool de conexiones no inicializado. Llame a initializeConnection() primero.',
      );
    }
    return await this.pool.getConnection();
  }

  /**
   * Ejecuta una consulta SQL en MySQL
   * @param query Consulta SQL
   * @param params Parámetros de la consulta
   */
  async query<T = any>(query: string, params?: any[]): Promise<T[]> {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(query, params);
      return rows as T[];
    } finally {
      connection.release();
    }
  }

  /**
   * Obtiene todas las tablas de la base de datos MySQL
   */
  async getTables(): Promise<string[]> {
    const rows = await this.query<{ TABLE_NAME: string }>(
      'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()',
    );
    return rows.map((row) => row.TABLE_NAME);
  }

  /**
   * Obtiene las columnas de una tabla
   * @param tableName Nombre de la tabla
   */
  async getTableColumns(tableName: string): Promise<
    Array<{
      columnName: string;
      dataType: string;
      isNullable: string;
      columnKey: string;
    }>
  > {
    const rows = await this.query<{
      COLUMN_NAME: string;
      DATA_TYPE: string;
      IS_NULLABLE: string;
      COLUMN_KEY: string;
    }>(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [tableName],
    );

    return rows.map((row) => ({
      columnName: row.COLUMN_NAME,
      dataType: row.DATA_TYPE,
      isNullable: row.IS_NULLABLE,
      columnKey: row.COLUMN_KEY,
    }));
  }

  /**
   * Obtiene datos de una tabla específica
   * @param tableName Nombre de la tabla
   * @param limit Límite de registros
   */
  async getTableData(tableName: string, limit?: number): Promise<any[]> {
    const query = limit
      ? `SELECT * FROM ${tableName} LIMIT ${limit}`
      : `SELECT * FROM ${tableName}`;
    return await this.query(query);
  }

  async getTableDataRaw(sql: string): Promise<any[]> {
    const query = sql;
    return await this.query(query);
  }

  /**
   * Verifica si la conexión está activa
   */
  async isConnected(): Promise<boolean> {
    try {
      if (!this.pool) return false;
      const connection = await this.pool.getConnection();
      connection.release();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Cierra la conexión al destruir el módulo
   */
  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
      this.logger.log('Pool de conexiones MySQL cerrado');
    }
  }
}
