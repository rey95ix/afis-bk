import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateIaConfigDto, UpdateIaConfigDto } from './dto';

@Injectable()
export class IaConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crear nueva configuración de IA
   */
  async create(createDto: CreateIaConfigDto, userId: number) {
    // Si se marca como activa, desactivar las demás
    if (createDto.activo) {
      await this.prisma.whatsapp_ia_config.updateMany({
        where: { activo: true },
        data: { activo: false },
      });
    }

    const config = await this.prisma.whatsapp_ia_config.create({
      data: {
        nombre: createDto.nombre,
        descripcion: createDto.descripcion,
        activo: createDto.activo ?? false,
        proveedor: createDto.proveedor ?? 'OPENAI',
        modelo: createDto.modelo ?? 'gpt-4',
        api_key: createDto.api_key,
        temperatura: createDto.temperatura ?? 0.7,
        max_tokens: createDto.max_tokens ?? 500,
        system_prompt: createDto.system_prompt,
        ventana_contexto: createDto.ventana_contexto ?? 10,
        fallback_a_humano: createDto.fallback_a_humano ?? true,
        condiciones_fallback: createDto.condiciones_fallback,
        delay_respuesta_seg: createDto.delay_respuesta_seg ?? 2,
        horario_atencion: createDto.horario_atencion,
      },
      include: {
        reglas: true,
      },
    });

    await this.prisma.logAction(
      'CREAR_IA_CONFIG',
      userId,
      `Configuración IA "${config.nombre}" creada`,
    );

    return config;
  }

  /**
   * Obtener todas las configuraciones
   */
  async findAll() {
    return this.prisma.whatsapp_ia_config.findMany({
      include: {
        _count: {
          select: { reglas: true },
        },
      },
      orderBy: { fecha_creacion: 'desc' },
    });
  }

  /**
   * Obtener configuración activa
   */
  async getActive() {
    const config = await this.prisma.whatsapp_ia_config.findFirst({
      where: { activo: true },
      include: {
        reglas: {
          where: { activo: true },
          orderBy: { prioridad: 'desc' },
        },
      },
    });

    if (!config) {
      throw new NotFoundException('No hay configuración de IA activa');
    }

    return config;
  }

  /**
   * Obtener una configuración por ID
   */
  async findOne(id: number) {
    const config = await this.prisma.whatsapp_ia_config.findUnique({
      where: { id_config: id },
      include: {
        reglas: {
          orderBy: { prioridad: 'desc' },
        },
      },
    });

    if (!config) {
      throw new NotFoundException(`Configuración IA con ID ${id} no encontrada`);
    }

    return config;
  }

  /**
   * Actualizar una configuración
   */
  async update(id: number, updateDto: UpdateIaConfigDto, userId: number) {
    const config = await this.prisma.whatsapp_ia_config.findUnique({
      where: { id_config: id },
    });

    if (!config) {
      throw new NotFoundException(`Configuración IA con ID ${id} no encontrada`);
    }

    // Si se marca como activa, desactivar las demás
    if (updateDto.activo && !config.activo) {
      await this.prisma.whatsapp_ia_config.updateMany({
        where: { activo: true, id_config: { not: id } },
        data: { activo: false },
      });
    }

    const updatedConfig = await this.prisma.whatsapp_ia_config.update({
      where: { id_config: id },
      data: updateDto,
      include: {
        reglas: true,
      },
    });

    await this.prisma.logAction(
      'ACTUALIZAR_IA_CONFIG',
      userId,
      `Configuración IA "${updatedConfig.nombre}" actualizada`,
    );

    return updatedConfig;
  }

  /**
   * Eliminar una configuración
   */
  async remove(id: number, userId: number) {
    const config = await this.prisma.whatsapp_ia_config.findUnique({
      where: { id_config: id },
    });

    if (!config) {
      throw new NotFoundException(`Configuración IA con ID ${id} no encontrada`);
    }

    if (config.activo) {
      throw new BadRequestException(
        'No se puede eliminar la configuración activa. Desactívela primero.',
      );
    }

    await this.prisma.whatsapp_ia_config.delete({
      where: { id_config: id },
    });

    await this.prisma.logAction(
      'ELIMINAR_IA_CONFIG',
      userId,
      `Configuración IA "${config.nombre}" eliminada`,
    );

    return { message: 'Configuración eliminada exitosamente' };
  }

  /**
   * Activar una configuración
   */
  async activate(id: number, userId: number) {
    const config = await this.prisma.whatsapp_ia_config.findUnique({
      where: { id_config: id },
    });

    if (!config) {
      throw new NotFoundException(`Configuración IA con ID ${id} no encontrada`);
    }

    // Desactivar todas las demás
    await this.prisma.whatsapp_ia_config.updateMany({
      where: { activo: true },
      data: { activo: false },
    });

    // Activar la seleccionada
    const updatedConfig = await this.prisma.whatsapp_ia_config.update({
      where: { id_config: id },
      data: { activo: true },
    });

    await this.prisma.logAction(
      'ACTIVAR_IA_CONFIG',
      userId,
      `Configuración IA "${config.nombre}" activada`,
    );

    return updatedConfig;
  }

  /**
   * Duplicar una configuración
   */
  async duplicate(id: number, userId: number) {
    const config = await this.prisma.whatsapp_ia_config.findUnique({
      where: { id_config: id },
      include: { reglas: true },
    });

    if (!config) {
      throw new NotFoundException(`Configuración IA con ID ${id} no encontrada`);
    }

    // Crear copia de la configuración
    const newConfig = await this.prisma.whatsapp_ia_config.create({
      data: {
        nombre: `${config.nombre} (copia)`,
        descripcion: config.descripcion,
        activo: false,
        proveedor: config.proveedor,
        modelo: config.modelo,
        api_key: config.api_key,
        temperatura: config.temperatura,
        max_tokens: config.max_tokens,
        system_prompt: config.system_prompt,
        ventana_contexto: config.ventana_contexto,
        fallback_a_humano: config.fallback_a_humano,
        condiciones_fallback: config.condiciones_fallback as any,
        delay_respuesta_seg: config.delay_respuesta_seg,
        horario_atencion: config.horario_atencion as any,
      },
    });

    // Copiar reglas
    for (const regla of config.reglas) {
      await this.prisma.whatsapp_ia_rule.create({
        data: {
          id_config: newConfig.id_config,
          nombre: regla.nombre,
          descripcion: regla.descripcion,
          prioridad: regla.prioridad,
          activo: regla.activo,
          condiciones: regla.condiciones as any,
          logica_condiciones: regla.logica_condiciones,
          acciones: regla.acciones as any,
        },
      });
    }

    await this.prisma.logAction(
      'DUPLICAR_IA_CONFIG',
      userId,
      `Configuración IA "${config.nombre}" duplicada como "${newConfig.nombre}"`,
    );

    return this.findOne(newConfig.id_config);
  }
}
