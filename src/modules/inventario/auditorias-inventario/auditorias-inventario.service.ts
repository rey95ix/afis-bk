import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MinioService } from '../../minio/minio.service';
import {
  CreateAuditoriaDto,
  UpdateAuditoriaDto,
  FilterAuditoriaDto,
  IniciarConteoDto,
  RegistrarConteoDto,
  EscanearSerieDto,
  FinalizarAuditoriaDto,
  CreateAjusteDto,
  AutorizarAjusteDto,
  FilterAjusteDto,
  QueryMetricasDto,
  UploadEvidenciaDto,
} from './dto';
import {
  estado_auditoria,
  estado_ajuste,
  tipo_discrepancia,
  tipo_movimiento,
  Prisma,
} from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

@Injectable()
export class AuditoriasInventarioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
  ) {}

  /**
   * Generar código único para auditoría: AUD-YYYYMM-####
   */
  private async generarCodigoAuditoria(): Promise<string> {
    const now = new Date();
    const prefix = `AUD-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    const ultimaAuditoria = await this.prisma.auditorias_inventario.findFirst({
      where: { codigo: { startsWith: prefix } },
      orderBy: { codigo: 'desc' },
    });

    let numero = 1;
    if (ultimaAuditoria) {
      const partes = ultimaAuditoria.codigo.split('-');
      numero = parseInt(partes[2]) + 1;
    }

    return `${prefix}-${String(numero).padStart(4, '0')}`;
  }

  /**
   * Generar código único para ajuste: AJU-YYYYMM-####
   */
  private async generarCodigoAjuste(): Promise<string> {
    const now = new Date();
    const prefix = `AJU-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    const ultimoAjuste = await this.prisma.ajustes_inventario.findFirst({
      where: { codigo: { startsWith: prefix } },
      orderBy: { codigo: 'desc' },
    });

    let numero = 1;
    if (ultimoAjuste) {
      const partes = ultimoAjuste.codigo.split('-');
      numero = parseInt(partes[2]) + 1;
    }

    return `${prefix}-${String(numero).padStart(4, '0')}`;
  }

  /**
   * Crear nueva auditoría
   */
  async create(
    createDto: CreateAuditoriaDto,
    id_usuario: number,
  ): Promise<any> {
    // Validar que la bodega existe
    const bodega = await this.prisma.bodegas.findUnique({
      where: { id_bodega: createDto.id_bodega },
    });
    console.log(bodega)
    if (!bodega) {
      throw new NotFoundException(
        `Bodega con ID ${createDto.id_bodega} no encontrada`,
      );
    }

    // Validar estante si se especifica
    if (createDto.id_estante) {
      const estante = await this.prisma.estantes.findFirst({
        where: {
          id_estante: createDto.id_estante,
          id_bodega: createDto.id_bodega,
        },
      });

      if (!estante) {
        throw new BadRequestException(
          `Estante con ID ${createDto.id_estante} no pertenece a la bodega ${createDto.id_bodega}`,
        );
      }
    }

    const codigo = await this.generarCodigoAuditoria();

    // Preparar categorías JSON si aplica
    let categoriasJson: string | null = null;
    if (!createDto.incluir_todas_categorias && createDto.categorias_a_auditar) {
      categoriasJson = JSON.stringify(createDto.categorias_a_auditar);
    }

    const auditoria = await this.prisma.auditorias_inventario.create({
      data: {
        codigo,
        tipo: createDto.tipo,
        estado: estado_auditoria.PLANIFICADA,
        id_bodega: createDto.id_bodega,
        id_estante: createDto.id_estante,
        incluir_todas_categorias: createDto.incluir_todas_categorias ?? true,
        categorias_a_auditar: categoriasJson,
        id_usuario_planifica: id_usuario,
        fecha_planificada: createDto.fecha_planificada
          ? new Date(createDto.fecha_planificada)
          : null,
        observaciones: createDto.observaciones,
      },
      include: {
        bodega: {
          select: {
            id_bodega: true,
            nombre: true,
            tipo: true,
          },
        },
        estante: {
          select: {
            id_estante: true,
            nombre: true,
          },
        },
        usuario_planifica: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
    });

    return auditoria;
  }

  /**
   * Listar auditorías con filtros y paginación
   */
  async findAll(filterDto: FilterAuditoriaDto): Promise<any> {
    const { page = 1, limit = 10, ...filters } = filterDto;
    const skip = (page - 1) * limit;

    const where: Prisma.auditorias_inventarioWhereInput = {};

    if (filters.tipo) where.tipo = filters.tipo;
    if (filters.estado) where.estado = filters.estado;
    if (filters.id_bodega) where.id_bodega = filters.id_bodega;
    if (filters.id_estante) where.id_estante = filters.id_estante;
    if (filters.id_usuario_planifica)
      where.id_usuario_planifica = filters.id_usuario_planifica;
    if (filters.id_usuario_ejecuta)
      where.id_usuario_ejecuta = filters.id_usuario_ejecuta;

    if (filters.fecha_desde || filters.fecha_hasta) {
      where.fecha_creacion = {};
      if (filters.fecha_desde)
        where.fecha_creacion.gte = new Date(filters.fecha_desde);
      if (filters.fecha_hasta)
        where.fecha_creacion.lte = new Date(filters.fecha_hasta);
    }

    const [auditorias, total] = await Promise.all([
      this.prisma.auditorias_inventario.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fecha_creacion: 'desc' },
        include: {
          bodega: {
            select: {
              id_bodega: true,
              nombre: true,
              tipo: true,
            },
          },
          estante: {
            select: {
              id_estante: true,
              nombre: true,
            },
          },
          usuario_planifica: {
            select: {
              id_usuario: true,
              nombres: true,
              apellidos: true,
            },
          },
          usuario_ejecuta: {
            select: {
              id_usuario: true,
              nombres: true,
              apellidos: true,
            },
          },
          _count: {
            select: {
              detalle: true,
              evidencias: true,
              ajustes: true,
            },
          },
        },
      }),
      this.prisma.auditorias_inventario.count({ where }),
    ]);

    // El TransformInterceptor envuelve la respuesta, así que retornamos directamente
    return {
      auditorias,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Obtener una auditoría específica con todo su detalle
   */
  async findOne(id: number): Promise<any> {
    const auditoria = await this.prisma.auditorias_inventario.findUnique({
      where: { id_auditoria: id },
      include: {
        bodega: {
          select: {
            id_bodega: true,
            nombre: true,
            tipo: true,
            sucursal: {
              select: {
                id_sucursal: true,
                nombre: true,
              },
            },
          },
        },
        estante: {
          select: {
            id_estante: true,
            nombre: true,
          },
        },
        usuario_planifica: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
            usuario: true,
          },
        },
        usuario_ejecuta: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
            usuario: true,
          },
        },
        detalle: {
          include: {
            catalogo: {
              select: {
                id_catalogo: true,
                codigo: true,
                nombre: true,
                descripcion: true,
                categoria: {
                  select: {
                    id_categoria: true,
                    nombre: true,
                    codigo: true,
                  },
                },
              },
            },
            usuario_conteo: {
              select: {
                id_usuario: true,
                nombres: true,
                apellidos: true,
              },
            },
            series: true,
          },
          orderBy: {
            catalogo: {
              nombre: 'asc',
            },
          },
        },
        evidencias: {
          include: {
            usuario_subida: {
              select: {
                id_usuario: true,
                nombres: true,
                apellidos: true,
              },
            },
          },
          orderBy: {
            fecha_subida: 'desc',
          },
        },
        ajustes: {
          include: {
            catalogo: {
              select: {
                id_catalogo: true,
                codigo: true,
                nombre: true,
              },
            },
            usuario_solicita: {
              select: {
                id_usuario: true,
                nombres: true,
                apellidos: true,
              },
            },
            usuario_autoriza: {
              select: {
                id_usuario: true,
                nombres: true,
                apellidos: true,
              },
            },
          },
          orderBy: {
            fecha_solicitud: 'desc',
          },
        },
        snapshot: true,
      },
    });

    if (!auditoria) {
      throw new NotFoundException(`Auditoría con ID ${id} no encontrada`);
    }

    return auditoria;
  }

  /**
   * Actualizar auditoría (solo si está en estado PLANIFICADA)
   */
  async update(
    id: number,
    updateDto: UpdateAuditoriaDto,
    id_usuario: number,
  ): Promise<any> {
    const auditoria = await this.prisma.auditorias_inventario.findUnique({
      where: { id_auditoria: id },
    });

    if (!auditoria) {
      throw new NotFoundException(`Auditoría con ID ${id} no encontrada`);
    }

    if (auditoria.estado !== estado_auditoria.PLANIFICADA) {
      throw new BadRequestException(
        'Solo se pueden actualizar auditorías en estado PLANIFICADA',
      );
    }

    // Preparar categorías JSON si aplica
    let categoriasJson: string | undefined;
    if (
      updateDto.incluir_todas_categorias === false &&
      updateDto.categorias_a_auditar
    ) {
      categoriasJson = JSON.stringify(updateDto.categorias_a_auditar);
    }

    const auditoriaActualizada = await this.prisma.auditorias_inventario.update(
      {
        where: { id_auditoria: id },
        data: {
          tipo: updateDto.tipo,
          estado: updateDto.estado,
          id_estante: updateDto.id_estante,
          incluir_todas_categorias: updateDto.incluir_todas_categorias,
          categorias_a_auditar: categoriasJson,
          fecha_planificada: updateDto.fecha_planificada
            ? new Date(updateDto.fecha_planificada)
            : undefined,
          observaciones: updateDto.observaciones,
        },
        include: {
          bodega: true,
          estante: true,
          usuario_planifica: true,
          usuario_ejecuta: true,
        },
      },
    );

    return auditoriaActualizada;
  }

  /**
   * Cancelar auditoría
   */
  async remove(id: number, id_usuario: number): Promise<any> {
    const auditoria = await this.prisma.auditorias_inventario.findUnique({
      where: { id_auditoria: id },
    });

    if (!auditoria) {
      throw new NotFoundException(`Auditoría con ID ${id} no encontrada`);
    }

    if (
      auditoria.estado === estado_auditoria.COMPLETADA ||
      auditoria.estado === estado_auditoria.CANCELADA
    ) {
      throw new BadRequestException(
        'No se puede cancelar una auditoría completada o ya cancelada',
      );
    }

    const auditoriaCancelada = await this.prisma.auditorias_inventario.update({
      where: { id_auditoria: id },
      data: {
        estado: estado_auditoria.CANCELADA,
        observaciones: `${auditoria.observaciones || ''}\n[CANCELADA por usuario ${id_usuario}]`,
      },
    });

    return auditoriaCancelada;
  }

  /**
   * Iniciar conteo físico
   * - Cambia estado a EN_PROGRESO
   * - Asigna usuario ejecutor
   * - Crea registros de detalle con stock actual del sistema
   */
  async iniciarConteo(
    id: number,
    iniciarDto: IniciarConteoDto,
    id_usuario: number,
  ): Promise<any> {
    const auditoria = await this.prisma.auditorias_inventario.findUnique({
      where: { id_auditoria: id },
      include: {
        detalle: true,
      },
    });

    if (!auditoria) {
      throw new NotFoundException(`Auditoría con ID ${id} no encontrada`);
    }

    if (auditoria.estado !== estado_auditoria.PLANIFICADA) {
      throw new BadRequestException(
        'Solo se puede iniciar una auditoría en estado PLANIFICADA',
      );
    }

    // Si ya tiene detalles, no los volvemos a crear
    if (auditoria.detalle.length > 0) {
      return await this.prisma.auditorias_inventario.update({
        where: { id_auditoria: id },
        data: {
          estado: estado_auditoria.EN_PROGRESO,
          id_usuario_ejecuta: id_usuario,
          fecha_inicio: new Date(),
          observaciones: iniciarDto.observaciones
            ? `${auditoria.observaciones || ''}\n${iniciarDto.observaciones}`
            : auditoria.observaciones,
        },
        include: {
          bodega: true,
          usuario_ejecuta: true,
          detalle: {
            include: {
              catalogo: {
                select: {
                  id_catalogo: true,
                  codigo: true,
                  nombre: true,
                },
              },
            },
          },
        },
      });
    }

    // Construir WHERE para obtener inventario a auditar
    const whereInventario: Prisma.inventarioWhereInput = {
      id_bodega: auditoria.id_bodega,
      estado: 'ACTIVO',
    };

    if (auditoria.id_estante) {
      whereInventario.id_estante = auditoria.id_estante;
    }

    // Filtrar por categorías si aplica
    if (!auditoria.incluir_todas_categorias && auditoria.categorias_a_auditar) {
      const categorias: number[] = JSON.parse(auditoria.categorias_a_auditar);
      whereInventario.catalogo = {
        id_categoria: {
          in: categorias,
        },
      };
    }

    // Obtener inventario actual
    const inventarios = await this.prisma.inventario.findMany({
      where: whereInventario,
      include: {
        catalogo: {
          select: {
            id_catalogo: true,
            codigo: true,
            nombre: true,
          },
        },
      },
    });

    if (inventarios.length === 0) {
      throw new BadRequestException(
        'No se encontró inventario para auditar con los filtros especificados',
      );
    }

    // Crear registros de detalle en transacción
    await this.prisma.$transaction(async (tx) => {
      // Actualizar auditoria
      await tx.auditorias_inventario.update({
        where: { id_auditoria: id },
        data: {
          estado: estado_auditoria.EN_PROGRESO,
          id_usuario_ejecuta: id_usuario,
          fecha_inicio: new Date(),
          observaciones: iniciarDto.observaciones
            ? `${auditoria.observaciones || ''}\n${iniciarDto.observaciones}`
            : auditoria.observaciones,
        },
      });

      // Crear detalles
      const detallesData = inventarios.map((inv) => ({
        id_auditoria: id,
        id_catalogo: inv.id_catalogo,
        cantidad_sistema: inv.cantidad_disponible,
        cantidad_reservada_sistema: inv.cantidad_reservada,
        costo_promedio_sistema: inv.costo_promedio || 0,
        fue_contado: false,
      }));

      await tx.auditorias_detalle.createMany({
        data: detallesData,
      });
    });

    return await this.findOne(id);
  }

  /**
   * Registrar conteos físicos de múltiples productos
   */
  async registrarConteo(
    id: number,
    registrarDto: RegistrarConteoDto,
    id_usuario: number,
  ): Promise<any> {
    const auditoria = await this.prisma.auditorias_inventario.findUnique({
      where: { id_auditoria: id },
    });

    if (!auditoria) {
      throw new NotFoundException(`Auditoría con ID ${id} no encontrada`);
    }

    if (auditoria.estado !== estado_auditoria.EN_PROGRESO) {
      throw new BadRequestException(
        'Solo se pueden registrar conteos en auditorías EN_PROGRESO',
      );
    }

    // Actualizar cada detalle con el conteo físico
    const updates = registrarDto.conteos.map(async (conteo) => {
      const detalle = await this.prisma.auditorias_detalle.findFirst({
        where: {
          id_auditoria: id,
          id_catalogo: conteo.id_catalogo,
        },
      });

      if (!detalle) {
        throw new NotFoundException(
          `Producto con ID ${conteo.id_catalogo} no está en esta auditoría`,
        );
      }

      // Calcular discrepancia
      const discrepancia = conteo.cantidad_fisica - detalle.cantidad_sistema;
      const discrepanciaValor = discrepancia * Number(detalle.costo_promedio_sistema);
      const porcentajeDiscrepancia =
        detalle.cantidad_sistema > 0
          ? Math.abs((discrepancia / detalle.cantidad_sistema) * 100)
          : 0;

      let tipoDiscrepancia: tipo_discrepancia;
      if (discrepancia > 0) {
        tipoDiscrepancia = tipo_discrepancia.SOBRANTE;
      } else if (discrepancia < 0) {
        tipoDiscrepancia = tipo_discrepancia.FALTANTE;
      } else {
        tipoDiscrepancia = tipo_discrepancia.CONFORME;
      }

      return this.prisma.auditorias_detalle.update({
        where: { id_auditoria_detalle: detalle.id_auditoria_detalle },
        data: {
          cantidad_fisica: conteo.cantidad_fisica,
          fue_contado: true,
          discrepancia,
          discrepancia_valor: discrepanciaValor,
          porcentaje_discrepancia: porcentajeDiscrepancia,
          tipo_discrepancia: tipoDiscrepancia,
          requiere_investigacion: porcentajeDiscrepancia > 10, // Más del 10%
          observaciones_conteo: conteo.observaciones,
          id_usuario_conteo: id_usuario,
          fecha_conteo: new Date(),
        },
      });
    });

    await Promise.all(updates);

    // Actualizar observaciones generales si existen
    if (registrarDto.observaciones_generales) {
      await this.prisma.auditorias_inventario.update({
        where: { id_auditoria: id },
        data: {
          observaciones: `${auditoria.observaciones || ''}\n[Conteo]: ${registrarDto.observaciones_generales}`,
        },
      });
    }

    return await this.findOne(id);
  }

  /**
   * Escanear serie individual durante auditoría
   */
  async escanearSerie(
    id: number,
    escanearDto: EscanearSerieDto,
    id_usuario: number,
  ): Promise<any> {
    const auditoria = await this.prisma.auditorias_inventario.findUnique({
      where: { id_auditoria: id },
    });

    if (!auditoria) {
      throw new NotFoundException(`Auditoría con ID ${id} no encontrada`);
    }

    if (auditoria.estado !== estado_auditoria.EN_PROGRESO) {
      throw new BadRequestException(
        'Solo se pueden escanear series en auditorías EN_PROGRESO',
      );
    }

    // Buscar el detalle de este producto
    const detalle = await this.prisma.auditorias_detalle.findFirst({
      where: {
        id_auditoria: id,
        id_catalogo: escanearDto.id_catalogo,
      },
    });

    if (!detalle) {
      throw new NotFoundException(
        `Producto con ID ${escanearDto.id_catalogo} no está en esta auditoría`,
      );
    }

    // Buscar serie en sistema
    const serieEnSistema = await this.prisma.inventario_series.findUnique({
      where: { numero_serie: escanearDto.numero_serie },
      include: {
        inventario: true,
      },
    });

    const serieRegistrada = await this.prisma.auditorias_series.create({
      data: {
        id_auditoria_detalle: detalle.id_auditoria_detalle,
        numero_serie: escanearDto.numero_serie,
        encontrado_fisicamente: escanearDto.encontrado_fisicamente ?? true,
        existe_en_sistema: !!serieEnSistema,
        estado_en_sistema: serieEnSistema?.estado,
        ubicacion_esperada_bodega: serieEnSistema?.inventario?.id_bodega,
        ubicacion_real_bodega: auditoria.id_bodega,
        observaciones: escanearDto.observaciones,
      },
    });

    return serieRegistrada;
  }

  /**
   * Subir evidencia fotográfica
   */
  async uploadEvidencia(
    id: number,
    file: Express.Multer.File,
    uploadDto: UploadEvidenciaDto,
    id_usuario: number,
  ): Promise<any> {
    const auditoria = await this.prisma.auditorias_inventario.findUnique({
      where: { id_auditoria: id },
    });

    if (!auditoria) {
      throw new NotFoundException(`Auditoría con ID ${id} no encontrada`);
    }

    // Subir archivo a MinIO
    const fileName = `auditorias/${id}/${Date.now()}_${file.originalname}`;
    const { url } = await this.minioService.uploadFile(
      file,
      fileName,
    );

    // Registrar evidencia en BD
    const evidencia = await this.prisma.auditorias_evidencias.create({
      data: {
        id_auditoria: id,
        tipo: uploadDto.tipo,
        titulo: uploadDto.titulo,
        descripcion: uploadDto.descripcion,
        nombre_archivo: file.originalname,
        ruta_archivo: url,
        mimetype: file.mimetype,
        size: file.size,
        id_catalogo: uploadDto.id_catalogo,
        id_usuario_subida: id_usuario,
      },
      include: {
        usuario_subida: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
    });

    return evidencia;
  }

  /**
   * Finalizar auditoría y calcular resumen
   */
  async finalizarAuditoria(
    id: number,
    finalizarDto: FinalizarAuditoriaDto,
    id_usuario: number,
  ): Promise<any> {
    const auditoria = await this.prisma.auditorias_inventario.findUnique({
      where: { id_auditoria: id },
      include: {
        detalle: true,
      },
    });

    if (!auditoria) {
      throw new NotFoundException(`Auditoría con ID ${id} no encontrada`);
    }

    if (auditoria.estado !== estado_auditoria.EN_PROGRESO) {
      throw new BadRequestException(
        'Solo se puede finalizar una auditoría EN_PROGRESO',
      );
    }

    // Calcular resumen
    const totalItems = auditoria.detalle.length;
    const itemsContados = auditoria.detalle.filter((d) => d.fue_contado).length;

    if (itemsContados === 0) {
      throw new BadRequestException(
        'No se han registrado conteos. Debe contar al menos un producto.',
      );
    }

    const itemsConformes = auditoria.detalle.filter(
      (d) => d.tipo_discrepancia === tipo_discrepancia.CONFORME,
    ).length;

    const itemsConDiscrepancia = auditoria.detalle.filter(
      (d) =>
        d.tipo_discrepancia === tipo_discrepancia.FALTANTE ||
        d.tipo_discrepancia === tipo_discrepancia.SOBRANTE,
    ).length;

    const valorTotalDiscrepancias = auditoria.detalle.reduce(
      (sum, d) => sum + Number(d.discrepancia_valor || 0),
      0,
    );

    const porcentajeAccuracy =
      itemsContados > 0 ? (itemsConformes / itemsContados) * 100 : 0;

    // Actualizar auditoría
    const auditoriaFinalizada = await this.prisma.auditorias_inventario.update({
      where: { id_auditoria: id },
      data: {
        estado: estado_auditoria.PENDIENTE_REVISION,
        fecha_fin: new Date(),
        total_items_auditados: itemsContados,
        total_items_conformes: itemsConformes,
        total_items_con_discrepancia: itemsConDiscrepancia,
        valor_total_discrepancias: valorTotalDiscrepancias,
        porcentaje_accuracy: porcentajeAccuracy,
        observaciones: finalizarDto.observaciones
          ? `${auditoria.observaciones || ''}\n[Finalización]: ${finalizarDto.observaciones}`
          : auditoria.observaciones,
      },
    });

    // Crear snapshot automáticamente
    await this.createSnapshot(id);

    return await this.findOne(id);
  }

  /**
   * Obtener discrepancias de una auditoría
   */
  async getDiscrepancias(id: number): Promise<any> {
    const auditoria = await this.prisma.auditorias_inventario.findUnique({
      where: { id_auditoria: id },
    });

    if (!auditoria) {
      throw new NotFoundException(`Auditoría con ID ${id} no encontrada`);
    }

    const discrepancias = await this.prisma.auditorias_detalle.findMany({
      where: {
        id_auditoria: id,
        OR: [
          { tipo_discrepancia: tipo_discrepancia.FALTANTE },
          { tipo_discrepancia: tipo_discrepancia.SOBRANTE },
        ],
      },
      include: {
        catalogo: {
          select: {
            id_catalogo: true,
            codigo: true,
            nombre: true,
            descripcion: true,
            categoria: {
              select: {
                id_categoria: true,
                nombre: true,
              },
            },
          },
        },
        usuario_conteo: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
        series: true,
      },
      orderBy: [
        { tipo_discrepancia: 'asc' },
        { discrepancia_valor: 'desc' },
      ],
    });

    // Agrupar por tipo de discrepancia
    const faltantes = discrepancias.filter(
      (d) => d.tipo_discrepancia === tipo_discrepancia.FALTANTE,
    );
    const sobrantes = discrepancias.filter(
      (d) => d.tipo_discrepancia === tipo_discrepancia.SOBRANTE,
    );

    const resumen = {
      total_discrepancias: discrepancias.length,
      total_faltantes: faltantes.length,
      total_sobrantes: sobrantes.length,
      valor_faltantes: faltantes.reduce(
        (sum, d) => sum + Math.abs(Number(d.discrepancia_valor || 0)),
        0,
      ),
      valor_sobrantes: sobrantes.reduce(
        (sum, d) => sum + Math.abs(Number(d.discrepancia_valor || 0)),
        0,
      ),
      valor_neto: discrepancias.reduce(
        (sum, d) => sum + Number(d.discrepancia_valor || 0),
        0,
      ),
    };

    return {
      auditoria: {
        id_auditoria: auditoria.id_auditoria,
        codigo: auditoria.codigo,
        tipo: auditoria.tipo,
        estado: auditoria.estado,
      },
      resumen,
      discrepancias,
      faltantes,
      sobrantes,
    };
  }

  /**
   * Generar ajustes desde discrepancias de auditoría
   */
  async generarAjustes(
    id: number,
    createDto: CreateAjusteDto,
    id_usuario: number,
  ): Promise<any> {
    const auditoria = await this.prisma.auditorias_inventario.findUnique({
      where: { id_auditoria: id },
      include: {
        detalle: true,
      },
    });

    if (!auditoria) {
      throw new NotFoundException(`Auditoría con ID ${id} no encontrada`);
    }

    if (
      auditoria.estado !== estado_auditoria.PENDIENTE_REVISION &&
      auditoria.estado !== estado_auditoria.COMPLETADA
    ) {
      throw new BadRequestException(
        'Solo se pueden generar ajustes de auditorías en PENDIENTE_REVISION o COMPLETADA',
      );
    }

    // Crear ajustes en transacción
    const ajustesCreados = await this.prisma.$transaction(async (tx) => {
      const ajustes: any[] = [];

      for (const ajusteItem of createDto.ajustes) {
        // Validar que el detalle existe
        const detalle = await tx.auditorias_detalle.findUnique({
          where: { id_auditoria_detalle: ajusteItem.id_auditoria_detalle },
        });

        if (!detalle) {
          throw new NotFoundException(
            `Detalle de auditoría ${ajusteItem.id_auditoria_detalle} no encontrado`,
          );
        }

        if (detalle.id_auditoria !== id) {
          throw new BadRequestException(
            `Detalle ${ajusteItem.id_auditoria_detalle} no pertenece a esta auditoría`,
          );
        }

        // Obtener inventario actual
        const inventario = await tx.inventario.findFirst({
          where: {
            id_catalogo: ajusteItem.id_catalogo,
            id_bodega: auditoria.id_bodega,
            id_estante: auditoria.id_estante,
          },
        });

        if (!inventario) {
          throw new NotFoundException(
            `Inventario para producto ${ajusteItem.id_catalogo} no encontrado`,
          );
        }

        const codigo = await this.generarCodigoAjuste();

        const ajuste = await tx.ajustes_inventario.create({
          data: {
            codigo,
            id_auditoria: id,
            id_auditoria_detalle: ajusteItem.id_auditoria_detalle,
            id_catalogo: ajusteItem.id_catalogo,
            id_bodega: auditoria.id_bodega,
            id_estante: auditoria.id_estante,
            cantidad_anterior: ajusteItem.cantidad_anterior,
            cantidad_ajuste: ajusteItem.cantidad_nueva - ajusteItem.cantidad_anterior,
            cantidad_nueva: ajusteItem.cantidad_nueva,
            costo_unitario: inventario.costo_promedio,
            motivo: tipo_movimiento.AJUSTE_INVENTARIO,
            motivo_detallado:
              createDto.motivo_detallado ||
              `Ajuste por auditoría ${auditoria.codigo}`,
            tipo_discrepancia: ajusteItem.tipo_discrepancia,
            causa_discrepancia: ajusteItem.causa_discrepancia,
            estado: estado_ajuste.PENDIENTE_AUTORIZACION,
            id_usuario_solicita: id_usuario,
            documentos_soporte: createDto.documentos_soporte,
            observaciones_autorizacion: ajusteItem.observaciones,
          },
        });

        ajustes.push(ajuste);
      }

      return ajustes;
    });

    return ajustesCreados;
  }

  /**
   * Listar ajustes con filtros
   */
  async getAjustes(filterDto: FilterAjusteDto): Promise<any> {
    const { page = 1, limit = 10, ...filters } = filterDto;
    const skip = (page - 1) * limit;

    const where: Prisma.ajustes_inventarioWhereInput = {};

    if (filters.estado) where.estado = filters.estado;
    if (filters.id_auditoria) where.id_auditoria = filters.id_auditoria;
    if (filters.id_catalogo) where.id_catalogo = filters.id_catalogo;
    if (filters.id_bodega) where.id_bodega = filters.id_bodega;
    if (filters.tipo_discrepancia) where.tipo_discrepancia = filters.tipo_discrepancia;
    if (filters.causa_discrepancia) where.causa_discrepancia = filters.causa_discrepancia;
    if (filters.id_usuario_solicita) where.id_usuario_solicita = filters.id_usuario_solicita;
    if (filters.id_usuario_autoriza) where.id_usuario_autoriza = filters.id_usuario_autoriza;

    if (filters.fecha_desde || filters.fecha_hasta) {
      where.fecha_solicitud = {};
      if (filters.fecha_desde) where.fecha_solicitud.gte = new Date(filters.fecha_desde);
      if (filters.fecha_hasta) where.fecha_solicitud.lte = new Date(filters.fecha_hasta);
    }

    const [ajustes, total] = await Promise.all([
      this.prisma.ajustes_inventario.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fecha_solicitud: 'desc' },
        include: {
          auditoria: {
            select: {
              id_auditoria: true,
              codigo: true,
              tipo: true,
            },
          },
          catalogo: {
            select: {
              id_catalogo: true,
              codigo: true,
              nombre: true,
              categoria: {
                select: {
                  id_categoria: true,
                  nombre: true,
                },
              },
            },
          },
          bodega: {
            select: {
              id_bodega: true,
              nombre: true,
            },
          },
          usuario_solicita: {
            select: {
              id_usuario: true,
              nombres: true,
              apellidos: true,
            },
          },
          usuario_autoriza: {
            select: {
              id_usuario: true,
              nombres: true,
              apellidos: true,
            },
          },
        },
      }),
      this.prisma.ajustes_inventario.count({ where }),
    ]);

    return {
      data: ajustes,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Autorizar o rechazar ajuste
   */
  async autorizarAjuste(
    id: number,
    autorizarDto: AutorizarAjusteDto,
    id_usuario: number,
  ): Promise<any> {
    const ajuste = await this.prisma.ajustes_inventario.findUnique({
      where: { id_ajuste: id },
    });

    if (!ajuste) {
      throw new NotFoundException(`Ajuste con ID ${id} no encontrado`);
    }

    if (ajuste.estado !== estado_ajuste.PENDIENTE_AUTORIZACION) {
      throw new BadRequestException(
        'Solo se pueden autorizar ajustes en estado PENDIENTE_AUTORIZACION',
      );
    }

    if (!autorizarDto.autorizado && !autorizarDto.motivo_rechazo) {
      throw new BadRequestException(
        'Debe proporcionar un motivo de rechazo',
      );
    }

    const nuevoEstado = autorizarDto.autorizado
      ? estado_ajuste.AUTORIZADO
      : estado_ajuste.RECHAZADO;

    const ajusteActualizado = await this.prisma.ajustes_inventario.update({
      where: { id_ajuste: id },
      data: {
        estado: nuevoEstado,
        id_usuario_autoriza: id_usuario,
        fecha_autorizacion: new Date(),
        observaciones_autorizacion: autorizarDto.observaciones_autorizacion,
        motivo_rechazo: autorizarDto.motivo_rechazo,
      },
      include: {
        auditoria: true,
        catalogo: true,
        bodega: true,
        usuario_solicita: true,
        usuario_autoriza: true,
      },
    });

    return ajusteActualizado;
  }

  /**
   * Aplicar ajuste autorizado al inventario
   */
  async aplicarAjuste(id: number, id_usuario: number): Promise<any> {
    const ajuste = await this.prisma.ajustes_inventario.findUnique({
      where: { id_ajuste: id },
      include: {
        auditoria: true,
        catalogo: true,
        bodega: true,
      },
    });

    if (!ajuste) {
      throw new NotFoundException(`Ajuste con ID ${id} no encontrado`);
    }

    if (ajuste.estado !== estado_ajuste.AUTORIZADO) {
      throw new BadRequestException(
        'Solo se pueden aplicar ajustes AUTORIZADOS',
      );
    }

    // Aplicar ajuste en transacción
    const resultado = await this.prisma.$transaction(async (tx) => {
      // Buscar inventario
      const inventario = await tx.inventario.findFirst({
        where: {
          id_catalogo: ajuste.id_catalogo,
          id_bodega: ajuste.id_bodega,
          id_estante: ajuste.id_estante,
        },
      });

      if (!inventario) {
        throw new NotFoundException(
          `Inventario no encontrado para aplicar ajuste`,
        );
      }

      // Validar que no quede negativo
      const nuevaCantidad = inventario.cantidad_disponible + ajuste.cantidad_ajuste;
      if (nuevaCantidad < 0) {
        throw new BadRequestException(
          `El ajuste resultaría en cantidad negativa (${nuevaCantidad})`,
        );
      }

      // Actualizar inventario
      const inventarioActualizado = await tx.inventario.update({
        where: { id_inventario: inventario.id_inventario },
        data: {
          cantidad_disponible: nuevaCantidad,
        },
      });

      // Crear movimiento de inventario
      const movimiento = await tx.movimientos_inventario.create({
        data: {
          tipo: tipo_movimiento.AJUSTE_INVENTARIO,
          id_catalogo: ajuste.id_catalogo,
          id_bodega_destino: ajuste.cantidad_ajuste > 0 ? ajuste.id_bodega : null,
          id_bodega_origen: ajuste.cantidad_ajuste < 0 ? ajuste.id_bodega : null,
          cantidad: Math.abs(ajuste.cantidad_ajuste),
          costo_unitario: ajuste.costo_unitario,
          id_usuario: id_usuario,
          observaciones: `Ajuste ${ajuste.codigo} - Auditoría ${ajuste.auditoria?.codigo || 'N/A'} - ${ajuste.motivo_detallado}`,
        },
      });

      // Actualizar ajuste
      const ajusteAplicado = await tx.ajustes_inventario.update({
        where: { id_ajuste: id },
        data: {
          estado: estado_ajuste.APLICADO,
          fecha_aplicacion: new Date(),
          id_movimiento_generado: movimiento.id_movimiento,
        },
      });

      return {
        ajuste: ajusteAplicado,
        inventario: inventarioActualizado,
        movimiento,
      };
    });

    return resultado;
  }

  /**
   * Obtener métricas para dashboard
   */
  async getMetricas(queryDto: QueryMetricasDto): Promise<any> {
    const where: Prisma.metricas_inventarioWhereInput = {
      periodo: queryDto.periodo,
    };

    if (queryDto.tipo_periodo) {
      where.tipo_periodo = queryDto.tipo_periodo;
    }

    if (queryDto.id_bodega) {
      where.id_bodega = queryDto.id_bodega;
    }

    if (queryDto.id_categoria) {
      where.id_categoria = queryDto.id_categoria;
    }

    let metrica = await this.prisma.metricas_inventario.findFirst({
      where,
      include: {
        bodega: {
          select: {
            id_bodega: true,
            nombre: true,
          },
        },
        categoria: {
          select: {
            id_categoria: true,
            nombre: true,
          },
        },
      },
    });

    // Si no existe, calcular y crear
    if (!metrica) {
      metrica = await this.calcularYGuardarMetricas(queryDto);
    }

    return metrica;
  }

  /**
   * Calcular y guardar métricas de un período
   */
  private async calcularYGuardarMetricas(
    queryDto: QueryMetricasDto,
  ): Promise<any> {
    // Parsear período
    const [year, month] = queryDto.periodo.split('-').map(Number);
    const fechaInicio = new Date(year, month - 1, 1);
    const fechaFin = new Date(year, month, 0, 23, 59, 59);

    const whereAuditorias: Prisma.auditorias_inventarioWhereInput = {
      fecha_fin: {
        gte: fechaInicio,
        lte: fechaFin,
      },
      estado: estado_auditoria.COMPLETADA,
    };

    if (queryDto.id_bodega) {
      whereAuditorias.id_bodega = queryDto.id_bodega;
    }

    // Obtener auditorías del período
    const auditorias = await this.prisma.auditorias_inventario.findMany({
      where: whereAuditorias,
      include: {
        detalle: true,
      },
    });

    const totalAuditorias = auditorias.length;
    let totalItemsAuditados = 0;
    let totalItemsConformes = 0;
    let totalItemsConDiscrepancia = 0;
    let valorDiscrepanciasPositivas = 0;
    let valorDiscrepanciasNegativas = 0;

    auditorias.forEach((aud) => {
      totalItemsAuditados += aud.total_items_auditados;
      totalItemsConformes += aud.total_items_conformes;
      totalItemsConDiscrepancia += aud.total_items_con_discrepancia;

      aud.detalle.forEach((det) => {
        const valorDisc = Number(det.discrepancia_valor || 0);
        if (valorDisc > 0) {
          valorDiscrepanciasPositivas += valorDisc;
        } else if (valorDisc < 0) {
          valorDiscrepanciasNegativas += Math.abs(valorDisc);
        }
      });
    });

    const accuracy =
      totalItemsAuditados > 0
        ? (totalItemsConformes / totalItemsAuditados) * 100
        : 0;

    const valorNetoDiscrepancias =
      valorDiscrepanciasPositivas - valorDiscrepanciasNegativas;

    // Calcular total ajustes
    const whereAjustes: Prisma.ajustes_inventarioWhereInput = {
      fecha_solicitud: {
        gte: fechaInicio,
        lte: fechaFin,
      },
    };

    if (queryDto.id_bodega) {
      whereAjustes.id_bodega = queryDto.id_bodega;
    }

    const totalAjustes = await this.prisma.ajustes_inventario.count({
      where: whereAjustes,
    });

    const totalAjustesAutorizados = await this.prisma.ajustes_inventario.count({
      where: {
        ...whereAjustes,
        estado: estado_ajuste.AUTORIZADO,
      },
    });

    // Guardar métrica
    const metrica = await this.prisma.metricas_inventario.create({
      data: {
        periodo: queryDto.periodo,
        tipo_periodo: queryDto.tipo_periodo || 'MENSUAL',
        id_bodega: queryDto.id_bodega,
        id_categoria: queryDto.id_categoria,
        total_auditorias_realizadas: totalAuditorias,
        total_items_auditados: totalItemsAuditados,
        total_items_conformes: totalItemsConformes,
        total_items_con_discrepancia: totalItemsConDiscrepancia,
        accuracy_porcentaje: accuracy,
        valor_discrepancias_positivas: valorDiscrepanciasPositivas,
        valor_discrepancias_negativas: valorDiscrepanciasNegativas,
        valor_neto_discrepancias: valorNetoDiscrepancias,
        total_ajustes: totalAjustes,
        total_ajustes_autorizados: totalAjustesAutorizados,
      },
      include: {
        bodega: true,
        categoria: true,
      },
    });

    return metrica;
  }

  /**
   * Crear snapshot de inventario post-auditoría
   */
  async createSnapshot(id_auditoria: number): Promise<any> {
    const auditoria = await this.prisma.auditorias_inventario.findUnique({
      where: { id_auditoria },
      include: {
        detalle: true,
      },
    });

    if (!auditoria) {
      throw new NotFoundException(
        `Auditoría con ID ${id_auditoria} no encontrada`,
      );
    }

    // Verificar si ya tiene snapshot
    const snapshotExistente = await this.prisma.snapshots_inventario.findUnique({
      where: { id_auditoria },
    });

    if (snapshotExistente) {
      return snapshotExistente;
    }

    // Generar código
    const now = new Date();
    const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const codigo = `SNP-${periodo}-${String(id_auditoria).padStart(4, '0')}`;

    // Obtener inventario actual
    const inventarios = await this.prisma.inventario.findMany({
      where: {
        id_bodega: auditoria.id_bodega,
        id_estante: auditoria.id_estante,
      },
    });

    const totalItems = inventarios.length;
    const totalCantidad = inventarios.reduce(
      (sum, inv) => sum + inv.cantidad_disponible + inv.cantidad_reservada,
      0,
    );
    const valorTotal = inventarios.reduce(
      (sum, inv) =>
        sum +
        (inv.cantidad_disponible + inv.cantidad_reservada) *
          Number(inv.costo_promedio || 0),
      0,
    );

    // Crear snapshot en transacción
    const snapshot = await this.prisma.$transaction(async (tx) => {
      const snap = await tx.snapshots_inventario.create({
        data: {
          codigo,
          tipo: 'AUDITORIA',
          periodo,
          descripcion: `Snapshot de auditoría ${auditoria.codigo}`,
          id_auditoria,
          id_bodega: auditoria.id_bodega,
          total_items: totalItems,
          total_cantidad: totalCantidad,
          valor_total_inventario: valorTotal,
          creado_por: auditoria.id_usuario_ejecuta || auditoria.id_usuario_planifica,
        },
      });

      // Crear detalles
      const detallesData = inventarios.map((inv) => ({
        id_snapshot: snap.id_snapshot,
        id_catalogo: inv.id_catalogo,
        id_bodega: inv.id_bodega,
        id_estante: inv.id_estante,
        cantidad_disponible: inv.cantidad_disponible,
        cantidad_reservada: inv.cantidad_reservada,
        cantidad_total: inv.cantidad_disponible + inv.cantidad_reservada,
        costo_promedio: inv.costo_promedio || 0,
        valor_total:
          (inv.cantidad_disponible + inv.cantidad_reservada) *
          Number(inv.costo_promedio || 0),
      }));

      await tx.snapshots_detalle.createMany({
        data: detallesData,
      });

      return snap;
    });

    return snapshot;
  }

  /**
   * Generar reporte PDF de auditoría (placeholder - implementar con jsReport)
   */
  async generarReportePdf(id: number): Promise<Buffer> {
    const auditoria = await this.findOne(id);

    if (!auditoria) {
      throw new NotFoundException(`Auditoría con ID ${id} no encontrada`);
    }

    // TODO: Implementar con jsReport usando template HTML
    // Por ahora retornamos un placeholder
    const templatePath = path.join(
      process.cwd(),
      'templates/inventario/auditoria.html',
    );

    // Verificar si existe template
    if (!fs.existsSync(templatePath)) {
      throw new BadRequestException(
        'Template de reporte no encontrado. Crear templates/inventario/auditoria.html',
      );
    }

    const templateHtml = fs.readFileSync(templatePath, 'utf-8');

    // Formatear datos para el template (spread auditoria al root level)
    const templateData = {
      ...auditoria,
      fechaGeneracion: new Date().toLocaleDateString('es-SV'),
    };

    try {
      const response = await axios.post(
        process.env.API_REPORT || 'http://localhost:5488/api/report',
        {
          template: {
            content: templateHtml,
            engine: 'jsrender',
            recipe: 'chrome-pdf',
          },
          data: templateData,
        },
        {
          responseType: 'arraybuffer',
        },
      );

      return Buffer.from(response.data);
    } catch (error) {
      throw new BadRequestException(
        `Error al generar PDF: ${error.message}`,
      );
    }
  }
}
