// src/modules/administracion/usuarios/usuarios.service.ts

import { Injectable, NotFoundException, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { PaginationDto, PaginatedResult } from '../../../common/dto/pagination.dto';
import { usuarios } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class UsuariosService {
  private readonly logger = new Logger(UsuariosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Obtener todos los usuarios con paginación y búsqueda
   */
  async findAll(paginationDto: PaginationDto): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 10, search = '' } = paginationDto;
    const skip = (page - 1) * limit;

    const where: any = { estado: 'ACTIVO' };

    if (search) {
      where.OR = [
        { usuario: { contains: search, mode: 'insensitive' } },
        { nombres: { contains: search, mode: 'insensitive' } },
        { apellidos: { contains: search, mode: 'insensitive' } },
        { dui: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.usuarios.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fecha_creacion: 'desc' },
        include: {
          roles: true,
        },
      }),
      this.prisma.usuarios.count({ where }),
    ]);

    // Remover el password de la respuesta
    const dataWithoutPassword = data.map(({ password, ...usuario }) => usuario);

    return {
      data: dataWithoutPassword,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Obtener un usuario por ID
   */
  async findOne(id: number): Promise<any> {
    const usuario = await this.prisma.usuarios.findUnique({
      where: { id_usuario: id },
      include: {
        roles: true,
      },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    const { password, ...usuarioWithoutPassword } = usuario;
    return usuarioWithoutPassword;
  }

  /**
   * Crear un nuevo usuario
   * La contraseña se genera automáticamente de forma temporal y debe ser cambiada en el primer login
   */
  async create(createUsuarioDto: CreateUsuarioDto, id_usuario?: number): Promise<any> {
    // Generar una contraseña temporal aleatoria segura
    const temporaryPassword = crypto.randomBytes(16).toString('hex');
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    const usuario = await this.prisma.usuarios.create({
      data: {
        ...createUsuarioDto,
        password: hashedPassword,
      },
      include: {
        roles: true,
      },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'CREAR_USUARIO',
      id_usuario,
      `Usuario creado: ${usuario.usuario} - ${usuario.nombres} ${usuario.apellidos}`,
    );

    // Intentar enviar email de bienvenida con credenciales
    try {
      await this.mailService.sendWelcomeEmail(
        {
          nombres: usuario.nombres,
          correo_electronico: usuario.usuario,
        },
        temporaryPassword,
      );
      this.logger.log(`Email de bienvenida enviado a ${usuario.usuario}`);
    } catch (error) {
      // No fallar la creación del usuario si el email falla
      this.logger.error(`Error al enviar email de bienvenida a ${usuario.usuario}:`, error);
    }

    const { password, ...usuarioWithoutPassword } = usuario;

    // Retornar el usuario con la contraseña temporal (solo se muestra una vez)
    return {
      ...usuarioWithoutPassword,
      temporaryPassword, // Solo se retorna en la creación para que el admin la comparta con el usuario
    };
  }

  /**
   * Actualizar un usuario (sin modificar la contraseña)
   */
  async update(id: number, updateUsuarioDto: UpdateUsuarioDto, id_usuario?: number): Promise<any> {
    const usuarioExiste = await this.prisma.usuarios.findUnique({
      where: { id_usuario: id },
    });

    if (!usuarioExiste) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    const usuario = await this.prisma.usuarios.update({
      where: { id_usuario: id },
      data: updateUsuarioDto,
      include: {
        roles: true,
      },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'ACTUALIZAR_USUARIO',
      id_usuario,
      `Usuario actualizado: ${usuario.usuario} - ${usuario.nombres} ${usuario.apellidos}`,
    );

    const { password, ...usuarioWithoutPassword } = usuario;
    return usuarioWithoutPassword;
  }

  /**
   * Cambiar contraseña de un usuario
   * Requiere validación de contraseña actual (opcional según política)
   */
  async changePassword(
    id: number,
    changePasswordDto: ChangePasswordDto,
    id_usuario?: number,
  ): Promise<any> {
    const usuario = await this.prisma.usuarios.findUnique({
      where: { id_usuario: id },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    // Validar que las contraseñas coincidan
    if (changePasswordDto.newPassword !== changePasswordDto.confirmPassword) {
      throw new BadRequestException('La nueva contraseña y la confirmación no coinciden');
    }

    // Si se proporciona contraseña actual, validarla
    if (changePasswordDto.currentPassword) {
      const isPasswordValid = await bcrypt.compare(
        changePasswordDto.currentPassword,
        usuario.password,
      );

      if (!isPasswordValid) {
        throw new UnauthorizedException('La contraseña actual es incorrecta');
      }
    }

    // Hashear la nueva contraseña
    const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);

    // Actualizar la contraseña
    await this.prisma.usuarios.update({
      where: { id_usuario: id },
      data: { password: hashedPassword },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'CAMBIO_CONTRASENA',
      id_usuario,
      `Contraseña cambiada para el usuario: ${usuario.usuario}`,
    );

    return {
      message: 'Contraseña actualizada exitosamente',
    };
  }

  /**
   * Eliminar (inactivar) un usuario
   */
  async remove(id: number, id_usuario?: number): Promise<any> {
    const usuarioExiste = await this.prisma.usuarios.findUnique({
      where: { id_usuario: id },
    });

    if (!usuarioExiste) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    const usuario = await this.prisma.usuarios.update({
      where: { id_usuario: id },
      data: { estado: 'INACTIVO' },
      include: {
        roles: true,
      },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'ELIMINAR_USUARIO',
      id_usuario,
      `Usuario eliminado: ${usuario.usuario} - ${usuario.nombres} ${usuario.apellidos}`,
    );

    const { password, ...usuarioWithoutPassword } = usuario;
    return usuarioWithoutPassword;
  }
}
