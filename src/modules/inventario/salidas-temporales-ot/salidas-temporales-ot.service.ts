// src/modules/inventario/salidas-temporales-ot/salidas-temporales-ot.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MinioService } from '../../minio/minio.service';
import { CreateSalidaTemporalDto } from './dto/create-salida-temporal.dto';
import { QuerySalidaTemporalDto } from './dto/query-salida-temporal.dto';
import {
  ProcesarInspeccionDto,
  ResultadoInspeccion,
} from './dto/procesar-inspeccion.dto';
import type { usuarios, estado_inventario } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class SalidasTemporalesOtService {
  private readonly logger = new Logger(SalidasTemporalesOtService.name);

  constructor(
    private prisma: PrismaService,
    private minioService: MinioService,
  ) {}

  /**
   * Generar código único para salida temporal: ST-YYYYMM-#####
   */
  private async generarCodigoSalida(): Promise<string> {
    const fecha = new Date();
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const prefix = `ST-${year}${month}-`;

    // Buscar el último número de salida del mes
    const ultimaSalida = await this.prisma.salidas_temporales_ot.findFirst({
      where: {
        codigo: {
          startsWith: prefix,
        },
      },
      orderBy: {
        codigo: 'desc',
      },
    });

    let numeroSalida = 1;
    if (ultimaSalida) {
      const ultimoNumero = parseInt(ultimaSalida.codigo.split('-')[2]);
      numeroSalida = ultimoNumero + 1;
    }

    return `${prefix}${String(numeroSalida).padStart(5, '0')}`;
  }

  /**
   * Obtener bodega asignada al usuario
   */
  private async obtenerBodegaUsuario(userId: number): Promise<number> {
    const bodega = await this.prisma.bodegas.findFirst({
      where: {
        id_responsable: userId,
        estado: 'ACTIVO',
      },
    });

    if (!bodega) {
      throw new ForbiddenException(
        'El usuario no tiene una bodega asignada o la bodega no está activa',
      );
    }

    return bodega.id_bodega;
  }

  /**
   * Crear salida temporal
   */
  async create(
    createDto: CreateSalidaTemporalDto,
    foto: Express.Multer.File,
    user: usuarios,
  ) {
    // 1. Validar que se subió la foto
    if (!foto) {
      throw new BadRequestException('La foto del formulario es obligatoria');
    }

    // 2. Obtener bodega del usuario logueado
    const idBodega = await this.obtenerBodegaUsuario(user.id_usuario);

    // 4. Validar stock y series para cada item
    for (const item of createDto.detalle) {
      const catalogo = await this.prisma.catalogo.findUnique({
        where: { id_catalogo: item.id_catalogo },
      });

      if (!catalogo) {
        throw new NotFoundException(
          `Producto con ID ${item.id_catalogo} no encontrado`,
        );
      }

      // Determinar si el producto requiere serie
      // Asumimos que si se proporciona id_serie, es serializado
      const esSerializado = !!item.id_serie;

      if (esSerializado) {
        // Validar que para productos serializados, cantidad debe ser 1 o no proporcionarse
        if (item.cantidad && item.cantidad !== 1) {
          throw new BadRequestException(
            `Producto serializado "${catalogo.nombre}": cada línea del detalle debe tener cantidad=1 o no especificar cantidad. Si necesita múltiples unidades, agregue múltiples líneas al detalle (una por cada serie).`,
          );
        }

        // Validar serie
        const serie = await this.prisma.inventario_series.findUnique({
          where: { id_serie: item.id_serie },
          include: {
            inventario: {
              include: {
                catalogo: true,
              },
            },
          },
        });

        if (!serie) {
          throw new NotFoundException(
            `Serie con ID ${item.id_serie} no encontrada`,
          );
        }

        if (serie.estado !== 'DISPONIBLE') {
          throw new BadRequestException(
            `La serie ${serie.numero_serie} no está disponible (estado actual: ${serie.estado})`,
          );
        }

        // Validar que la serie pertenece al producto correcto
        if (serie.inventario?.catalogo?.id_catalogo !== item.id_catalogo) {
          throw new BadRequestException(
            `La serie ${serie.numero_serie} no pertenece al producto seleccionado`,
          );
        }

        // Validar que la serie está en la bodega correcta
        if (serie.inventario?.id_bodega !== idBodega) {
          throw new BadRequestException(
            `La serie ${serie.numero_serie} no se encuentra en la bodega asignada al usuario`,
          );
        }
      } else {
        // Validar stock disponible para productos no serializados
        const cantidad = item.cantidad || 1;

        const inventario = await this.prisma.inventario.findFirst({
          where: {
            id_catalogo: item.id_catalogo,
            id_bodega: idBodega,
          },
        });

        if (!inventario) {
          throw new NotFoundException(
            `No hay inventario del producto "${catalogo.nombre}" en la bodega asignada`,
          );
        }

        if (inventario.cantidad_disponible < cantidad) {
          throw new BadRequestException(
            `Stock insuficiente para "${catalogo.nombre}". Disponible: ${inventario.cantidad_disponible}, Solicitado: ${cantidad}`,
          );
        }
      }
    }

    // 5. Subir foto a MinIO
    const timestamp = Date.now();
    const objectName = `salidas-temporales/${timestamp}-${foto.originalname}`;
    const { url: urlFoto } = await this.minioService.uploadFile(
      foto,
      objectName,
    );

    this.logger.log(
      `Foto subida a MinIO: ${objectName} -> URL: ${urlFoto.substring(0, 50)}...`,
    );

    // 6. Crear salida en transacción
    const result = await this.prisma.$transaction(async (prisma) => {
      // Crear salida temporal
      const salida = await prisma.salidas_temporales_ot.create({
        data: {
          codigo: createDto.codigo, // Código de OT ingresado por el usuario
          id_bodega_origen: idBodega,
          id_usuario_crea: user.id_usuario,
          url_foto_formulario: urlFoto,
          estado: 'PROCESADA',
          observaciones: createDto.observaciones,
        },
      });

      // Procesar cada item del detalle
      for (const item of createDto.detalle) {
        const esSerializado = !!item.id_serie;
        const cantidad = item.cantidad || 1;

        // Obtener costo unitario del inventario
        let costoUnitario: Decimal | null = null;

        if (esSerializado) {
          // Para serializados, usar costo de la serie
          const serie = await prisma.inventario_series.findUnique({
            where: { id_serie: item.id_serie },
          });
          costoUnitario = serie?.costo_adquisicion || null;
        } else {
          // Para no serializados, usar costo promedio del inventario
          const inventario = await prisma.inventario.findFirst({
            where: {
              id_catalogo: item.id_catalogo,
              id_bodega: idBodega,
            },
          });
          costoUnitario = inventario?.costo_promedio || null;
        }

        // Crear detalle de salida
        await prisma.salidas_temporales_ot_detalle.create({
          data: {
            id_salida_temporal: salida.id_salida_temporal,
            id_catalogo: item.id_catalogo,
            cantidad,
            id_serie: item.id_serie,
            costo_unitario: costoUnitario,
            observaciones: item.observaciones,
          },
        });

        // Descargar inventario
        if (esSerializado) {
          // Actualizar estado de la serie
          await prisma.inventario_series.update({
            where: { id_serie: item.id_serie },
            data: {
              estado: 'ASIGNADO',
              fecha_asignacion: new Date(),
            },
          });

          // Crear historial de serie
          await prisma.historial_series.create({
            data: {
              id_serie: item.id_serie!,
              estado_anterior: 'DISPONIBLE',
              estado_nuevo: 'ASIGNADO',
              id_usuario: user.id_usuario,
              observaciones: `Salida temporal para OT ${createDto.codigo}`,
            },
          });

          // Descargar 1 unidad del inventario
          await prisma.inventario.updateMany({
            where: {
              id_catalogo: item.id_catalogo,
              id_bodega: idBodega,
            },
            data: {
              cantidad_disponible: {
                decrement: 1,
              },
            },
          });
        } else {
          // Descargar cantidad del inventario
          await prisma.inventario.updateMany({
            where: {
              id_catalogo: item.id_catalogo,
              id_bodega: idBodega,
            },
            data: {
              cantidad_disponible: {
                decrement: cantidad,
              },
            },
          });
        }

        // Crear movimiento de inventario
        await prisma.movimientos_inventario.create({
          data: {
            tipo: 'SALIDA_OT',
            id_catalogo: item.id_catalogo,
            id_bodega_origen: idBodega,
            cantidad,
            id_usuario: user.id_usuario,
            costo_unitario: costoUnitario,
            observaciones: `Salida temporal ${createDto.codigo} - ${item.observaciones || 'Sin observaciones'}`,
          },
        });
      }

      // Registrar en audit log
      await prisma.log.create({
        data: {
          accion: 'CREAR_SALIDA_TEMPORAL_OT',
          descripcion: `Salida temporal creada para OT ${createDto.codigo}`,
          id_usuario: user.id_usuario,
        },
      });

      return salida;
    });

    this.logger.log(`Salida temporal creada para OT: ${createDto.codigo}`);

    // Retornar salida con relaciones
    return this.findOne(result.id_salida_temporal);
  }

  /**
   * Listar salidas temporales con filtros y paginación
   */
  async findAll(query: QuerySalidaTemporalDto, user: usuarios) {
    const { estado, id_usuario_crea, codigo, fecha_desde, fecha_hasta } = query;
    const page = query.page || 1;
    const limit = query.limit || 10;

    const skip = (page - 1) * limit;

    // Construir filtros
    const where: any = {};

    if (estado) {
      where.estado = estado;
    }

    if (id_usuario_crea) {
      where.id_usuario_crea = id_usuario_crea;
    }

    if (codigo) {
      where.codigo = {
        contains: codigo,
        mode: 'insensitive',
      };
    }

    if (fecha_desde || fecha_hasta) {
      where.fecha_salida = {};
      if (fecha_desde) {
        where.fecha_salida.gte = new Date(fecha_desde);
      }
      if (fecha_hasta) {
        where.fecha_salida.lte = new Date(`${fecha_hasta}T23:59:59.999Z`);
      }
    }

    // Contar total
    const total = await this.prisma.salidas_temporales_ot.count({ where });

    // Obtener salidas
    const salidas = await this.prisma.salidas_temporales_ot.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        fecha_salida: 'desc',
      },
      include: {
        bodega_origen: {
          select: {
            nombre: true,
          },
        },
        usuario_crea: {
          select: {
            nombres: true,
            apellidos: true,
          },
        },
        detalle: {
          include: {
            catalogo: {
              select: {
                codigo: true,
                nombre: true,
              },
            },
            serie: {
              select: {
                numero_serie: true,
                mac_address: true,
              },
            },
          },
        },
      },
    });

    return {
      data: salidas,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Obtener detalle de una salida temporal
   */
  async findOne(id: number) {
    const salida = await this.prisma.salidas_temporales_ot.findUnique({
      where: { id_salida_temporal: id },
      include: {
        bodega_origen: {
          select: {
            nombre: true,
            sucursal: {
              select: {
                nombre: true,
              },
            },
          },
        },
        usuario_crea: {
          select: {
            nombres: true,
            apellidos: true,
            usuario: true,
          },
        },
        detalle: {
          include: {
            catalogo: {
              select: {
                codigo: true,
                nombre: true,
                descripcion: true,
              },
            },
            serie: {
              select: {
                numero_serie: true,
                mac_address: true,
                estado: true,
              },
            },
          },
        },
      },
    });

    if (!salida) {
      throw new NotFoundException(
        `Salida temporal con ID ${id} no encontrada`,
      );
    }

    return salida;
  }

  /**
   * Cancelar salida temporal (revierte inventario)
   */
  async cancel(id: number, user: usuarios) {
    const salida = await this.prisma.salidas_temporales_ot.findUnique({
      where: { id_salida_temporal: id },
      include: {
        detalle: {
          include: {
            catalogo: true,
            serie: true,
          },
        },
      },
    });

    if (!salida) {
      throw new NotFoundException(
        `Salida temporal con ID ${id} no encontrada`,
      );
    }

    if (salida.estado === 'CANCELADA') {
      throw new BadRequestException('La salida temporal ya está cancelada');
    }

    // Revertir en transacción
    await this.prisma.$transaction(async (prisma) => {
      // Procesar cada item del detalle
      for (const item of salida.detalle) {
        const esSerializado = !!item.id_serie;
        const cantidad = item.cantidad;

        if (esSerializado) {
          // Enviar serie a inspección post-devolución
          await prisma.inventario_series.update({
            where: { id_serie: item.id_serie! },
            data: {
              estado: 'EN_INSPECCION',
              id_orden_trabajo: null,
              fecha_asignacion: null,
            },
          });

          // Crear historial - transición a inspección
          await prisma.historial_series.create({
            data: {
              id_serie: item.id_serie!,
              estado_anterior: 'ASIGNADO',
              estado_nuevo: 'EN_INSPECCION',
              id_usuario: user.id_usuario,
              observaciones: `Devolución pendiente de inspección - salida temporal ${salida.codigo}`,
            },
          });

          // Devolver 1 unidad al inventario
          await prisma.inventario.updateMany({
            where: {
              id_catalogo: item.id_catalogo,
              id_bodega: salida.id_bodega_origen,
            },
            data: {
              cantidad_disponible: {
                increment: 1,
              },
            },
          });
        } else {
          // Devolver cantidad al inventario
          await prisma.inventario.updateMany({
            where: {
              id_catalogo: item.id_catalogo,
              id_bodega: salida.id_bodega_origen,
            },
            data: {
              cantidad_disponible: {
                increment: cantidad,
              },
            },
          });
        }

        // Crear movimiento de devolución
        await prisma.movimientos_inventario.create({
          data: {
            tipo: 'DEVOLUCION',
            id_catalogo: item.id_catalogo,
            id_bodega_destino: salida.id_bodega_origen,
            cantidad,
            id_usuario: user.id_usuario,
            costo_unitario: item.costo_unitario,
            observaciones: `Cancelación de salida temporal ${salida.codigo}`,
          },
        });
      }

      // Actualizar estado de salida
      await prisma.salidas_temporales_ot.update({
        where: { id_salida_temporal: id },
        data: {
          estado: 'CANCELADA',
        },
      });

      // Registrar en audit log
      await prisma.log.create({
        data: {
          accion: 'CANCELAR_SALIDA_TEMPORAL_OT',
          descripcion: `Salida temporal ${salida.codigo} cancelada`,
          id_usuario: user.id_usuario,
        },
      });
    });

    this.logger.log(`Salida temporal cancelada: ${salida.codigo}`);

    return this.findOne(id);
  }

  /**
   * Obtener series disponibles de un producto en la bodega del usuario
   */
  async getSeriesDisponibles(idCatalogo: number, user: usuarios) {
    const idBodega = await this.obtenerBodegaUsuario(user.id_usuario);

    const series = await this.prisma.inventario_series.findMany({
      where: {
        inventario: {
          id_catalogo: idCatalogo,
          id_bodega: idBodega,
        },
        estado: 'DISPONIBLE',
      },
      select: {
        id_serie: true,
        numero_serie: true,
        mac_address: true,
        costo_adquisicion: true,
      },
      orderBy: {
        numero_serie: 'asc',
      },
    });

    return series;
  }

  /**
   * Obtener stock disponible de un producto en la bodega del usuario
   */
  async getStockDisponible(idCatalogo: number, user: usuarios) {
    const idBodega = await this.obtenerBodegaUsuario(user.id_usuario);

    const inventario = await this.prisma.inventario.findFirst({
      where: {
        id_catalogo: idCatalogo,
        id_bodega: idBodega,
      },
      select: {
        cantidad_disponible: true,
        cantidad_reservada: true,
        costo_promedio: true,
        catalogo: {
          select: {
            codigo: true,
            nombre: true,
          },
        },
      },
    });

    if (!inventario) {
      return {
        id_catalogo: idCatalogo,
        cantidad_disponible: 0,
        cantidad_reservada: 0,
        costo_promedio: 0,
      };
    }

    return inventario;
  }

  /**
   * Obtener series pendientes de inspección post-devolución
   */
  async getSeriesEnInspeccion(user: usuarios, bodegaId?: number) {
    const whereClause: any = {
      estado: 'EN_INSPECCION',
    };

    // Si se especifica bodega, filtrar por ella
    if (bodegaId) {
      whereClause.inventario = { id_bodega: bodegaId };
    }

    const series = await this.prisma.inventario_series.findMany({
      where: whereClause,
      include: {
        inventario: {
          include: {
            catalogo: {
              select: {
                id_catalogo: true,
                codigo: true,
                nombre: true,
              },
            },
            bodega: {
              select: {
                id_bodega: true,
                nombre: true,
              },
            },
          },
        },
      },
      orderBy: {
        fecha_ultima_actualizacion: 'asc',
      },
    });

    // Obtener historial para cada serie
    const result = await Promise.all(
      series.map(async (serie) => {
        const ultimoHistorial = await this.prisma.historial_series.findFirst({
          where: { id_serie: serie.id_serie },
          orderBy: { fecha_movimiento: 'desc' },
          include: {
            usuario: {
              select: {
                nombres: true,
                apellidos: true,
              },
            },
          },
        });

        return {
          id_serie: serie.id_serie,
          numero_serie: serie.numero_serie,
          mac_address: serie.mac_address,
          producto: serie.inventario?.catalogo || null,
          bodega: serie.inventario?.bodega || null,
          fecha_devolucion: ultimoHistorial?.fecha_movimiento || null,
          observaciones_devolucion: ultimoHistorial?.observaciones || null,
          devuelto_por: ultimoHistorial?.usuario
            ? `${ultimoHistorial.usuario.nombres} ${ultimoHistorial.usuario.apellidos}`
            : null,
        };
      }),
    );

    return result;
  }

  /**
   * Procesar resultado de inspección post-devolución
   * Transiciona la serie de EN_INSPECCION a su estado final
   */
  async procesarInspeccion(
    dto: ProcesarInspeccionDto,
    user: usuarios,
  ): Promise<{ id_serie: number; estado_nuevo: estado_inventario }> {
    // Verificar que la serie existe y está en inspección
    const serie = await this.prisma.inventario_series.findUnique({
      where: { id_serie: dto.id_serie },
      include: {
        inventario: {
          include: { catalogo: true, bodega: true },
        },
      },
    });

    if (!serie) {
      throw new NotFoundException(`Serie con ID ${dto.id_serie} no encontrada`);
    }

    if (serie.estado !== 'EN_INSPECCION') {
      throw new BadRequestException(
        `La serie ${serie.numero_serie} no está en estado EN_INSPECCION (estado actual: ${serie.estado})`,
      );
    }

    if (!serie.inventario) {
      throw new BadRequestException(
        `La serie ${serie.numero_serie} no tiene inventario asociado`,
      );
    }

    // Guardar referencias del inventario antes de la transacción
    const { id_catalogo, id_bodega } = serie.inventario;

    // Mapear resultado de inspección a estado final
    const mapeoEstados: Record<ResultadoInspeccion, estado_inventario> = {
      [ResultadoInspeccion.APROBADO]: 'DISPONIBLE',
      [ResultadoInspeccion.REQUIERE_REPARACION]: 'EN_REPARACION',
      [ResultadoInspeccion.DANO_PERMANENTE]: 'DEFECTUOSO',
    };

    const estadoNuevo = mapeoEstados[dto.resultado];

    await this.prisma.$transaction(async (prisma) => {
      // Actualizar estado de la serie
      await prisma.inventario_series.update({
        where: { id_serie: dto.id_serie },
        data: { estado: estadoNuevo },
      });

      // Registrar en historial
      await prisma.historial_series.create({
        data: {
          id_serie: dto.id_serie,
          estado_anterior: 'EN_INSPECCION',
          estado_nuevo: estadoNuevo,
          id_usuario: user.id_usuario,
          observaciones:
            dto.observaciones ||
            `Inspección completada: ${dto.resultado}`,
        },
      });

      // Si el equipo pasa la inspección, incrementar cantidad disponible
      if (estadoNuevo === 'DISPONIBLE') {
        await prisma.inventario.updateMany({
          where: {
            id_catalogo,
            id_bodega,
          },
          data: {
            cantidad_disponible: { increment: 1 },
          },
        });
      }

      // Registrar en log
      await prisma.log.create({
        data: {
          accion: 'INSPECCION_POST_DEVOLUCION',
          descripcion: `Serie ${serie.numero_serie} inspeccionada: ${dto.resultado} → ${estadoNuevo}`,
          id_usuario: user.id_usuario,
        },
      });
    });

    this.logger.log(
      `Inspección procesada: Serie ${serie.numero_serie} → ${estadoNuevo}`,
    );

    return {
      id_serie: dto.id_serie,
      estado_nuevo: estadoNuevo,
    };
  }

  /**
   * Procesar múltiples inspecciones en lote
   */
  async procesarInspeccionBulk(
    inspecciones: ProcesarInspeccionDto[],
    user: usuarios,
  ): Promise<{ procesadas: number; resultados: any[] }> {
    const resultados: any[] = [];

    for (const inspeccion of inspecciones) {
      try {
        const resultado = await this.procesarInspeccion(inspeccion, user);
        resultados.push({ ...resultado, success: true });
      } catch (error) {
        resultados.push({
          id_serie: inspeccion.id_serie,
          success: false,
          error: error.message,
        });
      }
    }

    return {
      procesadas: resultados.filter((r) => r.success).length,
      resultados,
    };
  }

  /**
   * Completar reparación de serie
   * Transiciona de EN_REPARACION a DISPONIBLE o DEFECTUOSO
   */
  async completarReparacion(
    idSerie: number,
    reparacionExitosa: boolean,
    observaciones: string,
    user: usuarios,
  ): Promise<{ id_serie: number; estado_nuevo: estado_inventario }> {
    const serie = await this.prisma.inventario_series.findUnique({
      where: { id_serie: idSerie },
      include: { inventario: true },
    });

    if (!serie) {
      throw new NotFoundException(`Serie con ID ${idSerie} no encontrada`);
    }

    if (serie.estado !== 'EN_REPARACION') {
      throw new BadRequestException(
        `La serie no está en estado EN_REPARACION (estado actual: ${serie.estado})`,
      );
    }

    if (!serie.inventario) {
      throw new BadRequestException(
        `La serie con ID ${idSerie} no tiene inventario asociado`,
      );
    }

    // Guardar referencias del inventario antes de la transacción
    const { id_catalogo, id_bodega } = serie.inventario;

    const estadoNuevo: estado_inventario = reparacionExitosa
      ? 'DISPONIBLE'
      : 'DEFECTUOSO';

    await this.prisma.$transaction(async (prisma) => {
      await prisma.inventario_series.update({
        where: { id_serie: idSerie },
        data: { estado: estadoNuevo },
      });

      await prisma.historial_series.create({
        data: {
          id_serie: idSerie,
          estado_anterior: 'EN_REPARACION',
          estado_nuevo: estadoNuevo,
          id_usuario: user.id_usuario,
          observaciones:
            observaciones ||
            `Reparación ${reparacionExitosa ? 'exitosa' : 'fallida'}`,
        },
      });

      // Si la reparación fue exitosa, incrementar cantidad disponible
      if (estadoNuevo === 'DISPONIBLE') {
        await prisma.inventario.updateMany({
          where: {
            id_catalogo,
            id_bodega,
          },
          data: {
            cantidad_disponible: { increment: 1 },
          },
        });
      }

      await prisma.log.create({
        data: {
          accion: 'COMPLETAR_REPARACION',
          descripcion: `Reparación de serie ${idSerie}: ${reparacionExitosa ? 'exitosa' : 'fallida'}`,
          id_usuario: user.id_usuario,
        },
      });
    });

    return { id_serie: idSerie, estado_nuevo: estadoNuevo };
  }
}
