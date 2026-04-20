// src/modules/facturacion/ciclos/ciclos.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import {
  CreateCicloDto,
  UpdateCicloDto,
  QueryCicloDto,
  UpdateClienteContactoDto,
  QueryNotificacionesGlobalDto,
} from './dto';
import { PaginationDto, PaginatedResult } from 'src/common/dto';
import { atcCicloFacturacion } from '@prisma/client';
import { validarTelefonoSV, validarEmail } from 'src/common/helpers';

@Injectable()
export class CiclosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crear un nuevo ciclo de facturación
   */
  async create(
    createCicloDto: CreateCicloDto,
    id_usuario: number,
  ): Promise<atcCicloFacturacion> {
    // Validar que no exista un ciclo con el mismo día de corte
    const existingCiclo = await this.prisma.atcCicloFacturacion.findFirst({
      where: {
        dia_corte: createCicloDto.dia_corte,
        estado: 'ACTIVO',
      },
    });

    if (existingCiclo) {
      throw new BadRequestException(
        `Ya existe un ciclo activo con día de corte ${createCicloDto.dia_corte}`,
      );
    }

    const ciclo = await this.prisma.atcCicloFacturacion.create({
      data: {
        nombre: createCicloDto.nombre,
        dia_corte: createCicloDto.dia_corte,
        dia_vencimiento: createCicloDto.dia_vencimiento,
        periodo_inicio: createCicloDto.periodo_inicio,
        periodo_fin: createCicloDto.periodo_fin,
      },
    });

    await this.prisma.logAction(
      'CREAR_CICLO_FACTURACION',
      id_usuario,
      `Ciclo creado: ${ciclo.nombre}`,
    );

    return ciclo;
  }

  /**
   * Listar ciclos con paginación y filtros
   */
  async findAll(
    queryDto: QueryCicloDto,
  ): Promise<PaginatedResult<atcCicloFacturacion & { _count: { contratos: number } }>> {
    const { page = 1, limit = 10, search, estado } = queryDto;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.nombre = { contains: search, mode: 'insensitive' };
    }

    if (estado) {
      where.estado = estado;
    }

    const [data, total] = await Promise.all([
      this.prisma.atcCicloFacturacion.findMany({
        where,
        skip,
        take: limit,
        include: {
          _count: {
            select: { contratos: true },
          },
        },
        orderBy: { dia_corte: 'asc' },
      }),
      this.prisma.atcCicloFacturacion.count({ where }),
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
   * Listar todos los ciclos activos (sin paginación, para dropdowns)
   */
  async findAllActive(): Promise<atcCicloFacturacion[]> {
    return this.prisma.atcCicloFacturacion.findMany({
      where: { estado: 'ACTIVO' },
      orderBy: { dia_corte: 'asc' },
    });
  }

  /**
   * Obtener un ciclo por ID
   */
  async findOne(id: number): Promise<atcCicloFacturacion> {
    const ciclo = await this.prisma.atcCicloFacturacion.findUnique({
      where: { id_ciclo: id },
      include: {
        _count: {
          select: { contratos: true },
        },
      },
    });

    if (!ciclo) {
      throw new NotFoundException(`Ciclo con ID ${id} no encontrado`);
    }

    return ciclo;
  }

  /**
   * Obtener los contratos de un ciclo con paginación
   */
  async findContratosByCiclo(id: number, paginationDto: PaginationDto) {
    const ciclo = await this.findOne(id);

    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const [contratos, total] = await Promise.all([
      this.prisma.atcContrato.findMany({
        where: { id_ciclo: id },
        skip,
        take: limit,
        include: {
          cliente: {
            select: {
              id_cliente: true,
              titular: true,
              telefono1: true,
              dui: true,
            },
          },
          plan: {
            select: {
              id_plan: true,
              nombre: true,
              precio: true,
            },
          },
          direccionServicio: {
            select: {
              direccion: true,
            },
          },
        },
        orderBy: { fecha_creacion: 'desc' },
      }),
      this.prisma.atcContrato.count({ where: { id_ciclo: id } }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      ciclo: {
        id_ciclo: ciclo.id_ciclo,
        nombre: ciclo.nombre,
        dia_corte: ciclo.dia_corte,
        dia_vencimiento: ciclo.dia_vencimiento,
        periodo_inicio: ciclo.periodo_inicio,
        periodo_fin: ciclo.periodo_fin,
      },
      contratos: {
        data: contratos,
        meta: {
          total,
          page,
          limit,
          totalPages,
        },
      },
    };
  }

  /**
   * Listar clientes del ciclo con validacion de telefono y correo
   */
  async findNotificacionesByCiclo(id: number) {
    await this.findOne(id);

    const contratos = await this.prisma.atcContrato.findMany({
      where: { id_ciclo: id },
      select: {
        cliente: {
          select: {
            id_cliente: true,
            titular: true,
            telefono1: true,
            telefono2: true,
            correo_electronico: true,
          },
        },
      },
      distinct: ['id_cliente'],
      orderBy: { id_cliente: 'asc' },
    });

    const clientes = contratos
      .map((c) => c.cliente)
      .filter((c) => !!c)
      .map((cliente) => this.evaluarContactoCliente(cliente));

    const resumen = {
      totalClientes: clientes.length,
      telefonosValidos: clientes.filter((c) => c.telefonoValido).length,
      telefonosInvalidos: clientes.filter((c) => !c.telefonoValido).length,
      correosValidos: clientes.filter((c) => c.correoValido).length,
      correosInvalidos: clientes.filter((c) => !c.correoValido).length,
    };

    return { resumen, clientes };
  }

  /**
   * Actualizar telefono y/o correo de un cliente del ciclo
   */
  async updateClienteContacto(
    idCiclo: number,
    idCliente: number,
    dto: UpdateClienteContactoDto,
    id_usuario: number,
  ) {
    await this.findOne(idCiclo);

    const contrato = await this.prisma.atcContrato.findFirst({
      where: { id_ciclo: idCiclo, id_cliente: idCliente },
      select: { id_contrato: true },
    });

    if (!contrato) {
      throw new NotFoundException(
        `El cliente ${idCliente} no pertenece al ciclo ${idCiclo}`,
      );
    }

    return this.aplicarUpdateContacto(idCliente, dto, id_usuario, idCiclo);
  }

  /**
   * Actualizar telefono y/o correo de un cliente sin restriccion de ciclo
   * (usado por la vista global de notificaciones)
   */
  async updateClienteContactoGlobal(
    idCliente: number,
    dto: UpdateClienteContactoDto,
    id_usuario: number,
  ) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id_cliente: idCliente },
      select: { id_cliente: true },
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente con ID ${idCliente} no encontrado`);
    }

    return this.aplicarUpdateContacto(idCliente, dto, id_usuario);
  }

  private async aplicarUpdateContacto(
    idCliente: number,
    dto: UpdateClienteContactoDto,
    id_usuario: number,
    idCiclo?: number,
  ) {
    if (dto.telefono1 === undefined && dto.correo_electronico === undefined) {
      throw new BadRequestException('Debe enviar al menos un campo a actualizar');
    }

    const data: { telefono1?: string; correo_electronico?: string } = {};

    if (dto.telefono1 !== undefined) {
      const v = validarTelefonoSV(dto.telefono1);
      if (!v.valido) {
        throw new BadRequestException(
          `Telefono invalido (${v.razon}): ${dto.telefono1}`,
        );
      }
      data.telefono1 = v.numeroLimpio;
    }

    if (dto.correo_electronico !== undefined) {
      const v = validarEmail(dto.correo_electronico);
      if (!v.valido) {
        throw new BadRequestException(
          `Correo invalido (${v.razon}): ${dto.correo_electronico}`,
        );
      }
      data.correo_electronico = dto.correo_electronico.trim();
    }

    const actualizado = await this.prisma.cliente.update({
      where: { id_cliente: idCliente },
      data,
      select: {
        id_cliente: true,
        titular: true,
        telefono1: true,
        telefono2: true,
        correo_electronico: true,
      },
    });

    const contexto =
      idCiclo !== undefined ? ` (ciclo ${idCiclo})` : ' (vista global)';
    await this.prisma.logAction(
      'EDITAR_CONTACTO_CLIENTE',
      id_usuario,
      `Contacto actualizado para cliente ${actualizado.titular}${contexto}`,
    );

    return this.evaluarContactoCliente(actualizado);
  }

  /**
   * Listar clientes de todos los ciclos (o uno filtrado) con validacion,
   * paginacion, busqueda por nombre y filtro por validez.
   */
  async findNotificacionesGlobal(dto: QueryNotificacionesGlobalDto) {
    const { page = 1, limit = 25, id_ciclo, filtro = 'TODOS', search } = dto;

    const cicloFiltro = Number.isFinite(id_ciclo) ? (id_ciclo as number) : undefined;

    if (cicloFiltro !== undefined) {
      await this.findOne(cicloFiltro);
    }

    const where: any = {};
    if (cicloFiltro !== undefined) {
      where.id_ciclo = cicloFiltro;
    }
    if (search && search.trim()) {
      where.cliente = {
        titular: { contains: search.trim(), mode: 'insensitive' },
      };
    }

    const contratos = await this.prisma.atcContrato.findMany({
      where,
      select: {
        cliente: {
          select: {
            id_cliente: true,
            titular: true,
            telefono1: true,
            telefono2: true,
            correo_electronico: true,
          },
        },
      },
      distinct: ['id_cliente'],
      orderBy: { id_cliente: 'asc' },
    });

    let clientes = contratos
      .map((c) => c.cliente)
      .filter((c) => !!c)
      .map((cliente) => this.evaluarContactoCliente(cliente));

    if (filtro !== 'TODOS') {
      clientes = clientes.filter((c) => {
        switch (filtro) {
          case 'TELEFONO_INVALIDO':
            return !c.telefonoValido;
          case 'CORREO_INVALIDO':
            return !c.correoValido;
          case 'AMBOS_INVALIDOS':
            return !c.telefonoValido && !c.correoValido;
          case 'TODOS_VALIDOS':
            return c.telefonoValido && c.correoValido;
          default:
            return true;
        }
      });
    }

    const resumen = {
      totalClientes: clientes.length,
      telefonosValidos: clientes.filter((c) => c.telefonoValido).length,
      telefonosInvalidos: clientes.filter((c) => !c.telefonoValido).length,
      correosValidos: clientes.filter((c) => c.correoValido).length,
      correosInvalidos: clientes.filter((c) => !c.correoValido).length,
    };

    const total = clientes.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const start = (page - 1) * limit;
    const paginados = clientes.slice(start, start + limit);

    return {
      resumen,
      clientes: paginados,
      meta: { total, page, limit, totalPages },
    };
  }

  private evaluarContactoCliente(cliente: {
    id_cliente: number;
    titular: string;
    telefono1: string | null;
    telefono2: string | null;
    correo_electronico: string | null;
  }) {
    const tel = validarTelefonoSV(cliente.telefono1);
    const tel2 = validarTelefonoSV(cliente.telefono2);
    const mail = validarEmail(cliente.correo_electronico);

    return {
      id: cliente.id_cliente,
      nombre: cliente.titular,
      telefono1: cliente.telefono1 ?? '',
      telefonoValido: tel.valido,
      telefonoLimpio: tel.numeroLimpio,
      telefonoRazon: tel.razon ?? '',
      telefono2: cliente.telefono2 ?? '',
      telefono2Valido: tel2.valido,
      telefono2Limpio: tel2.numeroLimpio,
      telefono2Razon: tel2.razon ?? '',
      correoElectronico: cliente.correo_electronico ?? '',
      correoValido: mail.valido,
      correoRazon: mail.razon ?? '',
    };
  }

  /**
   * Actualizar un ciclo
   */
  async update(
    id: number,
    updateCicloDto: UpdateCicloDto,
    id_usuario: number,
  ): Promise<atcCicloFacturacion> {
    const existingCiclo = await this.findOne(id);

    // Si se está cambiando el día de corte, validar que no exista otro ciclo con ese día
    if (
      updateCicloDto.dia_corte &&
      updateCicloDto.dia_corte !== existingCiclo.dia_corte
    ) {
      const duplicateCiclo = await this.prisma.atcCicloFacturacion.findFirst({
        where: {
          dia_corte: updateCicloDto.dia_corte,
          estado: 'ACTIVO',
          NOT: { id_ciclo: id },
        },
      });

      if (duplicateCiclo) {
        throw new BadRequestException(
          `Ya existe un ciclo activo con día de corte ${updateCicloDto.dia_corte}`,
        );
      }
    }

    const ciclo = await this.prisma.atcCicloFacturacion.update({
      where: { id_ciclo: id },
      data: updateCicloDto,
    });

    await this.prisma.logAction(
      'ACTUALIZAR_CICLO_FACTURACION',
      id_usuario,
      `Ciclo actualizado: ${ciclo.nombre}`,
    );

    return ciclo;
  }

  /**
   * Eliminar un ciclo (soft delete)
   */
  async remove(id: number, id_usuario: number): Promise<atcCicloFacturacion> {
    const ciclo = await this.findOne(id);

    // Verificar si tiene contratos asociados
    const contratosCount = await this.prisma.atcContrato.count({
      where: { id_ciclo: id },
    });

    if (contratosCount > 0) {
      throw new BadRequestException(
        `No se puede eliminar el ciclo porque tiene ${contratosCount} contrato(s) asociado(s)`,
      );
    }

    const updatedCiclo = await this.prisma.atcCicloFacturacion.update({
      where: { id_ciclo: id },
      data: { estado: 'INACTIVO' },
    });

    await this.prisma.logAction(
      'ELIMINAR_CICLO_FACTURACION',
      id_usuario,
      `Ciclo eliminado: ${ciclo.nombre}`,
    );

    return updatedCiclo;
  }
}
