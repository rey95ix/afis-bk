// src/modules/atencion-al-cliente/contratos/contratos.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateContratoDto } from './dto/create-contrato.dto';
import { UpdateContratoDto } from './dto/update-contrato.dto';
import { atcContrato } from '@prisma/client';
import { PaginationDto, PaginatedResult } from 'src/common/dto';
import { OrdenesTrabajoService } from '../ordenes-trabajo/ordenes-trabajo.service';
import { TipoOrden } from '../ordenes-trabajo/dto/create-orden.dto';
import { MinioService } from 'src/modules/minio/minio.service';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ContratosService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => OrdenesTrabajoService))
    private readonly ordenesTrabajoService: OrdenesTrabajoService,
    private readonly minioService: MinioService,
  ) {}

  /**
   * Genera el código de contrato automático con formato CTR-YYYYMM-#####
   */
  private async generateCodigoContrato(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `CTR-${year}${month}-`;

    // Buscar el último contrato del mes actual
    const lastContrato = await this.prisma.atcContrato.findFirst({
      where: {
        codigo: {
          startsWith: prefix,
        },
      },
      orderBy: {
        codigo: 'desc',
      },
    });

    let nextNumber = 1;
    if (lastContrato) {
      const lastNumber = parseInt(lastContrato.codigo.split('-').pop() || '0');
      nextNumber = lastNumber + 1;
    }

    return `${prefix}${String(nextNumber).padStart(5, '0')}`;
  }

  async create(
    createContratoDto: CreateContratoDto,
    id_usuario: number,
  ): Promise<atcContrato> {
    // Validar que el cliente exista
    const cliente = await this.prisma.cliente.findUnique({
      where: { id_cliente: createContratoDto.id_cliente },
    });
    if (!cliente) {
      throw new NotFoundException(
        `Cliente con ID ${createContratoDto.id_cliente} no encontrado`,
      );
    }

    // Validar que el plan exista
    const plan = await this.prisma.atcPlan.findUnique({
      where: { id_plan: createContratoDto.id_plan },
    });
    if (!plan) {
      throw new NotFoundException(
        `Plan con ID ${createContratoDto.id_plan} no encontrado`,
      );
    }

    // Validar que el ciclo exista
    const ciclo = await this.prisma.atcCicloFacturacion.findUnique({
      where: { id_ciclo: createContratoDto.id_ciclo },
    });
    if (!ciclo) {
      throw new NotFoundException(
        `Ciclo de facturación con ID ${createContratoDto.id_ciclo} no encontrado`,
      );
    }

    // Validar que la dirección pertenezca al cliente
    const direccion = await this.prisma.clienteDirecciones.findFirst({
      where: {
        id_cliente_direccion: createContratoDto.id_direccion_servicio,
        id_cliente: createContratoDto.id_cliente,
        estado: 'ACTIVO',
      },
    });
    if (!direccion) {
      throw new BadRequestException(
        `La dirección con ID ${createContratoDto.id_direccion_servicio} no pertenece al cliente o no está activa`,
      );
    }

    // Generar código automático
    const codigo = await this.generateCodigoContrato();

    // Crear el contrato con estado PENDIENTE_FIRMA (sin OT - se creará al firmar)
    const contrato = await this.prisma.atcContrato.create({
      data: {
        codigo,
        id_cliente: createContratoDto.id_cliente,
        id_plan: createContratoDto.id_plan,
        id_ciclo: createContratoDto.id_ciclo,
        id_direccion_servicio: createContratoDto.id_direccion_servicio,
        fecha_venta: createContratoDto.fecha_venta
          ? new Date(createContratoDto.fecha_venta)
          : new Date(),
        meses_contrato: createContratoDto.meses_contrato || 12,
        costo_instalacion: createContratoDto.costo_instalacion ?? 0,
        facturar_instalacion_separada:
          createContratoDto.facturar_instalacion_separada ?? true,
        id_usuario_creador: id_usuario,
        estado: 'PENDIENTE_FIRMA',
      },
      include: this.getIncludeRelations(),
    });

    // Registrar en el log
    await this.prisma.logAction(
      'CREAR_CONTRATO',
      id_usuario,
      `Contrato creado: ${contrato.codigo} - Cliente: ${cliente.titular} - Estado: PENDIENTE_FIRMA`,
    );

    return contrato;
  }

  async findAll(
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<atcContrato>> {
    const { page = 1, limit = 10, search = '' } = paginationDto;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { codigo: { contains: search, mode: 'insensitive' } },
        { cliente: { titular: { contains: search, mode: 'insensitive' } } },
        { cliente: { dui: { contains: search, mode: 'insensitive' } } },
        { plan: { nombre: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.atcContrato.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fecha_creacion: 'desc' },
        include: this.getIncludeRelations(),
      }),
      this.prisma.atcContrato.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async findOne(id: number): Promise<atcContrato> {
    const contrato = await this.prisma.atcContrato.findUnique({
      where: { id_contrato: id },
      include: this.getIncludeRelations(),
    });

    if (!contrato) {
      throw new NotFoundException(`Contrato con ID ${id} no encontrado`);
    }

    return contrato;
  }

  async findByCliente(id_cliente: number): Promise<atcContrato[]> {
    // Verificar que el cliente exista
    const cliente = await this.prisma.cliente.findUnique({
      where: { id_cliente },
    });
    if (!cliente) {
      throw new NotFoundException(`Cliente con ID ${id_cliente} no encontrado`);
    }

    return this.prisma.atcContrato.findMany({
      where: { id_cliente },
      orderBy: { fecha_creacion: 'desc' },
      include: this.getIncludeRelations(),
    });
  }

  async findByCodigo(codigo: string): Promise<atcContrato | null> {
    return this.prisma.atcContrato.findUnique({
      where: { codigo },
      include: this.getIncludeRelations(),
    });
  }

  async update(
    id: number,
    updateContratoDto: UpdateContratoDto,
    id_usuario: number,
  ): Promise<atcContrato> {
    const existingContrato = await this.findOne(id);

    // Validar plan si se actualiza
    if (
      updateContratoDto.id_plan &&
      updateContratoDto.id_plan !== existingContrato.id_plan
    ) {
      const plan = await this.prisma.atcPlan.findUnique({
        where: { id_plan: updateContratoDto.id_plan },
      });
      if (!plan) {
        throw new NotFoundException(
          `Plan con ID ${updateContratoDto.id_plan} no encontrado`,
        );
      }
    }

    // Validar ciclo si se actualiza
    if (
      updateContratoDto.id_ciclo &&
      updateContratoDto.id_ciclo !== existingContrato.id_ciclo
    ) {
      const ciclo = await this.prisma.atcCicloFacturacion.findUnique({
        where: { id_ciclo: updateContratoDto.id_ciclo },
      });
      if (!ciclo) {
        throw new NotFoundException(
          `Ciclo de facturación con ID ${updateContratoDto.id_ciclo} no encontrado`,
        );
      }
    }

    // Validar dirección si se actualiza
    if (
      updateContratoDto.id_direccion_servicio &&
      updateContratoDto.id_direccion_servicio !==
        existingContrato.id_direccion_servicio
    ) {
      const direccion = await this.prisma.clienteDirecciones.findFirst({
        where: {
          id_cliente_direccion: updateContratoDto.id_direccion_servicio,
          id_cliente: existingContrato.id_cliente,
          estado: 'ACTIVO',
        },
      });
      if (!direccion) {
        throw new BadRequestException(
          `La dirección con ID ${updateContratoDto.id_direccion_servicio} no pertenece al cliente o no está activa`,
        );
      }
    }

    const {
      fecha_venta,
      fecha_instalacion,
      fecha_inicio_contrato,
      fecha_fin_contrato,
      ...rest
    } = updateContratoDto;

    const contrato = await this.prisma.atcContrato.update({
      where: { id_contrato: id },
      data: {
        ...rest,
        fecha_venta: fecha_venta ? new Date(fecha_venta) : undefined,
        fecha_instalacion: fecha_instalacion
          ? new Date(fecha_instalacion)
          : undefined,
        fecha_inicio_contrato: fecha_inicio_contrato
          ? new Date(fecha_inicio_contrato)
          : undefined,
        fecha_fin_contrato: fecha_fin_contrato
          ? new Date(fecha_fin_contrato)
          : undefined,
      },
      include: this.getIncludeRelations(),
    });

    // Registrar en el log
    await this.prisma.logAction(
      'ACTUALIZAR_CONTRATO',
      id_usuario,
      `Contrato actualizado: ${contrato.codigo}`,
    );

    return contrato;
  }

  async remove(id: number, id_usuario: number): Promise<atcContrato> {
    const contrato = await this.findOne(id);

    // Cancelar la Orden de Trabajo asociada si existe
    if (contrato.id_orden_trabajo) {
      try {
        await this.ordenesTrabajoService.cancelarOrden(
          contrato.id_orden_trabajo,
          id_usuario,
        );
      } catch (error) {
        // Si falla la cancelación de la OT, logueamos pero continuamos con la cancelación del contrato
        console.error(`Error al cancelar OT ${contrato.id_orden_trabajo}:`, error);
      }
    }

    const updatedContrato = await this.prisma.atcContrato.update({
      where: { id_contrato: id },
      data: { estado: 'CANCELADO' },
      include: this.getIncludeRelations(),
    });

    // Registrar en el log
    await this.prisma.logAction(
      'CANCELAR_CONTRATO',
      id_usuario,
      `Contrato cancelado: ${contrato.codigo}${contrato.id_orden_trabajo ? ` - OT cancelada: ${contrato.id_orden_trabajo}` : ''}`,
    );

    return updatedContrato;
  }

  // ==================== CONTRATOS PENDIENTES DE FIRMA ====================

  /**
   * Obtiene contratos en estado PENDIENTE_FIRMA con paginación
   */
  async findPendientesFirma(
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<atcContrato>> {
    const { page = 1, limit = 10, search = '' } = paginationDto;
    const skip = (page - 1) * limit;

    const where: any = {
      estado: 'PENDIENTE_FIRMA',
    };

    if (search) {
      where.OR = [
        { codigo: { contains: search, mode: 'insensitive' } },
        { cliente: { titular: { contains: search, mode: 'insensitive' } } },
        { cliente: { dui: { contains: search, mode: 'insensitive' } } },
      ];
      where.AND = { estado: 'PENDIENTE_FIRMA' };
    }

    const [data, total] = await Promise.all([
      this.prisma.atcContrato.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fecha_creacion: 'desc' },
        include: this.getIncludeRelations(),
      }),
      this.prisma.atcContrato.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Genera PDF del contrato para impresión usando jsReport
   */
  async generatePdf(id: number): Promise<Buffer> {
    const contrato: any = await this.findOne(id);

    const templatePath = path.join(
      process.cwd(),
      'templates/atencion-cliente/contrato.html',
    );

    if (!fs.existsSync(templatePath)) {
      throw new NotFoundException(
        'Plantilla de contrato no encontrada. Asegúrese de que existe templates/atencion-cliente/contrato.html',
      );
    }

    const templateHtml = fs.readFileSync(templatePath, 'utf-8');

    // Cargar logo como base64
    const logoPath = path.join(
      process.cwd(),
      'templates/atencion-cliente/images/LogoNewTel.png',
    );
    let logoBase64 = '';
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    }

    // Obtener datos de facturación del cliente
    const datosFacturacion = await this.prisma.clienteDatosFacturacion.findFirst(
      {
        where: {
          id_cliente: contrato.id_cliente,
          estado: 'ACTIVO',
        },
        include: {
          dTEActividadEconomica: true,
        },
      },
    );

    // Determinar tipo de documento fiscal
    const esConsumidorFinal = !datosFacturacion || datosFacturacion.tipo === 'PERSONA';
    const esCreditoFiscal = datosFacturacion?.tipo === 'EMPRESA';

    // Fecha actual
    const fechaActual = new Date();
    const anioActual = fechaActual.getFullYear();
    const anioCorto = anioActual.toString().slice(-2);

    // Preparar datos para la plantilla
    const templateData = {
      // Logo
      logoBase64,

      // Contrato
      codigo: contrato.codigo || 'N/A',
      meses_contrato: contrato.meses_contrato || 12,
      costo_instalacion: contrato.costo_instalacion?.toFixed(2) || '0.00',

      // Cliente - Datos personales
      clienteNombre: contrato.cliente?.titular || 'N/A',
      clienteDui: contrato.cliente?.dui || 'N/A',
      clienteNit: contrato.cliente?.nit || 'N/A',
      clienteTelefono: contrato.cliente?.telefono1 || 'N/A',
      clienteWhatsapp: contrato.cliente?.telefono2 || '',
      clienteCorreo: contrato.cliente?.correo_electronico || 'N/A',
      clienteEmpresaTrabajo: contrato.cliente?.empresa_trabajo || 'N/A',
      clienteEdad: this.calcularEdad(contrato.cliente?.fecha_nacimiento),
      clienteFechaNacimiento: this.formatearFechaCorta(
        contrato.cliente?.fecha_nacimiento,
      ),

      // Cliente - Referencias
      referencia1Nombre: contrato.cliente?.referencia1 || '',
      referencia1Telefono: contrato.cliente?.referencia1_telefono || '',
      referencia2Nombre: contrato.cliente?.referencia2 || '',
      referencia2Telefono: contrato.cliente?.referencia2_telefono || '',

      // Plan
      planNombre: contrato.plan?.nombre || 'N/A',
      planPrecio: contrato.plan?.precio?.toFixed(2) || '0.00',
      planVelocidadBajada: contrato.plan?.velocidad_bajada || '-',
      planVelocidadSubida: contrato.plan?.velocidad_subida || '-',
      planVelocidad: `${contrato.plan?.velocidad_bajada || '-'}/${contrato.plan?.velocidad_subida || '-'} Mbps`,
      tipoServicioPlan:
        contrato.plan?.tipoPlan?.tipoServicio?.nombre || 'Internet',
      tipoServicioPlanCompleto:
        contrato.plan?.tipoPlan?.nombre ||
        contrato.plan?.tipoPlan?.tipoServicio?.nombre ||
        'Residencial',

      // Dirección de servicio
      direccion: contrato.direccionServicio?.direccion || '',
      colonia: contrato.direccionServicio?.colonias?.nombre || '',
      municipio: contrato.direccionServicio?.municipio?.nombre || '',
      departamento: contrato.direccionServicio?.departamento?.nombre || '',
      direccionCompleta: `${contrato.direccionServicio?.direccion || ''}, ${contrato.direccionServicio?.colonias?.nombre || ''}, ${contrato.direccionServicio?.municipio?.nombre || ''}, ${contrato.direccionServicio?.departamento?.nombre || ''}`.replace(
        /^, |, $/g,
        '',
      ),

      // Ciclo
      cicloNombre: contrato.ciclo?.nombre || 'N/A',

      // Facturación
      esConsumidorFinal,
      esCreditoFiscal,
      consumidorFinalMarca: esConsumidorFinal ? 'X' : '',
      creditoFiscalMarca: esCreditoFiscal ? 'X' : '',
      nitFacturacion: esCreditoFiscal ? datosFacturacion?.nit || '' : '',
      nrcFacturacion: esCreditoFiscal ? datosFacturacion?.nrc || '' : '',
      actividadEconomica: esCreditoFiscal
        ? datosFacturacion?.dTEActividadEconomica?.nombre || ''
        : '',

      // Campos de estado civil y vivienda
      estadoCivil: contrato.cliente?.estado_civil?.nombre || '',
      estadoVivienda: contrato.cliente?.estado_vivienda?.nombre || '',
      nombreConyuge: contrato.cliente?.nombre_conyuge || '',
      telefonoConyuge: contrato.cliente?.telefono_conyuge || '',
      telefonoOficinaConyuge: contrato.cliente?.telefono_oficina_conyuge || '',

      // Fechas
      fechaVenta: this.formatearFechaLarga(contrato.fecha_venta),
      fechaGeneracion: this.formatearFechaLarga(new Date()),
      fechaDia: String(fechaActual.getDate()).padStart(2, '0'),
      fechaMes: this.obtenerNombreMes(fechaActual),
      fechaMesNumero: String(fechaActual.getMonth() + 1).padStart(2, '0'),
      fechaAnio: anioActual,
      fechaAnioCorto: anioCorto,

      // Cable (para marcar si lleva TV)
      llevaCable: '', // Se puede calcular basado en el tipo de plan
    };

    const API_REPORT =
      process.env.API_REPORT || 'https://reports.edal.group/api/report';

    try {
      const response = await axios.post(
        API_REPORT,
        {
          template: {
            content: templateHtml,
            engine: 'jsrender',
            recipe: 'chrome-pdf',
          },
          data: templateData,
          options: {
            reportName: `Contrato_${contrato.codigo}`,
          },
        },
        {
          responseType: 'arraybuffer',
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000,
        },
      );

      return Buffer.from(response.data);
    } catch (error) {
      console.error('Error generating contract PDF:', error);
      throw new BadRequestException(
        'Error al generar el PDF del contrato. Verifique la configuración de jsReport.',
      );
    }
  }

  /**
   * Marca un contrato como firmado: sube la imagen del contrato firmado,
   * cambia el estado a PENDIENTE_INSTALACION y crea la Orden de Trabajo de instalación
   */
  async marcarComoFirmado(
    id: number,
    id_usuario: number,
    archivo: Express.Multer.File,
    observaciones?: string,
  ): Promise<atcContrato> {
    const contrato = await this.findOne(id);

    // Validar estado actual
    if (contrato.estado !== 'PENDIENTE_FIRMA') {
      throw new BadRequestException(
        `El contrato debe estar en estado PENDIENTE_FIRMA para ser firmado. Estado actual: ${contrato.estado}`,
      );
    }

    // Validar archivo
    if (!archivo) {
      throw new BadRequestException(
        'Debe adjuntar la imagen del contrato firmado',
      );
    }

    // Subir archivo a MinIO
    const objectName = `contratos-firmados/${contrato.codigo}/${Date.now()}_${archivo.originalname}`;
    const { url } = await this.minioService.uploadFile(archivo, objectName);

    // Crear la Orden de Trabajo de Instalación
    const ordenInstalacion = await this.ordenesTrabajoService.create(
      {
        tipo: TipoOrden.INSTALACION,
        id_cliente: contrato.id_cliente,
        id_direccion_servicio: contrato.id_direccion_servicio,
        observaciones_tecnico: `Instalación para contrato ${contrato.codigo}${observaciones ? ` - ${observaciones}` : ''}`,
      },
      id_usuario,
    );

    // Actualizar contrato
    const contratoActualizado = await this.prisma.atcContrato.update({
      where: { id_contrato: id },
      data: {
        estado: 'PENDIENTE_INSTALACION',
        url_contrato_firmado: url,
        id_orden_trabajo: ordenInstalacion.id_orden,
      },
      include: this.getIncludeRelations(),
    });

    // Registrar en el log
    await this.prisma.logAction(
      'FIRMAR_CONTRATO',
      id_usuario,
      `Contrato firmado: ${contrato.codigo} - OT creada: ${ordenInstalacion.codigo}${observaciones ? ` - Obs: ${observaciones}` : ''}`,
    );

    return contratoActualizado;
  }

  /**
   * Retorna las relaciones a incluir en las consultas
   */
  private getIncludeRelations() {
    return {
      cliente: {
        select: {
          id_cliente: true,
          titular: true,
          dui: true,
          nit: true,
          correo_electronico: true,
          telefono1: true,
          telefono2: true,
          fecha_nacimiento: true,
          empresa_trabajo: true,
          referencia1: true,
          referencia1_telefono: true,
          referencia2: true,
          referencia2_telefono: true,
          // Nuevos campos de estado civil y vivienda
          estado_civil: true,
          estado_vivienda: true,
          nombre_conyuge: true,
          telefono_conyuge: true,
          telefono_oficina_conyuge: true,
        },
      },
      plan: {
        include: {
          tipoPlan: {
            include: {
              tipoServicio: true,
            },
          },
        },
      },
      ciclo: true,
      direccionServicio: {
        include: {
          municipio: true,
          departamento: true,
          colonias: true,
        },
      },
      ordenTrabajo: {
        select: {
          id_orden: true,
          codigo: true,
          tipo: true,
          estado: true,
        },
      },
      usuarioCreador: {
        select: {
          id_usuario: true,
          nombres: true,
          apellidos: true,
        },
      },
      instalacion: true,
    };
  }

  /**
   * Calcula la edad a partir de la fecha de nacimiento
   */
  private calcularEdad(fechaNacimiento: Date | null): number {
    if (!fechaNacimiento) return 0;
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }
    return edad;
  }

  /**
   * Obtiene el nombre del mes en español
   */
  private obtenerNombreMes(fecha: Date): string {
    const meses = [
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ];
    return meses[fecha.getMonth()];
  }

  /**
   * Formatea una fecha en formato largo en español (14 de diciembre de 2025)
   */
  private formatearFechaLarga(fecha: Date | null): string {
    if (!fecha) return 'N/A';
    const d = new Date(fecha);
    return `${d.getDate()} de ${this.obtenerNombreMes(d)} de ${d.getFullYear()}`;
  }

  /**
   * Formatea una fecha en formato corto (14-12-2025)
   */
  private formatearFechaCorta(fecha: Date | null): string {
    if (!fecha) return 'N/A';
    const d = new Date(fecha);
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  }
}
