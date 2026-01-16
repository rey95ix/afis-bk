import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MysqlConnectionService } from './mysql-connection.service';
import { MinioService } from '../../minio/minio.service';
import { DuiAnalyzerService, DocumentType } from '../../openai/dui-analyzer.service';
import { RowDataPacket } from 'mysql2/promise';
import {
  MysqlContractMedia,
  MysqlCustomersContractMedia,
} from '../interfaces/mysql-tables.interface';
import {
  TableMappings,
  MigrationModuleResult,
  MigrationError,
  MigrationOptions,
} from '../interfaces/mapping.interface';
import { v4 as uuidv4 } from 'uuid';

// Mapeo de columnas MySQL a tipos de documento
type DocumentColumnKey = 'from_identification' | 'reverse_identification' | 'from_nit' | 'reverse_nit' | 'receipt' | 'signature';

const COLUMN_TO_DOCUMENT_TYPE: Record<DocumentColumnKey, DocumentType> = {
  from_identification: 'DUI_FRENTE',
  reverse_identification: 'DUI_TRASERA',
  from_nit: 'NIT_FRENTE',
  reverse_nit: 'NIT_TRASERA',
  receipt: 'RECIBO',
  signature: 'FIRMA',
};

// Magic bytes para detección de MIME type
const MIME_SIGNATURES: { bytes: number[]; mime: string; ext: string }[] = [
  { bytes: [0xFF, 0xD8, 0xFF], mime: 'image/jpeg', ext: 'jpg' },
  { bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], mime: 'image/png', ext: 'png' },
  { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], mime: 'image/gif', ext: 'gif' }, // GIF89a
  { bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], mime: 'image/gif', ext: 'gif' }, // GIF87a
  { bytes: [0x25, 0x50, 0x44, 0x46], mime: 'application/pdf', ext: 'pdf' },
  { bytes: [0x42, 0x4D], mime: 'image/bmp', ext: 'bmp' },
];
@Injectable()
export class DocumentosMigrationService {
  private readonly logger = new Logger(DocumentosMigrationService.name);

  constructor(
    private readonly mysql: MysqlConnectionService,
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
    private readonly duiAnalyzer: DuiAnalyzerService,
  ) {}

