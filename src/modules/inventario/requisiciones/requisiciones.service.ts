// src/modules/inventario/requisiciones/requisiciones.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import {
  CreateRequisicionDto,
  UpdateRequisicionDto,
  AuthorizeRequisicionDto,
  ProcessRequisicionDto,
} from './dto';
import { requisiciones_inventario, Prisma } from '@prisma/client';
import { PaginationDto, PaginatedResult } from 'src/common/dto';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Tipo para requisición con relaciones incluidas
type RequisicionWithRelations = Prisma.requisiciones_inventarioGetPayload<{
  include: {
    detalle: {
      include: {
        catalogo: true;
        series: {
          include: {
            serie: true;
          };
        };
      };
    };
    usuario_solicita: {
      select: {
        id_usuario: true;
        nombres: true;
        apellidos: true;
      };
    };
    usuario_autoriza: {
      select: {
        id_usuario: true;
        nombres: true;
        apellidos: true;
      };
    };
    usuario_procesa: {
      select: {
        id_usuario: true;
        nombres: true;
        apellidos: true;
      };
    };
    bodega_origen: true;
    bodega_destino: true;
    sucursal_origen: true;
    sucursal_destino: true;
    estante_origen: true;
    estante_destino: true;
  };
}>;

@Injectable()
export class RequisicionesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Genera un código único para la requisición en formato REQ-YYYYMM-#####
   */
  private async generateCodigo(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `REQ-${year}${month}-`;

    // Obtener el último código del mes actual
    const lastRequisicion = await this.prisma.requisiciones_inventario.findFirst(
      {
        where: {
          codigo: {
            startsWith: prefix,
          },
        },
        orderBy: {
          codigo: 'desc',
        },
      },
    );

    let nextNumber = 1;
    if (lastRequisicion) {
      const lastNumber = parseInt(lastRequisicion.codigo.split('-')[2]);
      nextNumber = lastNumber + 1;
    }

    return `${prefix}${String(nextNumber).padStart(5, '0')}`;
  }

  /**
   * Valida que las series solicitadas sean válidas y estén disponibles
   */
  private async validateSeries(
    id_catalogo: number,
    series: number[],
    id_bodega_origen?: number,
    id_estante_origen?: number,
  ): Promise<void> {
    if (!series || series.length === 0) {
      return;
    }

    // Verificar que todas las series existan
    const seriesData = await this.prisma.inventario_series.findMany({
      where: {
        id_serie: { in: series },
      },
      include: {
        inventario: {
          include: {
            catalogo: true,
          },
        },
      },
    });

    if (seriesData.length !== series.length) {
      const foundIds = seriesData.map((s) => s.id_serie);
      const missingIds = series.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(
        `Series no encontradas: ${missingIds.join(', ')}`,
      );
    }

    // Validar que todas las series pertenezcan al catálogo especificado
    const wrongCatalogo = seriesData.filter(
      (s) => s.inventario?.id_catalogo !== id_catalogo,
    );
    if (wrongCatalogo.length > 0) {
      throw new BadRequestException(
        `Las series ${wrongCatalogo.map((s) => s.numero_serie).join(', ')} no pertenecen al producto solicitado`,
      );
    }

    // Validar que todas las series estén disponibles
    const notAvailable = seriesData.filter((s) => s.estado !== 'DISPONIBLE');
    if (notAvailable.length > 0) {
      throw new BadRequestException(
        `Las series ${notAvailable.map((s) => s.numero_serie).join(', ')} no están disponibles (estado: ${notAvailable[0].estado})`,
      );
    }

    // Si se especifica bodega origen, validar que las series estén en esa bodega
    if (id_bodega_origen) {
      const wrongBodega = seriesData.filter(
        (s) => s.inventario?.id_bodega !== id_bodega_origen,
      );
      if (wrongBodega.length > 0) {
        throw new BadRequestException(
          `Las series ${wrongBodega.map((s) => s.numero_serie).join(', ')} no están en la bodega origen especificada`,
        );
      }
    }

    // Si se especifica estante origen, validar que las series estén en ese estante
    if (id_estante_origen) {
      const wrongEstante = seriesData.filter(
        (s) => s.inventario?.id_estante !== id_estante_origen,
      );
      if (wrongEstante.length > 0) {
        throw new BadRequestException(
          `Las series ${wrongEstante.map((s) => s.numero_serie).join(', ')} no están en el estante origen especificado`,
        );
      }
    }
  }

  /**
   * Valida que la requisición tenga origen y destino válidos según el tipo
   */
  private validateOrigenDestino(dto: CreateRequisicionDto): void {
    const {
      tipo,
      id_bodega_origen,
      id_bodega_destino,
      id_sucursal_origen,
      id_sucursal_destino,
      id_estante_origen,
      id_estante_destino,
    } = dto;

    if (tipo === 'TRANSFERENCIA_BODEGA') {
      if (!id_bodega_origen || !id_bodega_destino) {
        throw new BadRequestException(
          'Para transferencia de bodega se requiere bodega origen y destino',
        );
      }
      if (id_bodega_origen === id_bodega_destino) {
        throw new BadRequestException(
          'La bodega origen y destino no pueden ser iguales',
        );
      }
    } else if (tipo === 'TRANSFERENCIA_SUCURSAL') {
      if (!id_sucursal_origen || !id_sucursal_destino) {
        throw new BadRequestException(
          'Para transferencia de sucursal se requiere sucursal origen y destino',
        );
      }
      if (id_sucursal_origen === id_sucursal_destino) {
        throw new BadRequestException(
          'La sucursal origen y destino no pueden ser iguales',
        );
      }
    } else if (tipo === 'CAMBIO_ESTANTE') {
      if (!id_estante_origen || !id_estante_destino) {
        throw new BadRequestException(
          'Para cambio de estante se requiere estante origen y destino',
        );
      }
      if (id_estante_origen === id_estante_destino) {
        throw new BadRequestException(
          'El estante origen y destino no pueden ser iguales',
        );
      }
      if (!id_bodega_origen) {
        throw new BadRequestException(
          'Para cambio de estante se requiere especificar la bodega',
        );
      }
    }
  }

  /**
   * Crea una nueva requisición de inventario
   */
  async create(
    createRequisicionDto: CreateRequisicionDto,
    id_usuario: number,
  ): Promise<RequisicionWithRelations> {
    // Validar origen y destino
    this.validateOrigenDestino(createRequisicionDto);

    const { detalle, ...requisicionData } = createRequisicionDto;

    // Validar series para cada item
    for (const item of detalle) {
      if (item.series && item.series.length > 0) {
        // Si se especifican series, validarlas
        await this.validateSeries(
          item.id_catalogo,
          item.series,
          requisicionData.id_bodega_origen,
          requisicionData.id_estante_origen,
        );

        // La cantidad solicitada debe coincidir con el número de series
        if (item.cantidad_solicitada !== item.series.length) {
          throw new BadRequestException(
            `La cantidad solicitada (${item.cantidad_solicitada}) debe coincidir con el número de series especificadas (${item.series.length})`,
          );
        }
      }
    }

    // Generar código único
    const codigo = await this.generateCodigo();

    // Limpiar campos nulos o con valor 0 (que no existen en BD)
    const cleanedData: any = {
      codigo,
      tipo: requisicionData.tipo,
      motivo: requisicionData.motivo,
      id_usuario_solicita: id_usuario,
    };

    // Solo agregar campos que tengan valores válidos (no 0, no null, no undefined)
    if (requisicionData.id_sucursal_origen && requisicionData.id_sucursal_origen > 0) {
      cleanedData.id_sucursal_origen = requisicionData.id_sucursal_origen;
    }
    if (requisicionData.id_bodega_origen && requisicionData.id_bodega_origen > 0) {
      cleanedData.id_bodega_origen = requisicionData.id_bodega_origen;
    }
    if (requisicionData.id_estante_origen && requisicionData.id_estante_origen > 0) {
      cleanedData.id_estante_origen = requisicionData.id_estante_origen;
    }
    if (requisicionData.id_sucursal_destino && requisicionData.id_sucursal_destino > 0) {
      cleanedData.id_sucursal_destino = requisicionData.id_sucursal_destino;
    }
    if (requisicionData.id_bodega_destino && requisicionData.id_bodega_destino > 0) {
      cleanedData.id_bodega_destino = requisicionData.id_bodega_destino;
    }
    if (requisicionData.id_estante_destino && requisicionData.id_estante_destino > 0) {
      cleanedData.id_estante_destino = requisicionData.id_estante_destino;
    }

    // Crear requisición con detalle
    const requisicion = await this.prisma.requisiciones_inventario.create({
      data: {
        ...cleanedData,
        detalle: {
          create: detalle.map((item) => ({
            id_catalogo: item.id_catalogo,
            cantidad_solicitada: item.cantidad_solicitada,
            observaciones: item.observaciones,
            ...(item.series && item.series.length > 0 && {
              series: {
                create: item.series.map((id_serie) => ({
                  id_serie,
                })),
              },
            }),
          })),
        },
      },
      include: {
        detalle: {
          include: {
            catalogo: true,
            series: {
              include: {
                serie: true,
              },
            },
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
        usuario_procesa: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
        bodega_origen: true,
        bodega_destino: true,
        sucursal_origen: true,
        sucursal_destino: true,
        estante_origen: true,
        estante_destino: true,
      },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'CREAR_REQUISICION',
      id_usuario,
      `Requisición creada: ${requisicion.codigo}`,
    );

    return requisicion;
  }

  /**
   * Lista requisiciones con paginación y filtros
   */
  async findAll(
    paginationDto: PaginationDto & {
      estado?: string;
      tipo?: string;
      id_usuario_solicita?: number;
    },
  ): Promise<PaginatedResult<requisiciones_inventario>> {
    const {
      page = 1,
      limit = 10,
      search = '',
      estado,
      tipo,
      id_usuario_solicita,
    } = paginationDto;
    const skip = (page - 1) * limit;

    const where: Prisma.requisiciones_inventarioWhereInput = {};

    if (search) {
      where.OR = [
        { codigo: { contains: search, mode: 'insensitive' } },
        { motivo: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (estado) {
      where.estado = estado as any;
    }

    if (tipo) {
      where.tipo = tipo as any;
    }

    if (id_usuario_solicita) {
      where.id_usuario_solicita = Number(id_usuario_solicita);
    }

    const [data, total] = await Promise.all([
      this.prisma.requisiciones_inventario.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { fecha_creacion: 'desc' },
        include: {
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
          usuario_procesa: {
            select: {
              id_usuario: true,
              nombres: true,
              apellidos: true,
            },
          },
          bodega_origen: true,
          bodega_destino: true,
          sucursal_origen: true,
          sucursal_destino: true,
          estante_origen: true,
          estante_destino: true,
          detalle: {
            include: {
              catalogo: true,
              series: {
                include: {
                  serie: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.requisiciones_inventario.count({ where }),
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
   * Obtiene una requisición por ID
   */
  async findOne(id: number): Promise<RequisicionWithRelations> {
    const requisicion = await this.prisma.requisiciones_inventario.findUnique({
      where: { id_requisicion: id },
      include: {
        detalle: {
          include: {
            catalogo: true,
            series: {
              include: {
                serie: true,
              },
            },
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
        usuario_procesa: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
        bodega_origen: true,
        bodega_destino: true,
        sucursal_origen: true,
        sucursal_destino: true,
        estante_origen: true,
        estante_destino: true,
      },
    });

    if (!requisicion) {
      throw new NotFoundException(`Requisición con ID ${id} no encontrada`);
    }

    // Obtener IDs de catálogos únicos
    const catalogoIds = requisicion.detalle.map((d) => d.id_catalogo);

    // === DEBUG LOGGING ===
    console.log('=== DEBUG: Existencias Destino ===');
    console.log('Tipo:', requisicion.tipo);
    console.log('id_bodega_origen:', requisicion.id_bodega_origen);
    console.log('id_bodega_destino:', requisicion.id_bodega_destino);
    console.log('id_estante_origen:', requisicion.id_estante_origen);
    console.log('id_estante_destino:', requisicion.id_estante_destino);
    console.log('catalogoIds:', catalogoIds);
    // === END DEBUG ===

    // Consulta batch: Stock en bodega origen
    const stocksOrigen = await this.prisma.inventario.findMany({
      where: {
        id_catalogo: { in: catalogoIds },
        ...(requisicion.id_bodega_origen != null && {
          id_bodega: requisicion.id_bodega_origen,
        }),
        // Inventario se rastrea a nivel de bodega, no de estante
      },
      select: {
        id_catalogo: true,
        cantidad_disponible: true,
        cantidad_reservada: true,
      },
    });

    // Consulta batch: Stock en bodega destino
    // Para CAMBIO_ESTANTE, el destino está en la misma bodega que el origen
    let destinoWhereClause: any = {
      id_catalogo: { in: catalogoIds },
    };

    if (requisicion.tipo === 'CAMBIO_ESTANTE') {
      // Mismo bodega, diferente estante
      if (requisicion.id_bodega_origen != null) {
        destinoWhereClause.id_bodega = requisicion.id_bodega_origen;
      }
      // Inventario se rastrea a nivel de bodega, no de estante
    } else {
      // TRANSFERENCIA_BODEGA o TRANSFERENCIA_SUCURSAL
      if (requisicion.id_bodega_destino != null) {
        destinoWhereClause.id_bodega = requisicion.id_bodega_destino;
      }
      // Inventario se rastrea a nivel de bodega, no de estante
    }

    const stocksDestino = await this.prisma.inventario.findMany({
      where: destinoWhereClause,
      select: {
        id_catalogo: true,
        cantidad_disponible: true,
        cantidad_reservada: true,
      },
    });

    // === DEBUG LOGGING ===
    console.log('destinoWhereClause:', JSON.stringify(destinoWhereClause, null, 2));
    console.log('stocksDestino result:', JSON.stringify(stocksDestino, null, 2));
    console.log('stocksDestino.length:', stocksDestino.length);
    // === END DEBUG ===

    // Enriquecer cada detalle con información de existencias
    const detalleConStock = requisicion.detalle.map((item) => {
      const stockOrigen = stocksOrigen.find(
        (s) => s.id_catalogo === item.id_catalogo,
      );
      const stockDestino = stocksDestino.find(
        (s) => s.id_catalogo === item.id_catalogo,
      );

      return {
        ...item,
        existencias_origen: {
          disponible: stockOrigen?.cantidad_disponible || 0,
          reservada: stockOrigen?.cantidad_reservada || 0,
          total:
            (stockOrigen?.cantidad_disponible || 0) +
            (stockOrigen?.cantidad_reservada || 0),
        },
        existencias_destino: {
          disponible: stockDestino?.cantidad_disponible || 0,
          reservada: stockDestino?.cantidad_reservada || 0,
          total:
            (stockDestino?.cantidad_disponible || 0) +
            (stockDestino?.cantidad_reservada || 0),
        },
      };
    });

    return {
      ...requisicion,
      detalle: detalleConStock,
    };
  }

  /**
   * Actualiza una requisición (solo si está PENDIENTE)
   */
  async update(
    id: number,
    updateRequisicionDto: UpdateRequisicionDto,
    id_usuario: number,
  ): Promise<RequisicionWithRelations> {
    const requisicion = await this.findOne(id);

    if (requisicion.estado !== 'PENDIENTE') {
      throw new ConflictException(
        'Solo se pueden actualizar requisiciones en estado PENDIENTE',
      );
    }

    // Si se actualiza el tipo o ubicaciones, validar
    if (
      updateRequisicionDto.tipo ||
      updateRequisicionDto.id_bodega_origen !== undefined ||
      updateRequisicionDto.id_bodega_destino !== undefined ||
      updateRequisicionDto.id_sucursal_origen !== undefined ||
      updateRequisicionDto.id_sucursal_destino !== undefined ||
      updateRequisicionDto.id_estante_origen !== undefined ||
      updateRequisicionDto.id_estante_destino !== undefined
    ) {
      const dataToValidate = {
        tipo: updateRequisicionDto.tipo || requisicion.tipo,
        id_bodega_origen:
          updateRequisicionDto.id_bodega_origen ?? requisicion.id_bodega_origen,
        id_bodega_destino:
          updateRequisicionDto.id_bodega_destino ??
          requisicion.id_bodega_destino,
        id_sucursal_origen:
          updateRequisicionDto.id_sucursal_origen ??
          requisicion.id_sucursal_origen,
        id_sucursal_destino:
          updateRequisicionDto.id_sucursal_destino ??
          requisicion.id_sucursal_destino,
        id_estante_origen:
          updateRequisicionDto.id_estante_origen ??
          requisicion.id_estante_origen,
        id_estante_destino:
          updateRequisicionDto.id_estante_destino ??
          requisicion.id_estante_destino,
      } as CreateRequisicionDto;

      this.validateOrigenDestino(dataToValidate);
    }

    const { detalle, ...requisicionData } = updateRequisicionDto;

    // Limpiar campos nulos o con valor 0 (que no existen en BD)
    const cleanedData: any = {};

    // Solo agregar campos que estén presentes y tengan valores válidos
    if (requisicionData.tipo !== undefined) {
      cleanedData.tipo = requisicionData.tipo;
    }
    if (requisicionData.motivo !== undefined) {
      cleanedData.motivo = requisicionData.motivo;
    }
    if (requisicionData.id_sucursal_origen !== undefined) {
      if (requisicionData.id_sucursal_origen > 0) {
        cleanedData.id_sucursal_origen = requisicionData.id_sucursal_origen;
      } else {
        cleanedData.id_sucursal_origen = null;
      }
    }
    if (requisicionData.id_bodega_origen !== undefined) {
      if (requisicionData.id_bodega_origen > 0) {
        cleanedData.id_bodega_origen = requisicionData.id_bodega_origen;
      } else {
        cleanedData.id_bodega_origen = null;
      }
    }
    if (requisicionData.id_estante_origen !== undefined) {
      if (requisicionData.id_estante_origen > 0) {
        cleanedData.id_estante_origen = requisicionData.id_estante_origen;
      } else {
        cleanedData.id_estante_origen = null;
      }
    }
    if (requisicionData.id_sucursal_destino !== undefined) {
      if (requisicionData.id_sucursal_destino > 0) {
        cleanedData.id_sucursal_destino = requisicionData.id_sucursal_destino;
      } else {
        cleanedData.id_sucursal_destino = null;
      }
    }
    if (requisicionData.id_bodega_destino !== undefined) {
      if (requisicionData.id_bodega_destino > 0) {
        cleanedData.id_bodega_destino = requisicionData.id_bodega_destino;
      } else {
        cleanedData.id_bodega_destino = null;
      }
    }
    if (requisicionData.id_estante_destino !== undefined) {
      if (requisicionData.id_estante_destino > 0) {
        cleanedData.id_estante_destino = requisicionData.id_estante_destino;
      } else {
        cleanedData.id_estante_destino = null;
      }
    }

    // Si se actualiza el detalle, validar series y eliminar el anterior
    if (detalle) {
      // Validar series para cada item
      for (const item of detalle) {
        if (item.series && item.series.length > 0) {
          await this.validateSeries(
            item.id_catalogo,
            item.series,
            cleanedData.id_bodega_origen ?? requisicion.id_bodega_origen,
            cleanedData.id_estante_origen ?? requisicion.id_estante_origen,
          );

          if (item.cantidad_solicitada !== item.series.length) {
            throw new BadRequestException(
              `La cantidad solicitada (${item.cantidad_solicitada}) debe coincidir con el número de series especificadas (${item.series.length})`,
            );
          }
        }
      }

      await this.prisma.requisiciones_detalle.deleteMany({
        where: { id_requisicion: id },
      });
    }

    const updated = await this.prisma.requisiciones_inventario.update({
      where: { id_requisicion: id },
      data: {
        ...cleanedData,
        ...(detalle && {
          detalle: {
            create: detalle.map((item) => ({
              id_catalogo: item.id_catalogo,
              cantidad_solicitada: item.cantidad_solicitada,
              observaciones: item.observaciones,
              ...(item.series && item.series.length > 0 && {
                series: {
                  create: item.series.map((id_serie) => ({
                    id_serie,
                  })),
                },
              }),
            })),
          },
        }),
      },
      include: {
        detalle: {
          include: {
            catalogo: true,
            series: {
              include: {
                serie: true,
              },
            },
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
        usuario_procesa: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
        bodega_origen: true,
        bodega_destino: true,
        sucursal_origen: true,
        sucursal_destino: true,
        estante_origen: true,
        estante_destino: true,
      },
    });

    await this.prisma.logAction(
      'ACTUALIZAR_REQUISICION',
      id_usuario,
      `Requisición actualizada: ${updated.codigo}`,
    );

    return updated;
  }

  /**
   * Autoriza o rechaza una requisición
   */
  async authorize(
    id: number,
    authorizeDto: AuthorizeRequisicionDto,
    id_usuario: number,
  ): Promise<RequisicionWithRelations> {
    const requisicion = await this.findOne(id);

    if (requisicion.estado !== 'PENDIENTE') {
      throw new ConflictException(
        'Solo se pueden autorizar requisiciones en estado PENDIENTE',
      );
    }

    const { aprobar, observaciones_autorizacion, detalle } = authorizeDto;

    // Si se aprueba, actualizar cantidades autorizadas y series
    if (aprobar && detalle) {
      for (const item of detalle) {
        const detalleItem = requisicion.detalle.find(
          (d) => d.id_requisicion_detalle === item.id_requisicion_detalle,
        );

        if (!detalleItem) {
          throw new NotFoundException(
            `Detalle con ID ${item.id_requisicion_detalle} no encontrado`,
          );
        }

        // Si el item tiene series solicitadas, manejar autorización de series
        if (detalleItem.series && detalleItem.series.length > 0) {
          // Para productos con series, se REQUIERE especificar series_autorizadas
          if (!item.series_autorizadas || item.series_autorizadas.length === 0) {
            // Si cantidad_autorizada es 0, está bien (se rechaza ese item)
            if (item.cantidad_autorizada > 0) {
              throw new BadRequestException(
                `El producto "${detalleItem.catalogo.nombre}" tiene series. Debe especificar las series a autorizar o establecer cantidad_autorizada en 0 para rechazar este item.`,
              );
            }

            // Eliminar todas las series ya que se autorizó cantidad 0
            await this.prisma.requisiciones_detalle_series.deleteMany({
              where: {
                id_requisicion_detalle: item.id_requisicion_detalle,
              },
            });

            await this.prisma.requisiciones_detalle.update({
              where: {
                id_requisicion_detalle: item.id_requisicion_detalle,
              },
              data: {
                cantidad_autorizada: 0,
              },
            });
          } else {
            // Validar que cantidad_autorizada coincida con número de series
            if (item.cantidad_autorizada !== item.series_autorizadas.length) {
              throw new BadRequestException(
                `Para el producto "${detalleItem.catalogo.nombre}", la cantidad autorizada (${item.cantidad_autorizada}) debe coincidir con el número de series seleccionadas (${item.series_autorizadas.length})`,
              );
            }

            // Validar que las series autorizadas estén en las series solicitadas
            const seriesSolicitadas = detalleItem.series.map((s) => s.id_serie);
            const seriesNoSolicitadas = item.series_autorizadas.filter(
              (id) => !seriesSolicitadas.includes(id),
            );

            if (seriesNoSolicitadas.length > 0) {
              throw new BadRequestException(
                `Las series ${seriesNoSolicitadas.join(', ')} no están en la lista de series solicitadas para "${detalleItem.catalogo.nombre}"`,
              );
            }

            // Eliminar series no autorizadas
            const seriesToDelete = seriesSolicitadas.filter(
              (id) => !item.series_autorizadas!.includes(id),
            );

            if (seriesToDelete.length > 0) {
              await this.prisma.requisiciones_detalle_series.deleteMany({
                where: {
                  id_requisicion_detalle: item.id_requisicion_detalle,
                  id_serie: { in: seriesToDelete },
                },
              });
            }

            // La cantidad autorizada es el número de series autorizadas
            await this.prisma.requisiciones_detalle.update({
              where: {
                id_requisicion_detalle: item.id_requisicion_detalle,
              },
              data: {
                cantidad_autorizada: item.series_autorizadas.length,
              },
            });
          }
        } else {
          // Para items sin series, validar cantidad normal
          if (item.cantidad_autorizada > detalleItem.cantidad_solicitada) {
            throw new BadRequestException(
              `La cantidad autorizada no puede ser mayor a la solicitada para el item ${detalleItem.catalogo.nombre}`,
            );
          }

          await this.prisma.requisiciones_detalle.update({
            where: {
              id_requisicion_detalle: item.id_requisicion_detalle,
            },
            data: {
              cantidad_autorizada: item.cantidad_autorizada,
            },
          });
        }
      }
    } else if (aprobar && !detalle) {
      // Si se aprueba sin detalle, autorizar toda la cantidad/series solicitadas
      for (const item of requisicion.detalle) {
        const cantidadAutorizada =
          item.series && item.series.length > 0
            ? item.series.length
            : item.cantidad_solicitada;

        await this.prisma.requisiciones_detalle.update({
          where: {
            id_requisicion_detalle: item.id_requisicion_detalle,
          },
          data: {
            cantidad_autorizada: cantidadAutorizada,
          },
        });
      }
    }

    const updated = await this.prisma.requisiciones_inventario.update({
      where: { id_requisicion: id },
      data: {
        estado: aprobar ? 'APROBADA' : 'RECHAZADA',
        id_usuario_autoriza: id_usuario,
        fecha_autorizacion: new Date(),
        observaciones_autorizacion,
      },
      include: {
        detalle: {
          include: {
            catalogo: true,
            series: {
              include: {
                serie: true,
              },
            },
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
        usuario_procesa: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
        bodega_origen: true,
        bodega_destino: true,
        sucursal_origen: true,
        sucursal_destino: true,
        estante_origen: true,
        estante_destino: true,
      },
    });

    await this.prisma.logAction(
      aprobar ? 'APROBAR_REQUISICION' : 'RECHAZAR_REQUISICION',
      id_usuario,
      `Requisición ${aprobar ? 'aprobada' : 'rechazada'}: ${updated.codigo}`,
    );

    return updated;
  }

  /**
   * Procesa una requisición aprobada (ejecuta la transferencia de inventario)
   */
  async process(
    id: number,
    processDto: ProcessRequisicionDto,
    id_usuario: number,
  ): Promise<RequisicionWithRelations> {
    const requisicion = await this.findOne(id);

    if (requisicion.estado !== 'APROBADA') {
      throw new ConflictException(
        'Solo se pueden procesar requisiciones en estado APROBADA',
      );
    }

    // Validar que hay cantidades autorizadas
    const itemsSinAutorizar = requisicion.detalle.filter(
      (d) => !d.cantidad_autorizada || d.cantidad_autorizada <= 0,
    );

    if (itemsSinAutorizar.length > 0) {
      throw new BadRequestException(
        'Todos los items deben tener cantidad autorizada antes de procesar',
      );
    }

    // Ejecutar transferencia según el tipo
    if (requisicion.tipo === 'TRANSFERENCIA_BODEGA') {
      await this.procesarTransferenciaBodega(requisicion, id_usuario);
    } else if (requisicion.tipo === 'TRANSFERENCIA_SUCURSAL') {
      await this.procesarTransferenciaSucursal(requisicion, id_usuario);
    } else if (requisicion.tipo === 'CAMBIO_ESTANTE') {
      await this.procesarCambioEstante(requisicion, id_usuario);
    }

    // Actualizar cantidades procesadas
    for (const item of requisicion.detalle) {
      await this.prisma.requisiciones_detalle.update({
        where: {
          id_requisicion_detalle: item.id_requisicion_detalle,
        },
        data: {
          cantidad_procesada: item.cantidad_autorizada!,
        },
      });
    }

    const updated = await this.prisma.requisiciones_inventario.update({
      where: { id_requisicion: id },
      data: {
        estado: 'PROCESADA',
        id_usuario_procesa: id_usuario,
        fecha_proceso: new Date(),
        observaciones_proceso: processDto.observaciones_proceso,
      },
      include: {
        detalle: {
          include: {
            catalogo: true,
            series: {
              include: {
                serie: true,
              },
            },
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
        usuario_procesa: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
        bodega_origen: true,
        bodega_destino: true,
        sucursal_origen: true,
        sucursal_destino: true,
        estante_origen: true,
        estante_destino: true,
      },
    });

    await this.prisma.logAction(
      'PROCESAR_REQUISICION',
      id_usuario,
      `Requisición procesada: ${updated.codigo}`,
    );

    return updated;
  }

  /**
   * Procesa transferencia entre bodegas
   */
  private async procesarTransferenciaBodega(
    requisicion: RequisicionWithRelations,
    id_usuario: number,
  ): Promise<void> {
    // Validar que las bodegas existan
    if (!requisicion.id_bodega_origen || !requisicion.id_bodega_destino) {
      throw new BadRequestException('Bodega origen y destino son requeridas');
    }

    for (const item of requisicion.detalle) {
      const cantidad = item.cantidad_autorizada!;

      // Si el item tiene series, procesar transferencia de series
      if (item.series && item.series.length > 0) {
        await this.procesarTransferenciaConSeries(
          item,
          requisicion.id_bodega_origen,
          requisicion.id_bodega_destino,
          requisicion.id_estante_origen,
          requisicion.id_estante_destino,
          id_usuario,
          requisicion.codigo,
        );
      } else {
        // Procesar transferencia normal sin series
        await this.procesarTransferenciaSinSeries(
          item,
          cantidad,
          requisicion.id_bodega_origen,
          requisicion.id_bodega_destino,
          id_usuario,
          requisicion.codigo,
        );
      }
    }
  }

  /**
   * Procesa transferencia de productos con series
   */
  private async procesarTransferenciaConSeries(
    item: any,
    id_bodega_origen: number,
    id_bodega_destino: number,
    id_estante_origen: number | null,
    id_estante_destino: number | null,
    id_usuario: number,
    codigoRequisicion: string,
  ): Promise<void> {
    // Obtener inventarios origen
    const inventarioOrigen = await this.prisma.inventario.findFirst({
      where: {
        id_catalogo: item.id_catalogo,
        id_bodega: id_bodega_origen,
        ...(id_estante_origen && { id_estante: id_estante_origen }),
      },
    });

    if (!inventarioOrigen) {
      throw new NotFoundException(
        `Inventario origen no encontrado para ${item.catalogo.nombre}`,
      );
    }

    // Buscar o crear inventario destino
    let inventarioDestino = await this.prisma.inventario.findFirst({
      where: {
        id_catalogo: item.id_catalogo,
        id_bodega: id_bodega_destino,
        ...(id_estante_destino && { id_estante: id_estante_destino }),
      },
    });

    if (!inventarioDestino) {
      inventarioDestino = await this.prisma.inventario.create({
        data: {
          id_catalogo: item.id_catalogo,
          id_bodega: id_bodega_destino,
          id_estante: id_estante_destino,
          cantidad_disponible: 0,
          costo_promedio: inventarioOrigen.costo_promedio,
        },
      });
    }

    // Obtener series AUTORIZADAS desde la tabla de relación
    const seriesAutorizadas = await this.prisma.requisiciones_detalle_series.findMany({
      where: {
        id_requisicion_detalle: item.id_requisicion_detalle,
      },
      include: {
        serie: true,  // Include completo de inventario_series
      },
    });

    // Procesar cada serie AUTORIZADA
    for (const serieAutorizada of seriesAutorizadas) {
      const serie = serieAutorizada.serie;

      // Validar que la serie esté en el inventario origen
      if (serie.id_inventario !== inventarioOrigen.id_inventario) {
        throw new BadRequestException(
          `La serie ${serie.numero_serie} no está en el inventario origen`,
        );
      }

      // Validar que la serie esté disponible
      if (serie.estado !== 'DISPONIBLE') {
        throw new BadRequestException(
          `La serie ${serie.numero_serie} no está disponible (estado: ${serie.estado})`,
        );
      }

      // Actualizar serie al nuevo inventario (ESTO ES LO CRÍTICO)
      await this.prisma.inventario_series.update({
        where: { id_serie: serie.id_serie },
        data: {
          id_inventario: inventarioDestino.id_inventario,
          estado: 'EN_TRANSITO',
        },
      });

      // Registrar en historial
      await this.prisma.historial_series.create({
        data: {
          id_serie: serie.id_serie,
          estado_anterior: 'DISPONIBLE',
          estado_nuevo: 'EN_TRANSITO',
          id_bodega_anterior: id_bodega_origen,
          id_bodega_nueva: id_bodega_destino,
          id_usuario,
          observaciones: `Transferencia por requisición ${codigoRequisicion}`,
        },
      });

      // Una vez completada la transferencia, marcar como disponible en destino
      await this.prisma.inventario_series.update({
        where: { id_serie: serie.id_serie },
        data: {
          estado: 'DISPONIBLE',
        },
      });

      // Actualizar historial con estado final
      await this.prisma.historial_series.create({
        data: {
          id_serie: serie.id_serie,
          estado_anterior: 'EN_TRANSITO',
          estado_nuevo: 'DISPONIBLE',
          id_bodega_anterior: id_bodega_origen,
          id_bodega_nueva: id_bodega_destino,
          id_usuario,
          observaciones: `Transferencia completada - requisición ${codigoRequisicion}`,
        },
      });
    }

    const cantidad = seriesAutorizadas.length;

    // Actualizar cantidades en inventarios
    await this.prisma.inventario.update({
      where: { id_inventario: inventarioOrigen.id_inventario },
      data: {
        cantidad_disponible: {
          decrement: cantidad,
        },
      },
    });

    await this.prisma.inventario.update({
      where: { id_inventario: inventarioDestino.id_inventario },
      data: {
        cantidad_disponible: {
          increment: cantidad,
        },
      },
    });

    // Registrar movimiento
    await this.prisma.movimientos_inventario.create({
      data: {
        tipo: 'TRANSFERENCIA',
        id_catalogo: item.id_catalogo,
        id_bodega_origen,
        id_bodega_destino,
        cantidad,
        costo_unitario: inventarioOrigen.costo_promedio,
        id_usuario,
        observaciones: `Requisición ${codigoRequisicion} - ${cantidad} series transferidas`,
      },
    });
  }

  /**
   * Procesa transferencia de productos sin series
   */
  private async procesarTransferenciaSinSeries(
    item: any,
    cantidad: number,
    id_bodega_origen: number,
    id_bodega_destino: number,
    id_usuario: number,
    codigoRequisicion: string,
  ): Promise<void> {
    // Verificar stock disponible en bodega origen
    const inventarioOrigen = await this.prisma.inventario.findFirst({
      where: {
        id_catalogo: item.id_catalogo,
        id_bodega: id_bodega_origen,
      },
    });

    if (
      !inventarioOrigen ||
      inventarioOrigen.cantidad_disponible < cantidad
    ) {
      throw new BadRequestException(
        `Stock insuficiente en bodega origen para el producto ${item.catalogo.nombre}`,
      );
    }

    // Reducir stock en bodega origen
    await this.prisma.inventario.update({
      where: {
        id_inventario: inventarioOrigen.id_inventario,
      },
      data: {
        cantidad_disponible: {
          decrement: cantidad,
        },
      },
    });

    // Incrementar stock en bodega destino
    const inventarioDestino = await this.prisma.inventario.findFirst({
      where: {
        id_catalogo: item.id_catalogo,
        id_bodega: id_bodega_destino,
      },
    });

    if (inventarioDestino) {
      await this.prisma.inventario.update({
        where: {
          id_inventario: inventarioDestino.id_inventario,
        },
        data: {
          cantidad_disponible: {
            increment: cantidad,
          },
        },
      });
    } else {
      // Crear nuevo registro de inventario en bodega destino
      await this.prisma.inventario.create({
        data: {
          id_catalogo: item.id_catalogo,
          id_bodega: id_bodega_destino,
          cantidad_disponible: cantidad,
          costo_promedio: inventarioOrigen.costo_promedio,
        },
      });
    }

    // Registrar movimiento
    await this.prisma.movimientos_inventario.create({
      data: {
        tipo: 'TRANSFERENCIA',
        id_catalogo: item.id_catalogo,
        id_bodega_origen,
        id_bodega_destino,
        cantidad,
        costo_unitario: inventarioOrigen.costo_promedio,
        id_usuario,
        observaciones: `Requisición ${codigoRequisicion}`,
      },
    });
  }

  /**
   * Procesa transferencia entre sucursales (mueve de bodega principal a bodega principal)
   */
  private async procesarTransferenciaSucursal(
    requisicion: RequisicionWithRelations,
    id_usuario: number,
  ): Promise<void> {
    // Validar que las sucursales existan
    if (!requisicion.id_sucursal_origen || !requisicion.id_sucursal_destino) {
      throw new BadRequestException('Sucursal origen y destino son requeridas');
    }

    // Obtener bodegas principales de cada sucursal
    const bodegaOrigen = await this.prisma.bodegas.findFirst({
      where: {
        id_sucursal: requisicion.id_sucursal_origen,
        tipo: 'BODEGA',
      },
    });

    const bodegaDestino = await this.prisma.bodegas.findFirst({
      where: {
        id_sucursal: requisicion.id_sucursal_destino,
        tipo: 'BODEGA',
      },
    });

    if (!bodegaOrigen) {
      throw new NotFoundException(
        'No se encontró bodega principal en sucursal origen',
      );
    }

    if (!bodegaDestino) {
      throw new NotFoundException(
        'No se encontró bodega principal en sucursal destino',
      );
    }

    // Procesar como transferencia de bodega
    const requisicionConBodegas = {
      ...requisicion,
      id_bodega_origen: bodegaOrigen.id_bodega,
      id_bodega_destino: bodegaDestino.id_bodega,
    };

    await this.procesarTransferenciaBodega(requisicionConBodegas, id_usuario);
  }

  /**
   * Procesa cambio de estante dentro de la misma bodega
   */
  private async procesarCambioEstante(
    requisicion: RequisicionWithRelations,
    id_usuario: number,
  ): Promise<void> {
    // Validar que bodega y estantes existan
    if (!requisicion.id_bodega_origen || !requisicion.id_estante_origen || !requisicion.id_estante_destino) {
      throw new BadRequestException('Bodega y estantes origen/destino son requeridos');
    }

    for (const item of requisicion.detalle) {
      const cantidad = item.cantidad_autorizada!;

      // Si el item tiene series, usar procesarTransferenciaConSeries
      if (item.series && item.series.length > 0) {
        await this.procesarTransferenciaConSeries(
          item,
          requisicion.id_bodega_origen,
          requisicion.id_bodega_origen, // misma bodega
          requisicion.id_estante_origen,
          requisicion.id_estante_destino,
          id_usuario,
          requisicion.codigo,
        );
      } else {
        // Procesar cambio normal sin series
        // Verificar stock en estante origen
        const inventarioOrigen = await this.prisma.inventario.findFirst({
          where: {
            id_catalogo: item.id_catalogo,
            id_bodega: requisicion.id_bodega_origen,
            id_estante: requisicion.id_estante_origen,
          },
        });

        if (
          !inventarioOrigen ||
          inventarioOrigen.cantidad_disponible < cantidad
        ) {
          throw new BadRequestException(
            `Stock insuficiente en estante origen para el producto ${item.catalogo.nombre}`,
          );
        }

        // Reducir stock en estante origen
        await this.prisma.inventario.update({
          where: {
            id_inventario: inventarioOrigen.id_inventario,
          },
          data: {
            cantidad_disponible: {
              decrement: cantidad,
            },
          },
        });

        // Incrementar stock en estante destino
        const inventarioDestino = await this.prisma.inventario.findFirst({
          where: {
            id_catalogo: item.id_catalogo,
            id_bodega: requisicion.id_bodega_origen,
            id_estante: requisicion.id_estante_destino,
          },
        });

        if (inventarioDestino) {
          await this.prisma.inventario.update({
            where: {
              id_inventario: inventarioDestino.id_inventario,
            },
            data: {
              cantidad_disponible: {
                increment: cantidad,
              },
            },
          });
        } else {
          // Crear nuevo registro en estante destino
          await this.prisma.inventario.create({
            data: {
              id_catalogo: item.id_catalogo,
              id_bodega: requisicion.id_bodega_origen,
              id_estante: requisicion.id_estante_destino,
              cantidad_disponible: cantidad,
              costo_promedio: inventarioOrigen.costo_promedio,
            },
          });
        }

        // Registrar movimiento
        await this.prisma.movimientos_inventario.create({
          data: {
            tipo: 'TRANSFERENCIA',
            id_catalogo: item.id_catalogo,
            id_bodega_origen: requisicion.id_bodega_origen,
            id_bodega_destino: requisicion.id_bodega_origen,
            cantidad: cantidad,
            costo_unitario: inventarioOrigen.costo_promedio,
            id_usuario: id_usuario,
            observaciones: `Cambio de estante - Requisición ${requisicion.codigo}`,
          },
        });
      }
    }
  }

  /**
   * Cancela una requisición
   */
  async cancel(id: number, id_usuario: number): Promise<RequisicionWithRelations> {
    const requisicion = await this.findOne(id);

    if (requisicion.estado === 'PROCESADA') {
      throw new ConflictException(
        'No se puede cancelar una requisición ya procesada',
      );
    }

    if (requisicion.estado === 'CANCELADA') {
      throw new ConflictException('La requisición ya está cancelada');
    }

    const updated = await this.prisma.requisiciones_inventario.update({
      where: { id_requisicion: id },
      data: {
        estado: 'CANCELADA',
      },
      include: {
        detalle: {
          include: {
            catalogo: true,
            series: {
              include: {
                serie: true,
              },
            },
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
        usuario_procesa: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
        bodega_origen: true,
        bodega_destino: true,
        sucursal_origen: true,
        sucursal_destino: true,
        estante_origen: true,
        estante_destino: true,
      },
    });

    await this.prisma.logAction(
      'CANCELAR_REQUISICION',
      id_usuario,
      `Requisición cancelada: ${updated.codigo}`,
    );

    return updated;
  }

  /**
   * Elimina (soft delete) una requisición
   */
  async remove(id: number, id_usuario: number): Promise<RequisicionWithRelations> {
    const requisicion = await this.findOne(id);

    if (requisicion.estado === 'PROCESADA') {
      throw new ConflictException(
        'No se puede eliminar una requisición ya procesada',
      );
    }

    // En este caso, como no hay campo "estado" en el modelo de requisiciones,
    // simplemente cancelamos la requisición
    return this.cancel(id, id_usuario);
  }

  /**
   * Genera un PDF de la requisición usando jsReport
   */
  async generatePdf(id: number): Promise<Buffer> {
    // Obtener requisición completa
    const requisicion = await this.findOne(id);

    // Leer plantilla HTML
    const templatePath = path.join(process.cwd(), 'templates/inventario/requisicion.html');
    if (!fs.existsSync(templatePath)) {
      throw new NotFoundException('Plantilla de reporte no encontrada');
    }

    const templateHtml = fs.readFileSync(templatePath, 'utf-8');

    // Formatear fechas
    const formatDate = (date: Date | null): string => {
      if (!date) return 'N/A';
      return new Date(date).toLocaleString('es-SV', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    // Mapear tipo a label
    const TIPO_LABELS = {
      TRANSFERENCIA_BODEGA: 'Transferencia entre Bodegas',
      TRANSFERENCIA_SUCURSAL: 'Transferencia entre Sucursales',
      CAMBIO_ESTANTE: 'Cambio de Estante',
    };

    // Mapear estado a clase CSS
    const ESTADO_CLASS = {
      PENDIENTE: 'pendiente',
      APROBADA: 'aprobada',
      RECHAZADA: 'rechazada',
      PROCESADA: 'procesada',
      CANCELADA: 'cancelada',
    };

    // Preparar datos para la plantilla
    const templateData = {
      ...requisicion,
      tipoLabel: TIPO_LABELS[requisicion.tipo] || requisicion.tipo,
      estadoClass: ESTADO_CLASS[requisicion.estado] || 'pendiente',
      fechaCreacion: formatDate(requisicion.fecha_creacion),
      fechaAutorizacion: formatDate(requisicion.fecha_autorizacion),
      fechaProceso: formatDate(requisicion.fecha_proceso),
      fechaGeneracion: new Date().toLocaleString('es-SV', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
      mostrarAutorizada: requisicion.estado === 'APROBADA' || requisicion.estado === 'PROCESADA',
      mostrarProcesada: requisicion.estado === 'PROCESADA',
    };

    // Configurar petición a jsReport
    const API_REPORT = process.env.API_REPORT || 'https://reports.edal.group/api/report';

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
            reportName: `Requisicion_${requisicion.codigo}`,
          },
        },
        {
          responseType: 'arraybuffer',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      return Buffer.from(response.data);
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new BadRequestException('Error al generar el PDF de la requisición');
    }
  }
}
