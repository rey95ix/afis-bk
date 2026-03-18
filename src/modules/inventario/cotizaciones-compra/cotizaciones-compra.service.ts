import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RegistrarCotizacionCompraDto } from './dto/registrar-cotizacion-compra.dto';
import { UpdateCotizacionCompraDto } from './dto/update-cotizacion-compra.dto';
import { FilterCotizacionCompraDto } from './dto/filter-cotizacion-compra.dto';
import { SeleccionarCotizacionDto } from './dto/seleccionar-cotizacion.dto';
import { GenerarOcDesdeCotizacionDto } from './dto/generar-oc-desde-cotizacion.dto';
import { usuarios } from '@prisma/client';

@Injectable()
export class CotizacionesCompraService {
  constructor(private prisma: PrismaService) {}

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
    solicitud_compra: {
      select: {
        id_solicitud_compra: true,
        codigo: true,
        estado: true,
      },
    },
    usuario_registra: {
      select: {
        id_usuario: true,
        nombres: true,
        apellidos: true,
        usuario: true,
      },
    },
    usuario_selecciona: {
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
        solicitud_compra_detalle: {
          include: {
            catalogo: true,
          },
        },
      },
    },
    ordenes_compra: {
      select: {
        id_orden_compra: true,
        codigo: true,
        estado: true,
        total: true,
        fecha_creacion: true,
      },
    },
  };

  // =============================================
  // Cálculo de totales
  // =============================================

  private calculateTotals(detalles: any[]) {
    const tasaIVA = 0.13;
    let subtotal = 0;
    let descuentoTotal = 0;

    detalles.forEach((detalle) => {
      const subtotalLinea =
        (detalle.costo_unitario || 0) * (detalle.cantidad || 0);
      subtotal += subtotalLinea;
      descuentoTotal += detalle.descuento_monto || 0;
    });

    const baseImponible = subtotal - descuentoTotal;
    const iva = baseImponible * tasaIVA;
    const total = baseImponible + iva;

    return { subtotal, descuento: descuentoTotal, iva, total, tasaIVA };
  }

  // =============================================
  // Generación de código OC
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
  // CRUD
  // =============================================

  async registrar(dto: RegistrarCotizacionCompraDto, user: usuarios) {
    // Validar solicitud existe y está en estado EN_COTIZACION
    const solicitud = await this.prisma.solicitudes_compra.findUnique({
      where: { id_solicitud_compra: dto.id_solicitud_compra },
      include: {
        detalle: true,
      },
    });

    if (!solicitud) {
      throw new NotFoundException(
        `Solicitud de compra con ID ${dto.id_solicitud_compra} no encontrada`,
      );
    }

    if (solicitud.estado !== 'EN_COTIZACION') {
      throw new BadRequestException(
        `La solicitud debe estar en estado EN_COTIZACION para registrar cotizaciones. Estado actual: ${solicitud.estado}`,
      );
    }

    // Validar proveedor existe
    const proveedor = await this.prisma.proveedores.findUnique({
      where: { id_proveedor: dto.id_proveedor },
    });

    if (!proveedor) {
      throw new NotFoundException(
        `Proveedor con ID ${dto.id_proveedor} no encontrado`,
      );
    }

    // Validar que todos los id_solicitud_compra_detalle pertenecen a la solicitud
    const solicitudDetalleIds = solicitud.detalle.map(
      (d) => d.id_solicitud_compra_detalle,
    );

    for (const item of dto.detalle) {
      if (!solicitudDetalleIds.includes(item.id_solicitud_compra_detalle)) {
        throw new BadRequestException(
          `El detalle de solicitud con ID ${item.id_solicitud_compra_detalle} no pertenece a la solicitud ${dto.id_solicitud_compra}`,
        );
      }
    }

    // Construir detalle con cálculos
    const detalleConCantidades = dto.detalle.map((item) => {
      const solicitudDetalle = solicitud.detalle.find(
        (d) => d.id_solicitud_compra_detalle === item.id_solicitud_compra_detalle,
      );
      const cantidad = solicitudDetalle?.cantidad_aprobada || solicitudDetalle?.cantidad_solicitada || 0;
      return { ...item, cantidad };
    });

    const calculated = this.calculateTotals(detalleConCantidades);

    const cotizacion = await this.prisma.cotizaciones_compra.create({
      data: {
        id_solicitud_compra: dto.id_solicitud_compra,
        id_proveedor: dto.id_proveedor,
        estado: 'REGISTRADA',
        numero_cotizacion: dto.numero_cotizacion,
        fecha_cotizacion: dto.fecha_cotizacion
          ? new Date(dto.fecha_cotizacion)
          : null,
        fecha_vencimiento: dto.fecha_vencimiento
          ? new Date(dto.fecha_vencimiento)
          : null,
        condiciones_pago: dto.condiciones_pago,
        dias_credito: dto.dias_credito,
        dias_entrega: dto.dias_entrega,
        moneda: dto.moneda || 'USD',
        archivo_cotizacion: dto.archivo_cotizacion,
        observaciones: dto.observaciones,
        subtotal: calculated.subtotal,
        descuento: calculated.descuento,
        iva: calculated.iva,
        total: calculated.total,
        id_usuario_registra: user.id_usuario,
        detalle: {
          create: detalleConCantidades.map((item) => {
            const itemSubtotal =
              (item.costo_unitario || 0) * item.cantidad -
              (item.descuento_monto || 0);
            const itemIva = itemSubtotal * calculated.tasaIVA;
            return {
              id_solicitud_compra_detalle: item.id_solicitud_compra_detalle,
              costo_unitario: item.costo_unitario || 0,
              descuento_porcentaje: item.descuento_porcentaje || 0,
              descuento_monto: item.descuento_monto || 0,
              subtotal: itemSubtotal,
              iva: itemIva,
              total: itemSubtotal + itemIva,
              disponibilidad: item.disponibilidad,
              observaciones: item.observaciones,
            };
          }),
        },
      },
      include: this.includeCompleto,
    });

    await this.prisma.logAction(
      'REGISTRAR_COTIZACION_COMPRA',
      user.id_usuario,
      `Cotización de compra registrada para solicitud ${solicitud.codigo}, proveedor: ${proveedor.nombre_razon_social}`,
    );

    return cotizacion;
  }

  async findBySolicitud(idSolicitud: number) {
    const solicitud = await this.prisma.solicitudes_compra.findUnique({
      where: { id_solicitud_compra: idSolicitud },
    });

    if (!solicitud) {
      throw new NotFoundException(
        `Solicitud de compra con ID ${idSolicitud} no encontrada`,
      );
    }

    return this.prisma.cotizaciones_compra.findMany({
      where: { id_solicitud_compra: idSolicitud },
      include: this.includeCompleto,
      orderBy: { fecha_creacion: 'desc' },
    });
  }

  async findOne(id: number) {
    const cotizacion = await this.prisma.cotizaciones_compra.findUnique({
      where: { id_cotizacion_compra: id },
      include: this.includeCompleto,
    });

    if (!cotizacion) {
      throw new NotFoundException(
        `Cotización de compra con ID ${id} no encontrada`,
      );
    }

    return cotizacion;
  }

  async update(id: number, dto: UpdateCotizacionCompraDto, user: usuarios) {
    const cotizacion = await this.prisma.cotizaciones_compra.findUnique({
      where: { id_cotizacion_compra: id },
      include: {
        solicitud_compra: { include: { detalle: true } },
        detalle: true,
      },
    });

    if (!cotizacion) {
      throw new NotFoundException(
        `Cotización de compra con ID ${id} no encontrada`,
      );
    }

    if (!['PENDIENTE', 'REGISTRADA'].includes(cotizacion.estado)) {
      throw new BadRequestException(
        `Solo se pueden modificar cotizaciones en estado PENDIENTE o REGISTRADA. Estado actual: ${cotizacion.estado}`,
      );
    }

    const updateData: any = {};

    if (dto.numero_cotizacion !== undefined) updateData.numero_cotizacion = dto.numero_cotizacion;
    if (dto.fecha_cotizacion !== undefined) updateData.fecha_cotizacion = new Date(dto.fecha_cotizacion);
    if (dto.fecha_vencimiento !== undefined) updateData.fecha_vencimiento = new Date(dto.fecha_vencimiento);
    if (dto.condiciones_pago !== undefined) updateData.condiciones_pago = dto.condiciones_pago;
    if (dto.dias_credito !== undefined) updateData.dias_credito = dto.dias_credito;
    if (dto.dias_entrega !== undefined) updateData.dias_entrega = dto.dias_entrega;
    if (dto.moneda !== undefined) updateData.moneda = dto.moneda;
    if (dto.archivo_cotizacion !== undefined) updateData.archivo_cotizacion = dto.archivo_cotizacion;
    if (dto.observaciones !== undefined) updateData.observaciones = dto.observaciones;

    // Si se envía detalle, recalcular totales
    if (dto.detalle && dto.detalle.length > 0) {
      // Eliminar detalle anterior y crear nuevo
      await this.prisma.cotizaciones_compra_detalle.deleteMany({
        where: { id_cotizacion_compra: id },
      });

      const solicitudDetalle = cotizacion.solicitud_compra.detalle;
      const detalleConCantidades = dto.detalle.map((item) => {
        const solDetalle = solicitudDetalle.find(
          (d) => d.id_solicitud_compra_detalle === item.id_solicitud_compra_detalle,
        );
        const cantidad = solDetalle?.cantidad_aprobada || solDetalle?.cantidad_solicitada || 0;
        return { ...item, cantidad };
      });

      const calculated = this.calculateTotals(detalleConCantidades);

      updateData.subtotal = calculated.subtotal;
      updateData.descuento = calculated.descuento;
      updateData.iva = calculated.iva;
      updateData.total = calculated.total;

      updateData.detalle = {
        create: detalleConCantidades.map((item) => {
          const itemSubtotal =
            (item.costo_unitario || 0) * item.cantidad -
            (item.descuento_monto || 0);
          const itemIva = itemSubtotal * 0.13;
          return {
            id_solicitud_compra_detalle: item.id_solicitud_compra_detalle,
            costo_unitario: item.costo_unitario || 0,
            descuento_porcentaje: item.descuento_porcentaje || 0,
            descuento_monto: item.descuento_monto || 0,
            subtotal: itemSubtotal,
            iva: itemIva,
            total: itemSubtotal + itemIva,
            disponibilidad: item.disponibilidad,
            observaciones: item.observaciones,
          };
        }),
      };
    }

    const updated = await this.prisma.cotizaciones_compra.update({
      where: { id_cotizacion_compra: id },
      data: updateData,
      include: this.includeCompleto,
    });

    await this.prisma.logAction(
      'ACTUALIZAR_COTIZACION_COMPRA',
      user.id_usuario,
      `Cotización de compra ID ${id} actualizada`,
    );

    return updated;
  }

  async remove(id: number, user: usuarios) {
    const cotizacion = await this.prisma.cotizaciones_compra.findUnique({
      where: { id_cotizacion_compra: id },
    });

    if (!cotizacion) {
      throw new NotFoundException(
        `Cotización de compra con ID ${id} no encontrada`,
      );
    }

    if (!['PENDIENTE', 'REGISTRADA'].includes(cotizacion.estado)) {
      throw new BadRequestException(
        `Solo se pueden eliminar cotizaciones en estado PENDIENTE o REGISTRADA. Estado actual: ${cotizacion.estado}`,
      );
    }

    await this.prisma.cotizaciones_compra.delete({
      where: { id_cotizacion_compra: id },
    });

    await this.prisma.logAction(
      'ELIMINAR_COTIZACION_COMPRA',
      user.id_usuario,
      `Cotización de compra ID ${id} eliminada`,
    );

    return { message: 'Cotización de compra eliminada exitosamente' };
  }

  // =============================================
  // Comparación de cotizaciones
  // =============================================

  async comparar(idSolicitud: number) {
    const solicitud = await this.prisma.solicitudes_compra.findUnique({
      where: { id_solicitud_compra: idSolicitud },
      include: {
        detalle: {
          include: {
            catalogo: true,
          },
        },
      },
    });

    if (!solicitud) {
      throw new NotFoundException(
        `Solicitud de compra con ID ${idSolicitud} no encontrada`,
      );
    }

    const cotizaciones = await this.prisma.cotizaciones_compra.findMany({
      where: {
        id_solicitud_compra: idSolicitud,
        estado: { in: ['REGISTRADA', 'SELECCIONADA'] },
      },
      include: {
        proveedor: {
          select: {
            id_proveedor: true,
            nombre_razon_social: true,
            nombre_comercial: true,
          },
        },
        detalle: true,
      },
      orderBy: { fecha_creacion: 'asc' },
    });

    // Items de la solicitud (filas)
    const items = solicitud.detalle.map((d) => ({
      id_solicitud_compra_detalle: d.id_solicitud_compra_detalle,
      id_catalogo: d.id_catalogo,
      codigo: d.codigo,
      nombre: d.nombre,
      descripcion: d.descripcion,
      cantidad_solicitada: d.cantidad_solicitada,
      cantidad_aprobada: d.cantidad_aprobada,
      costo_estimado: d.costo_estimado,
    }));

    // Proveedores (columnas)
    const proveedores = cotizaciones.map((c) => ({
      id_cotizacion_compra: c.id_cotizacion_compra,
      id_proveedor: c.id_proveedor,
      nombre_proveedor: c.proveedor.nombre_comercial || c.proveedor.nombre_razon_social,
      estado: c.estado,
      numero_cotizacion: c.numero_cotizacion,
      condiciones_pago: c.condiciones_pago,
      dias_credito: c.dias_credito,
      dias_entrega: c.dias_entrega,
      moneda: c.moneda,
    }));

    // Matriz de precios: precios[id_solicitud_compra_detalle][id_cotizacion_compra]
    const precios: Record<number, Record<number, any>> = {};
    for (const item of solicitud.detalle) {
      precios[item.id_solicitud_compra_detalle] = {};
    }

    for (const cotizacion of cotizaciones) {
      for (const detalle of cotizacion.detalle) {
        if (precios[detalle.id_solicitud_compra_detalle]) {
          precios[detalle.id_solicitud_compra_detalle][cotizacion.id_cotizacion_compra] = {
            id_cotizacion_compra_detalle: detalle.id_cotizacion_compra_detalle,
            costo_unitario: detalle.costo_unitario,
            descuento_porcentaje: detalle.descuento_porcentaje,
            descuento_monto: detalle.descuento_monto,
            subtotal: detalle.subtotal,
            iva: detalle.iva,
            total: detalle.total,
            disponibilidad: detalle.disponibilidad,
            observaciones: detalle.observaciones,
          };
        }
      }
    }

    // Totales por proveedor
    const totales_por_proveedor: Record<number, any> = {};
    for (const cotizacion of cotizaciones) {
      totales_por_proveedor[cotizacion.id_cotizacion_compra] = {
        subtotal: cotizacion.subtotal,
        descuento: cotizacion.descuento,
        iva: cotizacion.iva,
        total: cotizacion.total,
      };
    }

    return {
      items,
      proveedores,
      precios,
      totales_por_proveedor,
    };
  }

  // =============================================
  // Workflow: Seleccionar cotización
  // =============================================

  async seleccionar(id: number, dto: SeleccionarCotizacionDto, user: usuarios) {
    const cotizacion = await this.prisma.cotizaciones_compra.findUnique({
      where: { id_cotizacion_compra: id },
      include: {
        solicitud_compra: true,
      },
    });

    if (!cotizacion) {
      throw new NotFoundException(
        `Cotización de compra con ID ${id} no encontrada`,
      );
    }

    if (cotizacion.estado !== 'REGISTRADA') {
      throw new BadRequestException(
        `La cotización debe estar en estado REGISTRADA para ser seleccionada. Estado actual: ${cotizacion.estado}`,
      );
    }

    if (cotizacion.solicitud_compra.estado !== 'EN_COTIZACION') {
      throw new BadRequestException(
        `La solicitud debe estar en estado EN_COTIZACION. Estado actual: ${cotizacion.solicitud_compra.estado}`,
      );
    }

    // Validar que hay al menos 1 cotización REGISTRADA para la solicitud
    const cotizacionesRegistradas = await this.prisma.cotizaciones_compra.count({
      where: {
        id_solicitud_compra: cotizacion.id_solicitud_compra,
        estado: 'REGISTRADA',
      },
    });

    if (cotizacionesRegistradas < 1) {
      throw new BadRequestException(
        'Debe haber al menos una cotización REGISTRADA para la solicitud',
      );
    }

    const resultado = await this.prisma.$transaction(async (tx) => {
      // Marcar esta cotización como SELECCIONADA
      const cotizacionSeleccionada = await tx.cotizaciones_compra.update({
        where: { id_cotizacion_compra: id },
        data: {
          estado: 'SELECCIONADA',
          motivo_seleccion: dto.motivo_seleccion,
          id_usuario_selecciona: user.id_usuario,
          fecha_seleccion: new Date(),
        },
        include: this.includeCompleto,
      });

      // Marcar todas las demás cotizaciones de la misma solicitud como DESCARTADA
      await tx.cotizaciones_compra.updateMany({
        where: {
          id_solicitud_compra: cotizacion.id_solicitud_compra,
          id_cotizacion_compra: { not: id },
          estado: 'REGISTRADA',
        },
        data: {
          estado: 'DESCARTADA',
        },
      });

      // Actualizar estado de la solicitud a COTIZACION_APROBADA
      await tx.solicitudes_compra.update({
        where: { id_solicitud_compra: cotizacion.id_solicitud_compra },
        data: {
          estado: 'COTIZACION_APROBADA',
        },
      });

      return cotizacionSeleccionada;
    });

    await this.prisma.logAction(
      'SELECCIONAR_COTIZACION_COMPRA',
      user.id_usuario,
      `Cotización de compra ID ${id} seleccionada para solicitud ${cotizacion.solicitud_compra.codigo}`,
    );

    return resultado;
  }

  // =============================================
  // Workflow: Generar OC desde cotización
  // =============================================

  async generarOc(id: number, dto: GenerarOcDesdeCotizacionDto, user: usuarios) {
    const cotizacion = await this.prisma.cotizaciones_compra.findUnique({
      where: { id_cotizacion_compra: id },
      include: {
        detalle: {
          include: {
            solicitud_compra_detalle: {
              include: {
                catalogo: true,
              },
            },
          },
        },
        solicitud_compra: true,
      },
    });

    if (!cotizacion) {
      throw new NotFoundException(
        `Cotización de compra con ID ${id} no encontrada`,
      );
    }

    if (cotizacion.estado !== 'SELECCIONADA') {
      throw new BadRequestException(
        `La cotización debe estar en estado SELECCIONADA para generar OC. Estado actual: ${cotizacion.estado}`,
      );
    }

    // Validar que todos los id_cotizacion_compra_detalle pertenecen a esta cotización
    const cotizacionDetalleIds = cotizacion.detalle.map(
      (d) => d.id_cotizacion_compra_detalle,
    );

    for (const grupo of dto.grupos) {
      for (const item of grupo.items) {
        if (!cotizacionDetalleIds.includes(item.id_cotizacion_compra_detalle)) {
          throw new BadRequestException(
            `El detalle de cotización con ID ${item.id_cotizacion_compra_detalle} no pertenece a la cotización ${id}`,
          );
        }
      }
    }

    const ordenesCreadas: any[] = [];

    for (const grupo of dto.grupos) {
      const codigo = await this.generarCodigoOrden();

      // Mapear items del grupo con datos del catálogo desde la solicitud
      const detalleItems = grupo.items.map((item) => {
        const cotDetalle = cotizacion.detalle.find(
          (d) => d.id_cotizacion_compra_detalle === item.id_cotizacion_compra_detalle,
        );
        const solDetalle = cotDetalle?.solicitud_compra_detalle;

        const itemSubtotal =
          (item.costo_unitario || 0) * item.cantidad -
          (cotDetalle?.descuento_monto || 0);
        const itemIva = itemSubtotal * 0.13;

        return {
          id_catalogo: solDetalle?.id_catalogo || null,
          codigo: solDetalle?.codigo || null,
          nombre: solDetalle?.nombre || '',
          descripcion: solDetalle?.descripcion || null,
          tiene_serie: solDetalle?.tiene_serie || false,
          afecta_inventario: solDetalle?.afecta_inventario ?? true,
          cantidad_ordenada: item.cantidad,
          costo_unitario: item.costo_unitario,
          subtotal: itemSubtotal,
          descuento_porcentaje: cotDetalle?.descuento_porcentaje || 0,
          descuento_monto: cotDetalle?.descuento_monto || 0,
          iva: itemIva,
          total: itemSubtotal + itemIva,
        };
      });

      // Calcular totales de la OC
      const tasaIVA = 0.13;
      let subtotal = 0;
      let descuentoTotal = 0;

      detalleItems.forEach((item) => {
        subtotal += (item.costo_unitario || 0) * item.cantidad_ordenada;
        descuentoTotal += item.descuento_monto || 0;
      });

      const baseImponible = subtotal - descuentoTotal;
      const iva = baseImponible * tasaIVA;
      const total = baseImponible + iva;

      const orden = await this.prisma.ordenes_compra.create({
        data: {
          codigo,
          estado: 'BORRADOR',
          id_proveedor: grupo.id_proveedor,
          id_sucursal: grupo.id_sucursal,
          id_bodega: grupo.id_bodega,
          id_forma_pago: grupo.id_forma_pago,
          dias_credito: grupo.dias_credito,
          moneda: cotizacion.moneda || 'USD',
          observaciones: grupo.observaciones,
          id_usuario_crea: user.id_usuario,
          id_solicitud_compra: cotizacion.id_solicitud_compra,
          id_cotizacion_compra: cotizacion.id_cotizacion_compra,
          subtotal,
          descuento: descuentoTotal,
          iva,
          total,
          detalle: {
            create: detalleItems,
          },
        },
        include: {
          proveedor: {
            select: {
              id_proveedor: true,
              nombre_razon_social: true,
              nombre_comercial: true,
            },
          },
          detalle: true,
        },
      });

      ordenesCreadas.push(orden);
    }

    await this.prisma.logAction(
      'GENERAR_OC_DESDE_COTIZACION',
      user.id_usuario,
      `${ordenesCreadas.length} orden(es) de compra generada(s) desde cotización ID ${id}: ${ordenesCreadas.map((o) => o.codigo).join(', ')}`,
    );

    return ordenesCreadas;
  }
}