  /**
   * Ejecuta la migración completa de documentos
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
      this.logger.log('Iniciando migración de documentos...');

      // Obtener total de registros en tbl_customers_contract_media
      const totalContractMedia = await this.mysql.getCount('tbl_customers_contract_media');
      this.logger.log(`Total de registros de documentos a procesar: ${totalContractMedia}`);

      // Procesar en lotes
      const batchSize = options.batchSize;
      let offset = 0;

      while (offset < totalContractMedia) {
        this.logger.log(
          `Procesando lote ${offset} - ${offset + batchSize} de ${totalContractMedia}...`,
        );

        const contractMediaRecords = await this.mysql.queryPaginated<
          (MysqlCustomersContractMedia & RowDataPacket)[]
        >(
          'SELECT * FROM tbl_customers_contract_media ORDER BY id_customers_contract_media',
          offset,
          batchSize,
        );

        for (const record of contractMediaRecords) {
          try {
            const result = await this.migrateContractMedia(record, options, mappings);
            totalRecords += result.total;
            migratedRecords += result.migrated;
            skippedRecords += result.skipped;
            errors.push(...result.errors);
          } catch (error) {
            if (options.continueOnError) {
              errors.push({
                table: 'clienteDocumentos',
                recordId: record.id_customers_contract_media,
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
        module: 'documentos',
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
      this.logger.error('Error en migración de documentos', error);
      const completedAt = new Date();

      return {
        module: 'documentos',
        success: false,
        totalRecords,
        migratedRecords,
        skippedRecords,
        errors: [
          ...errors,
          {
            table: 'clienteDocumentos',
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
   * Migra los documentos de un registro de tbl_customers_contract_media
   */
  private async migrateContractMedia(
    record: MysqlCustomersContractMedia,
    options: MigrationOptions,
    mappings: TableMappings,
  ): Promise<{ total: number; migrated: number; skipped: number; errors: MigrationError[] }> {
    const errors: MigrationError[] = [];
    let total = 0;
    let migrated = 0;
    let skipped = 0;

    // Obtener id_cliente desde el contrato mapeado
    const idContrato = mappings.contratos.get(record.id_customers_contract);
    if (!idContrato) {
      this.logger.warn(`Contrato no encontrado: ${record.id_customers_contract}`);
      return { total: 0, migrated: 0, skipped: 0, errors: [] };
    }

    // Buscar el cliente del contrato
    const contrato = await this.prisma.atcContrato.findUnique({
      where: { id_contrato: idContrato },
      select: { id_cliente: true },
    });

    if (!contrato) {
      this.logger.warn(`Contrato no encontrado en BD: ${idContrato}`);
      return { total: 0, migrated: 0, skipped: 0, errors: [] };
    }

    const idCliente = contrato.id_cliente;

    // Procesar cada columna de media
    const columns: DocumentColumnKey[] = [
      'from_identification',
      'reverse_identification',
      'from_nit',
      'reverse_nit',
      'receipt',
      'signature',
    ];

    for (const column of columns) {
      const mediaId = record[column];
      if (!mediaId) continue;

      total++;

      try {
        const result = await this.migrateMediaFile(
          mediaId,
          idCliente,
          column,
          options,
          mappings,
        );

        if (result.migrated) {
          migrated++;
        } else {
          skipped++;
        }
      } catch (error) {
        if (options.continueOnError) {
          errors.push({
            table: 'clienteDocumentos',
            recordId: mediaId,
            field: column,
            message: error instanceof Error ? error.message : 'Error',
          });
          skipped++;
        } else {
          throw error;
        }
      }
    }

    return { total, migrated, skipped, errors };
  }

