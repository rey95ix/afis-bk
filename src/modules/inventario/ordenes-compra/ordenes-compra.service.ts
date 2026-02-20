import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrdenCompraDto } from './dto/create-orden-compra.dto';
import { UpdateOrdenCompraDto } from './dto/update-orden-compra.dto';
import { FilterOrdenCompraDto } from './dto/filter-orden-compra.dto';
import { AprobarOrdenCompraDto } from './dto/aprobar-orden-compra.dto';
import { RechazarOrdenCompraDto } from './dto/rechazar-orden-compra.dto';
import { EmitirOrdenCompraDto } from './dto/emitir-orden-compra.dto';
import { GenerarCompraOcDto } from './dto/generar-compra-oc.dto';
import { CerrarOrdenCompraDto } from './dto/cerrar-orden-compra.dto';
import { CancelarOrdenCompraDto } from './dto/cancelar-orden-compra.dto';
import { Prisma, usuarios } from '@prisma/client';
import { convertToUTC } from 'src/common/helpers';
import { MovimientosBancariosService } from '../../bancos/movimientos-bancarios/movimientos-bancarios.service';
import { CxpService } from '../../cxp/cxp.service';

@Injectable()
export class OrdenesCompraService {
  constructor(
    private prisma: PrismaService,
    private movimientosBancariosService: MovimientosBancariosService,
    private cxpService: CxpService,
  ) {}

  // =============================================
  // Includes reutilizables
  // =============================================

  private readonly includeBasico = {
    proveedor: {
      select: {
        id_proveedor: true,
        nombre_razon_social: true,
        nombre_comercial: true,
      },
    },
    sucursal: {
      select: {
        id_sucursal: true,
        nombre: true,
      },
    },
    bodega: {
      select: {
        id_bodega: true,
        nombre: true,
      },
    },
    forma_pago: true,
    usuario_crea: {
      select: {
        id_usuario: true,
        nombres: true,
        apellidos: true,
        usuario: true,
      },
    },
    usuario_aprueba: {
      select: {
        id_usuario: true,
        nombres: true,
        apellidos: true,
        usuario: true,
      },
    },
  };

  private readonly includeCompleto = {
    ...this.includeBasico,
    detalle: {
      include: {
        catalogo: true,
      },
    },
    compras: {
      select: {
        id_compras: true,
        numero_factura: true,
        recepcionada: true,
        total: true,
        fecha_creacion: true,
      },
    },
  };

  // =============================================
  // Generación de código
  // =============================================

