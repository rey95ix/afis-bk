import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import {
  CrearCobroDto,
  ItemCobroDto,
  ContratosPendientesDto,
  ContratosPendientesResponse,
  ContratoPendiente,
} from '../dto';
import {
  FcBuilderService,
  CcfBuilderService,
  BuildDteParams,
  EmisorData,
  ReceptorData,
  ItemData,
} from '../dte/builders';
import { DteSignerService } from '../dte/signer';
import { MhTransmitterService, TransmisionResult } from '../dte/transmitter';
import { MoraService } from './mora.service';
import { TipoDte, Ambiente, DteDocument } from '../interfaces';
import { estado_dte } from '@prisma/client';

/**
 * Resultado de la creación de un cobro
 */
export interface CrearCobroResult {
  success: boolean;
  idDte?: number;
  codigoGeneracion?: string;
  numeroControl?: string;
  estado?: estado_dte;
  selloRecibido?: string;
  totalPagar?: number;
  error?: string;
  errores?: string[];
}

/**
 * Datos necesarios para generar el DTE
 */
interface DatosGeneracionDte {
  contrato: any;
  cliente: any;
  datosFacturacion: any;
  generalData: any;
  sucursal: any;
  bloque: any;
}

/**
 * Servicio principal para gestión de cobros/facturas
 *
 * Orquesta todo el flujo de generación de DTEs:
 * 1. Validación de datos de entrada
 * 2. Obtención de datos del contrato, cliente y emisor
 * 3. Determinación del tipo de DTE (FC o CCF)
 * 4. Cálculo de mora si aplica
 * 5. Construcción del JSON del DTE
 * 6. Firma con API_FIRMADOR
 * 7. Transmisión a MH
 * 8. Persistencia en BD
 */
@Injectable()
export class CobrosService {
  private readonly logger = new Logger(CobrosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fcBuilder: FcBuilderService,
    private readonly ccfBuilder: CcfBuilderService,
    private readonly signer: DteSignerService,
    private readonly transmitter: MhTransmitterService,
    private readonly moraService: MoraService,
  ) {}

