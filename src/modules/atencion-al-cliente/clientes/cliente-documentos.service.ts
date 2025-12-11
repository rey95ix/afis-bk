// src/modules/atencion-al-cliente/clientes/cliente-documentos.service.ts
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { MinioService } from 'src/modules/minio/minio.service';
import {
  DuiAnalyzerService,
  DuiValidationResult,
  ReciboExtractionResult,
} from 'src/modules/openai/dui-analyzer.service';
import { ClientesService } from './clientes.service';
import { clienteDocumentos } from '@prisma/client';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface ClienteDuplicado {
  id_cliente: number;
  titular: string;
  dui: string;
  coincidencia: 'NUMERO_CONTRATO' | 'DIRECCION' | 'AMBOS';
}

export interface ValidacionRecibo {
  numero_contrato: string | null;
  direccion: string | null;
  tipo_servicio: 'ENERGIA' | 'AGUA' | 'DESCONOCIDO';
  confianza: 'alta' | 'media' | 'baja';
  clientes_duplicados: ClienteDuplicado[];
  tiene_duplicados: boolean;
  mensaje: string;
}

export interface UploadDocumentosResult {
  message: string;
  documentos: clienteDocumentos[];
  validacion_dui?: {
    validado: boolean;
    dui_extraido: string | null;
    dui_esperado: string;
    confianza: 'alta' | 'media' | 'baja';
    mensaje: string;
    estado_validacion: string;
  };
  validacion_recibo?: ValidacionRecibo;
}

