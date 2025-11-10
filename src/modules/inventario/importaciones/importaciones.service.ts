// src/modules/inventario/importaciones/importaciones.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import {
  CreateImportacionDto,
  UpdateImportacionDto,
  CreateImportacionGastoDto,
  UpdateEstadoImportacionDto,
  RecepcionarImportacionDto,
  AddSeriesToDetalleDto,
  UpdateImportacionSerieDto,
} from './dto';
import { importaciones, estado_importacion } from '@prisma/client';
import { PaginationDto, PaginatedResult } from 'src/common/dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ImportacionesService {
  constructor(private readonly prisma: PrismaService) { }

  async create(
    createImportacionDto: CreateImportacionDto,
    id_user: number,
  ): Promise<importaciones> {
    const { detalle, ...importacionData } = createImportacionDto;

    // Generar número de orden único
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const count = await this.prisma.importaciones.count({
      where: {
        numero_orden: {
          startsWith: `IMP-${year}${month}`,
        },
      },
    });
    const numero_orden = `IMP-${year}${month}-${String(count + 1).padStart(5, '0')}`;

    // Calcular total FOB
    const subtotal = new Decimal(importacionData.subtotal_mercancia);
    const flete = new Decimal(importacionData.flete_internacional || 0);
    const seguro = new Decimal(importacionData.seguro || 0);
    const total_fob = subtotal.plus(flete).plus(seguro);

    // Crear importación con detalle
    const importacion = await this.prisma.importaciones.create({
      data: {
        numero_orden,
        id_proveedor: importacionData.id_proveedor,
        id_usuario_solicita: id_user,
        numero_factura_proveedor: importacionData.numero_factura_proveedor,
        numero_tracking: importacionData.numero_tracking,
        incoterm: importacionData.incoterm,
        puerto_origen: importacionData.puerto_origen,
        puerto_destino: importacionData.puerto_destino,
        naviera_courier: importacionData.naviera_courier,
        fecha_embarque: importacionData.fecha_embarque
          ? new Date(importacionData.fecha_embarque)
          : null,
        fecha_arribo_estimado: importacionData.fecha_arribo_estimado
          ? new Date(importacionData.fecha_arribo_estimado)
          : null,
        moneda: importacionData.moneda,
        subtotal_mercancia: subtotal,
        flete_internacional: flete,
        seguro: seguro,
        total_fob: total_fob,
        tipo_cambio: new Decimal(importacionData.tipo_cambio),
        numero_declaracion: importacionData.numero_declaracion,
        agente_aduanal: importacionData.agente_aduanal,
        observaciones: importacionData.observaciones,
        detalle: {
          create: detalle.map((item) => {
            const precio = new Decimal(item.precio_unitario_usd);
            const cantidad = item.cantidad_ordenada;
            const subtotal_usd = precio.times(cantidad);
            const tipo_cambio = new Decimal(importacionData.tipo_cambio);
            const precio_local = precio.times(tipo_cambio);
            const subtotal_local = subtotal_usd.times(tipo_cambio);

            return {
              id_catalogo: item.id_catalogo,
              codigo: item.codigo,
              nombre: item.nombre,
              descripcion: item.descripcion,
              cantidad_ordenada: cantidad,
              precio_unitario_usd: precio,
              subtotal_usd: subtotal_usd,
              precio_unitario_local: precio_local,
              subtotal_local: subtotal_local,
              peso_kg: item.peso_kg ? new Decimal(item.peso_kg) : null,
              volumen_m3: item.volumen_m3 ? new Decimal(item.volumen_m3) : null,
              tiene_serie: item.tiene_serie,
              observaciones: item.observaciones,
              series: item.series
                ? {
                  create: item.series.map((serie) => ({
                    numero_serie: serie.numero_serie,
                    mac_address: serie.mac_address,
                    observaciones: serie.observaciones,
                  })),
                }
                : undefined,
            };
          }),
        },
      },
      include: {
        detalle: {
          include: {
            series: true,
          },
        },
        proveedor: true,
      },
    });

    // Registrar en el log
    await this.prisma.log.create({
      data: {
        accion: 'CREAR_IMPORTACION',
        id_usuario: id_user,
        descripcion: `Importación creada: ${numero_orden}`,
      },
    });

    return importacion;
  }

  async findAll(
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<importaciones>> { 

    const { page = 1, limit = 10, search = '' } = paginationDto;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { numero_orden: { contains: search, mode: 'insensitive' } },
        { numero_factura_proveedor: { contains: search, mode: 'insensitive' } },
        { numero_tracking: { contains: search, mode: 'insensitive' } },
        {
          proveedor: {
            nombre_razon_social: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.importaciones.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fecha_creacion: 'desc' },
        include: {
          proveedor: {
            select: {
              nombre_razon_social: true,
              nombre_comercial: true,
            },
          },
          usuario_solicita: {
            select: {
              nombres: true,
              apellidos: true,
            },
          },
        },
      }),
      this.prisma.importaciones.count({ where }),
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

  async findByEstado(
    estado: estado_importacion,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<importaciones>> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const where = { estado };

    const [data, total] = await Promise.all([
      this.prisma.importaciones.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fecha_creacion: 'desc' },
        include: {
          proveedor: {
            select: {
              nombre_razon_social: true,
              nombre_comercial: true,
            },
          },
        },
      }),
      this.prisma.importaciones.count({ where }),
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

  async findOne(id: number): Promise<importaciones> {
    const importacion = await this.prisma.importaciones.findUnique({
      where: { id_importacion: id },
      include: {
        proveedor: true,
        usuario_solicita: {
          select: {
            nombres: true,
            apellidos: true,
            usuario: true,
          },
        },
        detalle: {
          include: {
            catalogo: true,
            series: true,
          },
        },
        gastos: true,
        retaceo: {
          include: {
            detalle: true,
          },
        },
      },
    });

    if (!importacion) {
      throw new NotFoundException(`Importación with ID ${id} not found`);
    }

    return importacion;
  }

  async update(
    id: number,
    updateImportacionDto: UpdateImportacionDto,
    id_usuario: number,
  ): Promise<importaciones> {
    const importacion = await this.findOne(id);

    // Validar que la importación esté en estado COTIZACION o ORDEN_COLOCADA
    if (
      importacion.estado !== 'COTIZACION' &&
      importacion.estado !== 'ORDEN_COLOCADA'
    ) {
      throw new BadRequestException(
        'Solo se pueden editar importaciones en estado COTIZACION u ORDEN_COLOCADA',
      );
    }

    const { detalle, ...importacionData } = updateImportacionDto;

    // Recalcular total FOB si se modifican los montos
    let updateData: any = { ...importacionData };

    if (
      importacionData.subtotal_mercancia ||
      importacionData.flete_internacional !== undefined ||
      importacionData.seguro !== undefined
    ) {
      const subtotal = new Decimal(
        importacionData.subtotal_mercancia || importacion.subtotal_mercancia,
      );
      const flete = new Decimal(
        importacionData.flete_internacional !== undefined
          ? importacionData.flete_internacional
          : importacion.flete_internacional || 0,
      );
      const seguro = new Decimal(
        importacionData.seguro !== undefined
          ? importacionData.seguro
          : importacion.seguro || 0,
      );
      updateData.total_fob = subtotal.plus(flete).plus(seguro);
    }

    const updated = await this.prisma.importaciones.update({
      where: { id_importacion: id },
      data: updateData,
      include: {
        detalle: {
          include: {
            series: true,
          },
        },
        proveedor: true,
      },
    });

    // Registrar en el log
    await this.prisma.log.create({
      data: {
        accion: 'ACTUALIZAR_IMPORTACION',
        id_usuario: id_usuario,
        descripcion: `Importación actualizada: ${updated.numero_orden}`,
      },
    });

    return updated;
  }

  async updateEstado(
    id: number,
    updateEstadoDto: UpdateEstadoImportacionDto,
    id_usuario: number,
  ): Promise<importaciones> {
    await this.findOne(id);

    const updateData: any = {
      estado: updateEstadoDto.estado,
    };

    // Actualizar fechas según el estado
    if (updateEstadoDto.fecha_embarque) {
      updateData.fecha_embarque = new Date(updateEstadoDto.fecha_embarque);
    }
    if (updateEstadoDto.fecha_arribo_real) {
      updateData.fecha_arribo_real = new Date(updateEstadoDto.fecha_arribo_real);
    }
    if (updateEstadoDto.fecha_liberacion_aduana) {
      updateData.fecha_liberacion_aduana = new Date(
        updateEstadoDto.fecha_liberacion_aduana,
      );
    }
    if (updateEstadoDto.fecha_recepcion) {
      updateData.fecha_recepcion = new Date(updateEstadoDto.fecha_recepcion);
    }

    const importacion = await this.prisma.importaciones.update({
      where: { id_importacion: id },
      data: updateData,
    });

    // Registrar en el log
    await this.prisma.log.create({
      data: {
        accion: 'CAMBIAR_ESTADO_IMPORTACION',
        id_usuario: id_usuario,
        descripcion: `Estado de importación ${importacion.numero_orden} cambiado a ${updateEstadoDto.estado}`,
      },
    });

    return importacion;
  }

  async addGasto(
    id_importacion: number,
    createGastoDto: CreateImportacionGastoDto,
    id_usuario: number,
  ) {
    await this.findOne(id_importacion);

    const monto = new Decimal(createGastoDto.monto);
    const tipo_cambio = createGastoDto.tipo_cambio
      ? new Decimal(createGastoDto.tipo_cambio)
      : null;
    const monto_local = tipo_cambio ? monto.times(tipo_cambio) : null;

    const gasto = await this.prisma.importaciones_gastos.create({
      data: {
        id_importacion,
        tipo: createGastoDto.tipo,
        descripcion: createGastoDto.descripcion,
        monto: monto,
        moneda: createGastoDto.moneda,
        tipo_cambio: tipo_cambio,
        monto_local: monto_local,
        aplica_retaceo: createGastoDto.aplica_retaceo,
        metodo_retaceo: createGastoDto.metodo_retaceo,
        numero_factura: createGastoDto.numero_factura,
        fecha_factura: createGastoDto.fecha_factura
          ? new Date(createGastoDto.fecha_factura)
          : null,
        observaciones: createGastoDto.observaciones,
      },
    });

    // Registrar en el log
    await this.prisma.log.create({
      data: {
        accion: 'AGREGAR_GASTO_IMPORTACION',
        id_usuario: id_usuario,
        descripcion: `Gasto agregado a importación ID ${id_importacion}: ${createGastoDto.tipo}`,
      },
    });

    return gasto;
  }

  async getGastos(id_importacion: number) {
    await this.findOne(id_importacion);

    return this.prisma.importaciones_gastos.findMany({
      where: { id_importacion },
      orderBy: { fecha_creacion: 'desc' },
    });
  }

  async deleteGasto(
    id_importacion: number,
    id_gasto: number,
    id_usuario: number,
  ) {
    // Verificar que la importación existe
    const importacion = await this.findOne(id_importacion);

    // Validar que la importación esté en estado que permite eliminar gastos
    if (
      importacion.estado !== 'COTIZACION' &&
      importacion.estado !== 'ORDEN_COLOCADA'
    ) {
      throw new BadRequestException(
        'Solo se pueden eliminar gastos de importaciones en estado COTIZACION u ORDEN_COLOCADA',
      );
    }

    // Verificar que el gasto existe y pertenece a esta importación
    const gasto = await this.prisma.importaciones_gastos.findFirst({
      where: {
        id_gasto,
        id_importacion,
      },
    });

    if (!gasto) {
      throw new NotFoundException(
        `Gasto with ID ${id_gasto} not found for this importación`,
      );
    }

    // Verificar si hay un retaceo calculado que use este gasto
    const retaceoConGasto = await this.prisma.retaceo_importacion.findFirst({
      where: {
        id_importacion,
        id_gasto,
      },
    });

    // if (retaceoConGasto) {
    //   throw new BadRequestException(
    //     'Este gasto ya fue usado en un cálculo de retaceo. Debe recalcular el retaceo después de eliminar este gasto.',
    //   );
    // }

    // Eliminar el gasto
    await this.prisma.retaceo_importacion.deleteMany({
      where: { id_gasto },
    }); 
    await this.prisma.importaciones_gastos.delete({
      where: { id_gasto },
    });

    // Registrar en el log
    await this.prisma.log.create({
      data: {
        accion: 'ELIMINAR_GASTO_IMPORTACION',
        id_usuario,
        descripcion: `Gasto eliminado de importación ID ${id_importacion}: ${gasto.tipo} - ${gasto.descripcion}`,
      },
    });

    return {
      message: retaceoConGasto == null ? 'Gasto eliminado exitosamente' : 'Gasto eliminado exitosamente. Recuerde recalcular el retaceo de la importación.',
    };
  }

  async recepcionar(
    id_importacion: number,
    recepcionDto: RecepcionarImportacionDto,
    id_usuario: number,
  ) {
    const importacion = await this.findOne(id_importacion);

    // Validar que la importación esté en estado LIBERADA
    if (importacion.estado !== 'LIBERADA') {
      throw new BadRequestException(
        'Solo se pueden recepcionar importaciones en estado LIBERADA',
      );
    }

    // Validar que todos los items existan
    const detalleIds = recepcionDto.items.map((i) => i.id_importacion_detalle);
    const detalles = await this.prisma.importaciones_detalle.findMany({
      where: {
        id_importacion_detalle: { in: detalleIds },
        id_importacion,
      },
      include: {
        series: true,
      },
    });

    if (detalles.length !== detalleIds.length) {
      throw new BadRequestException('Algunos items no pertenecen a esta importación');
    }

    // Iniciar transacción para recepcionar
    const result = await this.prisma.$transaction(async (tx) => {
      // Actualizar cantidades recibidas en detalle
      for (const item of recepcionDto.items) {
        await tx.importaciones_detalle.update({
          where: { id_importacion_detalle: item.id_importacion_detalle },
          data: {
            cantidad_recibida: item.cantidad_recibida,
          },
        });

        const detalle = detalles.find(
          (d) => d.id_importacion_detalle === item.id_importacion_detalle,
        );

        if (!detalle || !detalle.id_catalogo) continue;

        // Buscar si existe inventario
        const existingInventario = await tx.inventario.findFirst({
          where: {
            id_catalogo: detalle.id_catalogo,
            id_bodega: recepcionDto.id_bodega,
            id_estante: recepcionDto.id_estante ?? null,
          },
        });

        // Crear o actualizar inventario, si es actualizacion es de actualizar al nuevo costo promedio
        let costo_promedio: any = detalle.costo_unitario_final;
        if (existingInventario) {
          costo_promedio = ((Number(existingInventario.costo_promedio) * existingInventario.cantidad_disponible) + (Number(detalle.costo_unitario_final) * item.cantidad_recibida)) / (existingInventario.cantidad_disponible + item.cantidad_recibida);
        }


        const inventario = existingInventario
          ? await tx.inventario.update({
            where: { id_inventario: existingInventario.id_inventario },
            data: {
              cantidad_disponible: {
                increment: item.cantidad_recibida,
              },
              costo_promedio,
            },
          })
          : await tx.inventario.create({
            data: {
              id_catalogo: detalle.id_catalogo,
              id_bodega: recepcionDto.id_bodega,
              id_estante: recepcionDto.id_estante ?? null,
              cantidad_disponible: item.cantidad_recibida,
              costo_promedio,
            },
          });

        // Crear movimiento de inventario
        await tx.movimientos_inventario.create({
          data: {
            tipo: 'ENTRADA_IMPORTACION',
            id_catalogo: detalle.id_catalogo,
            id_bodega_destino: recepcionDto.id_bodega,
            cantidad: item.cantidad_recibida,
            costo_unitario: detalle.costo_unitario_final,
            id_importacion,
            id_usuario,
            observaciones: item.observaciones,
          },
        });

        // Si tiene series, crear registros en inventario_series
        if (detalle.tiene_serie && detalle.series.length > 0) {
          for (const serie of detalle.series) {
            const inventarioSerie = await tx.inventario_series.create({
              data: {
                id_inventario: inventario.id_inventario,
                numero_serie: serie.numero_serie,
                mac_address: serie.mac_address,
                estado: 'DISPONIBLE',
                costo_adquisicion: detalle.costo_unitario_final,
                observaciones: serie.observaciones,
              },
            });

            // Vincular serie de importación con inventario_series
            await tx.importaciones_series.update({
              where: { id_importacion_serie: serie.id_importacion_serie },
              data: {
                recibido: true,
                fecha_recepcion: new Date(),
                id_inventario_serie: inventarioSerie.id_serie,
              },
            });
          }
        }
      }

      // Actualizar estado de importación a RECIBIDA
      const updatedImportacion = await tx.importaciones.update({
        where: { id_importacion },
        data: {
          estado: 'RECIBIDA',
          fecha_recepcion: new Date(),
        },
      });

      return updatedImportacion;
    });

    // Registrar en el log
    await this.prisma.log.create({
      data: {
        accion: 'RECEPCIONAR_IMPORTACION',
        id_usuario,
        descripcion: `Importación recepcionada: ${result.numero_orden}`,
      },
    });

    return result;
  }

  async remove(id: number, id_usuario: number): Promise<importaciones> {
    const importacion = await this.findOne(id);

    // Validar que la importación esté en estado COTIZACION
    if (importacion.estado !== 'COTIZACION') {
      throw new BadRequestException(
        'Solo se pueden cancelar importaciones en estado COTIZACION',
      );
    }

    const updated = await this.prisma.importaciones.update({
      where: { id_importacion: id },
      data: { estado: 'CANCELADA' },
    });

    // Registrar en el log
    await this.prisma.log.create({
      data: {
        accion: 'CANCELAR_IMPORTACION',
        id_usuario: id_usuario,
        descripcion: `Importación cancelada: ${updated.numero_orden}`,
      },
    });

    return updated;
  }

  /**
   * Obtener todas las series de un detalle de importación
   */
  async getSeriesByDetalle(id_importacion_detalle: number) {
    // Verificar que el detalle existe
    const detalle = await this.prisma.importaciones_detalle.findUnique({
      where: { id_importacion_detalle },
      include: { importacion: true },
    });

    if (!detalle) {
      throw new NotFoundException(
        `Detalle de importación with ID ${id_importacion_detalle} not found`,
      );
    }

    // Verificar que el item tiene series
    if (!detalle.tiene_serie) {
      throw new BadRequestException(
        'Este item no está configurado para manejar series',
      );
    }

    return this.prisma.importaciones_series.findMany({
      where: { id_importacion_detalle },
      orderBy: { fecha_creacion: 'desc' },
    });
  }

  /**
   * Agregar series a un detalle de importación
   */
  async addSeriesToDetalle(
    id_importacion_detalle: number,
    addSeriesDto: AddSeriesToDetalleDto,
    id_usuario: number,
  ) {
    // Verificar que el detalle existe
    const detalle = await this.prisma.importaciones_detalle.findUnique({
      where: { id_importacion_detalle },
      include: {
        importacion: true,
        series: true,
      },
    });

    if (!detalle) {
      throw new NotFoundException(
        `Detalle de importación with ID ${id_importacion_detalle} not found`,
      );
    }

    // Verificar que el item tiene serie habilitada
    if (!detalle.tiene_serie) {
      throw new BadRequestException(
        'Este item no está configurado para manejar series. Configure tiene_serie=true primero.',
      );
    }

    // Verificar que la importación esté en estado editable
    if (
      detalle.importacion.estado !== 'COTIZACION' &&
      detalle.importacion.estado !== 'ORDEN_COLOCADA' &&
      detalle.importacion.estado !== 'EN_TRANSITO' &&
      detalle.importacion.estado !== 'EN_ADUANA' &&
      detalle.importacion.estado !== 'LIBERADA'
    ) {
      throw new BadRequestException(
        'Solo se pueden agregar series a importaciones que no han sido recepcionadas',
      );
    }

    // Validar que no se exceda la cantidad ordenada
    const totalSeriesActuales = detalle.series.length;
    const nuevasSeries = addSeriesDto.series.length;
    const totalSeriesDespues = totalSeriesActuales + nuevasSeries;

    if (totalSeriesDespues > detalle.cantidad_ordenada) {
      throw new BadRequestException(
        `No se pueden agregar ${nuevasSeries} series. Ya existen ${totalSeriesActuales} series y la cantidad ordenada es ${detalle.cantidad_ordenada}`,
      );
    }

    // Verificar que los números de serie no estén duplicados
    const numerosSerieExistentes = detalle.series.map((s) => s.numero_serie);
    const nuevosNumerosSerie = addSeriesDto.series.map((s) => s.numero_serie);

    const duplicados = nuevosNumerosSerie.filter((ns) =>
      numerosSerieExistentes.includes(ns),
    );

    if (duplicados.length > 0) {
      throw new BadRequestException(
        `Los siguientes números de serie ya están registrados en este item: ${duplicados.join(', ')}`,
      );
    }

    // Verificar que no existan números de serie duplicados en el sistema
    const seriesExistentesEnSistema =
      await this.prisma.importaciones_series.findMany({
        where: {
          numero_serie: { in: nuevosNumerosSerie },
        },
      });

    if (seriesExistentesEnSistema.length > 0) {
      const seriesDuplicadas = seriesExistentesEnSistema.map(
        (s) => s.numero_serie,
      );
      throw new BadRequestException(
        `Los siguientes números de serie ya están registrados en otras importaciones: ${seriesDuplicadas.join(', ')}`,
      );
    }

    // Crear las series
    const seriesCreadas = await this.prisma.importaciones_series.createMany({
      data: addSeriesDto.series.map((serie) => ({
        id_importacion_detalle,
        numero_serie: serie.numero_serie,
        mac_address: serie.mac_address,
        observaciones: serie.observaciones,
      })),
    });

    // Registrar en el log
    await this.prisma.log.create({
      data: {
        accion: 'AGREGAR_SERIES_IMPORTACION',
        id_usuario,
        descripcion: `Se agregaron ${nuevasSeries} series al detalle ${id_importacion_detalle} de la importación ${detalle.importacion.numero_orden}`,
      },
    });

    // Retornar las series del detalle
    return this.prisma.importaciones_series.findMany({
      where: { id_importacion_detalle },
      orderBy: { fecha_creacion: 'desc' },
    });
  }

  /**
   * Actualizar una serie específica
   */
  async updateSerie(
    id_importacion_serie: number,
    updateSerieDto: UpdateImportacionSerieDto,
    id_usuario: number,
  ) {
    // Verificar que la serie existe
    const serie = await this.prisma.importaciones_series.findUnique({
      where: { id_importacion_serie },
      include: {
        detalle: {
          include: {
            importacion: true,
          },
        },
      },
    });

    if (!serie) {
      throw new NotFoundException(
        `Serie with ID ${id_importacion_serie} not found`,
      );
    }

    // Verificar que la importación esté en estado editable
    if (
      serie.detalle.importacion.estado !== 'COTIZACION' &&
      serie.detalle.importacion.estado !== 'ORDEN_COLOCADA' &&
      serie.detalle.importacion.estado !== 'EN_TRANSITO' &&
      serie.detalle.importacion.estado !== 'EN_ADUANA' &&
      serie.detalle.importacion.estado !== 'LIBERADA'
    ) {
      throw new BadRequestException(
        'Solo se pueden editar series de importaciones que no han sido recepcionadas',
      );
    }

    // Si se está actualizando el número de serie, verificar que no esté duplicado
    if (updateSerieDto.numero_serie && updateSerieDto.numero_serie !== serie.numero_serie) {
      const serieExistente = await this.prisma.importaciones_series.findFirst({
        where: {
          numero_serie: updateSerieDto.numero_serie,
          id_importacion_serie: { not: id_importacion_serie },
        },
      });

      if (serieExistente) {
        throw new BadRequestException(
          `El número de serie ${updateSerieDto.numero_serie} ya está registrado en otra serie`,
        );
      }
    }

    // Actualizar la serie
    const updatedSerie = await this.prisma.importaciones_series.update({
      where: { id_importacion_serie },
      data: updateSerieDto,
    });

    // Registrar en el log
    await this.prisma.log.create({
      data: {
        accion: 'ACTUALIZAR_SERIE_IMPORTACION',
        id_usuario,
        descripcion: `Se actualizó la serie ${updatedSerie.numero_serie} de la importación ${serie.detalle.importacion.numero_orden}`,
      },
    });

    return updatedSerie;
  }

  /**
   * Eliminar una serie específica
   */
  async deleteSerie(id_importacion_serie: number, id_usuario: number) {
    // Verificar que la serie existe
    const serie = await this.prisma.importaciones_series.findUnique({
      where: { id_importacion_serie },
      include: {
        detalle: {
          include: {
            importacion: true,
          },
        },
      },
    });

    if (!serie) {
      throw new NotFoundException(
        `Serie with ID ${id_importacion_serie} not found`,
      );
    }

    // Verificar que la importación esté en estado editable
    if (
      serie.detalle.importacion.estado !== 'COTIZACION' &&
      serie.detalle.importacion.estado !== 'ORDEN_COLOCADA' &&
      serie.detalle.importacion.estado !== 'EN_TRANSITO' &&
      serie.detalle.importacion.estado !== 'EN_ADUANA' &&
      serie.detalle.importacion.estado !== 'LIBERADA'
    ) {
      throw new BadRequestException(
        'Solo se pueden eliminar series de importaciones que no han sido recepcionadas',
      );
    }

    // Verificar que la serie no haya sido recepcionada
    if (serie.recibido) {
      throw new BadRequestException(
        'No se puede eliminar una serie que ya ha sido recepcionada en el inventario',
      );
    }

    // Eliminar la serie
    await this.prisma.importaciones_series.delete({
      where: { id_importacion_serie },
    });

    // Registrar en el log
    await this.prisma.log.create({
      data: {
        accion: 'ELIMINAR_SERIE_IMPORTACION',
        id_usuario,
        descripcion: `Se eliminó la serie ${serie.numero_serie} de la importación ${serie.detalle.importacion.numero_orden}`,
      },
    });

    return {
      message: 'Serie eliminada exitosamente',
    };
  }

  /**
   * Calcular y aplicar el retaceo de gastos a los items de la importación
   */
  async calcularRetaceo(
    id_importacion: number,
    forzar_recalculo: boolean = false,
    id_usuario: number,
  ) {
    const importacion = await this.findOne(id_importacion);

    // Verificar si ya existe un retaceo calculado
    const retaceosExistentes = await this.prisma.retaceo_importacion.findMany({
      where: { id_importacion },
    });

    if (retaceosExistentes.length > 0 && !forzar_recalculo) {
      throw new BadRequestException(
        'Ya existe un retaceo calculado para esta importación. Use forzar_recalculo=true para recalcular.',
      );
    }

    // Obtener todos los gastos que aplican para retaceo
    const gastos = await this.prisma.importaciones_gastos.findMany({
      where: {
        id_importacion,
        aplica_retaceo: true,
      },
    });

    if (gastos.length === 0) {
      throw new BadRequestException(
        'No hay gastos con retaceo aplicable para esta importación',
      );
    }

    // Obtener el detalle de la importación
    const detalles = await this.prisma.importaciones_detalle.findMany({
      where: { id_importacion },
    });

    if (detalles.length === 0) {
      throw new BadRequestException('La importación no tiene items en el detalle');
    }

    // Calcular totales para distribución
    const totales = {
      valor: detalles.reduce((sum, d) => sum.plus(d.subtotal_usd), new Decimal(0)),
      peso: detalles.reduce((sum, d) => sum.plus(d.peso_kg || 0), new Decimal(0)),
      volumen: detalles.reduce((sum, d) => sum.plus(d.volumen_m3 || 0), new Decimal(0)),
      cantidad: detalles.reduce((sum, d) => sum + d.cantidad_ordenada, 0),
    };

    // Validar que existan los datos necesarios según los métodos de retaceo
    for (const gasto of gastos) {
      const metodo = gasto.metodo_retaceo || 'VALOR';
      if (metodo === 'PESO' && totales.peso.isZero()) {
        throw new BadRequestException(
          `El gasto "${gasto.descripcion}" usa método PESO pero los items no tienen peso registrado`,
        );
      }
      if (metodo === 'VOLUMEN' && totales.volumen.isZero()) {
        throw new BadRequestException(
          `El gasto "${gasto.descripcion}" usa método VOLUMEN pero los items no tienen volumen registrado`,
        );
      }
    }

    // Iniciar transacción para calcular el retaceo
    const result = await this.prisma.$transaction(async (tx) => {
      // Eliminar retaceos anteriores si existen
      if (retaceosExistentes.length > 0) {
        for (const retaceo of retaceosExistentes) {
          await tx.retaceo_detalle.deleteMany({
            where: { id_retaceo: retaceo.id_retaceo },
          });
          await tx.retaceo_importacion.delete({
            where: { id_retaceo: retaceo.id_retaceo },
          });
        }
      }

      // Array para acumular el retaceo de cada item
      const retaceosPorItem = new Map<number, Decimal>();
      detalles.forEach((d) => {
        retaceosPorItem.set(d.id_importacion_detalle, new Decimal(0));
      });

      // Procesar cada gasto - crear UN retaceo_importacion por gasto
      const retaceosCreados: any[] = [];
      for (const gasto of gastos) {
        const metodo = gasto.metodo_retaceo || 'VALOR';
        const monto_gasto = new Decimal(gasto.monto_local || gasto.monto);

        // Crear registro de retaceo para este gasto
        const retaceo = await tx.retaceo_importacion.create({
          data: {
            id_importacion,
            id_gasto: gasto.id_gasto,
            metodo_aplicado: metodo,
            monto_total_distribuir: monto_gasto,
            fecha_calculo: new Date(),
            calculado_por: id_usuario,
          },
        });

        retaceosCreados.push(retaceo);

        // Calcular distribución según el método para cada item
        for (const detalle of detalles) {
          let base_calculo = new Decimal(0);
          let porcentaje_asignado = new Decimal(0);

          switch (metodo) {
            case 'VALOR':
              // Distribuir proporcionalmente al valor
              base_calculo = new Decimal(detalle.subtotal_usd);
              porcentaje_asignado = base_calculo.dividedBy(totales.valor);
              break;

            case 'PESO':
              // Distribuir proporcionalmente al peso
              if (detalle.peso_kg && !new Decimal(detalle.peso_kg).isZero()) {
                base_calculo = new Decimal(detalle.peso_kg);
                porcentaje_asignado = base_calculo.dividedBy(totales.peso);
              }
              break;

            case 'VOLUMEN':
              // Distribuir proporcionalmente al volumen
              if (detalle.volumen_m3 && !new Decimal(detalle.volumen_m3).isZero()) {
                base_calculo = new Decimal(detalle.volumen_m3);
                porcentaje_asignado = base_calculo.dividedBy(totales.volumen);
              }
              break;

            case 'CANTIDAD':
              // Distribuir uniformemente por cantidad
              base_calculo = new Decimal(detalle.cantidad_ordenada);
              porcentaje_asignado = base_calculo.dividedBy(totales.cantidad);
              break;

            default:
              // Por defecto usar VALOR
              base_calculo = new Decimal(detalle.subtotal_usd);
              porcentaje_asignado = base_calculo.dividedBy(totales.valor);
              break;
          }

          // Calcular el monto asignado para este item desde este gasto
          const monto_asignado = monto_gasto.times(porcentaje_asignado);
          const monto_unitario = monto_asignado.dividedBy(detalle.cantidad_ordenada);

          // Acumular en el mapa
          const acumulado = retaceosPorItem.get(detalle.id_importacion_detalle) || new Decimal(0);
          retaceosPorItem.set(
            detalle.id_importacion_detalle,
            acumulado.plus(monto_asignado),
          );

          // Crear registro en retaceo_detalle
          await tx.retaceo_detalle.create({
            data: {
              id_retaceo: retaceo.id_retaceo,
              id_importacion_detalle: detalle.id_importacion_detalle,
              base_calculo: base_calculo,
              porcentaje_asignado: porcentaje_asignado,
              monto_asignado: monto_asignado,
              monto_unitario: monto_unitario,
            },
          });
        }
      }

      // Actualizar costo_unitario_final en cada detalle
      for (const [id_detalle, monto_retaceo_total] of retaceosPorItem.entries()) {
        const detalle = detalles.find((d) => d.id_importacion_detalle === id_detalle);
        if (!detalle) continue;

        // Costo unitario final = precio unitario local + (retaceo total / cantidad)
        const retaceo_por_unidad = monto_retaceo_total.dividedBy(detalle.cantidad_ordenada);

        // Manejar caso donde precio_unitario_local puede ser null
        const precio_local = detalle.precio_unitario_local
          ? new Decimal(detalle.precio_unitario_local)
          : new Decimal(0);

        const costo_unitario_final = precio_local.plus(retaceo_por_unidad);
        const costo_total_final = costo_unitario_final.times(detalle.cantidad_ordenada);

        await tx.importaciones_detalle.update({
          where: { id_importacion_detalle: id_detalle },
          data: {
            costo_unitario_final: costo_unitario_final,
            costo_total_final: costo_total_final,
          },
        });
      }

      return retaceosCreados;
    });

    // Registrar en el log
    await this.prisma.log.create({
      data: {
        accion: 'CALCULAR_RETACEO_IMPORTACION',
        id_usuario,
        descripcion: `Retaceo calculado para importación ${importacion.numero_orden}`,
      },
    });

    // Retornar los retaceos con su detalle
    return this.prisma.retaceo_importacion.findMany({
      where: { id_importacion },
      include: {
        detalle: {
          include: {
            detalle_importacion: true,
          },
        },
        gasto: true,
      },
    });
  }

  async getCountsByEstado(): Promise<any[]> {
    const counts = await this.prisma.importaciones.groupBy({
      by: ['estado'],
      _count: {
        id_importacion: true,
      },
    });

    const mappedCounts = counts.map((item) => ({
      estado: item.estado,
      cantidad: item._count.id_importacion,
    }));

    // Asegurarse de que todos los estados estén presentes, incluso si su contador es 0
    const allEstados = Object.values(estado_importacion);
    const finalCounts = allEstados.map((estado) => {
      const found = mappedCounts.find((item) => item.estado === estado);
      return found || { estado, cantidad: 0 };
    });

    return finalCounts;
  }
}