  /**
   * Crea un nuevo cobro/factura (DTE)
   *
   * @param dto Datos del cobro a crear
   * @param idUsuario ID del usuario que crea el cobro
   * @returns Resultado de la creación
   */
  async crearCobro(dto: CrearCobroDto, idUsuario: number): Promise<CrearCobroResult> {
    this.logger.log(`Iniciando creación de cobro para contrato ${dto.idContrato}`);

    try {
      // ==================== PASO 1: VALIDACIONES ====================
      const datos = await this.validarYObtenerDatos(dto);

      // ==================== PASO 2: DETERMINAR TIPO DE DTE ====================
      const tipoDte = this.determinarTipoDte(datos.datosFacturacion);
      this.logger.log(`Tipo de DTE determinado: ${tipoDte === '03' ? 'CCF' : 'Factura'}`);

      // ==================== PASO 3: CALCULAR MORA (si aplica) ====================
      let itemsMora: ItemCobroDto[] = [];
      if (dto.aplicarMora) {
        const calculoMora = await this.moraService.calcularMora(dto.idContrato);
        if (calculoMora.aplicaMora && calculoMora.montoMora > 0) {
          itemsMora = [
            {
              tipoItem: 2, // Servicio
              descripcion: `Mora por pago tardío (${calculoMora.diasAtraso} días)`,
              cantidad: 1,
              uniMedida: 99, // Otro
              precioUnitario: calculoMora.montoMora,
              esGravado: false,
              esExento: true, // La mora generalmente es exenta de IVA
            },
          ];
          this.logger.log(`Mora calculada: $${calculoMora.montoMora}`);
        }
      }

      // Combinar items del dto con mora
      const todosLosItems = [...dto.items, ...itemsMora];

      // ==================== PASO 4: GENERAR IDENTIFICACIÓN ====================
      const codigoGeneracion = uuidv4().toUpperCase();
      const numeroControl = this.generarNumeroControl(
        tipoDte,
        datos.sucursal,
        datos.bloque,
      );

      // ==================== PASO 5: CONSTRUIR DTE ====================
      const buildParams = this.prepararParametrosBuild(
        datos,
        tipoDte,
        codigoGeneracion,
        numeroControl,
        todosLosItems,
        dto,
      );

      const builder = tipoDte === '03' ? this.ccfBuilder : this.fcBuilder;
      const { documento, totales } = builder.build(buildParams);

      this.logger.log(`DTE construido. Total a pagar: $${totales.totalPagar}`);

      // ==================== PASO 6: GUARDAR BORRADOR ====================
      const dteCreado = await this.guardarBorrador(
        documento,
        tipoDte,
        codigoGeneracion,
        numeroControl,
        totales,
        datos,
        dto,
        idUsuario,
      );

      // ==================== PASO 7: FIRMAR DTE ====================
      const signResult = await this.signer.firmar(
        datos.generalData.nit,
        documento,
      );

      if (!signResult.success) {
        await this.actualizarEstadoDte(dteCreado.id_dte, 'BORRADOR', signResult.error);
        return {
          success: false,
          idDte: dteCreado.id_dte,
          codigoGeneracion,
          numeroControl,
          estado: 'BORRADOR',
          error: `Error al firmar: ${signResult.error}`,
        };
      }

      // Actualizar con DTE firmado
      await this.prisma.dte_emitidos.update({
        where: { id_dte: dteCreado.id_dte },
        data: {
          dte_firmado: signResult.documentoFirmado,
          estado: 'FIRMADO',
        },
      });

      this.logger.log('DTE firmado exitosamente');

      // ==================== PASO 8: TRANSMITIR A MH ====================
      const transmitResult = await this.transmitter.transmitirDte(
        {
          ambiente: datos.generalData.ambiente as Ambiente,
          idEnvio: 1,
          version: builder.getVersion(),
          tipoDte,
          documento: signResult.documentoFirmado!,
          codigoGeneracion,
        },
        datos.generalData.nit,
      );

      // ==================== PASO 9: ACTUALIZAR ESTADO FINAL ====================
      await this.actualizarConRespuestaMh(dteCreado.id_dte, transmitResult);

      // Actualizar correlativo del bloque
      await this.prisma.facturasBloques.update({
        where: { id_bloque: datos.bloque.id_bloque },
        data: { actual: datos.bloque.actual + 1 },
      });

      if (transmitResult.success) {
        this.logger.log(`DTE procesado exitosamente. Sello: ${transmitResult.selloRecibido}`);
        return {
          success: true,
          idDte: dteCreado.id_dte,
          codigoGeneracion,
          numeroControl,
          estado: 'PROCESADO',
          selloRecibido: transmitResult.selloRecibido,
          totalPagar: totales.totalPagar,
        };
      } else {
        return {
          success: false,
          idDte: dteCreado.id_dte,
          codigoGeneracion,
          numeroControl,
          estado: 'RECHAZADO',
          totalPagar: totales.totalPagar,
          error: transmitResult.error,
          errores: transmitResult.observaciones,
        };
      }
    } catch (error) {
      this.logger.error(`Error al crear cobro: ${error.message}`, error.stack);

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(`Error al crear cobro: ${error.message}`);
    }
  }

