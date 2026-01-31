import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnularCobroDto } from '../dto';
import {
  AnulacionBuilderService,
  DteOriginalData,
  MotivoAnulacionData,
  EmisorData,
} from '../dte/builders';
import { DteSignerService } from '../dte/signer';
import { MhTransmitterService, TransmisionResult } from '../dte/transmitter';
import { TipoDte, Ambiente } from '../interfaces';
import { estado_anulacion, tipo_invalidacion } from '@prisma/client';

/**
 * Resultado de la anulación de un DTE
 */
export interface AnularCobroResult {
  success: boolean;
  idAnulacion?: number;
  codigoGeneracionAnulacion?: string;
  estado?: estado_anulacion;
  selloRecibido?: string;
  error?: string;
  errores?: string[];
}

/**
 * Plazos de anulación según tipo de DTE (en días)
 */
const PLAZOS_ANULACION: Record<TipoDte, number> = {
  '01': 90, // Factura: 3 meses
  '03': 1, // CCF: 1 día hábil siguiente
  '05': 1, // Nota de Crédito: 1 día
  '06': 1, // Nota de Débito: 1 día
  '07': 1, // Comprobante de Retención: 1 día
  '11': 90, // Factura de Exportación: 3 meses
  '14': 90, // Factura de Sujeto Excluido: 3 meses
};

/**
 * Servicio para gestión de anulaciones de DTE
 *
 * Maneja el flujo completo de invalidación:
 * 1. Validación del DTE original (existe, procesado, no anulado, dentro de plazo)
 * 2. Construcción del evento de anulación
 * 3. Firma del evento
 * 4. Transmisión a MH
 * 5. Actualización de estados en BD
 */
@Injectable()
export class AnulacionesService {
  private readonly logger = new Logger(AnulacionesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly anulacionBuilder: AnulacionBuilderService,
    private readonly signer: DteSignerService,
    private readonly transmitter: MhTransmitterService,
  ) {}

  /**
   * Anula un DTE existente
   *
   * @param dto Datos de la anulación
   * @param idUsuario ID del usuario que realiza la anulación
   * @returns Resultado de la anulación
   */
  async anularCobro(dto: AnularCobroDto, idUsuario: number): Promise<AnularCobroResult> {
    this.logger.log(`Iniciando anulación de DTE ${dto.idDte}`);

    try {
      // ==================== PASO 1: VALIDACIONES ====================
      const { dteOriginal, generalData, sucursal } = await this.validarAnulacion(dto);

      // ==================== PASO 2: PREPARAR DATOS ====================
      const emisor = this.prepararEmisor(generalData, sucursal);
      const dteOriginalData = this.prepararDteOriginal(dteOriginal);
      const motivo = this.prepararMotivo(dto);

      // ==================== PASO 3: CONSTRUIR EVENTO DE ANULACIÓN ====================
      const { evento, codigoGeneracion } = this.anulacionBuilder.build({
        ambiente: generalData.ambiente as Ambiente,
        emisor,
        dteOriginal: dteOriginalData,
        motivo,
      });

      this.logger.log(`Evento de anulación construido: ${codigoGeneracion}`);

      // ==================== PASO 4: GUARDAR ANULACIÓN PENDIENTE ====================
      const anulacionCreada = await this.guardarAnulacion(
        dteOriginal,
        evento,
        codigoGeneracion,
        dto,
        idUsuario,
      );

      // ==================== PASO 5: FIRMAR EVENTO ====================
      const signResult = await this.signer.firmar(generalData.nit!, evento);

      if (!signResult.success) {
        await this.actualizarEstadoAnulacion(
          anulacionCreada.id_anulacion,
          'PENDIENTE',
          signResult.error,
        );
        return {
          success: false,
          idAnulacion: anulacionCreada.id_anulacion,
          codigoGeneracionAnulacion: codigoGeneracion,
          estado: 'PENDIENTE',
          error: `Error al firmar: ${signResult.error}`,
        };
      }

      // Actualizar con evento firmado
      await this.prisma.dte_anulaciones.update({
        where: { id_anulacion: anulacionCreada.id_anulacion },
        data: {
          anulacion_firmada: signResult.documentoFirmado,
          estado: 'FIRMADA',
        },
      });

      this.logger.log('Evento de anulación firmado exitosamente');

      // ==================== PASO 6: TRANSMITIR A MH ====================
      const transmitResult = await this.transmitter.transmitirAnulacion(
        {
          ambiente: generalData.ambiente as Ambiente,
          idEnvio: 1,
          version: 2,
          documento: signResult.documentoFirmado!,
        },
        generalData.nit!,
      );

      // ==================== PASO 7: ACTUALIZAR ESTADOS ====================
      await this.actualizarConRespuestaMh(
        anulacionCreada.id_anulacion,
        dteOriginal.id_dte,
        transmitResult,
      );

      if (transmitResult.success) {
        this.logger.log(
          `DTE anulado exitosamente. Sello: ${transmitResult.selloRecibido}`,
        );
        return {
          success: true,
          idAnulacion: anulacionCreada.id_anulacion,
          codigoGeneracionAnulacion: codigoGeneracion,
          estado: 'PROCESADA',
          selloRecibido: transmitResult.selloRecibido,
        };
      } else {
        return {
          success: false,
          idAnulacion: anulacionCreada.id_anulacion,
          codigoGeneracionAnulacion: codigoGeneracion,
          estado: 'RECHAZADA',
          error: transmitResult.error,
          errores: transmitResult.observaciones,
        };
      }
    } catch (error) {
      this.logger.error(`Error al anular DTE: ${error.message}`, error.stack);

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(`Error al anular DTE: ${error.message}`);
    }
  }

