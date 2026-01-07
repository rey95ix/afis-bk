import { PermisoDefinition, TipoAccion, TipoPermiso } from './permisos.types';

/**
 * Helper para crear permisos de forma consistente
 */
function crearPermiso(
  modulo: string,
  recurso: string,
  accion: TipoAccion,
  nombre: string,
  descripcion: string,
  opciones?: Partial<Pick<PermisoDefinition, 'es_critico' | 'requiere_auditoria' | 'tipo'>>,
): PermisoDefinition {
  return {
    codigo: `${modulo}.${recurso}:${accion.toLowerCase()}`,
    nombre,
    descripcion,
    modulo,
    recurso,
    accion,
    tipo: opciones?.tipo ?? 'RECURSO',
    estado: 'ACTIVO',
    es_critico: opciones?.es_critico ?? false,
    requiere_auditoria: opciones?.requiere_auditoria ?? false,
  };
}

/**
 * Helper para crear permiso CUSTOM con nombre personalizado en el codigo
 */
function crearPermisoCustom(
  modulo: string,
  recurso: string,
  nombreCodigo: string,
  nombre: string,
  descripcion: string,
  opciones?: Partial<Pick<PermisoDefinition, 'es_critico' | 'requiere_auditoria' | 'tipo'>>,
): PermisoDefinition {
  return {
    codigo: `${modulo}.${recurso}:${nombreCodigo}`,
    nombre,
    descripcion,
    modulo,
    recurso,
    accion: 'CUSTOM',
    tipo: opciones?.tipo ?? 'RECURSO',
    estado: 'ACTIVO',
    es_critico: opciones?.es_critico ?? false,
    requiere_auditoria: opciones?.requiere_auditoria ?? false,
  };
}

/**
 * =============================================================
 * DEFINICION MAESTRA DE TODOS LOS PERMISOS DEL SISTEMA
 * =============================================================
 *
 * Organizados por modulo para facilitar mantenimiento.
 * Al agregar nuevos permisos, agregarlos en la seccion correspondiente.
 *
 * Formato de codigo: modulo.recurso:accion
 * Ejemplo: inventario.compras:crear
 *
 * Para agregar un nuevo permiso:
 * 1. Buscar la seccion del modulo correspondiente
 * 2. Usar crearPermiso() o crearPermisoCustom()
 * 3. Ejecutar: npm run seed:permisos
 * =============================================================
 */