  /**
   * Valida los datos de entrada y obtiene la información necesaria de la BD
   */
  private async validarYObtenerDatos(dto: CrearCobroDto): Promise<DatosGeneracionDte> {
    // 1. Validar y obtener contrato
    const contrato = await this.prisma.atcContrato.findUnique({
      where: { id_contrato: dto.idContrato },
      include: {
        cliente: true,
        plan: true,
        ciclo: true,
      },
    });

    if (!contrato) {
      throw new NotFoundException(`Contrato ${dto.idContrato} no encontrado`);
    }

    if (contrato.estado !== 'INSTALADO_ACTIVO' && contrato.estado !== 'EN_MORA' && contrato.estado !== 'VELOCIDAD_REDUCIDA') {
      throw new BadRequestException(`El contrato no está activo para facturación (estado: ${contrato.estado})`);
    }

    // 2. Obtener datos de facturación del cliente
    const datosFacturacion = await this.prisma.clienteDatosFacturacion.findFirst({
      where: dto.idClienteFacturacion
        ? { id_cliente_datos_facturacion: dto.idClienteFacturacion }
        : { id_cliente: contrato.id_cliente, estado: 'ACTIVO' },
      include: {
        municipio: true,
        departamento: true,
        dTETipoDocumentoIdentificacion: true,
        dTEActividadEconomica: true,
      },
    });

    if (!datosFacturacion) {
      throw new BadRequestException(
        'El cliente no tiene datos de facturación configurados',
      );
    }

    // 3. Obtener datos de la empresa emisora
    const generalData = await this.prisma.generalData.findFirst();

    if (!generalData) {
      throw new InternalServerErrorException('No hay datos de empresa configurados');
    }

    if (!generalData.nit || !generalData.nrc) {
      throw new InternalServerErrorException(
        'La empresa no tiene NIT o NRC configurado',
      );
    }

    // 4. Obtener sucursal
    const sucursal = dto.idSucursal
      ? await this.prisma.sucursales.findUnique({
          where: { id_sucursal: dto.idSucursal },
          include: { Municipio: { include: { Departamento: true } } },
        })
      : await this.prisma.sucursales.findFirst({
          where: { estado: 'ACTIVO' },
          include: { Municipio: { include: { Departamento: true } } },
        });

    if (!sucursal) {
      throw new BadRequestException('No hay sucursal disponible');
    }

    // 5. Obtener bloque de facturas disponible
    const tipoDte = this.determinarTipoDte(datosFacturacion);
    const bloque = await this.prisma.facturasBloques.findFirst({
      where: {
        id_sucursal: sucursal.id_sucursal,
        estado: 'ACTIVO',
        Tipo: {
          codigo: tipoDte,
        },
        actual: {
          lt: this.prisma.facturasBloques.fields.hasta,
        },
      },
      include: { Tipo: true },
    });

    if (!bloque) {
      throw new BadRequestException(
        `No hay bloques de facturas disponibles para tipo ${tipoDte} en la sucursal`,
      );
    }

    if (bloque.actual >= bloque.hasta) {
      throw new BadRequestException(
        `El bloque de facturas ${bloque.serie} está agotado`,
      );
    }

    // 6. Verificar duplicados (mismo contrato y período)
    // TODO: Implementar verificación de período duplicado si es necesario

    return {
      contrato,
      cliente: contrato.cliente,
      datosFacturacion,
      generalData,
      sucursal,
      bloque,
    };
  }

  /**
   * Determina si el DTE debe ser FC (01) o CCF (03)
   */
  private determinarTipoDte(datosFacturacion: any): TipoDte {
    // Si tiene NIT y NRC, es CCF (03), sino es FC (01)
    if (datosFacturacion.nit && datosFacturacion.nrc) {
      return '03';
    }
    return '01';
  }

  /**
   * Genera el número de control del DTE
   * Formato: DTE-XX-YYYYYYYY-ZZZZZZZZZZZZZZZ
   */
  private generarNumeroControl(tipoDte: TipoDte, sucursal: any, bloque: any): string {
    const codEstable = (sucursal.cod_estable_MH || 'M001').substring(0, 4);
    const codPuntoVenta = (sucursal.cod_punto_venta_MH || 'P001').substring(0, 4);
    const correlativo = (bloque.actual + 1).toString().padStart(15, '0');

    return `DTE-${tipoDte}-${codEstable}${codPuntoVenta}-${correlativo}`;
  }

