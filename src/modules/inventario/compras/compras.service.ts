import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CxpService } from 'src/modules/cxp/cxp.service';
import { CreateCompraDto } from './dto/create-compra.dto';
import { UpdateCompraDto } from './dto/update-compra.dto';
import { FilterCompraDto } from './dto/filter-compra.dto';
import { compras, Prisma } from '@prisma/client';
import { convertToUTC } from 'src/common/helpers';

interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class ComprasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cxpService: CxpService,
  ) { }

  /**
   * Crea una nueva compra con sus detalles
   */
  async create(createCompraDto: CreateCompraDto, id_usuario: number) {
    const { detalles, id_estante, id_bodega, fecha_factura, ...compraData } = createCompraDto;

    // Determinar si hay líneas que afectan inventario
    const hasInventoryLines = detalles.some(d => d.afecta_inventario !== false);

    // Validar estante/bodega solo si hay líneas de inventario
    if (hasInventoryLines) {
      if (!id_estante || !id_bodega) {
        throw new BadRequestException(
          'Debe especificar sucursal, bodega y estante cuando hay líneas que afectan inventario',
        );
      }

      const estante = await this.prisma.estantes.findFirst({
        where: {
          id_estante,
          id_bodega,
          estado: 'ACTIVO',
        },
      });

      if (!estante) {
        throw new BadRequestException(
          `El estante con ID ${id_estante} no pertenece a la bodega con ID ${id_bodega} o no está activo`,
        );
      }
    }

    // Calcular totales automáticamente (incluye TODAS las líneas)
    const calculated = this.calculateTotals(detalles, compraData);

    // Validar series antes de crear (solo líneas de inventario)
    for (const detalle of detalles) {
      // Forzar valores para líneas de servicio
      if (detalle.afecta_inventario === false) {
        detalle.tiene_serie = false;
        detalle.cantidad_inventario = 0;
        detalle.series = undefined;
        continue;
      }

      if (detalle.tiene_serie && detalle.series && detalle.series.length > 0) {
        if (detalle.series.length !== detalle.cantidad_inventario) {
          throw new BadRequestException(
            `El producto "${detalle.nombre}" requiere ${detalle.cantidad_inventario} números de serie pero se proporcionaron ${detalle.series.length}`,
          );
        }
        // Validar que no haya duplicados en las series del mismo detalle
        const uniqueSeries = new Set(detalle.series);
        if (uniqueSeries.size !== detalle.series.length) {
          throw new BadRequestException(
            `El producto "${detalle.nombre}" tiene números de serie duplicados`,
          );
        }
      }
    }

    // Crear compra con detalles en una transacción
    const compra = await this.prisma.$transaction(async (prisma) => {
      // Crear la compra
      const nuevaCompra = await prisma.compras.create({
        data: {
          ...compraData,
          id_bodega,
          id_usuario,
          subtotal: calculated.subtotal,
          descuento: calculated.descuento,
          iva: calculated.iva,
          total: calculated.total,
          fecha_factura: convertToUTC(fecha_factura),
          ComprasDetalle: {
            create: detalles.map((detalle) => ({
              id_catalogo: detalle.id_catalogo,
              codigo: detalle.codigo,
              nombre: detalle.nombre,
              descripcion: detalle.descripcion,
              tiene_serie: detalle.tiene_serie,
              afecta_inventario: detalle.afecta_inventario ?? true,
              costo_unitario: detalle.costo_unitario,
              cantidad: detalle.cantidad,
              cantidad_inventario: detalle.cantidad_inventario,
              subtotal:
                detalle.costo_unitario * detalle.cantidad -
                (detalle.descuento_monto || 0),
              descuento_porcentaje: detalle.descuento_porcentaje || 0,
              descuento_monto: detalle.descuento_monto || 0,
              iva:
                (detalle.costo_unitario * detalle.cantidad -
                  (detalle.descuento_monto || 0)) *
                (calculated.tasaIVA || 0.13),
              total:
                (detalle.costo_unitario * detalle.cantidad -
                  (detalle.descuento_monto || 0)) *
                (1 + (calculated.tasaIVA || 0.13)),
            })),
          },
        },
        include: {
          ComprasDetalle: true,
          proveedor: true,
          usuario: true,
          sucursales: true,
          bodegas: true,
        },
      });

      // Guardar las series si vienen en los detalles (solo líneas de inventario)
      for (let i = 0; i < detalles.length; i++) {
        const detalle = detalles[i];
        if (detalle.afecta_inventario === false) continue;

        const detalleCreado = nuevaCompra.ComprasDetalle[i];

        if (detalle.tiene_serie && detalle.series && detalle.series.length > 0) {
          // Crear las series vinculadas al detalle de compra
          await prisma.inventario_series.createMany({
            data: detalle.series.map((numeroSerie) => ({
              numero_serie: numeroSerie,
              estado: 'DISPONIBLE',
              id_compra_detalle: detalleCreado.id_compras_detalle,
              costo_adquisicion: detalle.costo_unitario,
              // id_inventario se asignará cuando se recepcione
            })),
          });
        }
      }

      // Registrar acción en log
      await prisma.log.create({
        data: {
          accion: 'CREAR_COMPRA',
          id_usuario,
          descripcion: `Compra creada: Factura ${createCompraDto.numero_factura}, Total: $${calculated.total.toFixed(2)}`,
        },
      });

      // Si es compra a crédito, crear cuenta por pagar dentro de la transacción
      if (createCompraDto.es_credito && (createCompraDto.dias_credito || 0) > 0) {
        if (!nuevaCompra.id_sucursal) {
          throw new BadRequestException(
            'La compra debe tener una sucursal asignada para registrar crédito',
          );
        }
        if (!nuevaCompra.id_proveedor) {
          throw new BadRequestException(
            'La compra debe tener un proveedor asignado para registrar crédito',
          );
        }
        await this.cxpService.crearCuentaPorPagar({
          id_compras: nuevaCompra.id_compras,
          id_proveedor: nuevaCompra.id_proveedor,
          monto_total: nuevaCompra.total || 0,
          dias_credito: createCompraDto.dias_credito || 30,
          fecha_emision: nuevaCompra.fecha_factura || new Date(),
          id_sucursal: nuevaCompra.id_sucursal,
          id_usuario,
        }, prisma);
      }

      return nuevaCompra;
    });

    return compra;
  }

  /**
   * Lista todas las compras con filtros y paginación
   */
  async findAll(filterDto: FilterCompraDto) {
    const {
      page = 1,
      limit = 10,
      search,
      id_proveedor,
      id_sucursal,
      id_bodega,
      estado,
      fecha_desde,
      fecha_hasta,
    } = filterDto;

    const skip = (page - 1) * limit;

    const where: Prisma.comprasWhereInput = {};

    // Filtro por estado
    if (estado) {
      where.estado = estado;
    } else {
      where.estado = 'ACTIVO';
    }

    // Búsqueda por texto
    if (search) {
      where.OR = [
        { numero_factura: { contains: search, mode: 'insensitive' } },
        { nombre_proveedor: { contains: search, mode: 'insensitive' } },
        { detalle: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filtro por proveedor
    if (id_proveedor) {
      where.id_proveedor = id_proveedor;
    }

    // Filtro por sucursal
    if (id_sucursal) {
      where.id_sucursal = id_sucursal;
    }

    // Filtro por bodega
    if (id_bodega) {
      where.id_bodega = id_bodega;
    }

    // Filtro por rango de fechas
    if (fecha_desde || fecha_hasta) {
      where.fecha_factura = {};
      if (fecha_desde) {
        where.fecha_factura.gte = new Date(fecha_desde);
      }
      if (fecha_hasta) {
        where.fecha_factura.lte = new Date(fecha_hasta);
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.compras.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fecha_creacion: 'desc' },
        include: {
          proveedor: {
            select: {
              id_proveedor: true,
              nombre_razon_social: true,
              nombre_comercial: true,
            },
          },
          sucursales: {
            select: {
              id_sucursal: true,
              nombre: true,
            },
          },
          bodegas: {
            select: {
              id_bodega: true,
              nombre: true,
            },
          },
          usuario: {
            select: {
              id_usuario: true,
              nombres: true,
              apellidos: true,
            },
          },
          _count: {
            select: {
              ComprasDetalle: true,
            },
          },
        },
      }),
      this.prisma.compras.count({ where }),
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
   * Obtiene una compra por su ID
   */
  async findOne(id: number) {
    const compra = await this.prisma.compras.findUnique({
      where: { id_compras: id },
      include: {
        ComprasDetalle: {
          include: {
            catalogo: true,
            series: {
              select: {
                id_serie: true,
                numero_serie: true,
                mac_address: true,
                estado: true,
              },
            },
          },
        },
        proveedor: true,
        sucursales: true,
        bodegas: true,
        usuario: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
            usuario: true,
          },
        },
        dTEFormaPago: true,
        facturasTipos: true,
      },
    });

    if (!compra) {
      throw new NotFoundException(`Compra con ID ${id} no encontrada`);
    }

    return compra;
  }

  /**
   * Actualiza una compra (solo si está en estado ACTIVO y no recepcionada)
   */
  async update(
    id: number,
    updateCompraDto: UpdateCompraDto,
    id_usuario: number,
  ) {
    const compraExistente = await this.findOne(id);

    // Validar que no esté recepcionada
    if (compraExistente.recepcionada) {
      throw new BadRequestException(
        'No se puede actualizar una compra que ya ha sido recepcionada en inventario',
      );
    }

    const { detalles, id_estante, id_bodega, fecha_factura, ...compraData } = updateCompraDto;

    // Determinar si hay líneas que afectan inventario
    const hasInventoryLines = detalles ? detalles.some(d => d.afecta_inventario !== false) : true;

    // Si se proporciona estante y bodega, validar
    if (hasInventoryLines && id_estante && id_bodega) {
      const estante = await this.prisma.estantes.findFirst({
        where: {
          id_estante,
          id_bodega,
          estado: 'ACTIVO',
        },
      });

      if (!estante) {
        throw new BadRequestException(
          `El estante con ID ${id_estante} no pertenece a la bodega con ID ${id_bodega}`,
        );
      }
    }

    let calculated: any = null;
    if (detalles && detalles.length > 0) {
      calculated = this.calculateTotals(detalles, compraData);

      // Validar series antes de actualizar (solo líneas de inventario)
      for (const detalle of detalles) {
        // Forzar valores para líneas de servicio
        if (detalle.afecta_inventario === false) {
          detalle.tiene_serie = false;
          detalle.cantidad_inventario = 0;
          detalle.series = undefined;
          continue;
        }

        if (detalle.tiene_serie && detalle.series && detalle.series.length > 0) {
          if (detalle.series.length !== detalle.cantidad_inventario) {
            throw new BadRequestException(
              `El producto "${detalle.nombre}" requiere ${detalle.cantidad_inventario} números de serie pero se proporcionaron ${detalle.series.length}`,
            );
          }
          // Validar que no haya duplicados
          const uniqueSeries = new Set(detalle.series);
          if (uniqueSeries.size !== detalle.series.length) {
            throw new BadRequestException(
              `El producto "${detalle.nombre}" tiene números de serie duplicados`,
            );
          }
        }
      }
    }

    const compra = await this.prisma.$transaction(async (prisma) => {
      // Si se proporcionan nuevos detalles, eliminar los anteriores y crear nuevos
      if (detalles && detalles.length > 0) {
        // Eliminar las series asociadas a los detalles antiguos
        const detallesAntiguos = await prisma.comprasDetalle.findMany({
          where: { id_compras: id },
          select: { id_compras_detalle: true },
        });

        if (detallesAntiguos.length > 0) {
          await prisma.inventario_series.deleteMany({
            where: {
              id_compra_detalle: {
                in: detallesAntiguos.map((d) => d.id_compras_detalle),
              },
            },
          });
        }

        // Eliminar los detalles antiguos
        await prisma.comprasDetalle.deleteMany({
          where: { id_compras: id },
        });

        // Crear nuevos detalles
        const nuevosDetalles = await Promise.all(
          detalles.map((detalle) =>
            prisma.comprasDetalle.create({
              data: {
                id_compras: id,
                id_catalogo: detalle.id_catalogo,
                codigo: detalle.codigo,
                nombre: detalle.nombre,
                descripcion: detalle.descripcion,
                tiene_serie: detalle.tiene_serie,
                afecta_inventario: detalle.afecta_inventario ?? true,
                costo_unitario: detalle.costo_unitario,
                cantidad: detalle.cantidad,
                cantidad_inventario: detalle.cantidad_inventario,
                subtotal:
                  detalle.costo_unitario * detalle.cantidad -
                  (detalle.descuento_monto || 0),
                descuento_porcentaje: detalle.descuento_porcentaje || 0,
                descuento_monto: detalle.descuento_monto || 0,
                iva:
                  (detalle.costo_unitario * detalle.cantidad -
                    (detalle.descuento_monto || 0)) *
                  (calculated.tasaIVA || 0.13),
                total:
                  (detalle.costo_unitario * detalle.cantidad -
                    (detalle.descuento_monto || 0)) *
                  (1 + (calculated.tasaIVA || 0.13)),
              },
            }),
          ),
        );

        // Crear series para los nuevos detalles (solo líneas de inventario)
        for (let i = 0; i < detalles.length; i++) {
          const detalle = detalles[i];
          if (detalle.afecta_inventario === false) continue;

          const detalleCreado = nuevosDetalles[i];

          if (detalle.tiene_serie && detalle.series && detalle.series.length > 0) {
            await prisma.inventario_series.createMany({
              data: detalle.series.map((numeroSerie) => ({
                numero_serie: numeroSerie,
                estado: 'DISPONIBLE',
                id_compra_detalle: detalleCreado.id_compras_detalle,
                costo_adquisicion: detalle.costo_unitario,
              })),
            });
          }
        }
      }

      // Actualizar la compra
      const compraActualizada = await prisma.compras.update({
        where: { id_compras: id },
        data: {
          ...compraData,
          fecha_factura: convertToUTC(fecha_factura!),
          id_bodega,
          ...(calculated && {
            subtotal: calculated.subtotal,
            descuento: calculated.descuento,
            iva: calculated.iva,
            total: calculated.total,
          }),
        },
        include: {
          ComprasDetalle: true,
          proveedor: true,
          usuario: true,
          sucursales: true,
          bodegas: true,
        },
      });

      // Registrar en log
      await prisma.log.create({
        data: {
          accion: 'ACTUALIZAR_COMPRA',
          id_usuario,
          descripcion: `Compra actualizada: Factura ${compraActualizada.numero_factura}`,
        },
      });

      return compraActualizada;
    });

    return compra;
  }

  /**
   * Elimina (inactiva) una compra
   */
  async remove(id: number, id_usuario: number) {
    const compraExistente = await this.findOne(id); // Verificar que existe

    // Validar que no esté recepcionada
    if (compraExistente.recepcionada) {
      throw new BadRequestException(
        'No se puede eliminar una compra que ya ha sido recepcionada en inventario',
      );
    }

    return await this.prisma.$transaction(async (tx) => {
      // Intentar anular CxP asociada (si existe)
      await this.cxpService.anularCxpPorCompra(id, tx);

      const compra = await tx.compras.update({
        where: { id_compras: id },
        data: { estado: 'INACTIVO' },
      });

      // Registrar en log
      await tx.log.create({
        data: {
          accion: 'ELIMINAR_COMPRA',
          id_usuario,
          descripcion: `Compra eliminada: Factura ${compra.numero_factura}`,
        },
      });

      return compra;
    });
  }

  /**
   * Recepciona una compra y genera movimientos de inventario
   */
  async recepcionar(
    id: number,
    id_usuario: number,
    seriesPorDetalle?: { [id_compras_detalle: number]: string[] },
  ) {
    const compra = await this.findOne(id);

    // Validar que no esté recepcionada previamente
    if (compra.recepcionada) {
      throw new BadRequestException(
        'Esta compra ya ha sido recepcionada en inventario',
      );
    }

    // Validar que la compra esté activa
    if (compra.estado !== 'ACTIVO') {
      throw new BadRequestException(
        'Solo se pueden recepcionar compras en estado ACTIVO',
      );
    }

    // Filtrar solo líneas que afectan inventario
    const inventoryDetalles = compra.ComprasDetalle.filter(
      (d) => d.afecta_inventario !== false,
    );

    let estante: any = null;

    // Solo buscar estante si hay líneas de inventario
    if (inventoryDetalles.length > 0) {
      estante = await this.prisma.estantes.findFirst({
        where: {
          id_bodega: compra.id_bodega ?? 0,
          estado: 'ACTIVO',
        },
      });

      if (!estante) {
        throw new BadRequestException(
          `No se encontró un estante activo para la bodega con ID ${compra.id_bodega}`,
        );
      }
    }

    return await this.prisma.$transaction(async (prisma) => {
      // Procesar solo líneas de inventario
      for (const detalle of inventoryDetalles) {
        // Buscar o crear inventario
        let inventario = await prisma.inventario.findFirst({
          where: {
            id_catalogo: detalle.id_catalogo ?? 0,
            id_bodega: compra.id_bodega ?? 0,
            id_estante: estante.id_estante,
          },
        });

        if (!inventario) {
          // Crear nuevo inventario
          inventario = await prisma.inventario.create({
            data: {
              id_catalogo: detalle.id_catalogo ?? 0,
              id_bodega: compra.id_bodega ?? 0,
              id_estante: estante.id_estante,
              cantidad_disponible: 0,
              cantidad_reservada: 0,
              costo_promedio: detalle.costo_unitario,
            },
          });
        }

        // Si el producto tiene series, validar y procesar
        if (detalle.tiene_serie) {
          // Buscar series ya guardadas para este detalle
          const seriesGuardadas = await prisma.inventario_series.findMany({
            where: {
              id_compra_detalle: detalle.id_compras_detalle,
            },
          });

          let seriesToProcesar: string[] = [];

          if (seriesGuardadas.length > 0) {
            // Usar las series que ya fueron guardadas al crear/actualizar la compra
            seriesToProcesar = seriesGuardadas.map((s) => s.numero_serie);
          } else if (seriesPorDetalle?.[detalle.id_compras_detalle]) {
            // Si no hay series guardadas, usar las del parámetro (compatibilidad)
            seriesToProcesar = seriesPorDetalle[detalle.id_compras_detalle];
          } else {
            // No hay series disponibles
            throw new BadRequestException(
              `El producto "${detalle.nombre}" requiere ${detalle.cantidad_inventario} números de serie pero no se encontraron series registradas`,
            );
          }

          // Validar que la cantidad de series coincida
          if (seriesToProcesar.length !== detalle.cantidad_inventario) {
            throw new BadRequestException(
              `El producto "${detalle.nombre}" requiere ${detalle.cantidad_inventario} números de serie pero se encontraron ${seriesToProcesar.length}`,
            );
          }

          // Actualizar las series con el id_inventario
          if (seriesGuardadas.length > 0) {
            // Actualizar las series existentes
            await prisma.inventario_series.updateMany({
              where: {
                id_compra_detalle: detalle.id_compras_detalle,
              },
              data: {
                id_inventario: inventario.id_inventario,
              },
            });
          } else {
            // Crear nuevas series (compatibilidad con método antiguo)
            await prisma.inventario_series.createMany({
              data: seriesToProcesar.map((numeroSerie) => ({
                id_inventario: inventario.id_inventario,
                numero_serie: numeroSerie,
                estado: 'DISPONIBLE',
                id_compra_detalle: detalle.id_compras_detalle,
                costo_adquisicion: detalle.costo_unitario,
              })),
            });
          }
        }

        // Calcular nuevo costo promedio
        const cantidadAnterior = inventario.cantidad_disponible;
        const costoPromedioAnterior = Number(inventario.costo_promedio || 0);
        const cantidadNueva = detalle.cantidad_inventario;
        const costoNuevo = Number(detalle.costo_unitario);

        const nuevoCostoPromedio =
          cantidadAnterior + cantidadNueva > 0
            ? (costoPromedioAnterior * cantidadAnterior +
              costoNuevo * cantidadNueva) /
            (cantidadAnterior + cantidadNueva)
            : costoNuevo;

        // Actualizar inventario
        await prisma.inventario.update({
          where: { id_inventario: inventario.id_inventario },
          data: {
            cantidad_disponible: {
              increment: cantidadNueva,
            },
            costo_promedio: nuevoCostoPromedio,
          },
        });

        // Crear movimiento de inventario
        await prisma.movimientos_inventario.create({
          data: {
            tipo: 'ENTRADA_COMPRA',
            id_catalogo: detalle.id_catalogo ?? 0,
            id_bodega_destino: compra.id_bodega ?? 0,
            cantidad: cantidadNueva,
            costo_unitario: costoNuevo,
            id_compra: compra.id_compras,
            id_usuario,
            observaciones: `Recepción de compra - Factura: ${compra.numero_factura}`,
          },
        });
      }

      // Marcar la compra como recepcionada
      await prisma.compras.update({
        where: { id_compras: compra.id_compras },
        data: {
          recepcionada: true,
          fecha_recepcion: new Date(),
        },
      });

      // Registrar en log
      await prisma.log.create({
        data: {
          accion: 'RECEPCIONAR_COMPRA',
          id_usuario,
          descripcion: `Compra recepcionada: Factura ${compra.numero_factura}`,
        },
      });

      return { message: 'Compra recepcionada exitosamente' };
    });
  }

  /**
   * Calcula los totales de la compra automáticamente
   */
  private calculateTotals(detalles: any[], compraData: any) {
    let subtotal = 0;
    let descuentoTotal = 0;

    // Obtener tasa de IVA (puede venir de configuración general)
    const tasaIVA = 0.13; // 13% por defecto

    // Calcular subtotal y descuentos
    detalles.forEach((detalle) => {
      const subtotalLinea = detalle.costo_unitario * detalle.cantidad;
      subtotal += subtotalLinea;

      const descuentoLinea = detalle.descuento_monto || 0;
      descuentoTotal += descuentoLinea;
    });

    // Base imponible (después de descuentos)
    const baseImponible = subtotal - descuentoTotal;

    // Calcular IVA
    const iva = baseImponible * tasaIVA;

    // Total
    const total =
      baseImponible +
      iva +
      (compraData.cesc || 0) +
      (compraData.fovial || 0) +
      (compraData.cotrans || 0) -
      (compraData.iva_retenido || 0) +
      (compraData.iva_percivido || 0);

    return {
      subtotal,
      descuento: descuentoTotal,
      iva,
      total,
      tasaIVA,
    };
  }

  /**
   * Obtiene los tipos de factura disponibles
   */
  async getTiposFactura() {
    const tiposFactura = await this.prisma.facturasTipos.findMany({
      where: {
        estado: 'ACTIVO',
        activo: 'ACTIVO',
      },
      select: {
        id_tipo_factura: true,
        nombre: true,
        codigo: true,
        version: true,
      },
      orderBy: {
        nombre: 'asc',
      },
    });

    return tiposFactura;
  }
}
