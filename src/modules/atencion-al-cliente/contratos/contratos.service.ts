// src/modules/atencion-al-cliente/contratos/contratos.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateContratoDto } from './dto/create-contrato.dto';
import { UpdateContratoDto } from './dto/update-contrato.dto';
import { atcContrato } from '@prisma/client';
import { PaginationDto, PaginatedResult } from 'src/common/dto';
import { OrdenesTrabajoService } from '../ordenes-trabajo/ordenes-trabajo.service';
import { TipoOrden } from '../ordenes-trabajo/dto/create-orden.dto';

@Injectable()
export class ContratosService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => OrdenesTrabajoService))
    private readonly ordenesTrabajoService: OrdenesTrabajoService,
  ) {}

  /**
   * Genera el código de contrato automático con formato CTR-YYYYMM-#####
   */
  private async generateCodigoContrato(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `CTR-${year}${month}-`;

    // Buscar el último contrato del mes actual
    const lastContrato = await this.prisma.atcContrato.findFirst({
      where: {
        codigo: {
          startsWith: prefix,
        },
      },
      orderBy: {
        codigo: 'desc',
      },
    });

    let nextNumber = 1;
    if (lastContrato) {
      const lastNumber = parseInt(lastContrato.codigo.split('-').pop() || '0');
      nextNumber = lastNumber + 1;
    }

    return `${prefix}${String(nextNumber).padStart(5, '0')}`;
  }

  async create(
    createContratoDto: CreateContratoDto,
    id_usuario: number,
  ): Promise<atcContrato> {
    // Validar que el cliente exista
    const cliente = await this.prisma.cliente.findUnique({
      where: { id_cliente: createContratoDto.id_cliente },
    });
    if (!cliente) {
      throw new NotFoundException(
        `Cliente con ID ${createContratoDto.id_cliente} no encontrado`,
      );
    }

    // Validar que el plan exista
    const plan = await this.prisma.atcPlan.findUnique({
      where: { id_plan: createContratoDto.id_plan },
    });
    if (!plan) {
      throw new NotFoundException(
        `Plan con ID ${createContratoDto.id_plan} no encontrado`,
      );
    }

    // Validar que el ciclo exista
    const ciclo = await this.prisma.atcCicloFacturacion.findUnique({
      where: { id_ciclo: createContratoDto.id_ciclo },
    });
    if (!ciclo) {
      throw new NotFoundException(
        `Ciclo de facturación con ID ${createContratoDto.id_ciclo} no encontrado`,
      );
    }

    // Validar que la dirección pertenezca al cliente
    const direccion = await this.prisma.clienteDirecciones.findFirst({
      where: {
        id_cliente_direccion: createContratoDto.id_direccion_servicio,
        id_cliente: createContratoDto.id_cliente,
        estado: 'ACTIVO',
      },
    });
    if (!direccion) {
      throw new BadRequestException(
        `La dirección con ID ${createContratoDto.id_direccion_servicio} no pertenece al cliente o no está activa`,
      );
    }

    // Generar código automático
    const codigo = await this.generateCodigoContrato();

    // Crear el contrato inicialmente sin orden de trabajo
    const contrato = await this.prisma.atcContrato.create({
      data: {
        codigo,
        id_cliente: createContratoDto.id_cliente,
        id_plan: createContratoDto.id_plan,
        id_ciclo: createContratoDto.id_ciclo,
        id_direccion_servicio: createContratoDto.id_direccion_servicio,
        fecha_venta: createContratoDto.fecha_venta
          ? new Date(createContratoDto.fecha_venta)
          : new Date(),
        meses_contrato: createContratoDto.meses_contrato || 12,
        id_usuario_creador: id_usuario,
      },
    });

    // Crear automáticamente la Orden de Trabajo de Instalación
    const ordenInstalacion = await this.ordenesTrabajoService.create(
      {
        tipo: TipoOrden.INSTALACION,
        id_cliente: createContratoDto.id_cliente,
        id_direccion_servicio: createContratoDto.id_direccion_servicio,
        observaciones_tecnico: `Instalación para contrato ${codigo}`,
      },
      id_usuario,
    );

    // Actualizar el contrato con el id de la orden de trabajo
    const contratoActualizado = await this.prisma.atcContrato.update({
      where: { id_contrato: contrato.id_contrato },
      data: { id_orden_trabajo: ordenInstalacion.id_orden },
      include: this.getIncludeRelations(),
    });

    // Registrar en el log
    await this.prisma.logAction(
      'CREAR_CONTRATO',
      id_usuario,
      `Contrato creado: ${contratoActualizado.codigo} - Cliente: ${cliente.titular} - OT: ${ordenInstalacion.codigo}`,
    );

    return contratoActualizado;
  }

  async findAll(
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<atcContrato>> {
    const { page = 1, limit = 10, search = '' } = paginationDto;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { codigo: { contains: search, mode: 'insensitive' } },
        { cliente: { titular: { contains: search, mode: 'insensitive' } } },
        { cliente: { dui: { contains: search, mode: 'insensitive' } } },
        { plan: { nombre: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.atcContrato.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fecha_creacion: 'desc' },
        include: this.getIncludeRelations(),
      }),
      this.prisma.atcContrato.count({ where }),
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

  async findOne(id: number): Promise<atcContrato> {
    const contrato = await this.prisma.atcContrato.findUnique({
      where: { id_contrato: id },
      include: this.getIncludeRelations(),
    });

    if (!contrato) {
      throw new NotFoundException(`Contrato con ID ${id} no encontrado`);
    }

    return contrato;
  }

  async findByCliente(id_cliente: number): Promise<atcContrato[]> {
    // Verificar que el cliente exista
    const cliente = await this.prisma.cliente.findUnique({
      where: { id_cliente },
    });
    if (!cliente) {
      throw new NotFoundException(`Cliente con ID ${id_cliente} no encontrado`);
    }

    return this.prisma.atcContrato.findMany({
      where: { id_cliente },
      orderBy: { fecha_creacion: 'desc' },
      include: this.getIncludeRelations(),
    });
  }

  async findByCodigo(codigo: string): Promise<atcContrato | null> {
    return this.prisma.atcContrato.findUnique({
      where: { codigo },
      include: this.getIncludeRelations(),
    });
  }

  async update(
    id: number,
    updateContratoDto: UpdateContratoDto,
    id_usuario: number,
  ): Promise<atcContrato> {
    const existingContrato = await this.findOne(id);

    // Validar plan si se actualiza
    if (
      updateContratoDto.id_plan &&
      updateContratoDto.id_plan !== existingContrato.id_plan
    ) {
      const plan = await this.prisma.atcPlan.findUnique({
        where: { id_plan: updateContratoDto.id_plan },
      });
      if (!plan) {
        throw new NotFoundException(
          `Plan con ID ${updateContratoDto.id_plan} no encontrado`,
        );
      }
    }

    // Validar ciclo si se actualiza
    if (
      updateContratoDto.id_ciclo &&
      updateContratoDto.id_ciclo !== existingContrato.id_ciclo
    ) {
      const ciclo = await this.prisma.atcCicloFacturacion.findUnique({
        where: { id_ciclo: updateContratoDto.id_ciclo },
      });
      if (!ciclo) {
        throw new NotFoundException(
          `Ciclo de facturación con ID ${updateContratoDto.id_ciclo} no encontrado`,
        );
      }
    }

    // Validar dirección si se actualiza
    if (
      updateContratoDto.id_direccion_servicio &&
      updateContratoDto.id_direccion_servicio !==
        existingContrato.id_direccion_servicio
    ) {
      const direccion = await this.prisma.clienteDirecciones.findFirst({
        where: {
          id_cliente_direccion: updateContratoDto.id_direccion_servicio,
          id_cliente: existingContrato.id_cliente,
          estado: 'ACTIVO',
        },
      });
      if (!direccion) {
        throw new BadRequestException(
          `La dirección con ID ${updateContratoDto.id_direccion_servicio} no pertenece al cliente o no está activa`,
        );
      }
    }

    const {
      fecha_venta,
      fecha_instalacion,
      fecha_inicio_contrato,
      fecha_fin_contrato,
      ...rest
    } = updateContratoDto;

    const contrato = await this.prisma.atcContrato.update({
      where: { id_contrato: id },
      data: {
        ...rest,
        fecha_venta: fecha_venta ? new Date(fecha_venta) : undefined,
        fecha_instalacion: fecha_instalacion
          ? new Date(fecha_instalacion)
          : undefined,
        fecha_inicio_contrato: fecha_inicio_contrato
          ? new Date(fecha_inicio_contrato)
          : undefined,
        fecha_fin_contrato: fecha_fin_contrato
          ? new Date(fecha_fin_contrato)
          : undefined,
      },
      include: this.getIncludeRelations(),
    });

    // Registrar en el log
    await this.prisma.logAction(
      'ACTUALIZAR_CONTRATO',
      id_usuario,
      `Contrato actualizado: ${contrato.codigo}`,
    );

    return contrato;
  }

  async remove(id: number, id_usuario: number): Promise<atcContrato> {
    const contrato = await this.findOne(id);

    // Cancelar la Orden de Trabajo asociada si existe
    if (contrato.id_orden_trabajo) {
      try {
        await this.ordenesTrabajoService.cancelarOrden(
          contrato.id_orden_trabajo,
          id_usuario,
        );
      } catch (error) {
        // Si falla la cancelación de la OT, logueamos pero continuamos con la cancelación del contrato
        console.error(`Error al cancelar OT ${contrato.id_orden_trabajo}:`, error);
      }
    }

    const updatedContrato = await this.prisma.atcContrato.update({
      where: { id_contrato: id },
      data: { estado: 'CANCELADO' },
      include: this.getIncludeRelations(),
    });

    // Registrar en el log
    await this.prisma.logAction(
      'CANCELAR_CONTRATO',
      id_usuario,
      `Contrato cancelado: ${contrato.codigo}${contrato.id_orden_trabajo ? ` - OT cancelada: ${contrato.id_orden_trabajo}` : ''}`,
    );

    return updatedContrato;
  }

  /**
   * Retorna las relaciones a incluir en las consultas
   */
  private getIncludeRelations() {
    return {
      cliente: {
        select: {
          id_cliente: true,
          titular: true,
          dui: true,
          correo_electronico: true,
          telefono1: true,
        },
      },
      plan: {
        include: {
          tipoPlan: {
            include: {
              tipoServicio: true,
            },
          },
        },
      },
      ciclo: true,
      direccionServicio: {
        include: {
          municipio: true,
          departamento: true,
          colonias: true,
        },
      },
      ordenTrabajo: {
        select: {
          id_orden: true,
          codigo: true,
          tipo: true,
          estado: true,
        },
      },
      usuarioCreador: {
        select: {
          id_usuario: true,
          nombres: true,
          apellidos: true,
        },
      },
      instalacion: true,
    };
  }
}