export const PERMISOS_MAESTROS: PermisoDefinition[] = [
  // =============================================================
  // MODULO: AUTH (Autenticacion y Gestion de Permisos)
  // =============================================================

  // Gestion de Permisos
  crearPermiso('auth', 'permissions', 'VER', 'Ver Permisos', 'Ver listado y detalles de permisos del sistema'),
  crearPermiso('auth', 'permissions', 'CREAR', 'Crear Permisos', 'Crear nuevos permisos en el sistema', {
    es_critico: true,
    requiere_auditoria: true,
  }),
  crearPermiso('auth', 'permissions', 'EDITAR', 'Editar Permisos', 'Modificar permisos existentes', {
    es_critico: true,
    requiere_auditoria: true,
  }),
  crearPermiso('auth', 'permissions', 'ELIMINAR', 'Eliminar Permisos', 'Desactivar permisos del sistema', {
    es_critico: true,
    requiere_auditoria: true,
  }),
  crearPermisoCustom(
    'auth',
    'permissions',
    'asignar_politica',
    'Asignar Politicas',
    'Asignar politicas condicionales a permisos',
    { es_critico: true, requiere_auditoria: true },
  ),

  // Gestion de Politicas
  crearPermiso('auth', 'policies', 'VER', 'Ver Politicas', 'Ver listado y detalles de politicas de autorizacion'),
  crearPermiso('auth', 'policies', 'CREAR', 'Crear Politicas', 'Crear nuevas politicas condicionales', {
    es_critico: true,
    requiere_auditoria: true,
  }),
  crearPermiso('auth', 'policies', 'EDITAR', 'Editar Politicas', 'Modificar politicas existentes', {
    es_critico: true,
    requiere_auditoria: true,
  }),
  crearPermiso('auth', 'policies', 'ELIMINAR', 'Eliminar Politicas', 'Desactivar politicas del sistema', {
    es_critico: true,
    requiere_auditoria: true,
  }),
  crearPermisoCustom('auth', 'policies', 'probar', 'Probar Politicas', 'Ejecutar pruebas de evaluacion de politicas'),

  // Gestion de Permisos de Usuario
  crearPermiso(
    'auth',
    'user_permissions',
    'VER',
    'Ver Permisos de Usuarios',
    'Ver permisos asignados a usuarios especificos',
  ),
  crearPermisoCustom(
    'auth',
    'user_permissions',
    'asignar',
    'Asignar Permisos a Usuarios',
    'Asignar permisos individuales a usuarios',
    { es_critico: true, requiere_auditoria: true },
  ),
  crearPermisoCustom(
    'auth',
    'user_permissions',
    'revocar',
    'Revocar Permisos de Usuarios',
    'Remover permisos individuales de usuarios',
    { es_critico: true, requiere_auditoria: true },
  ),

  // =============================================================
  // MODULO: ADMINISTRACION
  // =============================================================

  // Usuarios
  crearPermiso(
    'administracion',
    'usuarios',
    'VER',
    'Ver Usuarios',
    'Ver listado y detalles de usuarios del sistema',
  ),
  crearPermiso('administracion', 'usuarios', 'CREAR', 'Crear Usuarios', 'Crear nuevos usuarios en el sistema', {
    es_critico: true,
    requiere_auditoria: true,
  }),
  crearPermiso(
    'administracion',
    'usuarios',
    'EDITAR',
    'Editar Usuarios',
    'Modificar informacion de usuarios existentes',
    { es_critico: true, requiere_auditoria: true },
  ),
  crearPermiso('administracion', 'usuarios', 'ELIMINAR', 'Eliminar Usuarios', 'Inactivar usuarios del sistema', {
    es_critico: true,
    requiere_auditoria: true,
  }),
  crearPermisoCustom(
    'administracion',
    'usuarios',
    'cambiar_password',
    'Cambiar Contrasenas',
    'Cambiar contrasenas de otros usuarios',
    { es_critico: true, requiere_auditoria: true },
  ),

  // Roles
  crearPermiso('administracion', 'roles', 'VER', 'Ver Roles', 'Ver listado y detalles de roles del sistema'),
  crearPermiso('administracion', 'roles', 'CREAR', 'Crear Roles', 'Crear nuevos roles', {
    es_critico: true,
    requiere_auditoria: true,
  }),
  crearPermiso('administracion', 'roles', 'EDITAR', 'Editar Roles', 'Modificar roles existentes', {
    es_critico: true,
    requiere_auditoria: true,
  }),
  crearPermiso('administracion', 'roles', 'ELIMINAR', 'Eliminar Roles', 'Eliminar roles del sistema', {
    es_critico: true,
    requiere_auditoria: true,
  }),
  crearPermisoCustom(
    'administracion',
    'roles',
    'asignar_permisos',
    'Asignar Permisos a Roles',
    'Gestionar permisos asignados a roles',
    { es_critico: true, requiere_auditoria: true },
  ),

  // Catalogo de Productos
  crearPermiso(
    'administracion',
    'catalogo',
    'VER',
    'Ver Catalogo',
    'Ver listado y detalles de productos del catalogo',
  ),
  crearPermiso('administracion', 'catalogo', 'CREAR', 'Crear Productos', 'Crear nuevos productos en el catalogo', {
    requiere_auditoria: true,
  }),
  crearPermiso('administracion', 'catalogo', 'EDITAR', 'Editar Productos', 'Modificar productos del catalogo', {
    requiere_auditoria: true,
  }),
  crearPermiso('administracion', 'catalogo', 'ELIMINAR', 'Eliminar Productos', 'Eliminar productos del catalogo', {
    es_critico: true,
    requiere_auditoria: true,
  }),

  // Categorias
  crearPermiso(
    'administracion',
    'categorias',
    'VER',
    'Ver Categorias',
    'Ver listado y detalles de categorias de productos',
  ),
  crearPermiso('administracion', 'categorias', 'CREAR', 'Crear Categorias', 'Crear nuevas categorias de productos', {
    requiere_auditoria: true,
  }),
  crearPermiso('administracion', 'categorias', 'EDITAR', 'Editar Categorias', 'Modificar categorias existentes', {
    requiere_auditoria: true,
  }),
  crearPermiso('administracion', 'categorias', 'ELIMINAR', 'Eliminar Categorias', 'Eliminar categorias de productos', {
    es_critico: true,
    requiere_auditoria: true,
  }),

  // Geografia
  crearPermiso(
    'administracion',
    'departamentos',
    'VER',
    'Ver Departamentos',
    'Ver catalogo de departamentos de El Salvador',
  ),
  crearPermiso('administracion', 'municipios', 'VER', 'Ver Municipios', 'Ver catalogo de municipios de El Salvador'),
  crearPermiso('administracion', 'colonias', 'VER', 'Ver Colonias', 'Ver catalogo de colonias y barrios'),
  crearPermiso('administracion', 'colonias', 'CREAR', 'Crear Colonias', 'Agregar nuevas colonias al catalogo'),
  crearPermiso('administracion', 'colonias', 'EDITAR', 'Editar Colonias', 'Modificar colonias existentes'),
  crearPermiso('administracion', 'colonias', 'ELIMINAR', 'Eliminar Colonias', 'Eliminar colonias del catalogo'),

  // DTE (Documentos Tributarios Electronicos)
  crearPermiso('administracion', 'dte', 'VER', 'Ver Catalogos DTE', 'Ver catalogos de documentos tributarios electronicos'),

  // Diagnosticos
  crearPermiso('administracion', 'diagnosticos', 'VER', 'Ver Diagnosticos', 'Ver catalogo de diagnosticos tecnicos'),
  crearPermiso('administracion', 'diagnosticos', 'CREAR', 'Crear Diagnosticos', 'Agregar nuevos diagnosticos al catalogo'),
  crearPermiso('administracion', 'diagnosticos', 'EDITAR', 'Editar Diagnosticos', 'Modificar diagnosticos existentes'),
  crearPermiso('administracion', 'diagnosticos', 'ELIMINAR', 'Eliminar Diagnosticos', 'Eliminar diagnosticos del catalogo'),

  // Planes (ATC Plans)
  crearPermiso('administracion', 'planes', 'VER', 'Ver Planes', 'Ver listado y detalles de planes'),
  crearPermiso('administracion', 'planes', 'CREAR', 'Crear Planes', 'Crear nuevos planes', { requiere_auditoria: true }),
  crearPermiso('administracion', 'planes', 'EDITAR', 'Editar Planes', 'Modificar planes existentes', { requiere_auditoria: true }),
  crearPermiso('administracion', 'planes', 'ELIMINAR', 'Eliminar Planes', 'Eliminar planes', {
    es_critico: true,
    requiere_auditoria: true,
  }),

  // Marcas
  crearPermiso('administracion', 'marcas', 'VER', 'Ver Marcas', 'Ver listado y detalles de marcas'),
  crearPermiso('administracion', 'marcas', 'CREAR', 'Crear Marcas', 'Crear nuevas marcas', { requiere_auditoria: true }),
  crearPermiso('administracion', 'marcas', 'EDITAR', 'Editar Marcas', 'Modificar marcas existentes', { requiere_auditoria: true }),
  crearPermiso('administracion', 'marcas', 'ELIMINAR', 'Eliminar Marcas', 'Eliminar marcas', {
    es_critico: true,
    requiere_auditoria: true,
  }),

  // Modelos
  crearPermiso('administracion', 'modelos', 'VER', 'Ver Modelos', 'Ver listado y detalles de modelos'),
  crearPermiso('administracion', 'modelos', 'CREAR', 'Crear Modelos', 'Crear nuevos modelos', { requiere_auditoria: true }),
  crearPermiso('administracion', 'modelos', 'EDITAR', 'Editar Modelos', 'Modificar modelos existentes', { requiere_auditoria: true }),
  crearPermiso('administracion', 'modelos', 'ELIMINAR', 'Eliminar Modelos', 'Eliminar modelos', {
    es_critico: true,
    requiere_auditoria: true,
  }),

  // =============================================================
  // MODULO: ATENCION AL CLIENTE
  // =============================================================

  // Clientes
  crearPermiso('atencion_cliente', 'clientes', 'VER', 'Ver Clientes', 'Ver listado y detalles de clientes'),
  crearPermiso('atencion_cliente', 'clientes', 'CREAR', 'Crear Clientes', 'Registrar nuevos clientes en el sistema', {
    requiere_auditoria: true,
  }),
  crearPermiso('atencion_cliente', 'clientes', 'EDITAR', 'Editar Clientes', 'Modificar informacion de clientes', {
    requiere_auditoria: true,
  }),
  crearPermiso('atencion_cliente', 'clientes', 'ELIMINAR', 'Eliminar Clientes', 'Inactivar clientes del sistema', {
    es_critico: true,
    requiere_auditoria: true,
  }),
  crearPermisoCustom(
    'atencion_cliente',
    'clientes',
    'gestionar_documentos',
    'Gestionar Documentos de Clientes',
    'Subir, ver y eliminar documentos de clientes',
  ),
  crearPermisoCustom(
    'atencion_cliente',
    'clientes',
    'gestionar_direcciones',
    'Gestionar Direcciones',
    'Administrar direcciones de servicio de clientes',
  ),
  crearPermisoCustom(
    'atencion_cliente',
    'clientes',
    'gestionar_facturacion',
    'Gestionar Datos de Facturacion',
    'Administrar datos de facturacion de clientes',
    { requiere_auditoria: true },
  ),

  // Contratos
  crearPermiso('atencion_cliente', 'contratos', 'VER', 'Ver Contratos', 'Ver listado y detalles de contratos'),
  crearPermiso('atencion_cliente', 'contratos', 'CREAR', 'Crear Contratos', 'Crear nuevos contratos de servicio', {
    requiere_auditoria: true,
  }),
  crearPermiso('atencion_cliente', 'contratos', 'EDITAR', 'Editar Contratos', 'Modificar contratos existentes', {
    requiere_auditoria: true,
  }),
  crearPermiso('atencion_cliente', 'contratos', 'ELIMINAR', 'Eliminar Contratos', 'Eliminar contratos', {
    es_critico: true,
    requiere_auditoria: true,
  }),
  crearPermisoCustom(
    'atencion_cliente',
    'contratos',
    'gestionar_instalacion',
    'Gestionar Instalacion',
    'Gestionar datos de instalacion de contratos',
    { requiere_auditoria: true },
  ),

  // Tickets
  crearPermiso('atencion_cliente', 'tickets', 'VER', 'Ver Tickets', 'Ver listado y detalles de tickets de soporte'),
  crearPermiso('atencion_cliente', 'tickets', 'CREAR', 'Crear Tickets', 'Crear nuevos tickets de soporte', {
    requiere_auditoria: true,
  }),
  crearPermiso('atencion_cliente', 'tickets', 'EDITAR', 'Editar Tickets', 'Modificar tickets existentes', {
    requiere_auditoria: true,
  }),
  crearPermisoCustom('atencion_cliente', 'tickets', 'escalar', 'Escalar Tickets', 'Escalar tickets a ordenes de trabajo', {
    requiere_auditoria: true,
  }),
  crearPermisoCustom('atencion_cliente', 'tickets', 'cerrar', 'Cerrar Tickets', 'Cerrar tickets resueltos', {
    requiere_auditoria: true,
  }),

  // Ordenes de Trabajo
  crearPermiso(
    'atencion_cliente',
    'ordenes',
    'VER',
    'Ver Ordenes de Trabajo',
    'Ver listado y detalles de ordenes de trabajo',
  ),
  crearPermiso('atencion_cliente', 'ordenes', 'CREAR', 'Crear Ordenes de Trabajo', 'Crear nuevas ordenes de trabajo', {
    requiere_auditoria: true,
  }),
  crearPermiso('atencion_cliente', 'ordenes', 'EDITAR', 'Editar Ordenes de Trabajo', 'Modificar ordenes de trabajo', {
    requiere_auditoria: true,
  }),
  crearPermisoCustom(
    'atencion_cliente',
    'ordenes',
    'asignar',
    'Asignar Ordenes',
    'Asignar ordenes de trabajo a tecnicos',
    { requiere_auditoria: true },
  ),
  crearPermisoCustom(
    'atencion_cliente',
    'ordenes',
    'agendar',
    'Agendar Visitas',
    'Agendar y reprogramar visitas tecnicas',
    { requiere_auditoria: true },
  ),
  crearPermisoCustom(
    'atencion_cliente',
    'ordenes',
    'ejecutar',
    'Ejecutar Ordenes',
    'Iniciar, agregar actividades y materiales a ordenes',
    { requiere_auditoria: true },
  ),
  crearPermisoCustom(
    'atencion_cliente',
    'ordenes',
    'cerrar',
    'Cerrar Ordenes',
    'Cerrar ordenes de trabajo completadas',
    { requiere_auditoria: true },
  ),
  crearPermisoCustom(
    'atencion_cliente',
    'ordenes',
    'gestionar_evidencias',
    'Gestionar Evidencias',
    'Subir y ver evidencias fotograficas de ordenes',
  ),

  // Agenda
  crearPermiso('atencion_cliente', 'agenda', 'VER', 'Ver Agenda', 'Ver calendario de visitas tecnicas programadas'),
  crearPermiso('atencion_cliente', 'agenda', 'EDITAR', 'Editar Agenda', 'Modificar fechas y horarios de agenda', {
    requiere_auditoria: true,
  }),

  // Catalogos de Atencion al Cliente
  crearPermiso(
    'atencion_cliente',
    'catalogos',
    'VER',
    'Ver Catalogos',
    'Ver catalogos de diagnosticos, soluciones y motivos',
  ),

  // Reportes
  crearPermiso(
    'atencion_cliente',
    'reportes',
    'VER',
    'Ver Reportes',
    'Acceder a reportes de ordenes, tecnicos y materiales',
  ),
  crearPermiso(
    'atencion_cliente',
    'reportes',
    'EXPORTAR',
    'Exportar Reportes',
    'Exportar reportes a PDF y Excel',
  ),

  // =============================================================
  // MODULO: INVENTARIO
  // =============================================================

  // Compras Locales
  crearPermiso('inventario', 'compras', 'VER', 'Ver Compras', 'Ver listado y detalles de compras locales'),
  crearPermiso('inventario', 'compras', 'CREAR', 'Crear Compras', 'Crear nuevas ordenes de compra locales', {
    requiere_auditoria: true,
  }),
  crearPermiso('inventario', 'compras', 'EDITAR', 'Editar Compras', 'Modificar ordenes de compra', {
    requiere_auditoria: true,
  }),
  crearPermiso('inventario', 'compras', 'ELIMINAR', 'Eliminar Compras', 'Eliminar ordenes de compra', {
    es_critico: true,
    requiere_auditoria: true,
  }),
  crearPermisoCustom(
    'inventario',
    'compras',
    'recepcionar',
    'Recepcionar Compras',
    'Recepcionar productos e ingresar al inventario',
    { requiere_auditoria: true },
  ),

  // Importaciones
  crearPermiso('inventario', 'importaciones', 'VER', 'Ver Importaciones', 'Ver listado y detalles de importaciones'),
  crearPermiso('inventario', 'importaciones', 'CREAR', 'Crear Importaciones', 'Crear nuevas importaciones internacionales', {
    requiere_auditoria: true,
  }),
  crearPermiso('inventario', 'importaciones', 'EDITAR', 'Editar Importaciones', 'Modificar importaciones existentes', {
    requiere_auditoria: true,
  }),
  crearPermiso('inventario', 'importaciones', 'ELIMINAR', 'Eliminar Importaciones', 'Eliminar importaciones', {
    es_critico: true,
    requiere_auditoria: true,
  }),
  crearPermisoCustom(
    'inventario',
    'importaciones',
    'gestionar_gastos',
    'Gestionar Gastos',
    'Agregar y eliminar gastos adicionales de importacion',
    { requiere_auditoria: true },
  ),
  crearPermisoCustom(
    'inventario',
    'importaciones',
    'calcular_retaceo',
    'Calcular Retaceo',
    'Calcular distribucion de costos adicionales',
    { requiere_auditoria: true },
  ),
  crearPermisoCustom(
    'inventario',
    'importaciones',
    'recepcionar',
    'Recepcionar Importaciones',
    'Recepcionar productos importados e ingresar al inventario',
    { requiere_auditoria: true },
  ),
  crearPermisoCustom(
    'inventario',
    'importaciones',
    'gestionar_series',
    'Gestionar Series',
    'Administrar numeros de serie de productos importados',
    { requiere_auditoria: true },
  ),
  crearPermiso('inventario', 'importaciones', 'EXPORTAR', 'Exportar Importaciones', 'Generar PDF de retaceo e importacion'),
  crearPermisoCustom(
    'inventario',
    'importaciones',
    'cambiar_estado',
    'Cambiar Estado Importacion',
    'Cambiar el estado de importaciones',
    { requiere_auditoria: true },
  ),

  // Requisiciones
  crearPermiso('inventario', 'requisiciones', 'VER', 'Ver Requisiciones', 'Ver listado y detalles de requisiciones'),
  crearPermiso('inventario', 'requisiciones', 'CREAR', 'Crear Requisiciones', 'Crear nuevas requisiciones de inventario', {
    requiere_auditoria: true,
  }),
  crearPermiso('inventario', 'requisiciones', 'EDITAR', 'Editar Requisiciones', 'Modificar requisiciones pendientes', {
    requiere_auditoria: true,
  }),
  crearPermiso('inventario', 'requisiciones', 'ELIMINAR', 'Eliminar Requisiciones', 'Eliminar requisiciones', {
    es_critico: true,
    requiere_auditoria: true,
  }),
  crearPermiso('inventario', 'requisiciones', 'APROBAR', 'Aprobar Requisiciones', 'Aprobar o rechazar requisiciones', {
    requiere_auditoria: true,
  }),
  crearPermisoCustom(
    'inventario',
    'requisiciones',
    'procesar',
    'Procesar Requisiciones',
    'Procesar requisiciones aprobadas y mover inventario',
    { requiere_auditoria: true },
  ),
  crearPermiso('inventario', 'requisiciones', 'EXPORTAR', 'Exportar Requisiciones', 'Generar PDF de requisiciones'),
  crearPermisoCustom(
    'inventario',
    'requisiciones',
    'cancelar',
    'Cancelar Requisiciones',
    'Cancelar requisiciones pendientes',
    { requiere_auditoria: true },
  ),

  // Ordenes de Salida
  crearPermiso('inventario', 'ordenes_salida', 'VER', 'Ver Ordenes de Salida', 'Ver listado y detalles de ordenes de salida'),
  crearPermiso('inventario', 'ordenes_salida', 'CREAR', 'Crear Ordenes de Salida', 'Crear nuevas ordenes de salida de inventario', {
    requiere_auditoria: true,
  }),
  crearPermiso('inventario', 'ordenes_salida', 'EDITAR', 'Editar Ordenes de Salida', 'Modificar ordenes de salida', {
    requiere_auditoria: true,
  }),
  crearPermiso('inventario', 'ordenes_salida', 'ELIMINAR', 'Eliminar Ordenes de Salida', 'Eliminar ordenes de salida', {
    es_critico: true,
    requiere_auditoria: true,
  }),
  crearPermiso('inventario', 'ordenes_salida', 'APROBAR', 'Aprobar Ordenes de Salida', 'Aprobar o rechazar ordenes de salida', {
    requiere_auditoria: true,
  }),
  crearPermisoCustom(
    'inventario',
    'ordenes_salida',
    'procesar',
    'Procesar Ordenes de Salida',
    'Procesar ordenes de salida y registrar movimientos',
    { requiere_auditoria: true },
  ),
  crearPermiso('inventario', 'ordenes_salida', 'EXPORTAR', 'Exportar Ordenes de Salida', 'Generar PDF de ordenes de salida'),

  // Bodegas
  crearPermiso('inventario', 'bodegas', 'VER', 'Ver Bodegas', 'Ver listado y detalles de bodegas'),
  crearPermiso('inventario', 'bodegas', 'CREAR', 'Crear Bodegas', 'Crear nuevas bodegas de almacenamiento', {
    requiere_auditoria: true,
  }),
  crearPermiso('inventario', 'bodegas', 'EDITAR', 'Editar Bodegas', 'Modificar bodegas existentes', {
    requiere_auditoria: true,
  }),
  crearPermiso('inventario', 'bodegas', 'ELIMINAR', 'Eliminar Bodegas', 'Eliminar bodegas del sistema', {
    es_critico: true,
    requiere_auditoria: true,
  }),

  // Estantes
  crearPermiso('inventario', 'estantes', 'VER', 'Ver Estantes', 'Ver estantes y ubicaciones de bodega'),
  crearPermiso('inventario', 'estantes', 'CREAR', 'Crear Estantes', 'Crear nuevos estantes en bodegas'),
  crearPermiso('inventario', 'estantes', 'EDITAR', 'Editar Estantes', 'Modificar estantes existentes'),
  crearPermiso('inventario', 'estantes', 'ELIMINAR', 'Eliminar Estantes', 'Eliminar estantes de bodegas'),

  // Sucursales
  crearPermiso('inventario', 'sucursales', 'VER', 'Ver Sucursales', 'Ver listado y detalles de sucursales'),
  crearPermiso('inventario', 'sucursales', 'CREAR', 'Crear Sucursales', 'Crear nuevas sucursales', {
    es_critico: true,
    requiere_auditoria: true,
  }),
  crearPermiso('inventario', 'sucursales', 'EDITAR', 'Editar Sucursales', 'Modificar sucursales existentes', {
    es_critico: true,
    requiere_auditoria: true,
  }),
  crearPermiso('inventario', 'sucursales', 'ELIMINAR', 'Eliminar Sucursales', 'Eliminar sucursales', {
    es_critico: true,
    requiere_auditoria: true,
  }),

  // Proveedores
  crearPermiso('inventario', 'proveedores', 'VER', 'Ver Proveedores', 'Ver listado y detalles de proveedores'),
  crearPermiso('inventario', 'proveedores', 'CREAR', 'Crear Proveedores', 'Crear nuevos proveedores', {
    requiere_auditoria: true,
  }),
  crearPermiso('inventario', 'proveedores', 'EDITAR', 'Editar Proveedores', 'Modificar proveedores existentes', {
    requiere_auditoria: true,
  }),
  crearPermiso('inventario', 'proveedores', 'ELIMINAR', 'Eliminar Proveedores', 'Eliminar proveedores', {
    es_critico: true,
    requiere_auditoria: true,
  }),

  // Items de Inventario
  crearPermiso('inventario', 'items', 'VER', 'Ver Inventario', 'Ver existencias y distribucion de inventario'),
  crearPermiso('inventario', 'items', 'CREAR', 'Crear Items Inventario', 'Crear nuevos registros de inventario', {
    requiere_auditoria: true,
  }),
  crearPermisoCustom('inventario', 'items', 'ver_alertas', 'Ver Alertas de Stock', 'Ver alertas de productos con stock bajo'),
  crearPermiso('inventario', 'items', 'EXPORTAR', 'Exportar Inventario', 'Exportar existencias a PDF y Excel'),
  crearPermisoCustom(
    'inventario',
    'items',
    'cargar_excel',
    'Cargar Inventario desde Excel',
    'Cargar inventario masivamente desde archivos Excel',
    { requiere_auditoria: true },
  ),

  // Series
  crearPermiso('inventario', 'series', 'VER', 'Ver Series', 'Buscar y ver numeros de serie de productos'),
  crearPermisoCustom('inventario', 'series', 'gestionar', 'Gestionar Series', 'Crear, editar y eliminar numeros de serie', {
    requiere_auditoria: true,
  }),

  // Movimientos de Inventario
  crearPermiso('inventario', 'movimientos', 'VER', 'Ver Movimientos', 'Ver historial de movimientos de inventario'),

  // Auditorias de Inventario
  crearPermiso('inventario', 'auditorias', 'VER', 'Ver Auditorias', 'Ver listado y detalles de auditorias de inventario'),
  crearPermiso('inventario', 'auditorias', 'CREAR', 'Crear Auditorias', 'Crear nuevas auditorias de inventario', {
    requiere_auditoria: true,
  }),
  crearPermiso('inventario', 'auditorias', 'EDITAR', 'Editar Auditorias', 'Modificar auditorias en curso', {
    requiere_auditoria: true,
  }),
  crearPermiso('inventario', 'auditorias', 'ELIMINAR', 'Eliminar Auditorias', 'Eliminar auditorias', {
    es_critico: true,
    requiere_auditoria: true,
  }),
  crearPermisoCustom(
    'inventario',
    'auditorias',
    'ejecutar',
    'Ejecutar Auditorias',
    'Iniciar conteos, registrar conteos, escanear series',
    { requiere_auditoria: true },
  ),
  crearPermisoCustom(
    'inventario',
    'auditorias',
    'finalizar',
    'Finalizar Auditorias',
    'Finalizar auditorias y ver discrepancias',
    { requiere_auditoria: true },
  ),
  crearPermisoCustom(
    'inventario',
    'auditorias',
    'generar_ajustes',
    'Generar Ajustes',
    'Generar ajustes desde discrepancias',
    { requiere_auditoria: true },
  ),
  crearPermiso('inventario', 'auditorias', 'EXPORTAR', 'Exportar Auditorias', 'Generar PDF de auditorias'),

  // Ajustes de Inventario
  crearPermiso('inventario', 'ajustes', 'VER', 'Ver Ajustes', 'Ver listado de ajustes de inventario'),
  crearPermiso('inventario', 'ajustes', 'APROBAR', 'Aprobar Ajustes', 'Aprobar ajustes de inventario', {
    es_critico: true,
    requiere_auditoria: true,
  }),
  crearPermisoCustom('inventario', 'ajustes', 'aplicar', 'Aplicar Ajustes', 'Aplicar ajustes aprobados al inventario', {
    es_critico: true,
    requiere_auditoria: true,
  }),

  // Catalogos de Inventario
  crearPermiso('inventario', 'catalogos', 'VER', 'Ver Catalogos', 'Ver catalogos auxiliares de inventario'),

  // =============================================================
  // MODULO: FACTURACION
  // =============================================================

  // Ciclos de Facturacion
  crearPermiso('facturacion', 'ciclos', 'VER', 'Ver Ciclos Facturacion', 'Ver listado y detalles de ciclos de facturacion'),
  crearPermiso('facturacion', 'ciclos', 'CREAR', 'Crear Ciclos Facturacion', 'Crear nuevos ciclos de facturacion', {
    requiere_auditoria: true,
  }),
  crearPermiso('facturacion', 'ciclos', 'EDITAR', 'Editar Ciclos Facturacion', 'Modificar ciclos de facturacion existentes', {
    requiere_auditoria: true,
  }),
  crearPermiso('facturacion', 'ciclos', 'ELIMINAR', 'Eliminar Ciclos Facturacion', 'Eliminar ciclos de facturacion', {
    es_critico: true,
    requiere_auditoria: true,
  }),

  // =============================================================
  // MODULO: SMS Y NOTIFICACIONES
  // =============================================================

  crearPermiso('sms', 'mensajes', 'VER', 'Ver SMS', 'Ver historial de mensajes SMS enviados'),
  crearPermisoCustom('sms', 'mensajes', 'enviar', 'Enviar SMS', 'Enviar mensajes SMS individuales', {
    requiere_auditoria: true,
  }),
  crearPermisoCustom(
    'sms',
    'notificaciones',
    'enviar',
    'Enviar Notificaciones',
    'Enviar notificaciones automaticas por SMS',
  ),

  // =============================================================
  // MODULO: DASHBOARDS Y REPORTES
  // =============================================================

  crearPermiso('dashboard', 'ventas', 'VER', 'Ver Dashboard de Ventas', 'Acceder al dashboard principal de ventas'),
  crearPermiso('dashboard', 'inventario', 'VER', 'Ver Dashboard de Inventario', 'Acceder al dashboard de inventario'),
  crearPermiso(
    'dashboard',
    'atencion_cliente',
    'VER',
    'Ver Dashboard de Atencion',
    'Acceder al dashboard de atencion al cliente',
  ),

  // =============================================================
  // MODULO: WHATSAPP CHAT (Atencion al Cliente)
  // =============================================================

  // Chat de WhatsApp
  crearPermiso(
    'atencion_cliente',
    'whatsapp_chat',
    'VER',
    'Ver WhatsApp Chat',
    'Ver conversaciones y mensajes de WhatsApp',
  ),
  crearPermiso('atencion_cliente', 'whatsapp_chat', 'CREAR', 'Crear Chat WhatsApp', 'Iniciar nuevas conversaciones y enviar mensajes', {
    requiere_auditoria: true,
  }),
  crearPermiso('atencion_cliente', 'whatsapp_chat', 'EDITAR', 'Editar Chat WhatsApp', 'Modificar chats, cerrar, archivar conversaciones', {
    requiere_auditoria: true,
  }),
  crearPermiso('atencion_cliente', 'whatsapp_chat', 'ELIMINAR', 'Eliminar Chat WhatsApp', 'Eliminar plantillas y conversaciones', {
    es_critico: true,
    requiere_auditoria: true,
  }),
  crearPermisoCustom(
    'atencion_cliente',
    'whatsapp_chat',
    'asignar',
    'Asignar Chat WhatsApp',
    'Asignar y desasignar chats a agentes',
    { requiere_auditoria: true },
  ),

  // IA de WhatsApp
  crearPermiso(
    'atencion_cliente',
    'whatsapp_ia',
    'VER',
    'Ver Configuracion IA WhatsApp',
    'Ver configuraciones y reglas de IA para WhatsApp',
  ),
  crearPermisoCustom(
    'atencion_cliente',
    'whatsapp_ia',
    'configurar',
    'Configurar IA WhatsApp',
    'Crear, editar y eliminar configuraciones de IA para WhatsApp',
    { es_critico: true, requiere_auditoria: true },
  ),

  // =============================================================
  // PERMISOS ADICIONALES DE INVENTARIO
  // =============================================================

  // Inspecciones de Series
  crearPermiso(
    'inventario',
    'inspecciones',
    'VER',
    'Ver Inspecciones',
    'Ver conteos y estado de series en inspeccion',
  ),
  crearPermiso('inventario', 'inspecciones', 'CREAR', 'Crear Inspecciones', 'Registrar inspecciones de equipos devueltos', {
    requiere_auditoria: true,
  }),

  // Reparaciones de Series
  crearPermiso('inventario', 'reparaciones', 'CREAR', 'Completar Reparaciones', 'Registrar resultado de reparaciones de equipos', {
    requiere_auditoria: true,
  }),

  // Series - Permisos granulares adicionales
  crearPermiso('inventario', 'series', 'CREAR', 'Crear Series', 'Agregar numeros de serie manualmente al inventario', {
    requiere_auditoria: true,
  }),
  crearPermiso('inventario', 'series', 'EDITAR', 'Editar Series', 'Cambiar estado de series directamente', {
    requiere_auditoria: true,
  }),

  // Ordenes de Salida - Permisos de workflow adicionales
  crearPermisoCustom(
    'inventario',
    'ordenes_salida',
    'enviar_autorizacion',
    'Enviar Orden a Autorizacion',
    'Enviar ordenes de salida para su autorizacion',
    { requiere_auditoria: true },
  ),
  crearPermisoCustom(
    'inventario',
    'ordenes_salida',
    'rechazar',
    'Rechazar Ordenes de Salida',
    'Rechazar ordenes de salida pendientes de autorizacion',
    { requiere_auditoria: true },
  ),
  crearPermisoCustom(
    'inventario',
    'ordenes_salida',
    'cancelar',
    'Cancelar Ordenes de Salida',
    'Cancelar ordenes de salida no procesadas',
    { requiere_auditoria: true },
  ),

  // Auditorias - Permiso adicional
  crearPermisoCustom(
    'inventario',
    'auditorias',
    'finalizar_directo',
    'Finalizar Auditoria Directamente',
    'Finalizar auditorias sin generar ajustes automaticos',
    { es_critico: true, requiere_auditoria: true },
  ),

  // Catalogo de Inventario - Permiso de edicion
  crearPermiso(
    'inventario',
    'catalogo',
    'EDITAR',
    'Editar Catalogo Inventario',
    'Modificar parametros ROP y configuraciones de catalogo de inventario',
    { requiere_auditoria: true },
  ),
];