  /**
   * Prepara los parámetros para el builder de DTE
   */
  private prepararParametrosBuild(
    datos: DatosGeneracionDte,
    tipoDte: TipoDte,
    codigoGeneracion: string,
    numeroControl: string,
    items: ItemCobroDto[],
    dto: CrearCobroDto,
  ): BuildDteParams {
    const { generalData, sucursal, datosFacturacion } = datos;

    // Preparar datos del emisor
    const emisor: EmisorData = {
      nit: generalData.nit!,
      nrc: generalData.nrc!,
      nombre: generalData.razon || generalData.nombre_sistema,
      codActividad: generalData.cod_actividad || '62010',
      descActividad: generalData.desc_actividad || 'Actividades de programación informática',
      nombreComercial: generalData.nombre_comercial || null,
      tipoEstablecimiento: '01', // Casa matriz por defecto
      telefono: generalData.contactos || '',
      correo: generalData.correo || '',
      departamento: sucursal.Municipio?.Departamento?.codigo || '06',
      municipio: sucursal.Municipio?.codigo || '14',
      complemento: sucursal.complemento || generalData.direccion || '',
      codEstableMH: sucursal.cod_estable_MH || null,
      codEstable: sucursal.cod_estable || null,
      codPuntoVentaMH: sucursal.cod_punto_venta_MH || null,
      codPuntoVenta: sucursal.cod_punto_venta || null,
    };

    // Preparar datos del receptor
    const receptor: ReceptorData = {
      tipoDocumento: datosFacturacion.dTETipoDocumentoIdentificacion?.codigo || null,
      numDocumento: datosFacturacion.nit || null,
      nit: datosFacturacion.nit || null,
      nrc: datosFacturacion.nrc || null,
      nombre: datosFacturacion.nombre_empresa,
      codActividad: datosFacturacion.dTEActividadEconomica?.codigo || null,
      descActividad: datosFacturacion.dTEActividadEconomica?.nombre || null,
      nombreComercial: null,
      telefono: datosFacturacion.telefono || null,
      correo: datosFacturacion.correo_electronico || null,
      departamento: datosFacturacion.departamento?.codigo || null,
      municipio: datosFacturacion.municipio?.codigo || null,
      complemento: datosFacturacion.direccion_facturacion || null,
    };

    // Preparar items
    const itemsData: ItemData[] = items.map((item) => ({
      tipoItem: item.tipoItem,
      codigo: item.codigo || null,
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      uniMedida: item.uniMedida,
      precioUnitario: item.precioUnitario,
      descuento: item.descuento || 0,
      esGravado: item.esGravado ?? true, // Por defecto gravado
      esExento: item.esExento ?? false,
      esNoSujeto: item.esNoSujeto ?? false,
      idCatalogo: item.idCatalogo,
    }));

    return {
      ambiente: (generalData.ambiente || '00') as Ambiente,
      numeroControl,
      codigoGeneracion,
      emisor,
      receptor,
      items: itemsData,
      condicionOperacion: dto.condicionOperacion || 1,
      pagos: dto.pagos?.map((p) => ({
        codigo: p.codigo,
        monto: p.monto,
        referencia: p.referencia,
        plazo: p.plazo,
        periodo: p.periodo,
      })),
      numPagoElectronico: dto.numPagoElectronico,
      observaciones: dto.observaciones,
    };
  }