  /**
   * Migra un archivo individual de tbl_contract_media
   */
  private async migrateMediaFile(
    mediaId: number,
    idCliente: number,
    column: DocumentColumnKey,
    options: MigrationOptions,
    mappings: TableMappings,
  ): Promise<{ migrated: boolean; newId: number }> {
    // Verificar si ya fue migrado
    if (mappings.documentos.has(mediaId)) {
      return { migrated: false, newId: mappings.documentos.get(mediaId)! };
    }

    // Obtener el archivo de MySQL
    const mediaRecord = await this.mysql.queryOne<MysqlContractMedia & RowDataPacket>(
      'SELECT * FROM tbl_contract_media WHERE id_contract_media = ?',
      [mediaId],
    );

    if (!mediaRecord || !mediaRecord.media) {
      this.logger.warn(`Media no encontrada o vacía: ${mediaId}`);
      return { migrated: false, newId: 0 };
    }

    // Convertir a Buffer si viene como string base64 (MySQL2 LONGBLOB)
    const buffer: Buffer = typeof mediaRecord.media === 'string'
      ? Buffer.from(mediaRecord.media, 'base64')
      : mediaRecord.media;

    // Detectar MIME type
    const { mime } = this.detectMimeType(buffer);
    const ext = 'png'
    if (options.dryRun) {
      this.logger.debug(
        `[DRY RUN] Migraría documento: ${column} (${mediaId}) para cliente ${idCliente}, mime: ${mime}`,
      );
      return { migrated: true, newId: mediaId };
    }

    // Clasificar documento con IA (solo para imágenes)
    let tipoDocumento: DocumentType = COLUMN_TO_DOCUMENT_TYPE[column];

    if (this.isImageMime(mime)) {
      try {
        const classification = await this.duiAnalyzer.classifyDocument(buffer, mime);

        if (classification.tipo_documento !== 'DESCONOCIDO' && classification.confianza !== 'baja') {
          tipoDocumento = classification.tipo_documento;
          this.logger.log(
            `IA clasificó documento ${mediaId} como: ${tipoDocumento} (confianza: ${classification.confianza})`,
          );
        } else {
          this.logger.debug(
            `IA no pudo clasificar documento ${mediaId}, usando fallback: ${tipoDocumento}`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Error al clasificar con IA, usando fallback ${tipoDocumento}: ${error}`,
        );
      }
    }

    // Generar nombre del objeto en MinIO
    const objectName = this.generateObjectName(idCliente, tipoDocumento, ext);

    // Subir a MinIO
    const { url } = await this.minioService.uploadBuffer(buffer, objectName, mime);

    // Crear registro en PostgreSQL
    const documento = await this.prisma.clienteDocumentos.create({
      data: {
        id_cliente: idCliente,
        tipo_documento: tipoDocumento,
        nombre_archivo: objectName,
        ruta_archivo: url,
        mimetype: mime,
        size: buffer.length,
        estado: 'ACTIVO',
      },
    });

    mappings.documentos.set(mediaId, documento.id_cliente_documento);

    this.logger.log(
      `Documento migrado: ${mediaId} → ${documento.id_cliente_documento} (${tipoDocumento})`,
    );

    return { migrated: true, newId: documento.id_cliente_documento };
  }

  /**
   * Detecta el MIME type basándose en los magic bytes del archivo
   * Soporta tanto Buffer nativo como string base64 (MySQL2 LONGBLOB)
   */
  private detectMimeType(data: Buffer | string): { mime: string; ext: string } {
    // Convertir a Buffer si viene como string base64 (MySQL2 retorna LONGBLOB como base64)
    let buffer: Buffer;
    if (typeof data === 'string') {
      buffer = Buffer.from(data, 'base64');
    } else if (Buffer.isBuffer(data)) {
      buffer = data;
    } else {
      this.logger.warn('detectMimeType recibió tipo de dato inesperado:', typeof data);
      return { mime: 'application/octet-stream', ext: 'bin' };
    }

    for (const sig of MIME_SIGNATURES) {
      const match = sig.bytes.every((byte, index) => buffer[index] === byte);
      if (match) {
        return { mime: sig.mime, ext: sig.ext };
      }
    }

    return { mime: 'application/octet-stream', ext: 'bin' };
  }

  /**
   * Verifica si el MIME type es una imagen
   */
  private isImageMime(mime: string): boolean {
    return mime.startsWith('image/');
  }

  /**
   * Genera el nombre del objeto para MinIO
   * Formato: clientes/{id_cliente}/{tipo}-{uuid}.{ext}
   */
  private generateObjectName(idCliente: number, tipoDoc: string, ext: string): string {
    const uuid = uuidv4();
    return `clientes/${idCliente}/documentos/${tipoDoc}-${uuid}.${ext}`;
  }

  /**
   * Migra documentos de contratos específicos (para migración individual)
   */
  async migrateByContractIds(
    mysqlContractIds: number[],
    postgresClienteId: number,
    options: MigrationOptions,
    mappings: TableMappings,
  ): Promise<{ total: number; migrated: number }> {
    let total = 0;
    let migrated = 0;

    if (mysqlContractIds.length === 0) {
      return { total: 0, migrated: 0 };
    }

    this.logger.log(`Migrando documentos de ${mysqlContractIds.length} contratos...`);

    // Buscar registros de media para estos contratos
    const placeholders = mysqlContractIds.map(() => '?').join(',');
    const contractMediaRecords = await this.mysql.query<
      (MysqlCustomersContractMedia & RowDataPacket)[]
    >(
      `SELECT * FROM tbl_customers_contract_media WHERE id_customers_contract IN (${placeholders})`,
      mysqlContractIds,
    );

    for (const record of contractMediaRecords) {
      const columns: DocumentColumnKey[] = [
        'from_identification',
        'reverse_identification',
        'from_nit',
        'reverse_nit',
        'receipt',
        'signature',
      ];

      for (const column of columns) {
        const mediaId = record[column];
        if (!mediaId) continue;

        total++;

        try {
          // Verificar si ya fue migrado
          if (mappings.documentos.has(mediaId)) {
            continue;
          }

          // Obtener el archivo de MySQL
          const mediaRecord = await this.mysql.queryOne<any>(
            'SELECT * FROM tbl_contract_media WHERE id_contract_media = ?',
            [mediaId],
          );

          if (!mediaRecord || !mediaRecord.media) {
            continue;
          }

          // Decodificar base64 a Buffer de imagen
          const buffer: Buffer = Buffer.from(mediaRecord.media.toString(), 'base64');
          const { mime, ext } = this.detectMimeType(buffer);

          if (options.dryRun) {
            this.logger.debug(`[DRY RUN] Migraría documento: ${column} (${mediaId})`);
            migrated++;
            continue;
          }

          // Clasificar documento con IA (solo para imágenes)
          let tipoDocumento: DocumentType = COLUMN_TO_DOCUMENT_TYPE[column];

          if (this.isImageMime(mime)) {
            try {
              const classification = await this.duiAnalyzer.classifyDocument(buffer, mime);
              if (classification.tipo_documento !== 'DESCONOCIDO' && classification.confianza !== 'baja') {
                tipoDocumento = classification.tipo_documento;
              }
            } catch (error) {
              // Usar fallback
            }
          }

          // Generar nombre del objeto en MinIO
          const objectName = this.generateObjectName(postgresClienteId, tipoDocumento, ext);

          // Subir a MinIO
          const { url } = await this.minioService.uploadBuffer(buffer, objectName, mime);

          // Crear registro en PostgreSQL
          const documento = await this.prisma.clienteDocumentos.create({
            data: {
              id_cliente: postgresClienteId,
              tipo_documento: tipoDocumento,
              nombre_archivo: objectName,
              ruta_archivo: url,
              mimetype: mime,
              size: buffer.length,
              estado: 'ACTIVO',
            },
          });

          mappings.documentos.set(mediaId, documento.id_cliente_documento);
          migrated++;
        } catch (error) {
          this.logger.warn(`Error migrando documento ${mediaId}: ${error}`);
        }
      }
    }

    this.logger.log(`Documentos migrados: ${migrated}/${total}`);
    return { total, migrated };
  }

  /**
   * Obtiene preview de datos a migrar
   */
  async getPreview(): Promise<{
    registrosContractMedia: number;
    archivosMedia: number;
    archivosPorTipo: Record<string, number>;
  }> {
    const registrosContractMedia = await this.mysql.getCount('tbl_customers_contract_media');
    const archivosMedia = await this.mysql.getCount('tbl_contract_media');

    // Contar archivos por tipo de columna
    const result = await this.mysql.query<RowDataPacket[]>(`
      SELECT
        SUM(CASE WHEN from_identification IS NOT NULL THEN 1 ELSE 0 END) as dui_frente,
        SUM(CASE WHEN reverse_identification IS NOT NULL THEN 1 ELSE 0 END) as dui_trasera,
        SUM(CASE WHEN from_nit IS NOT NULL THEN 1 ELSE 0 END) as nit_frente,
        SUM(CASE WHEN reverse_nit IS NOT NULL THEN 1 ELSE 0 END) as nit_trasera,
        SUM(CASE WHEN receipt IS NOT NULL THEN 1 ELSE 0 END) as recibo,
        SUM(CASE WHEN signature IS NOT NULL THEN 1 ELSE 0 END) as firma
      FROM tbl_customers_contract_media
    `);

    const row = result[0] || {};
    const archivosPorTipo: Record<string, number> = {
      DUI_FRENTE: Number(row.dui_frente) || 0,
      DUI_TRASERA: Number(row.dui_trasera) || 0,
      NIT_FRENTE: Number(row.nit_frente) || 0,
      NIT_TRASERA: Number(row.nit_trasera) || 0,
      RECIBO: Number(row.recibo) || 0,
      FIRMA: Number(row.firma) || 0,
    };

    return { registrosContractMedia, archivosMedia, archivosPorTipo };
  }
}