/**
 * Validar que no hay codigos duplicados en PERMISOS_MAESTROS
 * Se ejecuta al cargar el modulo
 */
function validarPermisosMaestros(): void {
  const codigos = new Set<string>();
  const duplicados: string[] = [];

  PERMISOS_MAESTROS.forEach((p) => {
    if (codigos.has(p.codigo)) {
      duplicados.push(p.codigo);
    }
    codigos.add(p.codigo);
  });

  if (duplicados.length > 0) {
    throw new Error(`Codigos de permiso duplicados encontrados: ${duplicados.join(', ')}`);
  }
}

// Validar al cargar el modulo
validarPermisosMaestros();

/**
 * Obtener todos los modulos unicos
 */
export const MODULOS_DISPONIBLES = [...new Set(PERMISOS_MAESTROS.map((p) => p.modulo))];

/**
 * Obtener permisos por modulo
 */
export function getPermisosPorModulo(modulo: string): PermisoDefinition[] {
  return PERMISOS_MAESTROS.filter((p) => p.modulo === modulo);
}

/**
 * Obtener permisos que coincidan con un patron
 * @param patron Patron tipo "inventario.*" o "inventario.compras:*"
 */
export function getPermisosPorPatron(patron: string): PermisoDefinition[] {
  // Convertir patron a regex
  const regexStr = patron.replace(/\./g, '\\.').replace(/\*/g, '.*');
  const regex = new RegExp(`^${regexStr}$`);

  return PERMISOS_MAESTROS.filter((p) => regex.test(p.codigo));
}