  /**
   * Guarda el DTE como borrador en la BD
   */
  private async guardarBorrador(
    documento: DteDocument,
    tipoDte: TipoDte,
    codigoGeneracion: string,
    numeroControl: string,
    totales: any,
    datos: DatosGeneracionDte,
    dto: CrearCobroDto,
    idUsuario: number,
  ) {
    const { generalData, datosFacturacion, contrato, sucursal } = datos;

    return this.prisma.dte_emitidos.create({
      data: {
        // Identificación
        codigo_generacion: codigoGeneracion,
        numero_control: numeroControl,
        tipo_dte: tipoDte,
        version: tipoDte === '03' ? 3 : 1,
        ambiente: generalData.ambiente || '00',
        tipo_modelo: 1,
        tipo_operacion: 1,

        // Fechas
        fecha_emision: new Date(),
        hora_emision: new Date().toTimeString().split(' ')[0],
        tipo_moneda: 'USD',

        // Receptor snapshot
        receptor_tipo_documento: datosFacturacion.dTETipoDocumentoIdentificacion?.codigo,
        receptor_num_documento: datosFacturacion.nit,
        receptor_nrc: datosFacturacion.nrc,
        receptor_nombre: datosFacturacion.nombre_empresa,
        receptor_cod_actividad: datosFacturacion.dTEActividadEconomica?.codigo,
        receptor_desc_actividad: datosFacturacion.dTEActividadEconomica?.nombre,
        receptor_telefono: datosFacturacion.telefono,
        receptor_correo: datosFacturacion.correo_electronico,
        receptor_departamento: datosFacturacion.departamento?.codigo,
        receptor_municipio: datosFacturacion.municipio?.codigo,
        receptor_complemento: datosFacturacion.direccion_facturacion,

        // Relaciones
        id_cliente: contrato.id_cliente,
        id_cliente_facturacion: datosFacturacion.id_cliente_datos_facturacion,
        id_contrato: contrato.id_contrato,
        id_sucursal: sucursal.id_sucursal,

        // Totales
        total_no_sujetas: totales.totalNoSuj,
        total_exentas: totales.totalExenta,
        total_gravadas: totales.totalGravada,
        subtotal_ventas: totales.totalNoSuj + totales.totalExenta + totales.totalGravada,
        total_iva: totales.totalIva,
        total_pagar: totales.totalPagar,
        total_letras: (documento.resumen as any).totalLetras,

        // Condición de operación
        condicion_operacion: dto.condicionOperacion || 1,
        pagos_json: dto.pagos ? JSON.stringify(dto.pagos) : null,
        num_pago_electronico: dto.numPagoElectronico,

        // JSON completo
        dte_json: JSON.stringify(documento),

        // Estado
        estado: 'BORRADOR',

        // Auditoría
        id_usuario_crea: idUsuario,

        // Detalle de items
        detalle: {
          create: dto.items.map((item, index) => ({
            num_item: index + 1,
            tipo_item: item.tipoItem,
            codigo: item.codigo,
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            uni_medida: item.uniMedida,
            precio_unitario: item.precioUnitario,
            monto_descuento: item.descuento || 0,
            venta_gravada: item.esGravado ? item.cantidad * item.precioUnitario : 0,
            venta_exenta: item.esExento ? item.cantidad * item.precioUnitario : 0,
            venta_no_sujeta: item.esNoSujeto ? item.cantidad * item.precioUnitario : 0,
            id_catalogo: item.idCatalogo,
          })),
        },
      },
    });
  }

  /**
   * Actualiza el estado del DTE
   */
  private async actualizarEstadoDte(
    idDte: number,
    estado: estado_dte,
    error?: string,
  ) {
    await this.prisma.dte_emitidos.update({
      where: { id_dte: idDte },
      data: {
        estado,
        ultimo_error: error,
        intentos_transmision: { increment: 1 },
      },
    });
  }

  /**
   * Actualiza el DTE con la respuesta de MH
   */
  private async actualizarConRespuestaMh(
    idDte: number,
    result: TransmisionResult,
  ) {
    await this.prisma.dte_emitidos.update({
      where: { id_dte: idDte },
      data: {
        estado: result.success ? 'PROCESADO' : 'RECHAZADO',
        sello_recepcion: result.selloRecibido,
        fecha_recepcion: result.fechaProcesamiento,
        codigo_msg: result.codigoMsg,
        descripcion_msg: result.descripcionMsg,
        observaciones_mh: result.observaciones?.join('\n'),
        ultimo_error: result.error,
        intentos_transmision: { increment: 1 },
      },
    });
  }

  /**
   * Obtiene un DTE por su ID
   */
  async obtenerPorId(idDte: number) {
    const dte = await this.prisma.dte_emitidos.findUnique({
      where: { id_dte: idDte },
      include: {
        detalle: true,
        cliente: true,
        contrato: true,
        sucursal: true,
        anulaciones: true,
      },
    });

    if (!dte) {
      throw new NotFoundException(`DTE ${idDte} no encontrado`);
    }

    return dte;
  }

