import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrdenSalidaDto } from './dto/create-orden-salida.dto';
import { UpdateOrdenSalidaDto } from './dto/update-orden-salida.dto';
import {
  AutorizarOrdenSalidaDto,
  RechazarOrdenSalidaDto,
} from './dto/autorizar-orden-salida.dto';
import {
  ProcesarOrdenSalidaDto,
  CancelarOrdenSalidaDto,
} from './dto/procesar-orden-salida.dto';
import { FilterOrdenSalidaDto } from './dto/filter-orden-salida.dto';
import { Prisma, usuarios } from '@prisma/client';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class OrdenesSalidaService {
  constructor(private prisma: PrismaService) {}

  /**
   * Genera el código único para la orden de salida
   * Formato: OS-YYYYMM-#####
   */
  private async generarCodigoOrden(): Promise<string> {
    const fecha = new Date();
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const prefix = `OS-${year}${month}-`;

    // Buscar el último número de orden del mes
    const ultimaOrden = await this.prisma.ordenes_salida.findFirst({
      where: {
        codigo: {
          startsWith: prefix,
        },
      },
      orderBy: {
        codigo: 'desc',
      },
    });

    let numeroOrden = 1;
    if (ultimaOrden) {
      const ultimoNumero = parseInt(ultimaOrden.codigo.split('-')[2]);
      numeroOrden = ultimoNumero + 1;
    }

    return `${prefix}${String(numeroOrden).padStart(5, '0')}`;
  }

  /**
   * Crear una nueva orden de salida
   */
  async create(createOrdenSalidaDto: CreateOrdenSalidaDto, user: usuarios) {
    // Validar que la bodega existe
    const bodega = await this.prisma.bodegas.findUnique({
      where: { id_bodega: createOrdenSalidaDto.id_bodega_origen },
    });

    if (!bodega) {
      throw new NotFoundException(
        `Bodega con ID ${createOrdenSalidaDto.id_bodega_origen} no encontrada`,
      );
    }

    // Validar que todos los productos existen
    for (const item of createOrdenSalidaDto.detalle) {
      const producto = await this.prisma.catalogo.findUnique({
        where: { id_catalogo: item.id_catalogo },
      });

      if (!producto) {
        throw new NotFoundException(
          `Producto con ID ${item.id_catalogo} no encontrado`,
        );
      }
    }

    // Generar código de orden
    const codigo = await this.generarCodigoOrden();

    // Calcular totales
    let subtotal = 0;
    for (const item of createOrdenSalidaDto.detalle) {
      const itemSubtotal =
        (item.costo_unitario || 0) * item.cantidad_solicitada;
      subtotal += itemSubtotal;
    }

    // Crear la orden con su detalle
    const ordenSalida = await this.prisma.ordenes_salida.create({
      data: {
        codigo,
        tipo: createOrdenSalidaDto.tipo,
        estado: 'BORRADOR',
        id_sucursal_origen: createOrdenSalidaDto.id_sucursal_origen,
        id_bodega_origen: createOrdenSalidaDto.id_bodega_origen,
        id_estante: createOrdenSalidaDto.id_estante,
        motivo: createOrdenSalidaDto.motivo,
        id_usuario_solicita: user.id_usuario,
        subtotal: new Prisma.Decimal(subtotal),
        total: new Prisma.Decimal(subtotal),
        // Campos para DESTRUCCION_CERTIFICADA
        empresa_destructora: createOrdenSalidaDto.empresa_destructora,
        numero_certificado: createOrdenSalidaDto.numero_certificado,
        fecha_destruccion: createOrdenSalidaDto.fecha_destruccion
          ? new Date(createOrdenSalidaDto.fecha_destruccion)
          : null,
        url_certificado: createOrdenSalidaDto.url_certificado,
        detalle: {
          create: createOrdenSalidaDto.detalle.map((item) => ({
            id_catalogo: item.id_catalogo,
            cantidad_solicitada: item.cantidad_solicitada,
            costo_unitario: item.costo_unitario
              ? new Prisma.Decimal(item.costo_unitario)
              : null,
            subtotal: item.costo_unitario
              ? new Prisma.Decimal(item.costo_unitario * item.cantidad_solicitada)
              : null,
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
        bodega_origen: {
          include: {
            sucursal: true,
          },
        },
        sucursal_origen: true,
        estante: true,
        usuario_solicita: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
            usuario: true,
          },
        },
      },
    });

    // Registrar log
    await this.prisma.logAction(
      'CREAR_ORDEN_SALIDA',
      user.id_usuario,
      `Orden de salida creada: ${codigo}`,
    );

    return ordenSalida;
  }

  /**
   * Listar todas las órdenes de salida con filtros
   */
  async findAll(filters: FilterOrdenSalidaDto) {
    const { page = 1, limit = 10, ...where } = filters;
    const skip = (page - 1) * limit;

    // Construir filtros dinámicos
    const whereClause: any = {};

    if (filters.estado) {
      whereClause.estado = filters.estado;
    }

    if (filters.tipo) {
      whereClause.tipo = filters.tipo;
    }

    if (filters.id_bodega_origen) {
      whereClause.id_bodega_origen = filters.id_bodega_origen;
    }

    if (filters.id_sucursal_origen) {
      whereClause.id_sucursal_origen = filters.id_sucursal_origen;
    }

    if (filters.id_usuario_solicita) {
      whereClause.id_usuario_solicita = filters.id_usuario_solicita;
    }

    if (filters.codigo) {
      whereClause.codigo = {
        contains: filters.codigo,
        mode: 'insensitive',
      };
    }

    if (filters.fecha_desde || filters.fecha_hasta) {
      whereClause.fecha_solicitud = {};
      if (filters.fecha_desde) {
        whereClause.fecha_solicitud.gte = new Date(filters.fecha_desde);
      }
      if (filters.fecha_hasta) {
        whereClause.fecha_solicitud.lte = new Date(filters.fecha_hasta);
      }
    }

    const [ordenes, total] = await Promise.all([
      this.prisma.ordenes_salida.findMany({
        where: whereClause,
        skip,
        take: limit,
        include: {
          detalle: {
            include: {
              catalogo: true,
            },
          },
          bodega_origen: {
            include: {
              sucursal: true,
            },
          },
          sucursal_origen: true,
          estante: true,
          usuario_solicita: {
            select: {
              id_usuario: true,
              nombres: true,
              apellidos: true,
              usuario: true,
            },
          },
          usuario_autoriza: {
            select: {
              id_usuario: true,
              nombres: true,
              apellidos: true,
              usuario: true,
            },
          },
          usuario_procesa: {
            select: {
              id_usuario: true,
              nombres: true,
              apellidos: true,
              usuario: true,
            },
          },
        },
        orderBy: {
          fecha_creacion: 'desc',
        },
      }),
      this.prisma.ordenes_salida.count({ where: whereClause }),
    ]);

    return {
      data: ordenes,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Obtener una orden de salida por ID
   */
  async findOne(id: number) {
    const orden = await this.prisma.ordenes_salida.findUnique({
      where: { id_orden_salida: id },
      include: {
        detalle: {
          include: {
            catalogo: true,
          },
        },
        bodega_origen: {
          include: {
            sucursal: true,
          },
        },
        sucursal_origen: true,
        estante: true,
        usuario_solicita: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
            usuario: true,
          },
        },
        usuario_autoriza: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
            usuario: true,
          },
        },
        usuario_procesa: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
            usuario: true,
          },
        },
      },
    });

    if (!orden) {
      throw new NotFoundException(`Orden de salida con ID ${id} no encontrada`);
    }

    return orden;
  }

  /**
   * Actualizar una orden de salida (solo si está en BORRADOR)
   */
  async update(id: number, updateOrdenSalidaDto: UpdateOrdenSalidaDto) {
    const ordenExistente = await this.findOne(id);

    if (ordenExistente.estado !== 'BORRADOR') {
      throw new BadRequestException(
        'Solo se pueden modificar órdenes en estado BORRADOR',
      );
    }

    // Si se actualizan productos, validar existencia
    if (updateOrdenSalidaDto.detalle) {
      for (const item of updateOrdenSalidaDto.detalle) {
        if (item.id_catalogo) {
          const producto = await this.prisma.catalogo.findUnique({
            where: { id_catalogo: item.id_catalogo },
          });

          if (!producto) {
            throw new NotFoundException(
              `Producto con ID ${item.id_catalogo} no encontrado`,
            );
          }
        }
      }

      // Eliminar detalles existentes y crear nuevos
      await this.prisma.ordenes_salida_detalle.deleteMany({
        where: { id_orden_salida: id },
      });
    }

    // Calcular nuevos totales si hay detalle
    let subtotal = ordenExistente.subtotal
      ? parseFloat(ordenExistente.subtotal.toString())
      : 0;

    if (updateOrdenSalidaDto.detalle) {
      subtotal = 0;
      for (const item of updateOrdenSalidaDto.detalle) {
        const itemSubtotal =
          (item.costo_unitario || 0) * (item.cantidad_solicitada || 0);
        subtotal += itemSubtotal;
      }
    }

    const ordenActualizada = await this.prisma.ordenes_salida.update({
      where: { id_orden_salida: id },
      data: {
        tipo: updateOrdenSalidaDto.tipo,
        id_sucursal_origen: updateOrdenSalidaDto.id_sucursal_origen,
        id_bodega_origen: updateOrdenSalidaDto.id_bodega_origen,
        id_estante: updateOrdenSalidaDto.id_estante,
        motivo: updateOrdenSalidaDto.motivo,
        // Campos para DESTRUCCION_CERTIFICADA
        empresa_destructora: updateOrdenSalidaDto.empresa_destructora,
        numero_certificado: updateOrdenSalidaDto.numero_certificado,
        fecha_destruccion: updateOrdenSalidaDto.fecha_destruccion
          ? new Date(updateOrdenSalidaDto.fecha_destruccion)
          : undefined,
        url_certificado: updateOrdenSalidaDto.url_certificado,
        subtotal: updateOrdenSalidaDto.detalle
          ? new Prisma.Decimal(subtotal)
          : undefined,
        total: updateOrdenSalidaDto.detalle
          ? new Prisma.Decimal(subtotal)
          : undefined,
        detalle: updateOrdenSalidaDto.detalle
          ? {
              create: updateOrdenSalidaDto.detalle.map((item) => ({
                id_catalogo: item.id_catalogo!,
                cantidad_solicitada: item.cantidad_solicitada!,
                costo_unitario: item.costo_unitario
                  ? new Prisma.Decimal(item.costo_unitario)
                  : null,
                subtotal: item.costo_unitario && item.cantidad_solicitada
                  ? new Prisma.Decimal(
                      item.costo_unitario * item.cantidad_solicitada,
                    )
                  : null,
                observaciones: item.observaciones,
              })),
            }
          : undefined,
      },
      include: {
        detalle: {
          include: {
            catalogo: true,
          },
        },
        bodega_origen: {
          include: {
            sucursal: true,
          },
        },
        sucursal_origen: true,
        estante: true,
      },
    });

    await this.prisma.logAction(
      'ACTUALIZAR_ORDEN_SALIDA',
      ordenExistente.id_usuario_solicita,
      `Orden de salida actualizada: ${ordenExistente.codigo}`,
    );

    return ordenActualizada;
  }

  /**
   * Enviar orden a autorización
   */
  async enviarAutorizacion(id: number, idUsuario: number) {
    const orden = await this.findOne(id);
    console.log(orden.estado)
    if (orden.estado !== 'BORRADOR') {
      throw new BadRequestException(
        'Solo se pueden enviar a autorización órdenes en estado BORRADOR',
      );
    }

    if (orden.detalle.length === 0) {
      throw new BadRequestException(
        'La orden debe tener al menos un producto',
      );
    }

    const ordenActualizada = await this.prisma.ordenes_salida.update({
      where: { id_orden_salida: id },
      data: {
        estado: 'PENDIENTE_AUTORIZACION',
      },
      include: {
        detalle: {
          include: {
            catalogo: true,
          },
        },
        bodega_origen: true,
      },
    });

    await this.prisma.logAction(
      'ENVIAR_AUTORIZACION_ORDEN_SALIDA',
      idUsuario,
      `Orden de salida enviada a autorización: ${orden.codigo}`,
    );

    return ordenActualizada;
  }

  /**
   * Autorizar una orden de salida
   */
  async autorizar(id: number, autorizarDto: AutorizarOrdenSalidaDto, user: usuarios) {
    const orden = await this.findOne(id);

    if (orden.estado !== 'PENDIENTE_AUTORIZACION') {
      throw new BadRequestException(
        'Solo se pueden autorizar órdenes en estado PENDIENTE_AUTORIZACION',
      );
    }

    // Validar stock disponible para cada item
    for (const item of autorizarDto.detalle) {
      const detalleOrden = orden.detalle.find(
        (d) => d.id_orden_salida_detalle === item.id_orden_salida_detalle,
      );

      if (!detalleOrden) {
        throw new NotFoundException(
          `Detalle con ID ${item.id_orden_salida_detalle} no encontrado`,
        );
      }

      // Verificar stock en inventario
      const inventario = await this.prisma.inventario.findFirst({
        where: {
          id_catalogo: detalleOrden.id_catalogo,
          id_bodega: orden.id_bodega_origen,
        },
      });

      if (!inventario || inventario.cantidad_disponible < item.cantidad_autorizada) {
        throw new BadRequestException(
          `Stock insuficiente para el producto ${detalleOrden.catalogo.nombre}. ` +
            `Disponible: ${inventario?.cantidad_disponible || 0}, Solicitado: ${item.cantidad_autorizada}`,
        );
      }

      // Actualizar cantidad autorizada en el detalle
      await this.prisma.ordenes_salida_detalle.update({
        where: { id_orden_salida_detalle: item.id_orden_salida_detalle },
        data: {
          cantidad_autorizada: item.cantidad_autorizada,
        },
      });
    }

    // Actualizar estado de la orden
    const ordenAutorizada = await this.prisma.ordenes_salida.update({
      where: { id_orden_salida: id },
      data: {
        estado: 'AUTORIZADA',
        id_usuario_autoriza: user.id_usuario,
        observaciones_autorizacion: autorizarDto.observaciones_autorizacion,
        fecha_autorizacion: new Date(),
      },
      include: {
        detalle: {
          include: {
            catalogo: true,
          },
        },
        bodega_origen: true,
        usuario_autoriza: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
    });

    await this.prisma.logAction(
      'AUTORIZAR_ORDEN_SALIDA',
      user.id_usuario,
      `Orden de salida autorizada: ${orden.codigo}`,
    );

    return ordenAutorizada;
  }

  /**
   * Rechazar una orden de salida
   */
  async rechazar(id: number, rechazarDto: RechazarOrdenSalidaDto, user: usuarios) {
    const orden = await this.findOne(id);

    if (orden.estado !== 'PENDIENTE_AUTORIZACION') {
      throw new BadRequestException(
        'Solo se pueden rechazar órdenes en estado PENDIENTE_AUTORIZACION',
      );
    }

    const ordenRechazada = await this.prisma.ordenes_salida.update({
      where: { id_orden_salida: id },
      data: {
        estado: 'RECHAZADA',
        id_usuario_autoriza: user.id_usuario,
        motivo_rechazo: rechazarDto.motivo_rechazo,
        fecha_autorizacion: new Date(),
      },
      include: {
        detalle: {
          include: {
            catalogo: true,
          },
        },
        bodega_origen: true,
      },
    });

    await this.prisma.logAction(
      'RECHAZAR_ORDEN_SALIDA',
      user.id_usuario,
      `Orden de salida rechazada: ${orden.codigo}. Motivo: ${rechazarDto.motivo_rechazo}`,
    );

    return ordenRechazada;
  }

  /**
   * Procesar una orden de salida (ejecutar la salida física del inventario)
   */
  async procesar(id: number, procesarDto: ProcesarOrdenSalidaDto, user: usuarios) {
    const orden = await this.findOne(id);

    if (orden.estado !== 'AUTORIZADA') {
      throw new BadRequestException(
        'Solo se pueden procesar órdenes en estado AUTORIZADA',
      );
    }

    // Usar transacción para garantizar consistencia
    return await this.prisma.$transaction(async (tx) => {
      // Procesar cada item del detalle
      for (const item of orden.detalle) {
        const cantidadProcesar = item.cantidad_autorizada || item.cantidad_solicitada;

        // Obtener inventario actual
        const inventario = await tx.inventario.findFirst({
          where: {
            id_catalogo: item.id_catalogo,
            id_bodega: orden.id_bodega_origen,
          },
        });

        if (!inventario || inventario.cantidad_disponible < cantidadProcesar) {
          throw new BadRequestException(
            `Stock insuficiente para procesar ${item.catalogo.nombre}`,
          );
        }

        // Descontar del inventario
        await tx.inventario.update({
          where: { id_inventario: inventario.id_inventario },
          data: {
            cantidad_disponible: inventario.cantidad_disponible - cantidadProcesar,
          },
        });

        // Registrar movimiento de inventario
        await tx.movimientos_inventario.create({
          data: {
            tipo: 'SALIDA_OT',
            id_catalogo: item.id_catalogo,
            id_bodega_origen: orden.id_bodega_origen,
            cantidad: cantidadProcesar,
            costo_unitario: item.costo_unitario
              ? new Prisma.Decimal(item.costo_unitario.toString())
              : null,
            id_orden_salida: id,
            id_usuario: user.id_usuario,
            observaciones: `Salida procesada - ${orden.tipo}`,
          },
        });

        // Actualizar cantidad procesada en el detalle
        await tx.ordenes_salida_detalle.update({
          where: { id_orden_salida_detalle: item.id_orden_salida_detalle },
          data: {
            cantidad_procesada: cantidadProcesar,
          },
        });
      }

      // Actualizar estado de la orden
      const ordenProcesada = await tx.ordenes_salida.update({
        where: { id_orden_salida: id },
        data: {
          estado: 'PROCESADA',
          id_usuario_procesa: user.id_usuario,
          observaciones_proceso: procesarDto.observaciones_proceso,
          fecha_proceso: new Date(),
          fecha_salida_efectiva: procesarDto.fecha_salida_efectiva
            ? new Date(procesarDto.fecha_salida_efectiva)
            : new Date(),
        },
        include: {
          detalle: {
            include: {
              catalogo: true,
            },
          },
          bodega_origen: true,
          usuario_procesa: {
            select: {
              id_usuario: true,
              nombres: true,
              apellidos: true,
            },
          },
        },
      });

      await this.prisma.logAction(
        'PROCESAR_ORDEN_SALIDA',
        user.id_usuario,
        `Orden de salida procesada: ${orden.codigo}`,
      );

      return ordenProcesada;
    });
  }

  /**
   * Cancelar una orden de salida
   */
  async cancelar(id: number, cancelarDto: CancelarOrdenSalidaDto, user: usuarios) {
    const orden = await this.findOne(id);

    if (orden.estado === 'PROCESADA') {
      throw new BadRequestException(
        'No se pueden cancelar órdenes ya procesadas',
      );
    }

    if (orden.estado === 'CANCELADA') {
      throw new BadRequestException('La orden ya está cancelada');
    }

    const ordenCancelada = await this.prisma.ordenes_salida.update({
      where: { id_orden_salida: id },
      data: {
        estado: 'CANCELADA',
        observaciones_proceso: cancelarDto.motivo,
      },
      include: {
        detalle: {
          include: {
            catalogo: true,
          },
        },
        bodega_origen: true,
      },
    });

    await this.prisma.logAction(
      'CANCELAR_ORDEN_SALIDA',
      user.id_usuario,
      `Orden de salida cancelada: ${orden.codigo}. Motivo: ${cancelarDto.motivo}`,
    );

    return ordenCancelada;
  }

  /**
   * Eliminar una orden de salida (solo si está en BORRADOR o CANCELADA)
   */
  async remove(id: number, idUsuario: number) {
    const orden = await this.findOne(id);

    if (orden.estado !== 'BORRADOR' && orden.estado !== 'CANCELADA') {
      throw new BadRequestException(
        'Solo se pueden eliminar órdenes en estado BORRADOR o CANCELADA',
      );
    }

    await this.prisma.ordenes_salida.delete({
      where: { id_orden_salida: id },
    });

    await this.prisma.logAction(
      'ELIMINAR_ORDEN_SALIDA', 
      idUsuario,
      `Orden de salida eliminada: ${orden.codigo}`,
    );

    return { message: 'Orden de salida eliminada exitosamente' };
  }

  /**
   * Obtener estadísticas de órdenes de salida
   */
  async obtenerEstadisticas(idBodega?: number) {
    const whereClause: any = idBodega ? { id_bodega_origen: idBodega } : {};

    const [
      totalOrdenes,
      borradores,
      pendientesAutorizacion,
      autorizadas,
      procesadas,
      rechazadas,
      canceladas,
    ] = await Promise.all([
      this.prisma.ordenes_salida.count({ where: whereClause }),
      this.prisma.ordenes_salida.count({
        where: { ...whereClause, estado: 'BORRADOR' },
      }),
      this.prisma.ordenes_salida.count({
        where: { ...whereClause, estado: 'PENDIENTE_AUTORIZACION' },
      }),
      this.prisma.ordenes_salida.count({
        where: { ...whereClause, estado: 'AUTORIZADA' },
      }),
      this.prisma.ordenes_salida.count({
        where: { ...whereClause, estado: 'PROCESADA' },
      }),
      this.prisma.ordenes_salida.count({
        where: { ...whereClause, estado: 'RECHAZADA' },
      }),
      this.prisma.ordenes_salida.count({
        where: { ...whereClause, estado: 'CANCELADA' },
      }),
    ]);

    return {
      total: totalOrdenes,
      por_estado: {
        borradores,
        pendientes_autorizacion: pendientesAutorizacion,
        autorizadas,
        procesadas,
        rechazadas,
        canceladas,
      },
    };
  }

  /**
   * Genera un PDF de la orden de salida usando jsReport
   * @param id ID de la orden de salida
   * @returns Buffer con el PDF generado
   */
  async generatePdf(id: number): Promise<Buffer> {
    // 1. Obtener datos de la orden de salida
    const orden = await this.findOne(id);

    // 2. Leer plantilla HTML
    const templatePath = path.join(
      process.cwd(),
      'templates/inventario/ordenes-salida.html',
    );

    if (!fs.existsSync(templatePath)) {
      throw new NotFoundException('Plantilla de reporte no encontrada');
    }

    const templateHtml = fs.readFileSync(templatePath, 'utf-8');

    // 3. Formatear fechas
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

    // 4. Mapeo de clases CSS para estados
    const ESTADO_CLASS = {
      BORRADOR: 'borrador',
      PENDIENTE_AUTORIZACION: 'pendiente',
      AUTORIZADA: 'autorizada',
      PROCESADA: 'procesada',
      RECHAZADA: 'rechazada',
      CANCELADA: 'cancelada',
    };

    // 5. Mapeo de nombres de tipos
    const TIPO_NOMBRE = {
      VENTA: 'Venta',
      DONACION: 'Donación',
      BAJA_INVENTARIO: 'Baja de Inventario',
      DEVOLUCION_PROVEEDOR: 'Devolución a Proveedor',
      TRASLADO_EXTERNO: 'Traslado Externo',
      CONSUMO_INTERNO: 'Consumo Interno',
      MERMA: 'Merma',
      DESTRUCCION_CERTIFICADA: 'Destrucción Certificada',
      OTRO: 'Otro',
    };

    // 6. Calcular totales
    let totalCantidadSolicitada = 0;
    let totalCantidadAutorizada = 0;
    let totalCantidadProcesada = 0;

    const detalleFormateado = orden.detalle.map((item, index) => {
      totalCantidadSolicitada += item.cantidad_solicitada || 0;
      totalCantidadAutorizada += item.cantidad_autorizada || 0;
      totalCantidadProcesada += item.cantidad_procesada || 0;

      return {
        numero: index + 1,
        codigo: item.catalogo.codigo,
        nombre: item.catalogo.nombre,
        cantidad_solicitada: item.cantidad_solicitada || 0,
        cantidad_autorizada: item.cantidad_autorizada || 0,
        cantidad_procesada: item.cantidad_procesada || 0,
        costo_unitario: item.costo_unitario
          ? parseFloat(item.costo_unitario.toString()).toFixed(2)
          : '0.00',
        subtotal: item.subtotal
          ? parseFloat(item.subtotal.toString()).toFixed(2)
          : '0.00',
        observaciones: item.observaciones || '',
      };
    });

    // 7. Preparar datos para la plantilla
    const templateData = {
      codigo: orden.codigo,
      tipo: TIPO_NOMBRE[orden.tipo] || orden.tipo,
      estado: orden.estado,
      estadoClass: ESTADO_CLASS[orden.estado] || 'borrador',
      motivo: orden.motivo || 'N/A',

      // Fechas
      fechaSolicitud: formatDate(orden.fecha_solicitud),
      fechaAutorizacion: formatDate(orden.fecha_autorizacion),
      fechaProceso: formatDate(orden.fecha_proceso),
      fechaSalidaEfectiva: formatDate(orden.fecha_salida_efectiva),

      // Ubicaciones
      sucursalOrigen: orden.sucursal_origen?.nombre || 'N/A',
      bodegaOrigen: orden.bodega_origen?.nombre || 'N/A',
      estante: orden.estante?.nombre || 'N/A',

      // Usuarios
      usuarioSolicita: orden.usuario_solicita
        ? `${orden.usuario_solicita.nombres} ${orden.usuario_solicita.apellidos}`
        : 'N/A',
      usuarioAutoriza: orden.usuario_autoriza
        ? `${orden.usuario_autoriza.nombres} ${orden.usuario_autoriza.apellidos}`
        : 'N/A',
      usuarioProcesa: orden.usuario_procesa
        ? `${orden.usuario_procesa.nombres} ${orden.usuario_procesa.apellidos}`
        : 'N/A',

      // Observaciones
      observacionesAutorizacion: orden.observaciones_autorizacion || '',
      observacionesProceso: orden.observaciones_proceso || '',
      motivoRechazo: orden.motivo_rechazo || '',

      // Detalle de productos
      detalle: detalleFormateado,

      // Totales
      totalCantidadSolicitada,
      totalCantidadAutorizada,
      totalCantidadProcesada,
      subtotal: orden.subtotal
        ? parseFloat(orden.subtotal.toString()).toFixed(2)
        : '0.00',
      total: orden.total
        ? parseFloat(orden.total.toString()).toFixed(2)
        : '0.00',

      // Flags condicionales para la plantilla
      mostrarAutorizada: orden.estado === 'AUTORIZADA' || orden.estado === 'PROCESADA',
      mostrarProcesada: orden.estado === 'PROCESADA',
      mostrarRechazada: orden.estado === 'RECHAZADA',

      // Fecha de generación del reporte
      fechaGeneracion: formatDate(new Date()),
    };

    // 8. Configurar petición a jsReport
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
            reportName: `OrdenSalida_${orden.codigo}`,
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
      throw new BadRequestException('Error al generar el PDF');
    }
  }
}
