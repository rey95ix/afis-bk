import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';

/**
 * Servicio para gestionar y consultar permisos de usuarios
 * Incluye caché en memoria para optimizar consultas repetitivas
 */
@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);

  // Caché de permisos por usuario (duración: 5 minutos)
  private permissionsCache = new Map<number, {
    permissions: string[];
    timestamp: number;
  }>();

  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutos en ms

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene todos los permisos de un usuario (rol + permisos individuales)
   * @param id_usuario ID del usuario
   * @param useCache Si usar caché (default: true)
   * @returns Array de códigos de permisos (ej: ['inventario.compras:ver', 'inventario.compras:crear'])
   */
  async getUserPermissions(id_usuario: number, useCache = true): Promise<string[]> {
    // Verificar caché
    if (useCache) {
      const cached = this.permissionsCache.get(id_usuario);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        this.logger.debug(`Permisos de usuario ${id_usuario} obtenidos de caché`);
        return cached.permissions;
      }
    }

    // Consultar base de datos
    const usuario = await this.prisma.usuarios.findUnique({
      where: { id_usuario },
      include: {
        roles: {
          include: {
            rol_permisos: {
              include: {
                permisos: true
              },
              where: {
                permisos: { estado: 'ACTIVO' }
              }
            }
          }
        },
        usuario_permisos: {
          where: {
            OR: [
              { fecha_expiracion: null }, // Sin expiración
              { fecha_expiracion: { gte: new Date() } } // No expirado
            ],
            permisos: { estado: 'ACTIVO' }
          },
          include: {
            permisos: true
          }
        }
      }
    });

    if (!usuario) {
      this.logger.warn(`Usuario ${id_usuario} no encontrado`);
      return [];
    }

    // Permisos del rol
    const permisosRol = usuario.roles?.rol_permisos?.map((rp: any) => rp.permisos.codigo) || [];

    // Permisos individuales del usuario
    const permisosUsuario = usuario.usuario_permisos?.map((up: any) => up.permisos.codigo) || [];

    // Combinar y eliminar duplicados
    const allPermissions = [...new Set([...permisosRol, ...permisosUsuario])];

    // Guardar en caché
    this.permissionsCache.set(id_usuario, {
      permissions: allPermissions,
      timestamp: Date.now()
    });

    this.logger.debug(`Usuario ${id_usuario} tiene ${allPermissions.length} permisos`);

    return allPermissions;
  }

  /**
   * Verifica si un usuario tiene un permiso específico
   * @param id_usuario ID del usuario
   * @param permissionCode Código del permiso (ej: 'inventario.compras:crear')
   * @returns true si tiene el permiso, false en caso contrario
   */
  async hasPermission(id_usuario: number, permissionCode: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(id_usuario);
    return permissions.includes(permissionCode);
  }

  /**
   * Verifica si un usuario tiene AL MENOS UNO de los permisos especificados
   * @param id_usuario ID del usuario
   * @param permissionCodes Array de códigos de permisos
   * @returns true si tiene al menos uno, false si no tiene ninguno
   */
  async hasAnyPermission(id_usuario: number, permissionCodes: string[]): Promise<boolean> {
    const permissions = await this.getUserPermissions(id_usuario);
    return permissionCodes.some(code => permissions.includes(code));
  }

  /**
   * Verifica si un usuario tiene TODOS los permisos especificados
   * @param id_usuario ID del usuario
   * @param permissionCodes Array de códigos de permisos
   * @returns true si tiene todos, false si le falta alguno
   */
  async hasAllPermissions(id_usuario: number, permissionCodes: string[]): Promise<boolean> {
    const permissions = await this.getUserPermissions(id_usuario);
    return permissionCodes.every(code => permissions.includes(code));
  }

  /**
   * Invalida el caché de permisos de un usuario
   * Útil cuando se modifican permisos del usuario o su rol
   * @param id_usuario ID del usuario (opcional, si no se especifica invalida todo el caché)
   */
  clearCache(id_usuario?: number): void {
    if (id_usuario) {
      this.permissionsCache.delete(id_usuario);
      this.logger.debug(`Caché de permisos invalidado para usuario ${id_usuario}`);
    } else {
      this.permissionsCache.clear();
      this.logger.debug('Caché de permisos completamente invalidado');
    }
  }

  /**
   * Obtiene permisos agrupados por módulo para un usuario
   * Útil para mostrar en UI
   * @param id_usuario ID del usuario
   * @returns Objeto con permisos agrupados por módulo
   */
  async getUserPermissionsByModule(id_usuario: number): Promise<Record<string, string[]>> {
    const permissions = await this.getUserPermissions(id_usuario);

    const grouped: Record<string, string[]> = {};

    for (const perm of permissions) {
      const [module] = perm.split('.');
      if (!grouped[module]) {
        grouped[module] = [];
      }
      grouped[module].push(perm);
    }

    return grouped;
  }

  /**
   * Verifica si un usuario puede acceder a un módulo completo
   * @param id_usuario ID del usuario
   * @param moduleName Nombre del módulo (ej: 'inventario', 'atencion_cliente')
   * @returns true si tiene al menos un permiso del módulo
   */
  async canAccessModule(id_usuario: number, moduleName: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(id_usuario);
    return permissions.some(perm => perm.startsWith(`${moduleName}.`));
  }
}
