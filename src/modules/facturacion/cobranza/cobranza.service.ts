// src/modules/facturacion/cobranza/cobranza.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import {
  bucket_mora,
  estado_asignacion_cobranza,
  Prisma,
} from '@prisma/client';
import {
  ALL_BUCKETS,
  calcularBucket,
  calcularDiasAtraso,
  rangoFechasBucket,
} from './helpers/bucket-mora.helper';
import { getInicioDiaElSalvador } from 'src/common/helpers/dates.helper';
import { DistribuirAsignacionesDto } from './dto/distribuir-asignaciones.dto';
import { CrearNotaDto } from './dto/crear-nota.dto';
import { FacturasVencidasQueryDto } from './dto/facturas-vencidas-query.dto';
import { MisAsignacionesQueryDto } from './dto/mis-asignaciones-query.dto';
import { ReasignarDto } from './dto/reasignar.dto';
import { CerrarAsignacionDto } from './dto/cerrar-asignacion.dto';

@Injectable()
export class CobranzaService {
  private readonly logger = new Logger(CobranzaService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Helpers internos
  // ---------------------------------------------------------------------------

  private async ensureCiclo(id_ciclo: number) {
    const ciclo = await this.prisma.atcCicloFacturacion.findUnique({
      where: { id_ciclo },
    });
    if (!ciclo) throw new NotFoundException(`Ciclo ${id_ciclo} no encontrado`);
    return ciclo;
  }

  /**
   * Devuelve el filtro Prisma base para facturas vencidas de un ciclo.
   */
  private whereFacturasVencidasCiclo(id_ciclo: number) {
    const inicioHoy = getInicioDiaElSalvador();
    return {
      estado: 'ACTIVO' as const,
      estado_pago: { in: ['PENDIENTE', 'VENCIDA', 'PARCIAL'] as const },
      fecha_vencimiento: { lt: inicioHoy, not: null },
      contrato: {
        id_ciclo,
      },
    } satisfies Prisma.facturaDirectaWhereInput;
  }

  // ---------------------------------------------------------------------------
  // 1) Resumen por buckets
  // ---------------------------------------------------------------------------
  async getResumenMora(id_ciclo: number) {
    await this.ensureCiclo(id_ciclo);

    const facturas = await this.prisma.facturaDirecta.findMany({
      where: this.whereFacturasVencidasCiclo(id_ciclo),
      select: {
        id_factura_directa: true,
        total: true,
        monto_mora: true,
        fecha_vencimiento: true,
        id_cliente: true,
        id_cliente_directo: true,
        cobranzaAsignaciones: {
          where: { estado: 'ACTIVA' },
          select: { id_asignacion: true },
        },
      },
    });

    const inicioHoy = getInicioDiaElSalvador();

    type Acc = {
      cantidad_facturas: number;
      monto_total: number;
      clientes: Set<string>;
      cantidad_asignadas: number;
    };
    const init = (): Acc => ({
      cantidad_facturas: 0,
      monto_total: 0,
      clientes: new Set<string>(),
      cantidad_asignadas: 0,
    });
    const buckets: Record<bucket_mora, Acc> = {
      DIAS_1_30: init(),
      DIAS_31_60: init(),
      DIAS_61_90: init(),
      DIAS_91_MAS: init(),
    };

    for (const f of facturas) {
      if (!f.fecha_vencimiento) continue;
      const b = calcularBucket(f.fecha_vencimiento, inicioHoy);
      const acc = buckets[b];
      acc.cantidad_facturas += 1;
      acc.monto_total += Number(f.total) + Number(f.monto_mora);
      acc.clientes.add(
        f.id_cliente
          ? `c:${f.id_cliente}`
          : f.id_cliente_directo
            ? `d:${f.id_cliente_directo}`
            : `f:${f.id_factura_directa}`,
      );
      if (f.cobranzaAsignaciones.length > 0) acc.cantidad_asignadas += 1;
    }

    return {
      id_ciclo,
      generado_en: new Date(),
      buckets: ALL_BUCKETS.map((b) => ({
        bucket: b,
        cantidad_facturas: buckets[b].cantidad_facturas,
        monto_total: Math.round(buckets[b].monto_total * 100) / 100,
        cantidad_clientes: buckets[b].clientes.size,
        cantidad_asignadas: buckets[b].cantidad_asignadas,
        cantidad_sin_asignar:
          buckets[b].cantidad_facturas - buckets[b].cantidad_asignadas,
      })),
      totales: {
        cantidad_facturas: facturas.length,
        monto_total:
          Math.round(
            facturas.reduce(
              (s, f) => s + Number(f.total) + Number(f.monto_mora),
              0,
            ) * 100,
          ) / 100,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 2) Lista de facturas vencidas (paginada)
  // ---------------------------------------------------------------------------
  async getFacturasVencidas(
    id_ciclo: number,
    query: FacturasVencidasQueryDto,
  ) {
    await this.ensureCiclo(id_ciclo);
    const { page = 1, limit = 10, search, bucket, asignado, id_gestor } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.facturaDirectaWhereInput = {
      ...this.whereFacturasVencidasCiclo(id_ciclo),
    };

    if (bucket) {
      const { gte, lte } = rangoFechasBucket(bucket);
      where.fecha_vencimiento = { gte, lte };
    }

    if (search) {
      where.OR = [
        { numero_factura: { contains: search, mode: 'insensitive' } },
        { cliente_nombre: { contains: search, mode: 'insensitive' } },
        { cliente: { titular: { contains: search, mode: 'insensitive' } } },
        { contrato: { codigo: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (asignado === 'true') {
      where.cobranzaAsignaciones = {
        some: { estado: 'ACTIVA', ...(id_gestor ? { id_gestor } : {}) },
      };
    } else if (asignado === 'false') {
      where.cobranzaAsignaciones = { none: { estado: 'ACTIVA' } };
    } else if (id_gestor) {
      where.cobranzaAsignaciones = {
        some: { estado: 'ACTIVA', id_gestor },
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.facturaDirecta.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fecha_vencimiento: 'asc' },
        select: {
          id_factura_directa: true,
          numero_factura: true,
          total: true,
          monto_mora: true,
          fecha_vencimiento: true,
          estado_pago: true,
          cliente_nombre: true,
          cliente_telefono: true,
          cliente: {
            select: {
              id_cliente: true,
              titular: true,
              telefono1: true,
              correo_electronico: true,
            },
          },
          contrato: { select: { id_contrato: true, codigo: true } },
          cobranzaAsignaciones: {
            where: { estado: 'ACTIVA' },
            include: {
              gestor: {
                select: {
                  id_usuario: true,
                  nombres: true,
                  apellidos: true,
                  usuario: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.facturaDirecta.count({ where }),
    ]);

    const enriched = data.map((f) => {
      const dias_atraso = f.fecha_vencimiento
        ? calcularDiasAtraso(f.fecha_vencimiento)
        : 0;
      const bucket_actual = f.fecha_vencimiento
        ? calcularBucket(f.fecha_vencimiento)
        : null;
      const asignacion = f.cobranzaAsignaciones[0] ?? null;
      return {
        id_factura_directa: f.id_factura_directa,
        numero_factura: f.numero_factura,
        total: f.total,
        monto_mora: f.monto_mora,
        fecha_vencimiento: f.fecha_vencimiento,
        estado_pago: f.estado_pago,
        dias_atraso,
        bucket_actual,
        cliente: f.cliente
          ? {
              id_cliente: f.cliente.id_cliente,
              nombre: f.cliente.titular,
              telefono: f.cliente.telefono1,
              correo: f.cliente.correo_electronico,
            }
          : {
              id_cliente: null,
              nombre: f.cliente_nombre,
              telefono: f.cliente_telefono,
              correo: null,
            },
        contrato: f.contrato,
        asignacion,
      };
    });

    return {
      data: enriched,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 3) Listar gestores candidatos
  // ---------------------------------------------------------------------------
  async getGestores() {
    // Por ahora cualquier usuario activo es gestor candidato.
    // TODO: filtrar por permiso 'facturacion.cobranza:gestionar' cuando se requiera.
    const gestores = await this.prisma.usuarios.findMany({
      where: { estado: 'ACTIVO' },
      select: {
        id_usuario: true,
        nombres: true,
        apellidos: true,
        usuario: true,
        id_rol: true,
        roles: { select: { nombre: true } },
        _count: {
          select: {
            cobranza_asignaciones_gestor: { where: { estado: 'ACTIVA' } },
          },
        },
      },
      orderBy: [{ nombres: 'asc' }, { apellidos: 'asc' }],
    });

    return gestores.map((g) => ({
      id_usuario: g.id_usuario,
      nombre_completo: `${g.nombres} ${g.apellidos}`.trim(),
      usuario: g.usuario,
      rol: g.roles?.nombre,
      asignaciones_activas: g._count.cobranza_asignaciones_gestor,
    }));
  }

  // ---------------------------------------------------------------------------
  // 4) Distribuir Round Robin
  // ---------------------------------------------------------------------------
  async distribuir(
    id_ciclo: number,
    dto: DistribuirAsignacionesDto,
    id_usuario_asignador: number,
  ) {
    await this.ensureCiclo(id_ciclo);

    // Validar que los gestores existan y estén activos
    const gestores = await this.prisma.usuarios.findMany({
      where: { id_usuario: { in: dto.id_gestores }, estado: 'ACTIVO' },
      select: { id_usuario: true },
    });
    if (gestores.length !== dto.id_gestores.length) {
      throw new BadRequestException(
        'Uno o más gestores no existen o están inactivos',
      );
    }

    const where: Prisma.facturaDirectaWhereInput = {
      ...this.whereFacturasVencidasCiclo(id_ciclo),
    };

    if (dto.solo_sin_asignar !== false) {
      where.cobranzaAsignaciones = { none: { estado: 'ACTIVA' } };
    }

    const facturas = await this.prisma.facturaDirecta.findMany({
      where,
      select: { id_factura_directa: true, fecha_vencimiento: true },
      orderBy: { fecha_vencimiento: 'asc' },
    });

    // Filtrar por buckets si se especificaron
    const bucketsSet = dto.buckets && dto.buckets.length > 0
      ? new Set(dto.buckets)
      : null;

    const candidatas = facturas.filter((f) => {
      if (!f.fecha_vencimiento) return false;
      if (!bucketsSet) return true;
      return bucketsSet.has(calcularBucket(f.fecha_vencimiento));
    });

    if (candidatas.length === 0) {
      return {
        id_ciclo,
        total_asignadas: 0,
        por_gestor: dto.id_gestores.map((id) => ({ id_gestor: id, cantidad: 0 })),
        mensaje: 'No hay facturas elegibles para distribuir con los filtros indicados',
      };
    }

    const conteo: Record<number, number> = Object.fromEntries(
      dto.id_gestores.map((id) => [id, 0]),
    );

    const data = candidatas.map((f, idx) => {
      const id_gestor = dto.id_gestores[idx % dto.id_gestores.length];
      conteo[id_gestor] += 1;
      return {
        id_factura_directa: f.id_factura_directa,
        id_ciclo,
        id_gestor,
        id_usuario_asignador,
        bucket_inicial: calcularBucket(f.fecha_vencimiento!),
        estado: 'ACTIVA' as estado_asignacion_cobranza,
      };
    });

    await this.prisma.$transaction(async (tx) => {
      // Si solo_sin_asignar=false: cerrar previas activas como REASIGNADA
      if (dto.solo_sin_asignar === false) {
        await tx.cobranza_asignacion.updateMany({
          where: {
            id_factura_directa: { in: candidatas.map((c) => c.id_factura_directa) },
            estado: 'ACTIVA',
          },
          data: {
            estado: 'REASIGNADA',
            fecha_cierre: new Date(),
            motivo_cierre: 'Reasignación masiva por distribución',
          },
        });
      }
      await tx.cobranza_asignacion.createMany({ data });
    });

    await this.prisma.logAction(
      'COBRANZA_DISTRIBUIR',
      id_usuario_asignador,
      `Ciclo ${id_ciclo}: ${candidatas.length} facturas distribuidas entre ${dto.id_gestores.length} gestores`,
    );

    return {
      id_ciclo,
      total_asignadas: candidatas.length,
      por_gestor: dto.id_gestores.map((id) => ({
        id_gestor: id,
        cantidad: conteo[id],
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // 5) Reasignar
  // ---------------------------------------------------------------------------
  async reasignar(
    id_asignacion: number,
    dto: ReasignarDto,
    id_usuario_asignador: number,
  ) {
    const actual = await this.prisma.cobranza_asignacion.findUnique({
      where: { id_asignacion },
    });
    if (!actual) throw new NotFoundException(`Asignación ${id_asignacion} no encontrada`);
    if (actual.estado !== 'ACTIVA') {
      throw new BadRequestException('Solo se pueden reasignar asignaciones ACTIVAS');
    }

    const nuevoGestor = await this.prisma.usuarios.findUnique({
      where: { id_usuario: dto.id_gestor_nuevo },
    });
    if (!nuevoGestor || nuevoGestor.estado !== 'ACTIVO') {
      throw new BadRequestException('Gestor nuevo no existe o está inactivo');
    }

    const nueva = await this.prisma.$transaction(async (tx) => {
      await tx.cobranza_asignacion.update({
        where: { id_asignacion },
        data: {
          estado: 'REASIGNADA',
          fecha_cierre: new Date(),
          motivo_cierre: dto.motivo,
        },
      });
      return tx.cobranza_asignacion.create({
        data: {
          id_factura_directa: actual.id_factura_directa,
          id_ciclo: actual.id_ciclo,
          id_gestor: dto.id_gestor_nuevo,
          id_usuario_asignador,
          bucket_inicial: actual.bucket_inicial,
          estado: 'ACTIVA',
        },
      });
    });

    await this.prisma.logAction(
      'COBRANZA_REASIGNAR',
      id_usuario_asignador,
      `Asignación ${id_asignacion} → nueva ${nueva.id_asignacion} (gestor ${dto.id_gestor_nuevo})`,
    );

    return nueva;
  }

  // ---------------------------------------------------------------------------
  // 6) Cerrar asignación
  // ---------------------------------------------------------------------------
  async cerrar(
    id_asignacion: number,
    dto: CerrarAsignacionDto,
    id_usuario: number,
  ) {
    const actual = await this.prisma.cobranza_asignacion.findUnique({
      where: { id_asignacion },
    });
    if (!actual) throw new NotFoundException(`Asignación ${id_asignacion} no encontrada`);
    if (actual.estado !== 'ACTIVA') {
      throw new BadRequestException('Solo se pueden cerrar asignaciones ACTIVAS');
    }

    const updated = await this.prisma.cobranza_asignacion.update({
      where: { id_asignacion },
      data: {
        estado: dto.estado,
        fecha_cierre: new Date(),
        motivo_cierre: dto.motivo,
      },
    });

    await this.prisma.logAction(
      'COBRANZA_CERRAR',
      id_usuario,
      `Asignación ${id_asignacion} cerrada como ${dto.estado}: ${dto.motivo}`,
    );

    return updated;
  }

  // ---------------------------------------------------------------------------
  // 7) Mis asignaciones
  // ---------------------------------------------------------------------------
  async getMisAsignaciones(id_usuario: number, query: MisAsignacionesQueryDto) {
    const { page = 1, limit = 10, search, id_ciclo, bucket } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.cobranza_asignacionWhereInput = {
      id_gestor: id_usuario,
      estado: 'ACTIVA',
    };
    if (id_ciclo) where.id_ciclo = id_ciclo;

    if (bucket) {
      const { gte, lte } = rangoFechasBucket(bucket);
      where.facturaDirecta = {
        is: { fecha_vencimiento: { gte, lte } },
      };
    }

    if (search) {
      where.facturaDirecta = {
        is: {
          ...(where.facturaDirecta?.is ?? {}),
          OR: [
            { numero_factura: { contains: search, mode: 'insensitive' } },
            { cliente_nombre: { contains: search, mode: 'insensitive' } },
            { cliente: { titular: { contains: search, mode: 'insensitive' } } },
          ],
        },
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.cobranza_asignacion.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fecha_asignacion: 'desc' },
        include: {
          ciclo: { select: { id_ciclo: true, nombre: true } },
          facturaDirecta: {
            select: {
              id_factura_directa: true,
              numero_factura: true,
              total: true,
              monto_mora: true,
              fecha_vencimiento: true,
              estado_pago: true,
              cliente_nombre: true,
              cliente_telefono: true,
              cliente: {
                select: {
                  id_cliente: true,
                  titular: true,
                  telefono1: true,
                  correo_electronico: true,
                },
              },
              contrato: { select: { id_contrato: true, codigo: true } },
            },
          },
          notas: {
            orderBy: { fecha_creacion: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.cobranza_asignacion.count({ where }),
    ]);

    const enriched = data.map((a) => {
      const f = a.facturaDirecta;
      const dias_atraso = f?.fecha_vencimiento
        ? calcularDiasAtraso(f.fecha_vencimiento)
        : 0;
      return {
        id_asignacion: a.id_asignacion,
        id_ciclo: a.id_ciclo,
        ciclo: a.ciclo,
        bucket_inicial: a.bucket_inicial,
        bucket_actual: f?.fecha_vencimiento ? calcularBucket(f.fecha_vencimiento) : null,
        dias_atraso,
        fecha_asignacion: a.fecha_asignacion,
        factura: {
          id_factura_directa: f.id_factura_directa,
          numero_factura: f.numero_factura,
          total: f.total,
          monto_mora: f.monto_mora,
          fecha_vencimiento: f.fecha_vencimiento,
          estado_pago: f.estado_pago,
        },
        cliente: f.cliente
          ? {
              id_cliente: f.cliente.id_cliente,
              nombre: f.cliente.titular,
              telefono: f.cliente.telefono1,
              correo: f.cliente.correo_electronico,
            }
          : {
              id_cliente: null,
              nombre: f.cliente_nombre,
              telefono: f.cliente_telefono,
              correo: null,
            },
        contrato: f.contrato,
        ultima_nota: a.notas[0] ?? null,
      };
    });

    return {
      data: enriched,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 8) Detalle de una asignación
  // ---------------------------------------------------------------------------
  async getAsignacionDetalle(id_asignacion: number) {
    const a = await this.prisma.cobranza_asignacion.findUnique({
      where: { id_asignacion },
      include: {
        ciclo: true,
        gestor: {
          select: { id_usuario: true, nombres: true, apellidos: true, usuario: true },
        },
        asignador: {
          select: { id_usuario: true, nombres: true, apellidos: true, usuario: true },
        },
        facturaDirecta: {
          include: {
            cliente: true,
            contrato: { include: { plan: true, direccionServicio: true } },
            cuenta_por_cobrar: true,
          },
        },
        notas: {
          orderBy: { fecha_creacion: 'desc' },
          include: {
            usuario: {
              select: {
                id_usuario: true,
                nombres: true,
                apellidos: true,
                usuario: true,
              },
            },
          },
        },
      },
    });
    if (!a) throw new NotFoundException(`Asignación ${id_asignacion} no encontrada`);

    const f = a.facturaDirecta;
    const dias_atraso = f.fecha_vencimiento ? calcularDiasAtraso(f.fecha_vencimiento) : 0;
    const bucket_actual = f.fecha_vencimiento ? calcularBucket(f.fecha_vencimiento) : null;

    return {
      ...a,
      dias_atraso,
      bucket_actual,
    };
  }

  // ---------------------------------------------------------------------------
  // 9) Crear nota
  // ---------------------------------------------------------------------------
  async crearNota(id_asignacion: number, dto: CrearNotaDto, id_usuario: number) {
    const a = await this.prisma.cobranza_asignacion.findUnique({
      where: { id_asignacion },
      select: { id_asignacion: true, id_gestor: true, estado: true },
    });
    if (!a) throw new NotFoundException(`Asignación ${id_asignacion} no encontrada`);
    if (a.estado !== 'ACTIVA') {
      throw new BadRequestException('No se pueden agregar notas a una asignación cerrada');
    }
    if (a.id_gestor !== id_usuario) {
      // Permitir a administradores (id_rol=1) registrar notas en nombre de cualquier gestor.
      const usuario = await this.prisma.usuarios.findUnique({
        where: { id_usuario },
        select: { id_rol: true },
      });
      if (!usuario || usuario.id_rol !== 1) {
        throw new ForbiddenException('Solo el gestor asignado puede registrar notas');
      }
    }

    if (dto.tipo === 'PROMESA_PAGO' && (!dto.fecha_promesa || !dto.monto_promesa)) {
      throw new BadRequestException(
        'Las notas de tipo PROMESA_PAGO requieren fecha_promesa y monto_promesa',
      );
    }

    const nota = await this.prisma.cobranza_nota.create({
      data: {
        id_asignacion,
        tipo: dto.tipo,
        descripcion: dto.descripcion,
        fecha_promesa: dto.fecha_promesa ? new Date(dto.fecha_promesa) : null,
        monto_promesa: dto.monto_promesa ?? null,
        id_usuario,
      },
      include: {
        usuario: {
          select: { id_usuario: true, nombres: true, apellidos: true, usuario: true },
        },
      },
    });

    return nota;
  }

  // ---------------------------------------------------------------------------
  // 10) Listar notas
  // ---------------------------------------------------------------------------
  async getNotas(id_asignacion: number) {
    const exists = await this.prisma.cobranza_asignacion.findUnique({
      where: { id_asignacion },
      select: { id_asignacion: true },
    });
    if (!exists) throw new NotFoundException(`Asignación ${id_asignacion} no encontrada`);

    return this.prisma.cobranza_nota.findMany({
      where: { id_asignacion },
      orderBy: { fecha_creacion: 'desc' },
      include: {
        usuario: {
          select: { id_usuario: true, nombres: true, apellidos: true, usuario: true },
        },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // 11) Dashboard de recuperación
  // ---------------------------------------------------------------------------
  async getDashboard(id_ciclo: number) {
    await this.ensureCiclo(id_ciclo);

    // Mora viva en este ciclo
    const facturasVivas = await this.prisma.facturaDirecta.findMany({
      where: this.whereFacturasVencidasCiclo(id_ciclo),
      select: {
        id_factura_directa: true,
        total: true,
        monto_mora: true,
        fecha_vencimiento: true,
      },
    });
    const mora_total =
      Math.round(
        facturasVivas.reduce(
          (s, f) => s + Number(f.total) + Number(f.monto_mora),
          0,
        ) * 100,
      ) / 100;

    // Asignaciones del ciclo cerradas como pagadas
    const asignaciones = await this.prisma.cobranza_asignacion.findMany({
      where: { id_ciclo },
      include: {
        gestor: {
          select: { id_usuario: true, nombres: true, apellidos: true },
        },
        facturaDirecta: { select: { total: true, monto_mora: true } },
      },
    });

    let mora_recuperada = 0;
    const porGestor: Record<
      number,
      { id_gestor: number; nombre: string; asignadas: number; recuperadas: number; monto_recuperado: number }
    > = {};

    for (const a of asignaciones) {
      const id = a.id_gestor;
      if (!porGestor[id]) {
        porGestor[id] = {
          id_gestor: id,
          nombre: `${a.gestor.nombres} ${a.gestor.apellidos}`.trim(),
          asignadas: 0,
          recuperadas: 0,
          monto_recuperado: 0,
        };
      }
      if (a.estado !== 'REASIGNADA') {
        porGestor[id].asignadas += 1;
      }
      if (a.estado === 'CERRADA_PAGADA') {
        porGestor[id].recuperadas += 1;
        const monto = Number(a.facturaDirecta.total) + Number(a.facturaDirecta.monto_mora);
        porGestor[id].monto_recuperado += monto;
        mora_recuperada += monto;
      }
    }
    mora_recuperada = Math.round(mora_recuperada * 100) / 100;

    // Facturas por bucket (vivo)
    const inicioHoy = getInicioDiaElSalvador();
    const facturas_por_bucket: Record<bucket_mora, number> = {
      DIAS_1_30: 0,
      DIAS_31_60: 0,
      DIAS_61_90: 0,
      DIAS_91_MAS: 0,
    };
    for (const f of facturasVivas) {
      if (!f.fecha_vencimiento) continue;
      facturas_por_bucket[calcularBucket(f.fecha_vencimiento, inicioHoy)] += 1;
    }

    const denominador = mora_total + mora_recuperada;
    const porcentaje_recuperacion =
      denominador > 0 ? Math.round((mora_recuperada / denominador) * 10000) / 100 : 0;

    return {
      id_ciclo,
      generado_en: new Date(),
      mora_total,
      mora_recuperada,
      mora_pendiente: mora_total,
      porcentaje_recuperacion,
      facturas_por_bucket: ALL_BUCKETS.map((b) => ({
        bucket: b,
        cantidad: facturas_por_bucket[b],
      })),
      top_gestores: Object.values(porGestor)
        .map((g) => ({
          ...g,
          monto_recuperado: Math.round(g.monto_recuperado * 100) / 100,
          porcentaje:
            g.asignadas > 0
              ? Math.round((g.recuperadas / g.asignadas) * 10000) / 100
              : 0,
        }))
        .sort((a, b) => b.monto_recuperado - a.monto_recuperado),
    };
  }
}