  /**
   * Valida que el DTE pueda ser anulado
   */
  private async validarAnulacion(dto: AnularCobroDto) {
    // 1. Obtener DTE original
    const dteOriginal = await this.prisma.dte_emitidos.findUnique({
      where: { id_dte: dto.idDte },
      include: {
        sucursal: {
          include: {
            Municipio: { include: { Departamento: true } },
            DTETipoEstablecimiento: true,
          },
        },
        anulaciones: {
          where: {
            estado: 'PROCESADA',
          },
        },
      },
    });

    if (!dteOriginal) {
      throw new NotFoundException(`DTE ${dto.idDte} no encontrado`);
    }

    // 2. Verificar estado del DTE
    if (dteOriginal.estado !== 'PROCESADO') {
      throw new BadRequestException(
        `El DTE no puede ser anulado porque está en estado ${dteOriginal.estado}. Solo se pueden anular DTEs en estado PROCESADO.`,
      );
    }

    // 3. Verificar que tenga sello de recepción
    if (!dteOriginal.sello_recepcion) {
      throw new BadRequestException(
        'El DTE no tiene sello de recepción de MH. No puede ser anulado.',
      );
    }

    // 4. Verificar que no haya sido anulado previamente
    if (dteOriginal.anulaciones.length > 0) {
      throw new ConflictException(
        'El DTE ya fue anulado anteriormente. No se puede anular más de una vez.',
      );
    }

    // 5. Verificar plazo de anulación
    const plazoMaximo = PLAZOS_ANULACION[dteOriginal.tipo_dte as TipoDte] || 1;
    const fechaRecepcion = dteOriginal.fecha_recepcion || dteOriginal.fecha_emision;
    const diasTranscurridos = this.calcularDiasTranscurridos(fechaRecepcion);

    if (diasTranscurridos > plazoMaximo) {
      throw new BadRequestException(
        `El plazo para anular este DTE ha expirado. Plazo máximo: ${plazoMaximo} días. Días transcurridos: ${diasTranscurridos}`,
      );
    }

    // 6. Si tipo es 1 (error), verificar DTE de reemplazo
    if (dto.tipoAnulacion === 1) {
      if (!dto.codigoGeneracionReemplazo) {
        throw new BadRequestException(
          'Para anulación tipo 1 (Error en información) se requiere especificar el DTE de reemplazo',
        );
      }

      const dteReemplazo = await this.prisma.dte_emitidos.findUnique({
        where: { codigo_generacion: dto.codigoGeneracionReemplazo },
      });

      if (!dteReemplazo) {
        throw new BadRequestException(
          `El DTE de reemplazo ${dto.codigoGeneracionReemplazo} no existe`,
        );
      }

      if (dteReemplazo.estado !== 'PROCESADO') {
        throw new BadRequestException(
          `El DTE de reemplazo debe estar en estado PROCESADO (actual: ${dteReemplazo.estado})`,
        );
      }
    }

    // 7. Si tipo es 3 (otro), verificar que tenga motivo
    if (dto.tipoAnulacion === 3 && !dto.motivoAnulacion) {
      throw new BadRequestException(
        'Para anulación tipo 3 (Otro) se requiere especificar el motivo',
      );
    }

    // 8. Obtener datos de la empresa emisora
    const generalData = await this.prisma.generalData.findFirst();
    if (!generalData || !generalData.nit) {
      throw new InternalServerErrorException('No hay datos de empresa configurados');
    }

    return {
      dteOriginal,
      generalData,
      sucursal: dteOriginal.sucursal,
    };
  }

