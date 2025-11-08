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

    // Generar código único
    const codigo = await this.generateCodigo();

    const { detalle, ...requisicionData } = createRequisicionDto;

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
          })),
        },
      },
      include: {
        detalle: {
          include: {
            catalogo: true,
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
      where.id_usuario_solicita = id_usuario_solicita;
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

    return requisicion;
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

    // Si se actualiza el detalle, eliminar el anterior y crear nuevo
    if (detalle) {
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
            })),
          },
        }),
      },
      include: {
        detalle: {
          include: {
            catalogo: true,
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

    // Si se aprueba, actualizar cantidades autorizadas
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
    } else if (aprobar && !detalle) {
      // Si se aprueba sin detalle, autorizar la cantidad solicitada completa
      for (const item of requisicion.detalle) {
        await this.prisma.requisiciones_detalle.update({
          where: {
            id_requisicion_detalle: item.id_requisicion_detalle,
          },
          data: {
            cantidad_autorizada: item.cantidad_solicitada,
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

      // Verificar stock disponible en bodega origen
      const inventarioOrigen = await this.prisma.inventario.findFirst({
        where: {
          id_catalogo: item.id_catalogo,
          id_bodega: requisicion.id_bodega_origen,
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
          id_bodega: requisicion.id_bodega_destino,
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
            id_bodega: requisicion.id_bodega_destino,
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
          id_bodega_destino: requisicion.id_bodega_destino,
          cantidad: cantidad,
          costo_unitario: inventarioOrigen.costo_promedio,
          id_usuario: id_usuario,
          observaciones: `Requisición ${requisicion.codigo}`,
        },
      });
    }
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
