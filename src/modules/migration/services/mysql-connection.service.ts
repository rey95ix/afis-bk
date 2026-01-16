import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mysql from 'mysql2/promise';
import { Pool, RowDataPacket } from 'mysql2/promise';
import { MysqlConnectionConfig } from '../interfaces/mapping.interface';

@Injectable()
export class MysqlConnectionService implements OnModuleDestroy {
  private readonly logger = new Logger(MysqlConnectionService.name);
  private pool: Pool | null = null;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Obtiene la configuración de conexión MySQL desde variables de entorno
   */
  private getConfig(): MysqlConnectionConfig {
    return {
      host: this.configService.get<string>('MYSQL_LEGACY_HOST', 'localhost'),
      port: this.configService.get<number>('MYSQL_LEGACY_PORT', 3306),
      user: this.configService.get<string>('MYSQL_LEGACY_USER', 'root'),
      password: this.configService.get<string>('MYSQL_LEGACY_PASSWORD', ''),
      database: this.configService.get<string>('MYSQL_LEGACY_DATABASE', ''),
    };
  }

  /**
   * Obtiene o crea el pool de conexiones
   */
  async getPool(): Promise<Pool> {
    if (!this.pool) {
      const config = this.getConfig();

      this.logger.log(
        `Conectando a MySQL: ${config.host}:${config.port}/${config.database}`,
      );

      this.pool = mysql.createPool({
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

      this.logger.log('Pool de conexiones MySQL creado');
    }

    return this.pool;
  }

  /**
   * Ejecuta una consulta SQL y retorna los resultados
   */
  async query<T extends RowDataPacket[]>(
    sql: string,
    params?: unknown[],
  ): Promise<T> {
    const pool = await this.getPool();
    const [rows] = await pool.query<T>(sql, params);
    return rows;
  }

  /**
   * Ejecuta una consulta y retorna el primer resultado
   */
  async queryOne<T extends RowDataPacket>(
    sql: string,
    params?: unknown[],
  ): Promise<T | null> {
    const results = await this.query<T[]>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Ejecuta una consulta paginada
   */
  async queryPaginated<T extends RowDataPacket[]>(
    sql: string,
    offset: number,
    limit: number,
    params?: unknown[],
  ): Promise<T> {
    const paginatedSql = `${sql} LIMIT ? OFFSET ?`;
    const paginatedParams = [...(params || []), limit, offset];
    return this.query<T>(paginatedSql, paginatedParams);
  }

  /**
   * Obtiene el conteo de registros de una tabla
   */
  async getCount(tableName: string, whereClause?: string): Promise<number> {
    let sql = `SELECT COUNT(*) as count FROM ${tableName}`;
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }

    const result = await this.queryOne<RowDataPacket & { count: number }>(sql);
    return result?.count || 0;
  }

  /**
   * Valida la conexión a MySQL
   */
  async validateConnection(): Promise<{
    connected: boolean;
    version?: string;
    database?: string;
    error?: string;
  }> {
    try {
      const pool = await this.getPool();
      const [rows] = await pool.query('SELECT VERSION() as version');
      const version = (rows as RowDataPacket[])[0]?.version;

      const config = this.getConfig();

      return {
        connected: true,
        version,
        database: config.database,
      };
    } catch (error) {
      this.logger.error('Error validando conexión MySQL', error);
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  /**
   * Obtiene información sobre las tablas principales
   */
  async getTablesCounts(): Promise<{ table: string; count: number }[]> {
    const tables = [
      'tbl_customers',
      'tbl_customers_location',
      'tbl_customers_contract',
      'tbl_customers_plan',
      'tbl_bill',
      'tbl_bill_details',
      'tbl_parameters_departament',
      'tbl_parameters_municipality',
      'tbl_parameters_city',
    ];

    const results: { table: string; count: number }[] = [];

    for (const table of tables) {
      try {
        const count = await this.getCount(table);
        results.push({ table, count });
      } catch (error) {
        this.logger.warn(`No se pudo contar tabla ${table}: ${error}`);
        results.push({ table, count: -1 });
      }
    }

    return results;
  }

  /**
   * Cierra el pool de conexiones al destruir el módulo
   */
  async onModuleDestroy() {
    if (this.pool) {
      this.logger.log('Cerrando pool de conexiones MySQL');
      await this.pool.end();
      this.pool = null;
    }
  }

  /**
   * Cierra el pool manualmente
   */
  async closePool(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.logger.log('Pool de conexiones MySQL cerrado manualmente');
    }
  }
}