  private async generarCodigoOrden(): Promise<string> {
    const fecha = new Date();
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const prefix = `OC-${year}${month}-`;

    const ultimaOrden = await this.prisma.ordenes_compra.findFirst({
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

  // =============================================
  // Cálculo de totales
  // =============================================

  private calculateTotals(detalles: any[]) {
    const tasaIVA = 0.13;
    let subtotal = 0;
    let descuentoTotal = 0;

    detalles.forEach((detalle) => {
      const subtotalLinea =
        (detalle.costo_unitario || 0) * (detalle.cantidad_ordenada || 0);
      subtotal += subtotalLinea;
      descuentoTotal += detalle.descuento_monto || 0;
    });

    const baseImponible = subtotal - descuentoTotal;
    const iva = baseImponible * tasaIVA;
    const total = baseImponible + iva;

    return { subtotal, descuento: descuentoTotal, iva, total, tasaIVA };
  }

  // =============================================
  // CRUD
  // =============================================

  async create(dto: CreateOrdenCompraDto, user: usuarios) {
    // Validar proveedor
    const proveedor = await this.prisma.proveedores.findUnique({
      where: { id_proveedor: dto.id_proveedor },
    });
    if (!proveedor) {
      throw new NotFoundException(
        `Proveedor con ID ${dto.id_proveedor} no encontrado`,
      );
    }

    // Validar catálogos si se proporcionan
    for (const item of dto.detalle) {
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

    const codigo = await this.generarCodigoOrden();
    const calculated = this.calculateTotals(dto.detalle);

    const orden = await this.prisma.ordenes_compra.create({
      data: {
        codigo,
        estado: 'BORRADOR',
        id_proveedor: dto.id_proveedor,
        id_sucursal: dto.id_sucursal,
        id_bodega: dto.id_bodega,
        id_forma_pago: dto.id_forma_pago,
        dias_credito: dto.dias_credito,
        moneda: dto.moneda || 'USD',
        motivo: dto.motivo,
        observaciones: dto.observaciones,
        fecha_entrega_esperada: dto.fecha_entrega_esperada
          ? new Date(dto.fecha_entrega_esperada)
          : null,
        id_usuario_crea: user.id_usuario,
        subtotal: calculated.subtotal,
        descuento: calculated.descuento,
        iva: calculated.iva,
        total: calculated.total,
        detalle: {
          create: dto.detalle.map((item) => {
            const itemSubtotal =
              (item.costo_unitario || 0) * item.cantidad_ordenada -
              (item.descuento_monto || 0);
            const itemIva = itemSubtotal * calculated.tasaIVA;
            return {
              id_catalogo: item.id_catalogo,
              codigo: item.codigo,
              nombre: item.nombre,
              descripcion: item.descripcion,
              tiene_serie: item.tiene_serie || false,
              afecta_inventario: item.afecta_inventario ?? true,
              cantidad_ordenada: item.cantidad_ordenada,
              costo_unitario: item.costo_unitario || 0,
              subtotal: itemSubtotal,
              descuento_porcentaje: item.descuento_porcentaje || 0,
              descuento_monto: item.descuento_monto || 0,
              iva: itemIva,
              total: itemSubtotal + itemIva,
              observaciones: item.observaciones,
            };
          }),
        },
      },
      include: this.includeCompleto,
    });

    await this.prisma.logAction(
      'CREAR_ORDEN_COMPRA',
      user.id_usuario,
      `Orden de compra creada: ${codigo}`,
    );

    return orden;
  }

  async findAll(filters: FilterOrdenCompraDto) {
    const { page = 1, limit = 10 } = filters;
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    if (filters.estado) {
      whereClause.estado = filters.estado;
    }

    if (filters.id_proveedor) {
      whereClause.id_proveedor = filters.id_proveedor;
    }

    if (filters.id_sucursal) {
      whereClause.id_sucursal = filters.id_sucursal;
    }

    if (filters.id_bodega) {
      whereClause.id_bodega = filters.id_bodega;
    }

    if (filters.codigo) {
      whereClause.codigo = {
        contains: filters.codigo,
        mode: 'insensitive',
      };
    }

    if (filters.search) {
      whereClause.OR = [
        { codigo: { contains: filters.search, mode: 'insensitive' } },
        {
          proveedor: {
            nombre_razon_social: {
              contains: filters.search,
              mode: 'insensitive',
            },
          },
        },
        {
          proveedor: {
            nombre_comercial: {
              contains: filters.search,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    if (filters.fecha_desde || filters.fecha_hasta) {
      whereClause.fecha_creacion = {};
      if (filters.fecha_desde) {
        whereClause.fecha_creacion.gte = new Date(filters.fecha_desde);
      }
      if (filters.fecha_hasta) {
        whereClause.fecha_creacion.lte = new Date(filters.fecha_hasta);
      }
    }

    const [ordenes, total] = await Promise.all([
      this.prisma.ordenes_compra.findMany({
        where: whereClause,
        skip,
        take: limit,
        include: {
          ...this.includeBasico,
          detalle: {
            include: {
              catalogo: true,
            },
          },
          _count: {
            select: {
              compras: true,
            },
          },
        },
        orderBy: {
          fecha_creacion: 'desc',
        },
      }),
      this.prisma.ordenes_compra.count({ where: whereClause }),
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

  async findOne(id: number) {
    const orden = await this.prisma.ordenes_compra.findUnique({
      where: { id_orden_compra: id },
      include: this.includeCompleto,
    });

    if (!orden) {
      throw new NotFoundException(
        `Orden de compra con ID ${id} no encontrada`,
      );
    }

    return orden;
  }

  async update(id: number, dto: UpdateOrdenCompraDto, user: usuarios) {
    const ordenExistente = await this.findOne(id);

    if (ordenExistente.estado !== 'BORRADOR') {
      throw new BadRequestException(
        'Solo se pueden modificar órdenes en estado BORRADOR',
      );
    }

    // Si se actualizan detalles, validar catálogos y recalcular
    if (dto.detalle) {
      for (const item of dto.detalle) {
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

      // Eliminar detalles existentes
      await this.prisma.ordenes_compra_detalle.deleteMany({
        where: { id_orden_compra: id },
      });
    }

    const calculated = dto.detalle
      ? this.calculateTotals(dto.detalle)
      : null;

    const ordenActualizada = await this.prisma.ordenes_compra.update({
      where: { id_orden_compra: id },
      data: {
        id_proveedor: dto.id_proveedor,
        id_sucursal: dto.id_sucursal,
        id_bodega: dto.id_bodega,
        id_forma_pago: dto.id_forma_pago,
        dias_credito: dto.dias_credito,
        moneda: dto.moneda,
        motivo: dto.motivo,
        observaciones: dto.observaciones,
        fecha_entrega_esperada: dto.fecha_entrega_esperada
          ? new Date(dto.fecha_entrega_esperada)
          : undefined,
        ...(calculated && {
          subtotal: calculated.subtotal,
          descuento: calculated.descuento,
          iva: calculated.iva,
          total: calculated.total,
        }),
        detalle: dto.detalle
          ? {
              create: dto.detalle.map((item) => {
                const itemSubtotal =
                  (item.costo_unitario || 0) *
                    (item.cantidad_ordenada || 0) -
                  (item.descuento_monto || 0);
                const itemIva = itemSubtotal * 0.13;
                return {
                  id_catalogo: item.id_catalogo,
                  codigo: item.codigo,
                  nombre: item.nombre || '',
                  descripcion: item.descripcion,
                  tiene_serie: item.tiene_serie || false,
                  afecta_inventario: item.afecta_inventario ?? true,
                  cantidad_ordenada: item.cantidad_ordenada || 0,
                  costo_unitario: item.costo_unitario || 0,
                  subtotal: itemSubtotal,
                  descuento_porcentaje: item.descuento_porcentaje || 0,
                  descuento_monto: item.descuento_monto || 0,
                  iva: itemIva,
                  total: itemSubtotal + itemIva,
                  observaciones: item.observaciones,
                };
              }),
            }
          : undefined,
      },
      include: this.includeCompleto,
    });

    await this.prisma.logAction(
      'ACTUALIZAR_ORDEN_COMPRA',
      user.id_usuario,
      `Orden de compra actualizada: ${ordenExistente.codigo}`,
    );

    return ordenActualizada;
  }

  async remove(id: number, user: usuarios) {
    const orden = await this.findOne(id);

    if (orden.estado !== 'BORRADOR' && orden.estado !== 'CANCELADA') {
      throw new BadRequestException(
        'Solo se pueden eliminar órdenes en estado BORRADOR o CANCELADA',
      );
    }

    await this.prisma.ordenes_compra.delete({
      where: { id_orden_compra: id },
    });

    await this.prisma.logAction(
      'ELIMINAR_ORDEN_COMPRA',
      user.id_usuario,
      `Orden de compra eliminada: ${orden.codigo}`,
    );

    return { message: 'Orden de compra eliminada exitosamente' };
  }

  // =============================================
  // Workflow
  // =============================================

  async enviarAprobacion(id: number, user: usuarios) {
    const orden = await this.findOne(id);

    if (orden.estado !== 'BORRADOR') {
      throw new BadRequestException(
        'Solo se pueden enviar a aprobación órdenes en estado BORRADOR',
      );
    }

    if (orden.detalle.length === 0) {
      throw new BadRequestException(
        'La orden debe tener al menos un producto',
      );
    }

    const ordenActualizada = await this.prisma.ordenes_compra.update({
      where: { id_orden_compra: id },
      data: {
        estado: 'PENDIENTE_APROBACION',
      },
      include: this.includeCompleto,
    });

    await this.prisma.logAction(
      'ENVIAR_APROBACION_ORDEN_COMPRA',
      user.id_usuario,
      `Orden de compra enviada a aprobación: ${orden.codigo}`,
    );

    return ordenActualizada;
  }

  async aprobar(id: number, dto: AprobarOrdenCompraDto, user: usuarios) {
    const orden = await this.findOne(id);

    if (orden.estado !== 'PENDIENTE_APROBACION') {
      throw new BadRequestException(
        'Solo se pueden aprobar órdenes en estado PENDIENTE_APROBACION',
      );
    }

    const ordenAprobada = await this.prisma.ordenes_compra.update({
      where: { id_orden_compra: id },
      data: {
        estado: 'APROBADA',
        id_usuario_aprueba: user.id_usuario,
        observaciones_aprobacion: dto.observaciones_aprobacion,
        fecha_aprobacion: new Date(),
      },
      include: this.includeCompleto,
    });

    await this.prisma.logAction(
      'APROBAR_ORDEN_COMPRA',
      user.id_usuario,
      `Orden de compra aprobada: ${orden.codigo}`,
    );

    return ordenAprobada;
  }

  async rechazar(id: number, dto: RechazarOrdenCompraDto, user: usuarios) {
    const orden = await this.findOne(id);

    if (orden.estado !== 'PENDIENTE_APROBACION') {
      throw new BadRequestException(
        'Solo se pueden rechazar órdenes en estado PENDIENTE_APROBACION',
      );
    }

    const ordenRechazada = await this.prisma.ordenes_compra.update({
      where: { id_orden_compra: id },
      data: {
        estado: 'RECHAZADA',
        id_usuario_aprueba: user.id_usuario,
        motivo_rechazo: dto.motivo_rechazo,
        fecha_aprobacion: new Date(),
      },
      include: this.includeCompleto,
    });

    await this.prisma.logAction(
      'RECHAZAR_ORDEN_COMPRA',
      user.id_usuario,
      `Orden de compra rechazada: ${orden.codigo}. Motivo: ${dto.motivo_rechazo}`,
    );

    return ordenRechazada;
  }

  async reabrir(id: number, user: usuarios) {
    const orden = await this.findOne(id);

    if (orden.estado !== 'RECHAZADA') {
      throw new BadRequestException(
        'Solo se pueden reabrir órdenes en estado RECHAZADA',
      );
    }

    const ordenReabierta = await this.prisma.ordenes_compra.update({
      where: { id_orden_compra: id },
      data: {
        estado: 'BORRADOR',
        motivo_rechazo: null,
        id_usuario_aprueba: null,
        observaciones_aprobacion: null,
        fecha_aprobacion: null,
      },
      include: this.includeCompleto,
    });

    await this.prisma.logAction(
      'REABRIR_ORDEN_COMPRA',
      user.id_usuario,
      `Orden de compra reabierta: ${orden.codigo}`,
    );

    return ordenReabierta;
  }

  // =============================================
  // Helper: Registrar pago bancario
  // =============================================

  private async registrarPagoOC(params: {
    dto: {
      metodo_pago?: string;
      id_cuenta_bancaria?: number;
      cheque_numero?: string;
      cheque_beneficiario?: string;
      cheque_fecha_emision?: string;
    };
    monto: number;
    ordenCodigo: string;
    documentoOrigenId: number;
    idUsuario: number;
  }): Promise<number | null> {
    const { dto, monto, ordenCodigo, documentoOrigenId, idUsuario } = params;

    if (!dto.metodo_pago) {
      throw new BadRequestException(
        'El método de pago es requerido cuando se registra un pago',
      );
    }

    if (monto <= 0) {
      throw new BadRequestException(
        'El monto debe ser mayor a cero para registrar un pago',
      );
    }

    // EFECTIVO no genera movimiento bancario
    if (dto.metodo_pago === 'EFECTIVO') {
      return null;
    }

    if (!dto.id_cuenta_bancaria) {
      throw new BadRequestException(
        'La cuenta bancaria es requerida para el método de pago seleccionado',
      );
    }

    if (dto.metodo_pago === 'TRANSFERENCIA') {
      const movimiento = await this.movimientosBancariosService.crearMovimiento(
        {
          id_cuenta_bancaria: dto.id_cuenta_bancaria,
          tipo_movimiento: 'SALIDA',
          metodo: 'TRANSFERENCIA',
          monto,
          modulo_origen: 'COMPRAS',
          documento_origen_id: documentoOrigenId,
          descripcion: `Pago OC #${ordenCodigo} - Transferencia`,
          transferencia: {
            fecha_transferencia: new Date().toISOString(),
          },
        },
        idUsuario,
      );
      return movimiento!.id_movimiento;
    }

    if (dto.metodo_pago === 'CHEQUE') {
      if (!dto.cheque_numero || !dto.cheque_beneficiario) {
        throw new BadRequestException(
          'El número de cheque y beneficiario son requeridos para el método CHEQUE',
        );
      }

      const movimiento = await this.movimientosBancariosService.crearMovimiento(
        {
          id_cuenta_bancaria: dto.id_cuenta_bancaria,
          tipo_movimiento: 'SALIDA',
          metodo: 'CHEQUE',
          monto,
          modulo_origen: 'COMPRAS',
          documento_origen_id: documentoOrigenId,
          descripcion: `Pago OC #${ordenCodigo} - Cheque ${dto.cheque_numero}`,
          cheque: {
            numero_cheque: dto.cheque_numero,
            beneficiario: dto.cheque_beneficiario,
            fecha_emision: dto.cheque_fecha_emision || new Date().toISOString(),
          },
        },
        idUsuario,
      );
      return movimiento!.id_movimiento;
    }

    throw new BadRequestException(
      `Método de pago no soportado: ${dto.metodo_pago}`,
    );
  }

  async emitir(id: number, dto: EmitirOrdenCompraDto, user: usuarios) {
    const orden = await this.findOne(id);

    if (orden.estado !== 'APROBADA') {
      throw new BadRequestException(
        'Solo se pueden emitir órdenes en estado APROBADA',
      );
    }

    // Datos de pago opcionales
    let pagoData: any = {};

    if (dto.registrar_pago) {
      const idMovimiento = await this.registrarPagoOC({
        dto,
        monto: orden.total || 0,
        ordenCodigo: orden.codigo,
        documentoOrigenId: orden.id_orden_compra,
        idUsuario: user.id_usuario,
      });

      pagoData = {
        pago_registrado: true,
        metodo_pago: dto.metodo_pago,
        id_cuenta_bancaria_pago: dto.metodo_pago !== 'EFECTIVO' ? dto.id_cuenta_bancaria : null,
        id_movimiento_bancario: idMovimiento,
        monto_pagado: orden.total || 0,
        fecha_pago: new Date(),
      };
    }

    const ordenEmitida = await this.prisma.ordenes_compra.update({
      where: { id_orden_compra: id },
      data: {
        estado: 'EMITIDA',
        fecha_emision: new Date(),
        observaciones: dto.observaciones || orden.observaciones,
        ...pagoData,
      },
      include: this.includeCompleto,
    });

    await this.prisma.logAction(
      'EMITIR_ORDEN_COMPRA',
      user.id_usuario,
      `Orden de compra emitida: ${orden.codigo}${dto.registrar_pago ? ` (pago registrado: ${dto.metodo_pago})` : ''}`,
    );

    return ordenEmitida;
  }

  // =============================================
  // Generar Compra desde OC
  // =============================================

  async generarCompra(id: number, dto: GenerarCompraOcDto, user: usuarios) {
    const orden = await this.findOne(id);

    if (orden.estado !== 'EMITIDA' && orden.estado !== 'RECEPCION_PARCIAL') {
      throw new BadRequestException(
        'Solo se pueden generar compras desde órdenes en estado EMITIDA o RECEPCION_PARCIAL',
      );
    }

    // Validar existencia de cada línea del detalle primero
    for (const detDto of dto.detalles) {
      const detalleOc = orden.detalle.find(
        (d) =>
          d.id_orden_compra_detalle === detDto.id_orden_compra_detalle,
      );

      if (!detalleOc) {
        throw new NotFoundException(
          `Detalle con ID ${detDto.id_orden_compra_detalle} no encontrado en la OC`,
        );
      }
    }

    // Determinar si algún producto incluido afecta inventario
    const algunoAfectaInventario = dto.detalles.some((detDto) => {
      const det = orden.detalle.find(
        (d) => d.id_orden_compra_detalle === detDto.id_orden_compra_detalle,
      )!;
      return det.afecta_inventario ?? true;
    });

    if (algunoAfectaInventario && !dto.id_estante) {
      throw new BadRequestException(
        'El estante es requerido cuando hay productos que afectan inventario',
      );
    }

    // Validar estante pertenece a bodega de la OC (solo si se proporcionó)
    if (dto.id_estante && orden.id_bodega) {
      const estante = await this.prisma.estantes.findFirst({
        where: {
          id_estante: dto.id_estante,
          id_bodega: orden.id_bodega,
          estado: 'ACTIVO',
        },
      });
      if (!estante) {
        throw new BadRequestException(
          `El estante con ID ${dto.id_estante} no pertenece a la bodega de la OC o no está activo`,
        );
      }
    }

    // Validar cada línea del detalle
    for (const detDto of dto.detalles) {
      const detalleOc = orden.detalle.find(
        (d) =>
          d.id_orden_compra_detalle === detDto.id_orden_compra_detalle,
      )!;

      const cantidadRestante =
        detalleOc.cantidad_ordenada - detalleOc.cantidad_recibida;

      if (detDto.cantidad_a_recibir > cantidadRestante) {
        throw new BadRequestException(
          `La cantidad a recibir (${detDto.cantidad_a_recibir}) para "${detalleOc.nombre}" excede la cantidad restante (${cantidadRestante})`,
        );
      }

      // Validar series si tiene_serie y afecta inventario
      if (detalleOc.tiene_serie && (detalleOc.afecta_inventario ?? true)) {
        if (
          !detDto.series ||
          detDto.series.length !== detDto.cantidad_a_recibir
        ) {
          throw new BadRequestException(
            `El producto "${detalleOc.nombre}" requiere ${detDto.cantidad_a_recibir} números de serie pero se proporcionaron ${detDto.series?.length || 0}`,
          );
        }
        // Validar duplicados
        const uniqueSeries = new Set(detDto.series);
        if (uniqueSeries.size !== detDto.series.length) {
          throw new BadRequestException(
            `El producto "${detalleOc.nombre}" tiene números de serie duplicados`,
          );
        }
      }
    }

    // Ejecutar en transacción
    const result = await this.prisma.$transaction(async (tx) => {
      // Calcular totales de la compra
      const tasaIVA = 0.13;
      let compraSubtotal = 0;

      const compraDetalles = dto.detalles.map((detDto) => {
        const detalleOc = orden.detalle.find(
          (d) =>
            d.id_orden_compra_detalle === detDto.id_orden_compra_detalle,
        )!;

        const costoUnit =
          detDto.costo_unitario ?? detalleOc.costo_unitario ?? 0;
        const lineSubtotal = costoUnit * detDto.cantidad_a_recibir;
        compraSubtotal += lineSubtotal;

        return {
          detalleOc,
          detDto,
          costoUnit,
          lineSubtotal,
        };
      });

      const compraIva = compraSubtotal * tasaIVA;
      const compraTotal = compraSubtotal + compraIva;

      // Crear la compra
      const nuevaCompra = await tx.compras.create({
        data: {
          numero_factura: dto.numero_factura,
          numero_quedan: dto.numero_quedan,
          id_proveedor: orden.id_proveedor,
          nombre_proveedor:
            orden.proveedor?.nombre_razon_social || '',
          id_forma_pago: orden.id_forma_pago,
          dias_credito: orden.dias_credito,
          id_sucursal: orden.id_sucursal,
          id_bodega: orden.id_bodega,
          id_tipo_factura: dto.id_tipo_factura || 2,
          id_usuario: user.id_usuario,
          id_orden_compra: orden.id_orden_compra,
          subtotal: compraSubtotal,
          iva: compraIva,
          total: compraTotal,
          fecha_factura: convertToUTC(dto.fecha_factura),
          fecha_de_pago: dto.fecha_de_pago
            ? convertToUTC(dto.fecha_de_pago)
            : null,
          is_dte: dto.is_dte || false,
          json_dte: dto.json_dte,
          numeroControl: dto.numeroControl,
          codigoGeneracion: dto.codigoGeneracion,
          recepcionada: !algunoAfectaInventario,
          fecha_recepcion: !algunoAfectaInventario ? new Date() : null,
          ComprasDetalle: {
            create: compraDetalles.map(
              ({ detalleOc, detDto, costoUnit, lineSubtotal }) => {
                const afectaInv = detalleOc.afecta_inventario ?? true;
                return {
                  id_catalogo: detalleOc.id_catalogo,
                  codigo: detalleOc.codigo,
                  nombre: detalleOc.nombre,
                  descripcion: detalleOc.descripcion,
                  tiene_serie: afectaInv ? detalleOc.tiene_serie : false,
                  afecta_inventario: afectaInv,
                  costo_unitario: costoUnit,
                  cantidad: detDto.cantidad_a_recibir,
                  cantidad_inventario: afectaInv ? detDto.cantidad_a_recibir : 0,
                  subtotal: lineSubtotal,
                  descuento_porcentaje: 0,
                  descuento_monto: 0,
                  iva: lineSubtotal * tasaIVA,
                  total: lineSubtotal * (1 + tasaIVA),
                };
              },
            ),
          },
        },
        include: {
          ComprasDetalle: true,
        },
      });

      // Crear series si aplica
      for (let i = 0; i < compraDetalles.length; i++) {
        const { detalleOc, detDto } = compraDetalles[i];
        const detalleCreado = nuevaCompra.ComprasDetalle[i];

        if (
          detalleOc.tiene_serie &&
          (detalleOc.afecta_inventario ?? true) &&
          detDto.series &&
          detDto.series.length > 0
        ) {
          try {
            await tx.inventario_series.createMany({
              data: detDto.series.map((numeroSerie) => ({
                numero_serie: numeroSerie,
                estado: 'DISPONIBLE',
                id_compra_detalle: detalleCreado.id_compras_detalle,
                costo_adquisicion:
                  compraDetalles[i].costoUnit,
              })),
            });
          } catch (error: any) {
            if (error.code === 'P2002') {
              throw new BadRequestException(
                `Número de serie duplicado detectado para "${detalleOc.nombre}". Verifique que las series no existan previamente.`,
              );
            }
            throw error;
          }
        }
      }

      // Actualizar cantidad_recibida en cada detalle de la OC
      for (const { detalleOc, detDto } of compraDetalles) {
        await tx.ordenes_compra_detalle.update({
          where: {
            id_orden_compra_detalle: detalleOc.id_orden_compra_detalle,
          },
          data: {
            cantidad_recibida:
              detalleOc.cantidad_recibida + detDto.cantidad_a_recibir,
          },
        });
      }

      // Determinar nuevo estado de la OC
      const detallesActualizados =
        await tx.ordenes_compra_detalle.findMany({
          where: { id_orden_compra: id },
        });

      const todasRecibidas = detallesActualizados.every(
        (d) => d.cantidad_recibida >= d.cantidad_ordenada,
      );

      let nuevoEstado: string;
      if (todasRecibidas) {
        nuevoEstado = 'CERRADA';
      } else {
        nuevoEstado = 'RECEPCION_PARCIAL';
      }

      await tx.ordenes_compra.update({
        where: { id_orden_compra: id },
        data: {
          estado: nuevoEstado as any,
          ...(nuevoEstado === 'CERRADA' && {
            fecha_cierre: new Date(),
          }),
        },
      });

      await this.prisma.logAction(
        'GENERAR_COMPRA_ORDEN_COMPRA',
        user.id_usuario,
        `Compra generada desde OC ${orden.codigo}: Factura ${dto.numero_factura}, Total: $${compraTotal.toFixed(2)}`,
      );

      // Si es compra a crédito, crear cuenta por pagar dentro de la transacción
      if (dto.es_credito) {
        if (!orden.id_sucursal) {
          throw new BadRequestException(
            'La orden de compra debe tener una sucursal asignada para generar una compra a crédito',
          );
        }
        const diasCredito = dto.dias_credito_override || orden.dias_credito || 30;
        await this.cxpService.crearCuentaPorPagar({
          id_compras: nuevaCompra.id_compras,
          id_proveedor: orden.id_proveedor,
          monto_total: compraTotal,
          dias_credito: diasCredito,
          fecha_emision: new Date(dto.fecha_factura),
          id_sucursal: orden.id_sucursal,
          id_usuario: user.id_usuario,
        }, tx);
      }

      return { nuevaCompra, compraTotal };
    });

    // Registrar pago DESPUÉS de que la transacción haya sido exitosa
    // Si es crédito, no registrar pago (se paga a través de CxP)
    if (dto.registrar_pago && !orden.pago_registrado && !dto.es_credito) {
      const idMovimiento = await this.registrarPagoOC({
        dto,
        monto: result.compraTotal,
        ordenCodigo: orden.codigo,
        documentoOrigenId: orden.id_orden_compra,
        idUsuario: user.id_usuario,
      });

      await this.prisma.ordenes_compra.update({
        where: { id_orden_compra: id },
        data: {
          pago_registrado: true,
          metodo_pago: dto.metodo_pago,
          id_cuenta_bancaria_pago: dto.metodo_pago !== 'EFECTIVO' ? dto.id_cuenta_bancaria : null,
          id_movimiento_bancario: idMovimiento,
          monto_pagado: result.compraTotal,
          fecha_pago: new Date(),
        },
      });
    }

    return result.nuevaCompra;
  }

  // =============================================
  // Cerrar y Cancelar
  // =============================================

  async cerrar(id: number, dto: CerrarOrdenCompraDto, user: usuarios) {
    const orden = await this.findOne(id);

    if (orden.estado !== 'RECEPCION_PARCIAL') {
      throw new BadRequestException(
        'Solo se pueden cerrar manualmente órdenes en estado RECEPCION_PARCIAL',
      );
    }

    const ordenCerrada = await this.prisma.ordenes_compra.update({
      where: { id_orden_compra: id },
      data: {
        estado: 'CERRADA',
        fecha_cierre: new Date(),
        observaciones: dto.observaciones || orden.observaciones,
      },
      include: this.includeCompleto,
    });

    await this.prisma.logAction(
      'CERRAR_ORDEN_COMPRA',
      user.id_usuario,
      `Orden de compra cerrada manualmente: ${orden.codigo}`,
    );

    return ordenCerrada;
  }

  async cancelar(id: number, dto: CancelarOrdenCompraDto, user: usuarios) {
    const orden = await this.findOne(id);

    const estadosPermitidos = [
      'BORRADOR',
      'PENDIENTE_APROBACION',
      'APROBADA',
      'EMITIDA',
    ];

    if (!estadosPermitidos.includes(orden.estado)) {
      throw new BadRequestException(
        `No se puede cancelar una orden en estado ${orden.estado}`,
      );
    }

    // Si está EMITIDA, verificar que no tenga compras generadas
    if (orden.estado === 'EMITIDA' && orden.compras.length > 0) {
      throw new BadRequestException(
        'No se puede cancelar una orden emitida que ya tiene compras generadas',
      );
    }

    const ordenCancelada = await this.prisma.ordenes_compra.update({
      where: { id_orden_compra: id },
      data: {
        estado: 'CANCELADA',
        motivo: dto.motivo,
      },
      include: this.includeCompleto,
    });

    await this.prisma.logAction(
      'CANCELAR_ORDEN_COMPRA',
      user.id_usuario,
      `Orden de compra cancelada: ${orden.codigo}. Motivo: ${dto.motivo}`,
    );

    return ordenCancelada;
  }

  // =============================================
  // Estadísticas
  // =============================================

  async obtenerEstadisticas() {
    const [
      total,
      borradores,
      pendientesAprobacion,
      aprobadas,
      rechazadas,
      emitidas,
      recepcionParcial,
      recepcionTotal,
      cerradas,
      canceladas,
    ] = await Promise.all([
      this.prisma.ordenes_compra.count(),
      this.prisma.ordenes_compra.count({
        where: { estado: 'BORRADOR' },
      }),
      this.prisma.ordenes_compra.count({
        where: { estado: 'PENDIENTE_APROBACION' },
      }),
      this.prisma.ordenes_compra.count({
        where: { estado: 'APROBADA' },
      }),
      this.prisma.ordenes_compra.count({
        where: { estado: 'RECHAZADA' },
      }),
      this.prisma.ordenes_compra.count({
        where: { estado: 'EMITIDA' },
      }),
      this.prisma.ordenes_compra.count({
        where: { estado: 'RECEPCION_PARCIAL' },
      }),
      this.prisma.ordenes_compra.count({
        where: { estado: 'RECEPCION_TOTAL' },
      }),
      this.prisma.ordenes_compra.count({
        where: { estado: 'CERRADA' },
      }),
      this.prisma.ordenes_compra.count({
        where: { estado: 'CANCELADA' },
      }),
    ]);

    return {
      total,
      por_estado: {
        borradores,
        pendientes_aprobacion: pendientesAprobacion,
        aprobadas,
        rechazadas,
        emitidas,
        recepcion_parcial: recepcionParcial,
        recepcion_total: recepcionTotal,
        cerradas,
        canceladas,
      },
    };
  }
}