  /**
   * Prepara los datos del emisor para el evento de anulación
   */
  private prepararEmisor(generalData: any, sucursal: any): EmisorData {
    return {
      nit: generalData.nit!,
      nrc: generalData.nrc!,
      nombre: generalData.razon || generalData.nombre_sistema,
      codActividad: generalData.cod_actividad || '62010',
      descActividad: generalData.desc_actividad || 'Actividades de programación informática',
      nombreComercial: sucursal?.nombre || generalData.nombre_comercial,
      tipoEstablecimiento: sucursal?.DTETipoEstablecimiento?.codigo || '01',
      telefono: generalData.contactos || '',
      correo: generalData.correo || '',
      departamento: sucursal?.Municipio?.Departamento?.codigo || '06',
      municipio: sucursal?.Municipio?.codigo || '14',
      complemento: sucursal?.complemento || generalData.direccion || '',
      codEstableMH: sucursal?.cod_estable_MH || null,
      codEstable: sucursal?.cod_estable || null,
      codPuntoVentaMH: sucursal?.cod_punto_venta_MH || null,
      codPuntoVenta: sucursal?.cod_punto_venta || null,
    };
  }

  /**
   * Prepara los datos del DTE original para el evento de anulación
   */
  private prepararDteOriginal(dte: any): DteOriginalData {
    // Calcular monto IVA según tipo de DTE
    const montoIva = Number(dte.total_iva) || Number(dte.iva_perci1) || 0;

    return {
      tipoDte: dte.tipo_dte as TipoDte,
      codigoGeneracion: dte.codigo_generacion,
      selloRecibido: dte.sello_recepcion,
      numeroControl: dte.numero_control,
      fechaEmision: this.formatDate(dte.fecha_emision),
      montoIva,
      tipoDocumentoReceptor: dte.receptor_tipo_documento,
      numDocumentoReceptor: dte.receptor_num_documento,
      nombreReceptor: dte.receptor_nombre,
      telefonoReceptor: dte.receptor_telefono,
      correoReceptor: dte.receptor_correo,
    };
  }

  /**
   * Prepara los datos del motivo de anulación
   */
  private prepararMotivo(dto: AnularCobroDto): MotivoAnulacionData {
    return {
      tipoAnulacion: dto.tipoAnulacion,
      motivoAnulacion: dto.motivoAnulacion || null,
      nombreResponsable: dto.nombreResponsable,
      tipoDocResponsable: dto.tipoDocResponsable,
      numDocResponsable: dto.numDocResponsable,
      nombreSolicita: dto.nombreSolicita,
      tipoDocSolicita: dto.tipoDocSolicita,
      numDocSolicita: dto.numDocSolicita,
      codigoGeneracionReemplazo: dto.codigoGeneracionReemplazo,
    };
  }

  /**
   * Mapea el tipo de anulación del DTO al enum de Prisma
   */
  private mapearTipoInvalidacion(tipo: 1 | 2 | 3): tipo_invalidacion {
    switch (tipo) {
      case 1:
        return 'ERROR_INFORMACION';
      case 2:
        return 'RESCINDIR_OPERACION';
      case 3:
        return 'OTRO';
    }
  }

