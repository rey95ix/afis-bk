import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateIaRuleDto, UpdateIaRuleDto } from './dto';

@Injectable()
export class IaRuleService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crear una nueva regla
   */
  async create(createDto: CreateIaRuleDto, userId: number) {
    // Verificar que la configuración existe
    const config = await this.prisma.whatsapp_ia_config.findUnique({
      where: { id_config: createDto.id_config },
    });

    if (!config) {
      throw new NotFoundException(
        `Configuración IA con ID ${createDto.id_config} no encontrada`,
      );
    }

    const rule = await this.prisma.whatsapp_ia_rule.create({
      data: {
        id_config: createDto.id_config,
        nombre: createDto.nombre,
        descripcion: createDto.descripcion,
        prioridad: createDto.prioridad ?? 0,
        activo: createDto.activo ?? true,
        condiciones: createDto.condiciones as any,
        logica_condiciones: createDto.logica_condiciones ?? 'AND',
        acciones: createDto.acciones as any,
      },
    });

    await this.prisma.logAction(
      'CREAR_IA_REGLA',
      userId,
      `Regla IA "${rule.nombre}" creada en config ${config.nombre}`,
    );

    return rule;
  }

  /**
   * Obtener todas las reglas de una configuración
   */
  async findAllByConfig(configId: number) {
    return this.prisma.whatsapp_ia_rule.findMany({
      where: { id_config: configId },
      orderBy: { prioridad: 'desc' },
    });
  }

  /**
   * Obtener todas las reglas activas
   */
  async findAllActive() {
    return this.prisma.whatsapp_ia_rule.findMany({
      where: {
        activo: true,
        config: { activo: true },
      },
      orderBy: { prioridad: 'desc' },
      include: {
        config: {
          select: {
            id_config: true,
            nombre: true,
          },
        },
      },
    });
  }

  /**
   * Obtener una regla por ID
   */
  async findOne(id: number) {
    const rule = await this.prisma.whatsapp_ia_rule.findUnique({
      where: { id_regla: id },
      include: {
        config: {
          select: {
            id_config: true,
            nombre: true,
          },
        },
      },
    });

    if (!rule) {
      throw new NotFoundException(`Regla IA con ID ${id} no encontrada`);
    }

    return rule;
  }

  /**
   * Actualizar una regla
   */
  async update(id: number, updateDto: UpdateIaRuleDto, userId: number) {
    const rule = await this.prisma.whatsapp_ia_rule.findUnique({
      where: { id_regla: id },
    });

    if (!rule) {
      throw new NotFoundException(`Regla IA con ID ${id} no encontrada`);
    }

    const updateData: any = { ...updateDto };
    if (updateDto.condiciones) {
      updateData.condiciones = updateDto.condiciones as any;
    }
    if (updateDto.acciones) {
      updateData.acciones = updateDto.acciones as any;
    }

    const updatedRule = await this.prisma.whatsapp_ia_rule.update({
      where: { id_regla: id },
      data: updateData,
    });

    await this.prisma.logAction(
      'ACTUALIZAR_IA_REGLA',
      userId,
      `Regla IA "${updatedRule.nombre}" actualizada`,
    );

    return updatedRule;
  }

  /**
   * Eliminar una regla
   */
  async remove(id: number, userId: number) {
    const rule = await this.prisma.whatsapp_ia_rule.findUnique({
      where: { id_regla: id },
    });

    if (!rule) {
      throw new NotFoundException(`Regla IA con ID ${id} no encontrada`);
    }

    await this.prisma.whatsapp_ia_rule.delete({
      where: { id_regla: id },
    });

    await this.prisma.logAction(
      'ELIMINAR_IA_REGLA',
      userId,
      `Regla IA "${rule.nombre}" eliminada`,
    );

    return { message: 'Regla eliminada exitosamente' };
  }

  /**
   * Reordenar prioridades de reglas
   */
  async reorder(
    configId: number,
    ruleIds: number[],
    userId: number,
  ) {
    // Verificar que todas las reglas pertenecen a la configuración
    const rules = await this.prisma.whatsapp_ia_rule.findMany({
      where: {
        id_regla: { in: ruleIds },
        id_config: configId,
      },
    });

    if (rules.length !== ruleIds.length) {
      throw new BadRequestException(
        'Algunas reglas no pertenecen a esta configuración',
      );
    }

    // Actualizar prioridades (mayor índice = mayor prioridad)
    const updates = ruleIds.map((id, index) =>
      this.prisma.whatsapp_ia_rule.update({
        where: { id_regla: id },
        data: { prioridad: ruleIds.length - index },
      }),
    );

    await this.prisma.$transaction(updates);

    await this.prisma.logAction(
      'REORDENAR_IA_REGLAS',
      userId,
      `Reglas reordenadas en config ID ${configId}`,
    );

    return this.findAllByConfig(configId);
  }

  /**
   * Duplicar una regla
   */
  async duplicate(id: number, userId: number) {
    const rule = await this.prisma.whatsapp_ia_rule.findUnique({
      where: { id_regla: id },
    });

    if (!rule) {
      throw new NotFoundException(`Regla IA con ID ${id} no encontrada`);
    }

    const newRule = await this.prisma.whatsapp_ia_rule.create({
      data: {
        id_config: rule.id_config,
        nombre: `${rule.nombre} (copia)`,
        descripcion: rule.descripcion,
        prioridad: rule.prioridad - 1, // Menor prioridad que el original
        activo: false, // Desactivada por defecto
        condiciones: rule.condiciones as any,
        logica_condiciones: rule.logica_condiciones,
        acciones: rule.acciones as any,
      },
    });

    await this.prisma.logAction(
      'DUPLICAR_IA_REGLA',
      userId,
      `Regla IA "${rule.nombre}" duplicada`,
    );

    return newRule;
  }

  /**
   * Incrementar contador de ejecuciones
   */
  async incrementExecutionCount(id: number) {
    return this.prisma.whatsapp_ia_rule.update({
      where: { id_regla: id },
      data: {
        ejecuciones_count: { increment: 1 },
        ultima_ejecucion_at: new Date(),
      },
    });
  }
}
