// src/modules/atencion-al-cliente/clientes/cliente-documentos.service.ts
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { MinioService } from 'src/modules/minio/minio.service';
import { clienteDocumentos } from '@prisma/client';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ClienteDocumentosService {
  private readonly logger = new Logger(ClienteDocumentosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
  ) {}

  async uploadDocumentos(
    id_cliente: number,
    files: {
      dui_frente?: Express.Multer.File[];
      dui_trasera?: Express.Multer.File[];
      nit_frente?: Express.Multer.File[];
      nit_trasera?: Express.Multer.File[];
      recibo?: Express.Multer.File[];
    },
    id_usuario: number,
  ): Promise<{ message: string; documentos: clienteDocumentos[] }> {
    // Verificar que el cliente exista
    const cliente = await this.prisma.cliente.findUnique({
      where: { id_cliente },
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente con ID ${id_cliente} no encontrado`);
    }

    const documentosCreados: clienteDocumentos[] = [];

    // Eliminar documentos anteriores del mismo tipo antes de crear nuevos
    const tiposDocumentos = [
      'DUI_FRENTE',
      'DUI_TRASERA',
      'NIT_FRENTE',
      'NIT_TRASERA',
      'RECIBO',
    ];

    for (const tipo of tiposDocumentos) {
      const documentosAntiguos = await this.prisma.clienteDocumentos.findMany({
        where: {
          id_cliente,
          tipo_documento: tipo,
        },
      });

      // Eliminar archivos de MinIO y registros de base de datos
      for (const doc of documentosAntiguos) {
        try {
          await this.minioService.deleteFile(doc.ruta_archivo);
        } catch (error) {
          // Continuar aunque el archivo no exista en MinIO
          this.logger.warn(
            `No se pudo eliminar archivo de MinIO: ${doc.ruta_archivo}`,
          );
        }
        await this.prisma.clienteDocumentos.delete({
          where: { id_cliente_documento: doc.id_cliente_documento },
        });
      }
    }

    // Procesar cada tipo de documento
    const fileTypes = [
      { key: 'dui_frente', tipo: 'DUI_FRENTE' },
      { key: 'dui_trasera', tipo: 'DUI_TRASERA' },
      { key: 'nit_frente', tipo: 'NIT_FRENTE' },
      { key: 'nit_trasera', tipo: 'NIT_TRASERA' },
      { key: 'recibo', tipo: 'RECIBO' },
    ];

    for (const fileType of fileTypes) {
      const fileArray = files[fileType.key];
      if (fileArray && fileArray.length > 0) {
        const file = fileArray[0];

        // Generar nombre único para el archivo en MinIO
        const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
        const ext = extname(file.originalname);
        const objectName = `cliente-${id_cliente}/${fileType.key}-${uniqueSuffix}${ext}`;

        // Subir archivo a MinIO
        const { url, etag } = await this.minioService.uploadFile(file, objectName);

        // Guardar registro en base de datos
        const documento = await this.prisma.clienteDocumentos.create({
          data: {
            id_cliente,
            tipo_documento: fileType.tipo,
            nombre_archivo: file.originalname,
            ruta_archivo: url, // Guardar el nombre del objeto en MinIO
            mimetype: file.mimetype,
            size: file.size,
          },
        });

        documentosCreados.push(documento);
      }
    }

    // Registrar en el log
    await this.prisma.logAction(
      'SUBIR_DOCUMENTOS_CLIENTE',
      id_usuario,
      `Documentos subidos para cliente ID: ${id_cliente} (${documentosCreados.length} archivos)`,
    );

    return {
      message: 'Documentos subidos exitosamente',
      documentos: documentosCreados,
    };
  }

  async getDocumentosByCliente(id_cliente: number): Promise<clienteDocumentos[]> {
    // Verificar que el cliente exista
    const cliente = await this.prisma.cliente.findUnique({
      where: { id_cliente },
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente con ID ${id_cliente} no encontrado`);
    }

    return this.prisma.clienteDocumentos.findMany({
      where: {
        id_cliente,
        estado: 'ACTIVO',
      },
      orderBy: {
        fecha_creacion: 'desc',
      },
    });
  }

  async getDocumento(id: number): Promise<clienteDocumentos> {
    const documento = await this.prisma.clienteDocumentos.findUnique({
      where: { id_cliente_documento: id },
    });

    if (!documento) {
      throw new NotFoundException(`Documento con ID ${id} no encontrado`);
    }

    return documento;
  }

  async downloadDocumento(
    id: number,
  ): Promise<{ buffer: Buffer; documento: clienteDocumentos }> {
    const documento = await this.getDocumento(id);

    // Descargar archivo desde MinIO
    const buffer = await this.minioService.getFile(documento.ruta_archivo);

    return {
      buffer,
      documento,
    };
  }

  async deleteDocumento(id: number, id_usuario: number): Promise<{ message: string }> {
    const documento = await this.getDocumento(id);

    // Eliminar el archivo de MinIO
    try {
      await this.minioService.deleteFile(documento.ruta_archivo);
    } catch (error) {
      // Continuar aunque el archivo no exista en MinIO
      this.logger.warn(
        `No se pudo eliminar archivo de MinIO: ${documento.ruta_archivo}`,
      );
    }

    // Eliminar el registro de la base de datos
    await this.prisma.clienteDocumentos.delete({
      where: { id_cliente_documento: id },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'ELIMINAR_DOCUMENTO_CLIENTE',
      id_usuario,
      `Documento eliminado: ${documento.tipo_documento} del cliente ID: ${documento.id_cliente}`,
    );

    return {
      message: 'Documento eliminado exitosamente',
    };
  }
}
