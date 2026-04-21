// src/modules/facturacion/ciclos/ciclos.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { randomUUID } from 'crypto';
import {
  CreateCicloDto,
  UpdateCicloDto,
  QueryCicloDto,
  UpdateClienteContactoDto,
  QueryNotificacionesGlobalDto,
  NotificarFacturasDto,
  NotificacionJob,
  NotificacionJobInicioResponse,
  CanalNotificacion,
} from './dto';
import { PaginationDto, PaginatedResult } from 'src/common/dto';
import {
  atcCicloFacturacion,
  estado_factura_directa,
  estado_dte,
  estado_pago_factura,
} from '@prisma/client';
import { validarTelefonoSV, validarEmail } from 'src/common/helpers';
import { FacturaDirectaService } from '../factura-directa/factura-directa.service';
import { MailService } from 'src/modules/mail/mail.service';
import { TemplateService } from 'src/modules/whatsapp-chat/template/template.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CiclosService {
  private readonly logger = new Logger(CiclosService.name);
  private readonly notificacionJobs = new Map<string, NotificacionJob>();
  private readonly JOB_TTL_MS = 60 * 60 * 1000; // 1 hora despues de finalizar
  private readonly DELAY_ENTRE_ENVIOS_MS = 250;

  constructor(
    private readonly prisma: PrismaService,
    private readonly facturaDirectaService: FacturaDirectaService,
    private readonly mailService: MailService,
    @Inject(forwardRef(() => TemplateService))
    private readonly templateService: TemplateService,
    private readonly configService: ConfigService,
  ) {}

  private readonly mesesNombres = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  /**
   * Crear un nuevo ciclo de facturación
   */
  async create(
    createCicloDto: CreateCicloDto,
    id_usuario: number,
  ): Promise<atcCicloFacturacion> {
    // Validar que no exista un ciclo con el mismo día de corte
    const existingCiclo = await this.prisma.atcCicloFacturacion.findFirst({
      where: {
        dia_corte: createCicloDto.dia_corte,
        estado: 'ACTIVO',
      },
    });

    if (existingCiclo) {
      throw new BadRequestException(
        `Ya existe un ciclo activo con día de corte ${createCicloDto.dia_corte}`,
      );
    }

    const ciclo = await this.prisma.atcCicloFacturacion.create({
      data: {
        nombre: createCicloDto.nombre,
        dia_corte: createCicloDto.dia_corte,
        dia_vencimiento: createCicloDto.dia_vencimiento,
        periodo_inicio: createCicloDto.periodo_inicio,
        periodo_fin: createCicloDto.periodo_fin,
      },
    });

    await this.prisma.logAction(
      'CREAR_CICLO_FACTURACION',
      id_usuario,
      `Ciclo creado: ${ciclo.nombre}`,
    );

    return ciclo;
  }

  /**
   * Listar ciclos con paginación y filtros
   */
  async findAll(
    queryDto: QueryCicloDto,
  ): Promise<PaginatedResult<atcCicloFacturacion & { _count: { contratos: number } }>> {
    const { page = 1, limit = 10, search, estado } = queryDto;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.nombre = { contains: search, mode: 'insensitive' };
    }

    if (estado) {
      where.estado = estado;
    }

    const [data, total] = await Promise.all([
      this.prisma.atcCicloFacturacion.findMany({
        where,
        skip,
        take: limit,
        include: {
          _count: {
            select: { contratos: true },
          },
        },
        orderBy: { dia_corte: 'asc' },
      }),
      this.prisma.atcCicloFacturacion.count({ where }),
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
   * Listar todos los ciclos activos (sin paginación, para dropdowns)
   */
  async findAllActive(): Promise<atcCicloFacturacion[]> {
    return this.prisma.atcCicloFacturacion.findMany({
      where: { estado: 'ACTIVO' },
      orderBy: { dia_corte: 'asc' },
    });
  }

  /**
   * Obtener un ciclo por ID
   */
  async findOne(id: number): Promise<atcCicloFacturacion> {
    const ciclo = await this.prisma.atcCicloFacturacion.findUnique({
      where: { id_ciclo: id },
      include: {
        _count: {
          select: { contratos: true },
        },
      },
    });

    if (!ciclo) {
      throw new NotFoundException(`Ciclo con ID ${id} no encontrado`);
    }

    return ciclo;
  }

  /**
   * Obtener los contratos de un ciclo con paginación
   */
  async findContratosByCiclo(id: number, paginationDto: PaginationDto) {
    const ciclo = await this.findOne(id);

    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const [contratos, total] = await Promise.all([
      this.prisma.atcContrato.findMany({
        where: { id_ciclo: id },
        skip,
        take: limit,
        include: {
          cliente: {
            select: {
              id_cliente: true,
              titular: true,
              telefono1: true,
              dui: true,
            },
          },
          plan: {
            select: {
              id_plan: true,
              nombre: true,
              precio: true,
            },
          },
          direccionServicio: {
            select: {
              direccion: true,
            },
          },
        },
        orderBy: { fecha_creacion: 'desc' },
      }),
      this.prisma.atcContrato.count({ where: { id_ciclo: id } }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      ciclo: {
        id_ciclo: ciclo.id_ciclo,
        nombre: ciclo.nombre,
        dia_corte: ciclo.dia_corte,
        dia_vencimiento: ciclo.dia_vencimiento,
        periodo_inicio: ciclo.periodo_inicio,
        periodo_fin: ciclo.periodo_fin,
      },
      contratos: {
        data: contratos,
        meta: {
          total,
          page,
          limit,
          totalPages,
        },
      },
    };
  }

  /**
   * Listar clientes del ciclo con validacion de telefono y correo
   */
  async findNotificacionesByCiclo(id: number) {
    await this.findOne(id);

    const contratos = await this.prisma.atcContrato.findMany({
      where: { id_ciclo: id },
      select: {
        cliente: {
          select: {
            id_cliente: true,
            titular: true,
            telefono1: true,
            telefono2: true,
            correo_electronico: true,
          },
        },
      },
      distinct: ['id_cliente'],
      orderBy: { id_cliente: 'asc' },
    });

    const clientes = contratos
      .map((c) => c.cliente)
      .filter((c) => !!c)
      .map((cliente) => this.evaluarContactoCliente(cliente));

    const resumen = {
      totalClientes: clientes.length,
      telefonosValidos: clientes.filter((c) => c.telefonoValido).length,
      telefonosInvalidos: clientes.filter((c) => !c.telefonoValido).length,
      correosValidos: clientes.filter((c) => c.correoValido).length,
      correosInvalidos: clientes.filter((c) => !c.correoValido).length,
    };

    return { resumen, clientes };
  }

  /**
   * Actualizar telefono y/o correo de un cliente del ciclo
   */
  async updateClienteContacto(
    idCiclo: number,
    idCliente: number,
    dto: UpdateClienteContactoDto,
    id_usuario: number,
  ) {
    await this.findOne(idCiclo);

    const contrato = await this.prisma.atcContrato.findFirst({
      where: { id_ciclo: idCiclo, id_cliente: idCliente },
      select: { id_contrato: true },
    });

    if (!contrato) {
      throw new NotFoundException(
        `El cliente ${idCliente} no pertenece al ciclo ${idCiclo}`,
      );
    }

    return this.aplicarUpdateContacto(idCliente, dto, id_usuario, idCiclo);
  }

  /**
   * Actualizar telefono y/o correo de un cliente sin restriccion de ciclo
   * (usado por la vista global de notificaciones)
   */
  async updateClienteContactoGlobal(
    idCliente: number,
    dto: UpdateClienteContactoDto,
    id_usuario: number,
  ) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id_cliente: idCliente },
      select: { id_cliente: true },
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente con ID ${idCliente} no encontrado`);
    }

    return this.aplicarUpdateContacto(idCliente, dto, id_usuario);
  }

  private async aplicarUpdateContacto(
    idCliente: number,
    dto: UpdateClienteContactoDto,
    id_usuario: number,
    idCiclo?: number,
  ) {
    if (dto.telefono1 === undefined && dto.correo_electronico === undefined) {
      throw new BadRequestException('Debe enviar al menos un campo a actualizar');
    }

    const data: { telefono1?: string; correo_electronico?: string } = {};

    if (dto.telefono1 !== undefined) {
      const v = validarTelefonoSV(dto.telefono1);
      if (!v.valido) {
        throw new BadRequestException(
          `Telefono invalido (${v.razon}): ${dto.telefono1}`,
        );
      }
      data.telefono1 = v.numeroLimpio;
    }

    if (dto.correo_electronico !== undefined) {
      const v = validarEmail(dto.correo_electronico);
      if (!v.valido) {
        throw new BadRequestException(
          `Correo invalido (${v.razon}): ${dto.correo_electronico}`,
        );
      }
      data.correo_electronico = dto.correo_electronico.trim();
    }

    const actualizado = await this.prisma.cliente.update({
      where: { id_cliente: idCliente },
      data,
      select: {
        id_cliente: true,
        titular: true,
        telefono1: true,
        telefono2: true,
        correo_electronico: true,
      },
    });

    const contexto =
      idCiclo !== undefined ? ` (ciclo ${idCiclo})` : ' (vista global)';
    await this.prisma.logAction(
      'EDITAR_CONTACTO_CLIENTE',
      id_usuario,
      `Contacto actualizado para cliente ${actualizado.titular}${contexto}`,
    );

    return this.evaluarContactoCliente(actualizado);
  }

  /**
   * Listar clientes de todos los ciclos (o uno filtrado) con validacion,
   * paginacion, busqueda por nombre y filtro por validez.
   */
  async findNotificacionesGlobal(dto: QueryNotificacionesGlobalDto) {
    const { page = 1, limit = 25, id_ciclo, filtro = 'TODOS', search } = dto;

    const cicloFiltro = Number.isFinite(id_ciclo) ? (id_ciclo as number) : undefined;

    if (cicloFiltro !== undefined) {
      await this.findOne(cicloFiltro);
    }

    const where: any = {};
    if (cicloFiltro !== undefined) {
      where.id_ciclo = cicloFiltro;
    }
    if (search && search.trim()) {
      where.cliente = {
        titular: { contains: search.trim(), mode: 'insensitive' },
      };
    }

    const contratos = await this.prisma.atcContrato.findMany({
      where,
      select: {
        cliente: {
          select: {
            id_cliente: true,
            titular: true,
            telefono1: true,
            telefono2: true,
            correo_electronico: true,
          },
        },
      },
      distinct: ['id_cliente'],
      orderBy: { id_cliente: 'asc' },
    });

    let clientes = contratos
      .map((c) => c.cliente)
      .filter((c) => !!c)
      .map((cliente) => this.evaluarContactoCliente(cliente));

    if (filtro !== 'TODOS') {
      clientes = clientes.filter((c) => {
        switch (filtro) {
          case 'TELEFONO_INVALIDO':
            return !c.telefonoValido;
          case 'CORREO_INVALIDO':
            return !c.correoValido;
          case 'AMBOS_INVALIDOS':
            return !c.telefonoValido && !c.correoValido;
          case 'TODOS_VALIDOS':
            return c.telefonoValido && c.correoValido;
          default:
            return true;
        }
      });
    }

    const resumen = {
      totalClientes: clientes.length,
      telefonosValidos: clientes.filter((c) => c.telefonoValido).length,
      telefonosInvalidos: clientes.filter((c) => !c.telefonoValido).length,
      correosValidos: clientes.filter((c) => c.correoValido).length,
      correosInvalidos: clientes.filter((c) => !c.correoValido).length,
    };

    const total = clientes.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const start = (page - 1) * limit;
    const paginados = clientes.slice(start, start + limit);

    return {
      resumen,
      clientes: paginados,
      meta: { total, page, limit, totalPages },
    };
  }

  private evaluarContactoCliente(cliente: {
    id_cliente: number;
    titular: string;
    telefono1: string | null;
    telefono2: string | null;
    correo_electronico: string | null;
  }) {
    const tel = validarTelefonoSV(cliente.telefono1);
    const tel2 = validarTelefonoSV(cliente.telefono2);
    const mail = validarEmail(cliente.correo_electronico);

    return {
      id: cliente.id_cliente,
      nombre: cliente.titular,
      telefono1: cliente.telefono1 ?? '',
      telefonoValido: tel.valido,
      telefonoLimpio: tel.numeroLimpio,
      telefonoRazon: tel.razon ?? '',
      telefono2: cliente.telefono2 ?? '',
      telefono2Valido: tel2.valido,
      telefono2Limpio: tel2.numeroLimpio,
      telefono2Razon: tel2.razon ?? '',
      correoElectronico: cliente.correo_electronico ?? '',
      correoValido: mail.valido,
      correoRazon: mail.razon ?? '',
    };
  }

  /**
   * Inicia un job asincrono que notifica por correo las facturas pendientes/vencidas del ciclo
   * para el mes indicado. El endpoint retorna inmediatamente con { jobId, total } y el proceso
   * continua en background. El frontend debe consultar el estado via getNotificacionJob.
   *
   * Dimensionado para lotes grandes (~800 envios); envia en serie con una pausa leve entre
   * cada envio para evitar saturar el SMTP. Los errores individuales se capturan y no detienen
   * el proceso.
   */
  async iniciarNotificacionJob(
    idCiclo: number,
    dto: NotificarFacturasDto,
    id_usuario: number,
  ): Promise<NotificacionJobInicioResponse> {
    await this.findOne(idCiclo);

    const { mes, anio, id_cliente } = dto;
    const canal: CanalNotificacion = dto.canal ?? 'email';
    const inicioMes = new Date(anio, mes - 1, 1, 0, 0, 0, 0);
    const finMes = new Date(anio, mes, 0, 23, 59, 59, 999);

    const facturas = await this.prisma.facturaDirecta.findMany({
      where: {
        estado: estado_factura_directa.ACTIVO,
        estado_pago: {
          in: [
            estado_pago_factura.PENDIENTE,
            estado_pago_factura.VENCIDA,
            estado_pago_factura.PARCIAL,
            estado_pago_factura.EN_ACUERDO,
          ],
        },
        fecha_vencimiento: { gte: inicioMes, lte: finMes },
        contrato: { id_ciclo: idCiclo },
        ...(id_cliente !== undefined ? { id_cliente } : {}),
      },
      include: {
        cliente: {
          select: {
            id_cliente: true,
            titular: true,
            telefono1: true,
            correo_electronico: true,
          },
        },
      },
      orderBy: { id_factura_directa: 'asc' },
    });

    const jobId = randomUUID();
    const ahora = new Date().toISOString();
    const job: NotificacionJob = {
      id: jobId,
      id_ciclo: idCiclo,
      mes,
      anio,
      id_cliente,
      canal,
      total: facturas.length,
      procesados: 0,
      enviados: 0,
      fallidos: 0,
      estado: 'EN_PROGRESO',
      errores: [],
      mensaje:
        facturas.length === 0
          ? 'Sin notificaciones por enviar'
          : 'Preparando envio...',
      iniciado_en: ahora,
      actualizado_en: ahora,
      finalizado_en: null,
    };
    this.notificacionJobs.set(jobId, job);
    this.limpiarJobsExpirados();

    // Fire-and-forget: procesar en background, no bloquea la respuesta HTTP.
    this.procesarFacturasJob(jobId, facturas, id_usuario).catch((err) => {
      this.logger.error(
        `Job notificacion ${jobId} fallo: ${err?.message ?? err}`,
      );
      const j = this.notificacionJobs.get(jobId);
      if (j) {
        j.estado = 'ERROR';
        j.mensaje = `Error inesperado: ${err?.message ?? 'desconocido'}`;
        j.finalizado_en = new Date().toISOString();
        j.actualizado_en = j.finalizado_en;
      }
    });

    return { jobId, total: facturas.length };
  }

  /**
   * Consulta el estado de un job de notificacion iniciado previamente.
   */
  getNotificacionJob(jobId: string): NotificacionJob {
    const job = this.notificacionJobs.get(jobId);
    if (!job) {
      throw new NotFoundException(
        `Job de notificacion ${jobId} no encontrado o expirado.`,
      );
    }
    return job;
  }

  private async procesarFacturasJob(
    jobId: string,
    facturas: Array<any>,
    id_usuario: number,
  ): Promise<void> {
    const job = this.notificacionJobs.get(jobId);
    if (!job) return;

    for (let idx = 0; idx < facturas.length; idx++) {
      const factura = facturas[idx];
      const nombreCliente =
        factura.cliente?.titular || factura.cliente_nombre || 'Cliente';
      const correo =
        factura.cliente?.correo_electronico || factura.cliente_correo || null;
      const telefonoRaw =
        factura.cliente?.telefono1 || factura.cliente_telefono || null;

      job.mensaje = `Enviando ${idx + 1} de ${job.total}: ${nombreCliente}`;
      job.actualizado_en = new Date().toISOString();

      try {
        const numeroMostrar =
          factura.numero_control ||
          factura.numero_factura ||
          `FD-${factura.id_factura_directa}`;

        if (job.canal === 'whatsapp') {
          await this.enviarNotificacionWhatsApp({
            factura,
            nombreCliente,
            telefonoRaw,
            numeroMostrar,
            mes: job.mes,
            anio: job.anio,
          });
        } else {
          await this.enviarNotificacionEmail({
            factura,
            nombreCliente,
            correo,
            numeroMostrar,
          });
        }

        job.enviados++;
      } catch (error: any) {
        job.fallidos++;
        job.errores.push({
          id_factura: factura.id_factura_directa,
          numero_control: factura.numero_control,
          cliente: nombreCliente,
          correo,
          telefono: telefonoRaw,
          error: error?.message ?? 'Error desconocido',
        });
        this.logger.warn(
          `Job ${jobId} (${job.canal}): fallo factura ${factura.id_factura_directa} — ${error?.message ?? error}`,
        );
      }

      job.procesados++;
      job.actualizado_en = new Date().toISOString();

      // Pausa leve entre envios para no saturar SMTP / Meta.
      if (idx < facturas.length - 1) {
        await new Promise((r) => setTimeout(r, this.DELAY_ENTRE_ENVIOS_MS));
      }
    }

    job.estado = 'COMPLETADO';
    job.mensaje = `Finalizado: ${job.enviados} enviados, ${job.fallidos} fallidos de ${job.total}`;
    job.finalizado_en = new Date().toISOString();
    job.actualizado_en = job.finalizado_en;

    const alcance =
      job.id_cliente !== undefined ? `cliente ${job.id_cliente}` : 'masivo';
    await this.prisma.logAction(
      'NOTIFICAR_FACTURAS_CICLO',
      id_usuario,
      `Ciclo ${job.id_ciclo} ${String(job.mes).padStart(2, '0')}/${job.anio} (${alcance}, ${job.canal}): ${job.enviados} enviados, ${job.fallidos} fallidos de ${job.total}`,
    );
  }

  private async enviarNotificacionEmail(params: {
    factura: any;
    nombreCliente: string;
    correo: string | null;
    numeroMostrar: string;
  }): Promise<void> {
    const { factura, nombreCliente, correo, numeroMostrar } = params;

    if (!correo || !validarEmail(correo).valido) {
      throw new Error('Cliente sin correo electronico valido');
    }

    if (!factura.dte_json) {
      throw new Error('La factura no tiene JSON del DTE');
    }

    const procesada =
      factura.estado_dte === estado_dte.PROCESADO &&
      !!factura.sello_recepcion;

    // === MODO DEMO: se comenta el envío real y se simula con un delay de 3s ===
    const pdfBuffer = await this.facturaDirectaService.generatePdf(
      factura.id_factura_directa,
    );
    
    const identificador =
      factura.codigo_generacion || `FD-${factura.id_factura_directa}`;
    
    if (procesada) {
      let dteJsonCompleto: string = factura.dte_json || '';
      try {
        const dteObj = JSON.parse(factura.dte_json || '{}');
        if (factura.dte_firmado) dteObj.firmaElectronica = factura.dte_firmado;
        if (factura.sello_recepcion) dteObj.selloRecibido = factura.sello_recepcion;
        dteJsonCompleto = JSON.stringify(dteObj, null, 4);
      } catch {
        // Si el JSON no parsea, se envia el original sin firma/sello embebidos
      }
    
      await this.mailService.sendFacturaEmail(
        correo,
        nombreCliente,
        numeroMostrar,
        identificador,
        pdfBuffer,
        dteJsonCompleto,
      );
    } else {
      await this.mailService.sendAvisoPagoEmail(
        correo,
        nombreCliente,
        numeroMostrar,
        identificador,
        pdfBuffer,
      );
    }
    await new Promise((r) => setTimeout(r, 3000));
    void procesada;
    void numeroMostrar;
    void nombreCliente;
  }

  private async enviarNotificacionWhatsApp(params: {
    factura: any;
    nombreCliente: string;
    telefonoRaw: string | null;
    numeroMostrar: string;
    mes: number;
    anio: number;
  }): Promise<void> {
    const { factura, nombreCliente, telefonoRaw, mes, anio } = params;

    if (!telefonoRaw) {
      throw new Error('Cliente sin numero de telefono registrado');
    }

    const validacion = validarTelefonoSV(telefonoRaw);
    if (!validacion.valido) {
      throw new Error(`Telefono invalido (${validacion.razon ?? 'desconocido'})`);
    }

    const frontendUrl = (
      this.configService.get<string>('FRONTEND_URL') ?? ''
    ).replace(/\/+$/, '');
    if (!frontendUrl) {
      throw new Error('FRONTEND_URL no configurado en el backend');
    }

    const linkFactura = `${frontendUrl}/ver/factura/${factura.id_factura_directa}`;
    const periodo = `${this.mesesNombres[mes - 1]} ${anio}`;

    const nombreTemplate =
      this.configService.get<string>('WHATSAPP_TEMPLATE_NOTIFICACION_FACTURA') ??
      'aviso_pago';
    const idiomaTemplate =
      this.configService.get<string>(
        'WHATSAPP_TEMPLATE_NOTIFICACION_FACTURA_IDIOMA',
      ) ?? 'es';

    // === MODO DEMO: se comenta el envío real y se simula con un delay de 3s ===
    const resultado = await this.templateService.sendTemplate(
      validacion.numeroLimpio,
      {
        nombre_template: nombreTemplate,
        idioma: idiomaTemplate,
        parametros: {
          body_1: nombreCliente,
          body_2: periodo,
          button_0_url: linkFactura,
        },
      } as any,
    );
    
    if (!resultado?.success) {
      throw new Error(
        resultado?.error ?? 'Error desconocido al enviar plantilla de WhatsApp',
      );
    }
    await new Promise((r) => setTimeout(r, 3000));
    void nombreTemplate;
    void idiomaTemplate;
    void linkFactura;
    void periodo;
    void nombreCliente;
  }

  private limpiarJobsExpirados(): void {
    const ahora = Date.now();
    for (const [id, job] of this.notificacionJobs) {
      if (job.estado === 'EN_PROGRESO' || !job.finalizado_en) continue;
      const edad = ahora - new Date(job.finalizado_en).getTime();
      if (edad > this.JOB_TTL_MS) {
        this.notificacionJobs.delete(id);
      }
    }
  }

  /**
   * Actualizar un ciclo
   */
  async update(
    id: number,
    updateCicloDto: UpdateCicloDto,
    id_usuario: number,
  ): Promise<atcCicloFacturacion> {
    const existingCiclo = await this.findOne(id);

    // Si se está cambiando el día de corte, validar que no exista otro ciclo con ese día
    if (
      updateCicloDto.dia_corte &&
      updateCicloDto.dia_corte !== existingCiclo.dia_corte
    ) {
      const duplicateCiclo = await this.prisma.atcCicloFacturacion.findFirst({
        where: {
          dia_corte: updateCicloDto.dia_corte,
          estado: 'ACTIVO',
          NOT: { id_ciclo: id },
        },
      });

      if (duplicateCiclo) {
        throw new BadRequestException(
          `Ya existe un ciclo activo con día de corte ${updateCicloDto.dia_corte}`,
        );
      }
    }

    const ciclo = await this.prisma.atcCicloFacturacion.update({
      where: { id_ciclo: id },
      data: updateCicloDto,
    });

    await this.prisma.logAction(
      'ACTUALIZAR_CICLO_FACTURACION',
      id_usuario,
      `Ciclo actualizado: ${ciclo.nombre}`,
    );

    return ciclo;
  }

  /**
   * Eliminar un ciclo (soft delete)
   */
  async remove(id: number, id_usuario: number): Promise<atcCicloFacturacion> {
    const ciclo = await this.findOne(id);

    // Verificar si tiene contratos asociados
    const contratosCount = await this.prisma.atcContrato.count({
      where: { id_ciclo: id },
    });

    if (contratosCount > 0) {
      throw new BadRequestException(
        `No se puede eliminar el ciclo porque tiene ${contratosCount} contrato(s) asociado(s)`,
      );
    }

    const updatedCiclo = await this.prisma.atcCicloFacturacion.update({
      where: { id_ciclo: id },
      data: { estado: 'INACTIVO' },
    });

    await this.prisma.logAction(
      'ELIMINAR_CICLO_FACTURACION',
      id_usuario,
      `Ciclo eliminado: ${ciclo.nombre}`,
    );

    return updatedCiclo;
  }
}
