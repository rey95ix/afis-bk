import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateRolDto } from './dto/create-rol.dto';
import { UpdateRolDto } from './dto/update-rol.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtener todos los roles activos
   */
  async findAll() {
    return this.prisma.roles.findMany({
      where: { estado: 'ACTIVO' },
      orderBy: { nombre: 'asc' },
      select: {
        id_rol: true,
        nombre: true,
        descripcion: true,
        estado: true,
        fecha_creacion: true,
        fecha_ultima_actualizacion: true,
        _count: {
          select: {
            usuarios: true,
            rol_permisos: true,
          },
        },
      },
    });
  }

  /**
   * Obtener un rol por ID
   */
  async findOne(id: number) {
    const rol = await this.prisma.roles.findUnique({
      where: { id_rol: id },
      include: {
        _count: {
          select: {
            usuarios: true,
            rol_permisos: true,
          },
        },
      },
    });

    if (!rol) {
      throw new NotFoundException(`Rol con ID ${id} no encontrado`);
    }

    return rol;
  }

  /**
   * Crear un nuevo rol
   */
  async create(createRolDto: CreateRolDto, userId: number) {
    // Verificar que no exista un rol con el mismo nombre
    const existingRol = await this.prisma.roles.findFirst({
      where: {
        nombre: {
          equals: createRolDto.nombre,
          mode: 'insensitive',
        },
      },
    });

    if (existingRol) {
      throw new BadRequestException(
        `Ya existe un rol con el nombre "${createRolDto.nombre}"`,
      );
    }

    // Crear el rol
    const rol = await this.prisma.roles.create({
      data: {
        nombre: createRolDto.nombre,
        descripcion: createRolDto.descripcion,
        estado: 'ACTIVO',
      },
    });

    // Registrar en audit log
    await this.prisma.logAction(
      'CREAR_ROL', 
      userId,
      `Rol creado: ${rol.nombre} (ID: ${rol.id_rol})`,
    );

    return rol;
  }

  /**
   * Actualizar un rol existente
   */
  async update(id: number, updateRolDto: UpdateRolDto, userId: number) {
    // Verificar que el rol existe
    const rolExistente = await this.prisma.roles.findUnique({
      where: { id_rol: id },
    });

    if (!rolExistente) {
      throw new NotFoundException(`Rol con ID ${id} no encontrado`);
    }

    // Si se está actualizando el nombre, verificar que no exista otro rol con ese nombre
    if (updateRolDto.nombre) {
      const conflictingRol = await this.prisma.roles.findFirst({
        where: {
          nombre: {
            equals: updateRolDto.nombre,
            mode: 'insensitive',
          },
          id_rol: {
            not: id,
          },
        },
      });

      if (conflictingRol) {
        throw new BadRequestException(
          `Ya existe otro rol con el nombre "${updateRolDto.nombre}"`,
        );
      }
    }

    // Actualizar el rol
    const rol = await this.prisma.roles.update({
      where: { id_rol: id },
      data: updateRolDto,
    });

    // Registrar en audit log
    await this.prisma.logAction(
      'ACTUALIZAR_ROL', 
      userId,
      `Rol actualizado: ${rol.nombre} (ID: ${rol.id_rol})`,
    );

    return rol;
  }

  /**
   * Eliminar (desactivar) un rol
   */
  async remove(id: number, userId: number) {
    // Verificar que el rol existe
    const rol = await this.prisma.roles.findUnique({
      where: { id_rol: id },
      include: {
        _count: {
          select: {
            usuarios: true,
          },
        },
      },
    });

    if (!rol) {
      throw new NotFoundException(`Rol con ID ${id} no encontrado`);
    }

    // Verificar si hay usuarios asociados
    if (rol._count.usuarios > 0) {
      throw new BadRequestException(
        `No se puede eliminar el rol "${rol.nombre}" porque tiene ${rol._count.usuarios} usuario(s) asignado(s). Primero reasigne los usuarios a otro rol.`,
      );
    }

    // Desactivar el rol (soft delete)
    const rolActualizado = await this.prisma.roles.update({
      where: { id_rol: id },
      data: {
        estado: 'INACTIVO',
      },
    });

    // Registrar en audit log
    await this.prisma.logAction(
      'ELIMINAR_ROL', 
      userId,
      `Rol eliminado (desactivado): ${rol.nombre} (ID: ${rol.id_rol})`,
    );

    return rolActualizado;
  }
}
