// src/modules/minio/minio.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as Minio from 'minio';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private minioClient: Minio.Client;
  private bucketName = 'clientes-documentos';

  constructor(private configService: ConfigService) {
    this.minioClient = new Minio.Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT') || 'localhost',
      port: parseInt(this.configService.get<string>('MINIO_PORT') || '9000'),
      useSSL: this.configService.get<string>('MINIO_USE_SSL') === 'true',
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY') || 'minioadmin',
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY') || 'minioadmin',
    });
  }

  async onModuleInit() {
    try {
      // Verificar si el bucket existe, si no, crearlo
      const bucketExists = await this.minioClient.bucketExists(this.bucketName);

      if (!bucketExists) {
        await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
        this.logger.log(`Bucket "${this.bucketName}" creado exitosamente`);

        // Establecer política de bucket para permitir lectura pública (opcional)
        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.bucketName}/*`],
            },
          ],
        };

        await this.minioClient.setBucketPolicy(
          this.bucketName,
          JSON.stringify(policy),
        );
        this.logger.log(`Política de bucket configurada para "${this.bucketName}"`);
      } else {
        this.logger.log(`Bucket "${this.bucketName}" ya existe`);
      }
    } catch (error) {
      this.logger.error(`Error al inicializar MinIO: ${error.message}`);
    }
  }

  /**
   * Subir un archivo a MinIO
   */
  async uploadFile(
    file: Express.Multer.File,
    objectName: string,
  ): Promise<{ url: string; etag: string }> {
    try {
      const metaData = {
        'Content-Type': file.mimetype,
        'X-Original-Name': Buffer.from(file.originalname).toString('base64'),
      };

      const result = await this.minioClient.putObject(
        this.bucketName,
        objectName,
        file.buffer,
        file.size,
        metaData,
      );

      const url = await this.getFileUrl(objectName);

      return {
        url,
        etag: result.etag,
      };
    } catch (error) {
      this.logger.error(`Error al subir archivo: ${error.message}`);
      throw error;
    }
  }

  /**
   * Subir un buffer directamente a MinIO
   */
  async uploadBuffer(
    buffer: Buffer,
    objectName: string,
    mimeType: string,
  ): Promise<{ url: string; etag: string }> {
    try {
      const metaData = {
        'Content-Type': mimeType,
      };

      const result = await this.minioClient.putObject(
        this.bucketName,
        objectName,
        buffer,
        buffer.length,
        metaData,
      );

      const url = await this.getFileUrl(objectName);

      return {
        url,
        etag: result.etag,
      };
    } catch (error) {
      this.logger.error(`Error al subir buffer: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtener URL del archivo
   */
  async getFileUrl(objectName: string): Promise<string> {
    try {
      // Generar URL firmada con 7 días de expiración
      const url = await this.minioClient.presignedGetObject(
        this.bucketName,
        objectName,
        7 * 24 * 60 * 60, // 7 días
      );
      return url;
    } catch (error) {
      this.logger.error(`Error al obtener URL: ${error.message}`);
      throw error;
    }
  }

  /**
   * Descargar un archivo
   */
  async getFile(objectName: string): Promise<Buffer> {
    try {
      const chunks: Buffer[] = [];
      const stream = await this.minioClient.getObject(this.bucketName, objectName);

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', (error) => reject(error));
      });
    } catch (error) {
      this.logger.error(`Error al descargar archivo: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extraer el nombre del objeto de una URL firmada de MinIO
   * Si ya es un nombre de objeto (no URL), lo retorna tal cual
   */
  private extractObjectNameFromUrl(urlOrObjectName: string): string {
    // Si no empieza con http, asumir que ya es un nombre de objeto
    if (!urlOrObjectName.startsWith('http')) {
      return urlOrObjectName;
    }

    try {
      const url = new URL(urlOrObjectName);
      // La ruta tiene formato: /bucket-name/object-name
      // Removemos el primer / y el nombre del bucket
      const pathParts = url.pathname.split('/');
      // pathParts[0] es vacío, pathParts[1] es el bucket, el resto es el object name
      if (pathParts.length >= 3) {
        return pathParts.slice(2).join('/');
      }
      return urlOrObjectName;
    } catch {
      // Si falla el parseo, retornar como está
      return urlOrObjectName;
    }
  }

  /**
   * Eliminar un archivo
   * Acepta tanto el nombre del objeto como una URL completa de MinIO
   */
  async deleteFile(objectNameOrUrl: string): Promise<void> {
    try {
      const objectName = this.extractObjectNameFromUrl(objectNameOrUrl);
      await this.minioClient.removeObject(this.bucketName, objectName);
      this.logger.log(`Archivo eliminado: ${objectName}`);
    } catch (error) {
      this.logger.error(`Error al eliminar archivo: ${error.message}`);
      throw error;
    }
  }

  /**
   * Listar archivos por prefijo
   */
  async listFiles(prefix: string): Promise<string[]> {
    try {
      const objectsList: string[] = [];
      const stream = this.minioClient.listObjects(this.bucketName, prefix, true);

      return new Promise((resolve, reject) => {
        stream.on('data', (obj) => {
          if (obj.name) {
            objectsList.push(obj.name);
          }
        });
        stream.on('end', () => resolve(objectsList));
        stream.on('error', (error) => reject(error));
      });
    } catch (error) {
      this.logger.error(`Error al listar archivos: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verificar si un archivo existe
   */
  async fileExists(objectName: string): Promise<boolean> {
    try {
      await this.minioClient.statObject(this.bucketName, objectName);
      return true;
    } catch (error) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Obtener metadata de un archivo
   */
  async getFileMetadata(objectName: string): Promise<Minio.BucketItemStat> {
    try {
      return await this.minioClient.statObject(this.bucketName, objectName);
    } catch (error) {
      this.logger.error(`Error al obtener metadata: ${error.message}`);
      throw error;
    }
  }
}
