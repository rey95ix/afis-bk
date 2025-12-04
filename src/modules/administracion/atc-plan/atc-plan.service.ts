// src/modules/administracion/atc-plan/atc-plan.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { atcPlan } from '@prisma/client';
import { PaginationDto, PaginatedResult } from 'src/common/dto';

@Injectable()
export class AtcPlanService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crear un nuevo plan
   */
  async create(createPlanDto: CreatePlanDto, id_usuario?: number): Promise<atcPlan> {
    // Validar que el tipo de plan existe
    const tipoPlan = await this.prisma.atcTipoPlan.findUnique({
      where: { id_tipo_plan: createPlanDto.id_tipo_plan },
    });
    if (!tipoPlan) {
      throw new NotFoundException(`Tipo de plan con ID ${createPlanDto.id_tipo_plan} no encontrado`);
    }

    // Crear el plan
    const plan = await this.prisma.atcPlan.create({
      data: {
        nombre: createPlanDto.nombre,
        descripcion: createPlanDto.descripcion,
        precio: createPlanDto.precio,
        id_tipo_plan: createPlanDto.id_tipo_plan,
        meses_contrato: createPlanDto.meses_contrato ?? 12,
        velocidad_bajada: createPlanDto.velocidad_bajada,
        velocidad_subida: createPlanDto.velocidad_subida,
        aplica_iva: createPlanDto.aplica_iva ?? true,
        aplica_cesc: createPlanDto.aplica_cesc ?? false,
        porcentaje_iva: createPlanDto.porcentaje_iva ?? 13.00,
        fecha_inicio_vigencia: createPlanDto.fecha_inicio_vigencia ? new Date(createPlanDto.fecha_inicio_vigencia) : null,
        fecha_fin_vigencia: createPlanDto.fecha_fin_vigencia ? new Date(createPlanDto.fecha_fin_vigencia) : null,
      },
      include: {
        tipoPlan: {
          include: {
            tipoServicio: true,
          },
        },
      },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'CREAR_PLAN',
      id_usuario,
      `Plan creado: ${plan.nombre} - $${plan.precio}`,
    );

    return plan;
  }

  /**
   * Obtener todos los planes con paginación y búsqueda
   */
  async findAll(paginationDto: PaginationDto): Promise<PaginatedResult<atcPlan>> {
    const { page = 1, limit = 10, search = '' } = paginationDto;
    const skip = (page - 1) * limit;

    // Construir el filtro de búsqueda
    const where: any = {
      estado: 'ACTIVO',
    };

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { descripcion: { contains: search, mode: 'insensitive' } },
        { tipoPlan: { nombre: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Ejecutar consultas en paralelo
    const [data, total] = await Promise.all([
      this.prisma.atcPlan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fecha_creacion: 'desc' },
        include: {
          tipoPlan: {
            include: {
              tipoServicio: true,
            },
          },
        },
      }),
      this.prisma.atcPlan.count({ where }),
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
   * Obtener todos los planes activos (para selects)
   */
  async findAllActive(): Promise<atcPlan[]> {
    return this.prisma.atcPlan.findMany({
      where: { estado: 'ACTIVO' },
      include: {
        tipoPlan: {
          include: {
            tipoServicio: true,
          },
        },
      },
      orderBy: [
        { tipoPlan: { nombre: 'asc' } },
        { nombre: 'asc' },
      ],
    });
  }

  /**
   * Obtener un plan por ID
   */
  async findOne(id: number): Promise<atcPlan> {
    const plan = await this.prisma.atcPlan.findUnique({
      where: { id_plan: id },
      include: {
        tipoPlan: {
          include: {
            tipoServicio: true,
          },
        },
        _count: {
          select: { contratos: true },
        },
      },
    });
    if (!plan) {
      throw new NotFoundException(`Plan con ID ${id} no encontrado`);
    }
    return plan;
  }

  /**
   * Actualizar un plan
   */
  async update(id: number, updatePlanDto: UpdatePlanDto, id_usuario?: number): Promise<atcPlan> {
    await this.findOne(id); // Verificar que existe

    // Si se cambia el tipo de plan, validar que existe
    if (updatePlanDto.id_tipo_plan) {
      const tipoPlan = await this.prisma.atcTipoPlan.findUnique({
        where: { id_tipo_plan: updatePlanDto.id_tipo_plan },
      });
      if (!tipoPlan) {
        throw new NotFoundException(`Tipo de plan con ID ${updatePlanDto.id_tipo_plan} no encontrado`);
      }
    }

    const updateData: any = { ...updatePlanDto };

    // Convertir fechas si existen
    if (updatePlanDto.fecha_inicio_vigencia) {
      updateData.fecha_inicio_vigencia = new Date(updatePlanDto.fecha_inicio_vigencia);
    }
    if (updatePlanDto.fecha_fin_vigencia) {
      updateData.fecha_fin_vigencia = new Date(updatePlanDto.fecha_fin_vigencia);
    }

    const plan = await this.prisma.atcPlan.update({
      where: { id_plan: id },
      data: updateData,
      include: {
        tipoPlan: {
          include: {
            tipoServicio: true,
          },
        },
      },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'ACTUALIZAR_PLAN',
      id_usuario,
      `Plan actualizado: ${plan.nombre}`,
    );

    return plan;
  }

  /**
   * Eliminar un plan (soft delete)
   */
  async remove(id: number, id_usuario?: number): Promise<atcPlan> {
    const planExistente = await this.findOne(id);

    // Verificar si tiene contratos asociados
    const contratosCount = await this.prisma.atcContrato.count({
      where: { id_plan: id },
    });
    if (contratosCount > 0) {
      throw new BadRequestException(
        `No se puede eliminar el plan porque tiene ${contratosCount} contrato(s) asociado(s)`,
      );
    }

    const plan = await this.prisma.atcPlan.update({
      where: { id_plan: id },
      data: { estado: 'INACTIVO' },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'ELIMINAR_PLAN',
      id_usuario,
      `Plan eliminado: ${plan.nombre}`,
    );

    return plan;
  }

  /**
   * Obtener tipos de plan para selects
   */
  async getTiposPlan(): Promise<any[]> {
    return this.prisma.atcTipoPlan.findMany({
      where: { estado: 'ACTIVO' },
      include: {
        tipoServicio: true,
      },
      orderBy: { nombre: 'asc' },
    });
  }
}
