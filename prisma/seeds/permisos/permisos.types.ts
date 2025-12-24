/**
 * Tipos para el sistema de permisos
 * Deben coincidir con los enums definidos en schema.prisma
 */

// Acciones disponibles (enum tipo_accion en schema.prisma)
export type TipoAccion =
  | 'VER'
  | 'CREAR'
  | 'EDITAR'
  | 'ELIMINAR'
  | 'APROBAR'
  | 'RECHAZAR'
  | 'EXPORTAR'
  | 'IMPRIMIR'
  | 'CUSTOM';

// Tipo de permiso (enum tipo_permiso en schema.prisma)
export type TipoPermiso = 'RECURSO' | 'FUNCIONAL';

// Estado del permiso
export type EstadoPermiso = 'ACTIVO' | 'INACTIVO';

/**
 * Definicion de un permiso individual
 */
export interface PermisoDefinition {
  /** Codigo unico del permiso: modulo.recurso:accion */
  codigo: string;
  /** Nombre descriptivo para UI */
  nombre: string;
  /** Descripcion detallada del permiso */
  descripcion: string;
  /** Modulo al que pertenece (inventario, administracion, etc.) */
  modulo: string;
  /** Recurso especifico (compras, usuarios, etc.) */
  recurso: string;
  /** Accion permitida */
  accion: TipoAccion;
  /** Tipo de permiso */
  tipo: TipoPermiso;
  /** Estado inicial */
  estado: EstadoPermiso;
  /** Si es un permiso critico que requiere atencion especial */
  es_critico: boolean;
  /** Si requiere registro en auditoria */
  requiere_auditoria: boolean;
}

/**
 * IDs de roles predefinidos en el sistema
 * Deben coincidir con los registros en la tabla roles
 */
export const ROL_IDS = {
  ADMIN: 1,
  FACTURACION: 2,
  INVENTARIO: 3,
  ATENCION_CLIENTE: 4,
  TECNICO: 5,
} as const;

export type RolId = (typeof ROL_IDS)[keyof typeof ROL_IDS];

/**
 * Definicion de roles predefinidos del sistema
 * Se crearan automaticamente si no existen al ejecutar el seed
 */
export const ROLES_PREDEFINIDOS = [
  { id_rol: ROL_IDS.ADMIN, nombre: 'Admin', descripcion: 'Administrador del sistema con acceso total' },
  { id_rol: ROL_IDS.FACTURACION, nombre: 'Facturacion', descripcion: 'Rol para personal de facturacion' },
  { id_rol: ROL_IDS.INVENTARIO, nombre: 'Inventario', descripcion: 'Rol para gestion de inventario' },
  { id_rol: ROL_IDS.ATENCION_CLIENTE, nombre: 'Atencion Cliente', descripcion: 'Rol para atencion al cliente' },
  { id_rol: ROL_IDS.TECNICO, nombre: 'Tecnico', descripcion: 'Rol para tecnicos de campo' },
] as const;