  /**
   * Guarda la anulación en la BD con estado PENDIENTE
   */
  private async guardarAnulacion(
    dteOriginal: any,
    evento: any,
    codigoGeneracion: string,
    dto: AnularCobroDto,
    idUsuario: number,
  ) {
    return this.prisma.dte_anulaciones.create({
      data: {
        id_dte: dteOriginal.id_dte,
        codigo_generacion: codigoGeneracion,
        version: 2,
        ambiente: dteOriginal.ambiente,
        tipo_invalidacion: this.mapearTipoInvalidacion(dto.tipoAnulacion),
        motivo_invalidacion: dto.motivoAnulacion,
        nombre_responsable: dto.nombreResponsable,
        tipo_doc_responsable: dto.tipoDocResponsable,
        num_doc_responsable: dto.numDocResponsable,
        nombre_solicita: dto.nombreSolicita,
        tipo_doc_solicita: dto.tipoDocSolicita,
        num_doc_solicita: dto.numDocSolicita,
        tipo_documento_original: dteOriginal.tipo_dte,
        numero_documento_original: dteOriginal.codigo_generacion,
        fecha_emision_original: dteOriginal.fecha_emision,
        monto_iva_original: dteOriginal.total_iva || dteOriginal.iva_perci1 || 0,
        codigo_generacion_reemplazo: dto.codigoGeneracionReemplazo,
        anulacion_json: JSON.stringify(evento),
        estado: 'PENDIENTE',
        id_usuario_crea: idUsuario,
      },
    });
  }

  /**
   * Actualiza el estado de la anulación
   */
  private async actualizarEstadoAnulacion(
    idAnulacion: number,
    estado: estado_anulacion,
    error?: string,
  ) {
    await this.prisma.dte_anulaciones.update({
      where: { id_anulacion: idAnulacion },
      data: {
        estado,
        ultimo_error: error,
        intentos_transmision: { increment: 1 },
      },
    });
  }

  /**
   * Actualiza la anulación y el DTE original con la respuesta de MH
   */
  private async actualizarConRespuestaMh(
    idAnulacion: number,
    idDte: number,
    result: TransmisionResult,
  ) {
    // Actualizar anulación
    await this.prisma.dte_anulaciones.update({
      where: { id_anulacion: idAnulacion },
      data: {
        estado: result.success ? 'PROCESADA' : 'RECHAZADA',
        sello_recepcion: result.selloRecibido,
        fecha_recepcion: result.fechaProcesamiento,
        codigo_msg: result.codigoMsg,
        descripcion_msg: result.descripcionMsg,
        ultimo_error: result.error,
        intentos_transmision: { increment: 1 },
      },
    });

    // Si fue exitosa, actualizar el DTE original a INVALIDADO
    if (result.success) {
      await this.prisma.dte_emitidos.update({
        where: { id_dte: idDte },
        data: {
          estado: 'INVALIDADO',
        },
      });
    }
  }

  /**
   * Calcula los días transcurridos desde una fecha
   */
  private calcularDiasTranscurridos(fecha: Date): number {
    const hoy = new Date();
    const diffTime = hoy.getTime() - fecha.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Formatea una fecha a YYYY-MM-DD (usando hora local)
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Obtiene una anulación por su ID
   */
  async obtenerPorId(idAnulacion: number) {
    const anulacion = await this.prisma.dte_anulaciones.findUnique({
      where: { id_anulacion: idAnulacion },
      include: {
        dte: {
          select: {
            id_dte: true,
            codigo_generacion: true,
            numero_control: true,
            tipo_dte: true,
            receptor_nombre: true,
          },
        },
        usuarioCrea: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
    });

    if (!anulacion) {
      throw new NotFoundException(`Anulación ${idAnulacion} no encontrada`);
    }

    return anulacion;
  }

  /**
   * Lista anulaciones con filtros y paginación
   */
  async listar(filtros: {
    idDte?: number;
    estado?: estado_anulacion;
    fechaDesde?: Date;
    fechaHasta?: Date;
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 20, ...where } = filtros;
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    if (where.idDte) whereClause.id_dte = where.idDte;
    if (where.estado) whereClause.estado = where.estado;
    if (where.fechaDesde || where.fechaHasta) {
      whereClause.fecha_creacion = {};
      if (where.fechaDesde) whereClause.fecha_creacion.gte = where.fechaDesde;
      if (where.fechaHasta) whereClause.fecha_creacion.lte = where.fechaHasta;
    }

    const [items, total] = await Promise.all([
      this.prisma.dte_anulaciones.findMany({
        where: whereClause,
        include: {
          dte: {
            select: {
              numero_control: true,
              tipo_dte: true,
              receptor_nombre: true,
            },
          },
        },
        orderBy: { fecha_creacion: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.dte_anulaciones.count({ where: whereClause }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