  /**
   * Lista DTEs con filtros y paginación
   */
  async listar(filtros: {
    idContrato?: number;
    idCliente?: number;
    tipoDte?: TipoDte;
    estado?: estado_dte;
    fechaDesde?: Date;
    fechaHasta?: Date;
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 20, ...where } = filtros;
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    if (where.idContrato) whereClause.id_contrato = where.idContrato;
    if (where.idCliente) whereClause.id_cliente = where.idCliente;
    if (where.tipoDte) whereClause.tipo_dte = where.tipoDte;
    if (where.estado) whereClause.estado = where.estado;
    if (where.fechaDesde || where.fechaHasta) {
      whereClause.fecha_emision = {};
      if (where.fechaDesde) whereClause.fecha_emision.gte = where.fechaDesde;
      if (where.fechaHasta) whereClause.fecha_emision.lte = where.fechaHasta;
    }

    const [items, total] = await Promise.all([
      this.prisma.dte_emitidos.findMany({
        where: whereClause,
        include: {
          cliente: { select: { titular: true } },
          contrato: { select: { codigo: true } },
        },
        orderBy: { fecha_creacion: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.dte_emitidos.count({ where: whereClause }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Obtiene contratos pendientes de cobro con información de mora
   *
   * @param dto Filtros y paginación
   * @returns Lista paginada de contratos con info de pago
   */
  async getContratosPendientes(dto: ContratosPendientesDto): Promise<ContratosPendientesResponse> {
    const { page = 1, limit = 10, search, estado } = dto;
    const skip = (page - 1) * limit;

    // Estados que pueden facturarse
    const estadosFacturables = estado
      ? [estado]
      : ['INSTALADO_ACTIVO', 'EN_MORA', 'VELOCIDAD_REDUCIDA'];

    // Construir where clause
    const whereClause: any = {
      estado: { in: estadosFacturables },
    };

    // Búsqueda por nombre de cliente o número de contrato
    if (search) {
      whereClause.OR = [
        { codigo: { contains: search, mode: 'insensitive' } },
        { cliente: { titular: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Obtener contratos con relaciones
    const [contratos, total] = await Promise.all([
      this.prisma.atcContrato.findMany({
        where: whereClause,
        include: {
          cliente: {
            select: {
              id_cliente: true,
              titular: true,
              dui: true,
              nit: true,
            },
          },
          plan: {
            select: {
              id_plan: true,
              nombre: true,
              precio: true,
            },
          },
        },
        orderBy: { fecha_creacion: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.atcContrato.count({ where: whereClause }),
    ]);

    // Calcular mora para cada contrato y construir respuesta
    const data: ContratoPendiente[] = await Promise.all(
      contratos.map(async (contrato) => {
        // Calcular mora
        const calculoMora = await this.moraService.calcularMora(contrato.id_contrato);

        // Obtener precio del plan
        const precioBase = Number(contrato.plan?.precio || 0);

        // Calcular total
        const totalPagar = precioBase + (calculoMora.aplicaMora ? calculoMora.montoMora : 0);

        // Determinar período actual
        const periodoActual = this.obtenerPeriodoActual();

        return {
          idContrato: contrato.id_contrato,
          numeroContrato: contrato.codigo,
          cliente: {
            id: contrato.cliente.id_cliente,
            nombre: contrato.cliente.titular,
            dui: contrato.cliente.dui,
            nit: contrato.cliente.nit,
          },
          plan: {
            id: contrato.plan?.id_plan || 0,
            nombre: contrato.plan?.nombre || 'Sin plan',
            precio: precioBase,
          },
          estado: contrato.estado,
          periodoActual,
          montoBase: precioBase,
          mora: {
            aplica: calculoMora.aplicaMora,
            monto: calculoMora.montoMora,
            diasAtraso: calculoMora.diasAtraso,
          },
          totalPagar: Math.round(totalPagar * 100) / 100,
        };
      }),
    );

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Obtiene el período actual en formato "Mes Año"
   */
  private obtenerPeriodoActual(): string {
    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];
    const fecha = new Date();
    return `${meses[fecha.getMonth()]} ${fecha.getFullYear()}`;
  }
}