@Injectable()
export class ClienteDocumentosService {
  private readonly logger = new Logger(ClienteDocumentosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
    private readonly duiAnalyzerService: DuiAnalyzerService,
    private readonly clientesService: ClientesService,
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
  ): Promise<UploadDocumentosResult> {
    // Verificar que el cliente exista y obtener su DUI
    const cliente = await this.prisma.cliente.findUnique({
      where: { id_cliente },
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente con ID ${id_cliente} no encontrado`);
    }

    const documentosCreados: clienteDocumentos[] = [];
    let validacionDui: DuiValidationResult | null = null;
    let validacionRecibo: ValidacionRecibo | null = null;

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
        const { url } = await this.minioService.uploadFile(file, objectName);

        // Variables para validación IA
        let validacionIaEstado: string | null = null;
        let duiExtraidoIa: string | null = null;
        let numeroContratoExtraido: string | null = null;
        let direccionExtraida: string | null = null;
        let tipoServicioRecibo: string | null = null;

        // Si es DUI_FRENTE, realizar validación con IA
        if (fileType.key === 'dui_frente') {
          this.logger.log(`Iniciando validación de DUI con IA para cliente ${id_cliente}...`);

          try {
            validacionDui = await this.duiAnalyzerService.validarDuiConImagen(
              file.buffer,
              cliente.dui,
              file.mimetype,
            );

            validacionIaEstado = validacionDui.estado_validacion;
            duiExtraidoIa = validacionDui.dui_extraido;

            if (validacionDui.coincide) {
              this.logger.log(`Validación exitosa: DUI coincide para cliente ${id_cliente}`);
            } else {
              this.logger.warn(
                `Validación fallida para cliente ${id_cliente}: ${validacionDui.mensaje}`,
              );
            }
          } catch (error) {
            this.logger.error(`Error en validación IA de DUI: ${error.message}`);
            validacionIaEstado = 'ERROR_IA';
            validacionDui = {
              coincide: false,
              dui_extraido: null,
              dui_esperado: cliente.dui,
              confianza: 'baja',
              mensaje: `Error en el servicio de validación: ${error.message}`,
              estado_validacion: 'ERROR_IA',
            };
          }
        }

        // Si es RECIBO, realizar análisis y búsqueda de duplicados
        if (fileType.key === 'recibo') {
          this.logger.log(`Iniciando análisis de recibo con IA para cliente ${id_cliente}...`);

          try {
            const datosRecibo = await this.duiAnalyzerService.extractReciboData(
              file.buffer,
              file.mimetype,
            );

            numeroContratoExtraido = datosRecibo.numero_contrato;
            direccionExtraida = datosRecibo.direccion;
            tipoServicioRecibo = datosRecibo.tipo_servicio;

            // Buscar clientes duplicados
            const clientesDuplicados: ClienteDuplicado[] = [];

            // Buscar por número de contrato
            if (datosRecibo.numero_contrato) {
              const duplicadosPorNC = await this.clientesService.buscarClientesPorNumeroContrato(
                datosRecibo.numero_contrato,
                id_cliente,
              );

              duplicadosPorNC.forEach((dup) => {
                clientesDuplicados.push({
                  ...dup,
                  coincidencia: 'NUMERO_CONTRATO',
                });
              });
            }

            // Buscar por dirección similar
            if (datosRecibo.direccion) {
              const duplicadosPorDir = await this.clientesService.buscarClientesPorDireccionSimilar(
                datosRecibo.direccion,
                id_cliente,
              );

              duplicadosPorDir.forEach((dup) => {
                // Verificar si ya existe por NC
                const existente = clientesDuplicados.find((d) => d.id_cliente === dup.id_cliente);
                if (existente) {
                  existente.coincidencia = 'AMBOS';
                } else {
                  clientesDuplicados.push({
                    id_cliente: dup.id_cliente,
                    titular: dup.titular,
                    dui: dup.dui,
                    coincidencia: 'DIRECCION',
                  });
                }
              });
            }

            // Construir resultado de validación de recibo
            validacionRecibo = {
              numero_contrato: datosRecibo.numero_contrato,
              direccion: datosRecibo.direccion,
              tipo_servicio: datosRecibo.tipo_servicio,
              confianza: datosRecibo.confianza,
              clientes_duplicados: clientesDuplicados,
              tiene_duplicados: clientesDuplicados.length > 0,
              mensaje: this.construirMensajeRecibo(datosRecibo, clientesDuplicados),
            };

            if (clientesDuplicados.length > 0) {
              this.logger.warn(
                `Se encontraron ${clientesDuplicados.length} posibles duplicados para cliente ${id_cliente}`,
              );
            }
          } catch (error) {
            this.logger.error(`Error en análisis de recibo: ${error.message}`);
            validacionRecibo = {
              numero_contrato: null,
              direccion: null,
              tipo_servicio: 'DESCONOCIDO',
              confianza: 'baja',
              clientes_duplicados: [],
              tiene_duplicados: false,
              mensaje: `Error en el análisis del recibo: ${error.message}`,
            };
          }
        }

        // Guardar registro en base de datos con campos de validación IA
        const documento = await this.prisma.clienteDocumentos.create({
          data: {
            id_cliente,
            tipo_documento: fileType.tipo,
            nombre_archivo: file.originalname,
            ruta_archivo: url,
            mimetype: file.mimetype,
            size: file.size,
            validacion_ia: validacionIaEstado,
            dui_extraido_ia: duiExtraidoIa,
            numero_contrato_extraido: numeroContratoExtraido,
            direccion_extraida: direccionExtraida,
            tipo_servicio_recibo: tipoServicioRecibo,
          },
        });

        documentosCreados.push(documento);
      }
    }

    // Construir mensaje general
    const mensaje = this.construirMensajeGeneral(validacionDui, validacionRecibo);

    // Registrar en el log
    const logDetails: string[] = [];
    if (validacionDui) {
      logDetails.push(`DUI: ${validacionDui.estado_validacion}`);
    }
    if (validacionRecibo) {
      logDetails.push(`Recibo: NC=${validacionRecibo.numero_contrato || 'N/A'}`);
      if (validacionRecibo.tiene_duplicados) {
        logDetails.push(`Duplicados: ${validacionRecibo.clientes_duplicados.length}`);
      }
    }

    await this.prisma.logAction(
      'SUBIR_DOCUMENTOS_CLIENTE',
      id_usuario,
      `Documentos subidos para cliente ID: ${id_cliente} (${documentosCreados.length} archivos). ${logDetails.join(', ')}`,
    );

    // Construir respuesta
    const result: UploadDocumentosResult = {
      message: mensaje,
      documentos: documentosCreados,
    };

    if (validacionDui) {
      result.validacion_dui = {
        validado: validacionDui.coincide,
        dui_extraido: validacionDui.dui_extraido,
        dui_esperado: validacionDui.dui_esperado,
        confianza: validacionDui.confianza,
        mensaje: validacionDui.mensaje,
        estado_validacion: validacionDui.estado_validacion,
      };
    }

    if (validacionRecibo) {
      result.validacion_recibo = validacionRecibo;
    }

    return result;
  }

  /**
   * Construye el mensaje de validación del recibo
   */
  private construirMensajeRecibo(
    datosRecibo: ReciboExtractionResult,
    duplicados: ClienteDuplicado[],
  ): string {
    const partes: string[] = [];

    if (datosRecibo.numero_contrato) {
      partes.push(`NC: ${datosRecibo.numero_contrato}`);
    }
    if (datosRecibo.direccion) {
      const dirCorta = datosRecibo.direccion.length > 50
        ? datosRecibo.direccion.substring(0, 50) + '...'
        : datosRecibo.direccion;
      partes.push(`Dirección: ${dirCorta}`);
    }

    if (duplicados.length > 0) {
      partes.push(`ALERTA: ${duplicados.length} cliente(s) con datos similares encontrado(s)`);
    }

    return partes.length > 0 ? partes.join('. ') : 'Recibo procesado';
  }

  /**
   * Construye el mensaje general de la respuesta
   */
  private construirMensajeGeneral(
    validacionDui: DuiValidationResult | null,
    validacionRecibo: ValidacionRecibo | null,
  ): string {
    const alertas: string[] = [];

    // Alertas de DUI
    if (validacionDui) {
      if (validacionDui.estado_validacion === 'NO_COINCIDE') {
        alertas.push('El DUI de la imagen no coincide con el registrado');
      } else if (validacionDui.estado_validacion === 'NO_DETECTADO') {
        alertas.push('No se pudo detectar el DUI en la imagen');
      }
    }

    // Alertas de Recibo
    if (validacionRecibo?.tiene_duplicados) {
      alertas.push(`Se encontraron ${validacionRecibo.clientes_duplicados.length} cliente(s) con datos similares`);
    }

    if (alertas.length === 0) {
      if (validacionDui?.coincide) {
        return 'Documentos subidos exitosamente. Validación de DUI correcta.';
      }
      return 'Documentos subidos exitosamente.';
    }

    return `Documentos subidos. ADVERTENCIA: ${alertas.join('. ')}. Requiere revisión.`;
  }

  async getDocumentosByCliente(id_cliente: number): Promise<clienteDocumentos[]> {
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
    const buffer = await this.minioService.getFile(documento.ruta_archivo);

    return {
      buffer,
      documento,
    };
  }

  async deleteDocumento(id: number, id_usuario: number): Promise<{ message: string }> {
    const documento = await this.getDocumento(id);

    try {
      await this.minioService.deleteFile(documento.ruta_archivo);
    } catch (error) {
      this.logger.warn(
        `No se pudo eliminar archivo de MinIO: ${documento.ruta_archivo}`,
      );
    }

    await this.prisma.clienteDocumentos.delete({
      where: { id_cliente_documento: id },
    });

    await this.prisma.logAction(
      'ELIMINAR_DOCUMENTO_CLIENTE',
      id_usuario,
      `Documento eliminado: ${documento.tipo_documento} del cliente ID: ${documento.id_cliente}`,
    );

    return {
      message: 'Documento eliminado exitosamente',
    };
  }

  /**
   * Obtiene documentos pendientes de validación (para revisión administrativa)
   */
  async getDocumentosPendientesValidacion(): Promise<clienteDocumentos[]> {
    return this.prisma.clienteDocumentos.findMany({
      where: {
        estado: 'ACTIVO',
        OR: [
          // DUI con problemas de validación
          {
            tipo_documento: 'DUI_FRENTE',
            validacion_ia: { in: ['NO_COINCIDE', 'NO_DETECTADO', 'ERROR_IA'] },
          },
          // Recibos que generaron alertas de duplicados (tienen NC extraído)
          {
            tipo_documento: 'RECIBO',
            numero_contrato_extraido: { not: null },
          },
        ],
      },
      include: {
        cliente: {
          select: {
            id_cliente: true,
            titular: true,
            dui: true,
          },
        },
      },
      orderBy: {
        fecha_creacion: 'desc',
      },
    });
  }
}
