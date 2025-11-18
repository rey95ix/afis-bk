-- =====================================================
-- PERMISOS COMPLETOS DEL SISTEMA AFIS
-- =====================================================
-- Este archivo contiene TODOS los permisos del sistema
-- organizados por módulo y recurso
-- Formato: {modulo}.{recurso}:{accion}
-- =====================================================

-- =====================================================
-- MÓDULO: AUTH (Autenticación y Gestión de Permisos)
-- =====================================================

-- Gestión de Permisos
INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('auth.permissions:ver', 'Ver Permisos', 'Ver listado y detalles de permisos del sistema', 'auth', 'permissions', 'VER', 'RECURSO', 'ACTIVO', false, false),
('auth.permissions:crear', 'Crear Permisos', 'Crear nuevos permisos en el sistema', 'auth', 'permissions', 'CREAR', 'RECURSO', 'ACTIVO', true, true),
('auth.permissions:editar', 'Editar Permisos', 'Modificar permisos existentes', 'auth', 'permissions', 'EDITAR', 'RECURSO', 'ACTIVO', true, true),
('auth.permissions:eliminar', 'Eliminar Permisos', 'Desactivar permisos del sistema', 'auth', 'permissions', 'ELIMINAR', 'RECURSO', 'ACTIVO', true, true),
('auth.permissions:asignar_politica', 'Asignar Políticas', 'Asignar políticas condicionales a permisos', 'auth', 'permissions', 'CUSTOM', 'RECURSO', 'ACTIVO', true, true);

-- Gestión de Políticas
INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('auth.policies:ver', 'Ver Políticas', 'Ver listado y detalles de políticas de autorización', 'auth', 'policies', 'VER', 'RECURSO', 'ACTIVO', false, false),
('auth.policies:crear', 'Crear Políticas', 'Crear nuevas políticas condicionales', 'auth', 'policies', 'CREAR', 'RECURSO', 'ACTIVO', true, true),
('auth.policies:editar', 'Editar Políticas', 'Modificar políticas existentes', 'auth', 'policies', 'EDITAR', 'RECURSO', 'ACTIVO', true, true),
('auth.policies:eliminar', 'Eliminar Políticas', 'Desactivar políticas del sistema', 'auth', 'policies', 'ELIMINAR', 'RECURSO', 'ACTIVO', true, true),
('auth.policies:probar', 'Probar Políticas', 'Ejecutar pruebas de evaluación de políticas', 'auth', 'policies', 'CUSTOM', 'RECURSO', 'ACTIVO', false, false);

-- Gestión de Permisos de Usuario
INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('auth.user_permissions:ver', 'Ver Permisos de Usuarios', 'Ver permisos asignados a usuarios específicos', 'auth', 'user_permissions', 'VER', 'RECURSO', 'ACTIVO', false, false),
('auth.user_permissions:asignar', 'Asignar Permisos a Usuarios', 'Asignar permisos individuales a usuarios', 'auth', 'user_permissions', 'CUSTOM', 'RECURSO', 'ACTIVO', true, true),
('auth.user_permissions:revocar', 'Revocar Permisos de Usuarios', 'Remover permisos individuales de usuarios', 'auth', 'user_permissions', 'CUSTOM', 'RECURSO', 'ACTIVO', true, true);

-- =====================================================
-- MÓDULO: ADMINISTRACION
-- =====================================================

-- Usuarios
INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('administracion.usuarios:ver', 'Ver Usuarios', 'Ver listado y detalles de usuarios del sistema', 'administracion', 'usuarios', 'VER', 'RECURSO', 'ACTIVO', false, false),
('administracion.usuarios:crear', 'Crear Usuarios', 'Crear nuevos usuarios en el sistema', 'administracion', 'usuarios', 'CREAR', 'RECURSO', 'ACTIVO', true, true),
('administracion.usuarios:editar', 'Editar Usuarios', 'Modificar información de usuarios existentes', 'administracion', 'usuarios', 'EDITAR', 'RECURSO', 'ACTIVO', true, true),
('administracion.usuarios:eliminar', 'Eliminar Usuarios', 'Inactivar usuarios del sistema', 'administracion', 'usuarios', 'ELIMINAR', 'RECURSO', 'ACTIVO', true, true),
('administracion.usuarios:cambiar_password', 'Cambiar Contraseñas', 'Cambiar contraseñas de otros usuarios', 'administracion', 'usuarios', 'CUSTOM', 'RECURSO', 'ACTIVO', true, true);

-- Roles
INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('administracion.roles:ver', 'Ver Roles', 'Ver listado y detalles de roles del sistema', 'administracion', 'roles', 'VER', 'RECURSO', 'ACTIVO', false, false),
('administracion.roles:crear', 'Crear Roles', 'Crear nuevos roles', 'administracion', 'roles', 'CREAR', 'RECURSO', 'ACTIVO', true, true),
('administracion.roles:editar', 'Editar Roles', 'Modificar roles existentes', 'administracion', 'roles', 'EDITAR', 'RECURSO', 'ACTIVO', true, true),
('administracion.roles:eliminar', 'Eliminar Roles', 'Eliminar roles del sistema', 'administracion', 'roles', 'ELIMINAR', 'RECURSO', 'ACTIVO', true, true),
('administracion.roles:asignar_permisos', 'Asignar Permisos a Roles', 'Gestionar permisos asignados a roles', 'administracion', 'roles', 'CUSTOM', 'RECURSO', 'ACTIVO', true, true);

-- Catálogo de Productos
INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('administracion.catalogo:ver', 'Ver Catálogo', 'Ver listado y detalles de productos del catálogo', 'administracion', 'catalogo', 'VER', 'RECURSO', 'ACTIVO', false, false),
('administracion.catalogo:crear', 'Crear Productos', 'Crear nuevos productos en el catálogo', 'administracion', 'catalogo', 'CREAR', 'RECURSO', 'ACTIVO', false, true),
('administracion.catalogo:editar', 'Editar Productos', 'Modificar productos del catálogo', 'administracion', 'catalogo', 'EDITAR', 'RECURSO', 'ACTIVO', false, true),
('administracion.catalogo:eliminar', 'Eliminar Productos', 'Eliminar productos del catálogo', 'administracion', 'catalogo', 'ELIMINAR', 'RECURSO', 'ACTIVO', true, true);

-- Categorías
INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('administracion.categorias:ver', 'Ver Categorías', 'Ver listado y detalles de categorías de productos', 'administracion', 'categorias', 'VER', 'RECURSO', 'ACTIVO', false, false),
('administracion.categorias:crear', 'Crear Categorías', 'Crear nuevas categorías de productos', 'administracion', 'categorias', 'CREAR', 'RECURSO', 'ACTIVO', false, true),
('administracion.categorias:editar', 'Editar Categorías', 'Modificar categorías existentes', 'administracion', 'categorias', 'EDITAR', 'RECURSO', 'ACTIVO', false, true),
('administracion.categorias:eliminar', 'Eliminar Categorías', 'Eliminar categorías de productos', 'administracion', 'categorias', 'ELIMINAR', 'RECURSO', 'ACTIVO', true, true);

-- Geografía - Departamentos
INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('administracion.departamentos:ver', 'Ver Departamentos', 'Ver catálogo de departamentos de El Salvador', 'administracion', 'departamentos', 'VER', 'RECURSO', 'ACTIVO', false, false);

-- Geografía - Municipios
INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('administracion.municipios:ver', 'Ver Municipios', 'Ver catálogo de municipios de El Salvador', 'administracion', 'municipios', 'VER', 'RECURSO', 'ACTIVO', false, false);

-- Geografía - Colonias
INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('administracion.colonias:ver', 'Ver Colonias', 'Ver catálogo de colonias y barrios', 'administracion', 'colonias', 'VER', 'RECURSO', 'ACTIVO', false, false),
('administracion.colonias:crear', 'Crear Colonias', 'Agregar nuevas colonias al catálogo', 'administracion', 'colonias', 'CREAR', 'RECURSO', 'ACTIVO', false, false),
('administracion.colonias:editar', 'Editar Colonias', 'Modificar colonias existentes', 'administracion', 'colonias', 'EDITAR', 'RECURSO', 'ACTIVO', false, false),
('administracion.colonias:eliminar', 'Eliminar Colonias', 'Eliminar colonias del catálogo', 'administracion', 'colonias', 'ELIMINAR', 'RECURSO', 'ACTIVO', false, false);

-- DTE (Documentos Tributarios Electrónicos)
INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('administracion.dte:ver', 'Ver Catálogos DTE', 'Ver catálogos de documentos tributarios electrónicos', 'administracion', 'dte', 'VER', 'RECURSO', 'ACTIVO', false, false);

-- Diagnósticos
INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('administracion.diagnosticos:ver', 'Ver Diagnósticos', 'Ver catálogo de diagnósticos técnicos', 'administracion', 'diagnosticos', 'VER', 'RECURSO', 'ACTIVO', false, false),
('administracion.diagnosticos:crear', 'Crear Diagnósticos', 'Agregar nuevos diagnósticos al catálogo', 'administracion', 'diagnosticos', 'CREAR', 'RECURSO', 'ACTIVO', false, false),
('administracion.diagnosticos:editar', 'Editar Diagnósticos', 'Modificar diagnósticos existentes', 'administracion', 'diagnosticos', 'EDITAR', 'RECURSO', 'ACTIVO', false, false),
('administracion.diagnosticos:eliminar', 'Eliminar Diagnósticos', 'Eliminar diagnósticos del catálogo', 'administracion', 'diagnosticos', 'ELIMINAR', 'RECURSO', 'ACTIVO', false, false);

-- =====================================================
-- MÓDULO: ATENCIÓN AL CLIENTE
-- =====================================================

-- Clientes
INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('atencion_cliente.clientes:ver', 'Ver Clientes', 'Ver listado y detalles de clientes', 'atencion_cliente', 'clientes', 'VER', 'RECURSO', 'ACTIVO', false, false),
('atencion_cliente.clientes:crear', 'Crear Clientes', 'Registrar nuevos clientes en el sistema', 'atencion_cliente', 'clientes', 'CREAR', 'RECURSO', 'ACTIVO', false, true),
('atencion_cliente.clientes:editar', 'Editar Clientes', 'Modificar información de clientes', 'atencion_cliente', 'clientes', 'EDITAR', 'RECURSO', 'ACTIVO', false, true),
('atencion_cliente.clientes:eliminar', 'Eliminar Clientes', 'Inactivar clientes del sistema', 'atencion_cliente', 'clientes', 'ELIMINAR', 'RECURSO', 'ACTIVO', true, true),
('atencion_cliente.clientes:gestionar_documentos', 'Gestionar Documentos de Clientes', 'Subir, ver y eliminar documentos de clientes', 'atencion_cliente', 'clientes', 'CUSTOM', 'RECURSO', 'ACTIVO', false, false),
('atencion_cliente.clientes:gestionar_direcciones', 'Gestionar Direcciones', 'Administrar direcciones de servicio de clientes', 'atencion_cliente', 'clientes', 'CUSTOM', 'RECURSO', 'ACTIVO', false, false),
('atencion_cliente.clientes:gestionar_facturacion', 'Gestionar Datos de Facturación', 'Administrar datos de facturación de clientes', 'atencion_cliente', 'clientes', 'CUSTOM', 'RECURSO', 'ACTIVO', false, true);

-- Tickets
INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('atencion_cliente.tickets:ver', 'Ver Tickets', 'Ver listado y detalles de tickets de soporte', 'atencion_cliente', 'tickets', 'VER', 'RECURSO', 'ACTIVO', false, false),
('atencion_cliente.tickets:crear', 'Crear Tickets', 'Crear nuevos tickets de soporte', 'atencion_cliente', 'tickets', 'CREAR', 'RECURSO', 'ACTIVO', false, true),
('atencion_cliente.tickets:editar', 'Editar Tickets', 'Modificar tickets existentes', 'atencion_cliente', 'tickets', 'EDITAR', 'RECURSO', 'ACTIVO', false, true),
('atencion_cliente.tickets:escalar', 'Escalar Tickets', 'Escalar tickets a órdenes de trabajo', 'atencion_cliente', 'tickets', 'CUSTOM', 'RECURSO', 'ACTIVO', false, true),
('atencion_cliente.tickets:cerrar', 'Cerrar Tickets', 'Cerrar tickets resueltos', 'atencion_cliente', 'tickets', 'CUSTOM', 'RECURSO', 'ACTIVO', false, true);

-- Órdenes de Trabajo
INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('atencion_cliente.ordenes:ver', 'Ver Órdenes de Trabajo', 'Ver listado y detalles de órdenes de trabajo', 'atencion_cliente', 'ordenes', 'VER', 'RECURSO', 'ACTIVO', false, false),
('atencion_cliente.ordenes:crear', 'Crear Órdenes de Trabajo', 'Crear nuevas órdenes de trabajo', 'atencion_cliente', 'ordenes', 'CREAR', 'RECURSO', 'ACTIVO', false, true),
('atencion_cliente.ordenes:editar', 'Editar Órdenes de Trabajo', 'Modificar órdenes de trabajo', 'atencion_cliente', 'ordenes', 'EDITAR', 'RECURSO', 'ACTIVO', false, true),
('atencion_cliente.ordenes:asignar', 'Asignar Órdenes', 'Asignar órdenes de trabajo a técnicos', 'atencion_cliente', 'ordenes', 'CUSTOM', 'RECURSO', 'ACTIVO', false, true),
('atencion_cliente.ordenes:agendar', 'Agendar Visitas', 'Agendar y reprogramar visitas técnicas', 'atencion_cliente', 'ordenes', 'CUSTOM', 'RECURSO', 'ACTIVO', false, true),
('atencion_cliente.ordenes:ejecutar', 'Ejecutar Órdenes', 'Iniciar, agregar actividades y materiales a órdenes', 'atencion_cliente', 'ordenes', 'CUSTOM', 'RECURSO', 'ACTIVO', false, true),
('atencion_cliente.ordenes:cerrar', 'Cerrar Órdenes', 'Cerrar órdenes de trabajo completadas', 'atencion_cliente', 'ordenes', 'CUSTOM', 'RECURSO', 'ACTIVO', false, true),
('atencion_cliente.ordenes:gestionar_evidencias', 'Gestionar Evidencias', 'Subir y ver evidencias fotográficas de órdenes', 'atencion_cliente', 'ordenes', 'CUSTOM', 'RECURSO', 'ACTIVO', false, false);

-- Agenda
INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('atencion_cliente.agenda:ver', 'Ver Agenda', 'Ver calendario de visitas técnicas programadas', 'atencion_cliente', 'agenda', 'VER', 'RECURSO', 'ACTIVO', false, false),
('atencion_cliente.agenda:editar', 'Editar Agenda', 'Modificar fechas y horarios de agenda', 'atencion_cliente', 'agenda', 'EDITAR', 'RECURSO', 'ACTIVO', false, true);

-- Catálogos de Atención al Cliente
INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('atencion_cliente.catalogos:ver', 'Ver Catálogos', 'Ver catálogos de diagnósticos, soluciones y motivos', 'atencion_cliente', 'catalogos', 'VER', 'RECURSO', 'ACTIVO', false, false);

-- Reportes
INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('atencion_cliente.reportes:ver', 'Ver Reportes', 'Acceder a reportes de órdenes, técnicos y materiales', 'atencion_cliente', 'reportes', 'VER', 'RECURSO', 'ACTIVO', false, false),
('atencion_cliente.reportes:exportar', 'Exportar Reportes', 'Exportar reportes a PDF y Excel', 'atencion_cliente', 'reportes', 'EXPORTAR', 'RECURSO', 'ACTIVO', false, false);

-- =====================================================
-- MÓDULO: INVENTARIO
-- =====================================================

-- Compras Locales
INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('inventario.compras:ver', 'Ver Compras', 'Ver listado y detalles de compras locales', 'inventario', 'compras', 'VER', 'RECURSO', 'ACTIVO', false, false),
('inventario.compras:crear', 'Crear Compras', 'Crear nuevas órdenes de compra locales', 'inventario', 'compras', 'CREAR', 'RECURSO', 'ACTIVO', false, true),
('inventario.compras:editar', 'Editar Compras', 'Modificar órdenes de compra', 'inventario', 'compras', 'EDITAR', 'RECURSO', 'ACTIVO', false, true),
('inventario.compras:eliminar', 'Eliminar Compras', 'Eliminar órdenes de compra', 'inventario', 'compras', 'ELIMINAR', 'RECURSO', 'ACTIVO', true, true),
('inventario.compras:recepcionar', 'Recepcionar Compras', 'Recepcionar productos e ingresar al inventario', 'inventario', 'compras', 'CUSTOM', 'RECURSO', 'ACTIVO', false, true);

-- Importaciones
INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('inventario.importaciones:ver', 'Ver Importaciones', 'Ver listado y detalles de importaciones', 'inventario', 'importaciones', 'VER', 'RECURSO', 'ACTIVO', false, false),
('inventario.importaciones:crear', 'Crear Importaciones', 'Crear nuevas importaciones internacionales', 'inventario', 'importaciones', 'CREAR', 'RECURSO', 'ACTIVO', false, true),
('inventario.importaciones:editar', 'Editar Importaciones', 'Modificar importaciones existentes', 'inventario', 'importaciones', 'EDITAR', 'RECURSO', 'ACTIVO', false, true),
('inventario.importaciones:eliminar', 'Eliminar Importaciones', 'Eliminar importaciones', 'inventario', 'importaciones', 'ELIMINAR', 'RECURSO', 'ACTIVO', true, true),
('inventario.importaciones:gestionar_gastos', 'Gestionar Gastos', 'Agregar y eliminar gastos adicionales de importación', 'inventario', 'importaciones', 'CUSTOM', 'RECURSO', 'ACTIVO', false, true),
('inventario.importaciones:calcular_retaceo', 'Calcular Retaceo', 'Calcular distribución de costos adicionales', 'inventario', 'importaciones', 'CUSTOM', 'RECURSO', 'ACTIVO', false, true),
('inventario.importaciones:recepcionar', 'Recepcionar Importaciones', 'Recepcionar productos importados e ingresar al inventario', 'inventario', 'importaciones', 'CUSTOM', 'RECURSO', 'ACTIVO', false, true),
('inventario.importaciones:gestionar_series', 'Gestionar Series', 'Administrar números de serie de productos importados', 'inventario', 'importaciones', 'CUSTOM', 'RECURSO', 'ACTIVO', false, true),
('inventario.importaciones:exportar', 'Exportar Importaciones', 'Generar PDF de retaceo e importación', 'inventario', 'importaciones', 'EXPORTAR', 'RECURSO', 'ACTIVO', false, false);

-- Requisiciones
INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('inventario.requisiciones:ver', 'Ver Requisiciones', 'Ver listado y detalles de requisiciones', 'inventario', 'requisiciones', 'VER', 'RECURSO', 'ACTIVO', false, false),
('inventario.requisiciones:crear', 'Crear Requisiciones', 'Crear nuevas requisiciones de inventario', 'inventario', 'requisiciones', 'CREAR', 'RECURSO', 'ACTIVO', false, true),
('inventario.requisiciones:editar', 'Editar Requisiciones', 'Modificar requisiciones pendientes', 'inventario', 'requisiciones', 'EDITAR', 'RECURSO', 'ACTIVO', false, true),
('inventario.requisiciones:eliminar', 'Eliminar Requisiciones', 'Eliminar requisiciones', 'inventario', 'requisiciones', 'ELIMINAR', 'RECURSO', 'ACTIVO', true, true),
('inventario.requisiciones:aprobar', 'Aprobar Requisiciones', 'Aprobar o rechazar requisiciones', 'inventario', 'requisiciones', 'APROBAR', 'RECURSO', 'ACTIVO', false, true),
('inventario.requisiciones:procesar', 'Procesar Requisiciones', 'Procesar requisiciones aprobadas y mover inventario', 'inventario', 'requisiciones', 'CUSTOM', 'RECURSO', 'ACTIVO', false, true),
('inventario.requisiciones:exportar', 'Exportar Requisiciones', 'Generar PDF de requisiciones', 'inventario', 'requisiciones', 'EXPORTAR', 'RECURSO', 'ACTIVO', false, false);

-- Órdenes de Salida
INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('inventario.ordenes_salida:ver', 'Ver Órdenes de Salida', 'Ver listado y detalles de órdenes de salida', 'inventario', 'ordenes_salida', 'VER', 'RECURSO', 'ACTIVO', false, false),
('inventario.ordenes_salida:crear', 'Crear Órdenes de Salida', 'Crear nuevas órdenes de salida de inventario', 'inventario', 'ordenes_salida', 'CREAR', 'RECURSO', 'ACTIVO', false, true),
('inventario.ordenes_salida:editar', 'Editar Órdenes de Salida', 'Modificar órdenes de salida', 'inventario', 'ordenes_salida', 'EDITAR', 'RECURSO', 'ACTIVO', false, true),
('inventario.ordenes_salida:eliminar', 'Eliminar Órdenes de Salida', 'Eliminar órdenes de salida', 'inventario', 'ordenes_salida', 'ELIMINAR', 'RECURSO', 'ACTIVO', true, true),
('inventario.ordenes_salida:aprobar', 'Aprobar Órdenes de Salida', 'Aprobar o rechazar órdenes de salida', 'inventario', 'ordenes_salida', 'APROBAR', 'RECURSO', 'ACTIVO', false, true),
('inventario.ordenes_salida:procesar', 'Procesar Órdenes de Salida', 'Procesar órdenes de salida y registrar movimientos', 'inventario', 'ordenes_salida', 'CUSTOM', 'RECURSO', 'ACTIVO', false, true),
('inventario.ordenes_salida:exportar', 'Exportar Órdenes de Salida', 'Generar PDF de órdenes de salida', 'inventario', 'ordenes_salida', 'EXPORTAR', 'RECURSO', 'ACTIVO', false, false);

-- Bodegas
INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('inventario.bodegas:ver', 'Ver Bodegas', 'Ver listado y detalles de bodegas', 'inventario', 'bodegas', 'VER', 'RECURSO', 'ACTIVO', false, false),
('inventario.bodegas:crear', 'Crear Bodegas', 'Crear nuevas bodegas de almacenamiento', 'inventario', 'bodegas', 'CREAR', 'RECURSO', 'ACTIVO', false, true),
('inventario.bodegas:editar', 'Editar Bodegas', 'Modificar bodegas existentes', 'inventario', 'bodegas', 'EDITAR', 'RECURSO', 'ACTIVO', false, true),
('inventario.bodegas:eliminar', 'Eliminar Bodegas', 'Eliminar bodegas del sistema', 'inventario', 'bodegas', 'ELIMINAR', 'RECURSO', 'ACTIVO', true, true);

-- Estantes
INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('inventario.estantes:ver', 'Ver Estantes', 'Ver estantes y ubicaciones de bodega', 'inventario', 'estantes', 'VER', 'RECURSO', 'ACTIVO', false, false),
('inventario.estantes:crear', 'Crear Estantes', 'Crear nuevos estantes en bodegas', 'inventario', 'estantes', 'CREAR', 'RECURSO', 'ACTIVO', false, false),
('inventario.estantes:editar', 'Editar Estantes', 'Modificar estantes existentes', 'inventario', 'estantes', 'EDITAR', 'RECURSO', 'ACTIVO', false, false),
('inventario.estantes:eliminar', 'Eliminar Estantes', 'Eliminar estantes de bodegas', 'inventario', 'estantes', 'ELIMINAR', 'RECURSO', 'ACTIVO', false, false);

-- Sucursales
INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('inventario.sucursales:ver', 'Ver Sucursales', 'Ver listado y detalles de sucursales', 'inventario', 'sucursales', 'VER', 'RECURSO', 'ACTIVO', false, false),
('inventario.sucursales:crear', 'Crear Sucursales', 'Crear nuevas sucursales', 'inventario', 'sucursales', 'CREAR', 'RECURSO', 'ACTIVO', true, true),
('inventario.sucursales:editar', 'Editar Sucursales', 'Modificar sucursales existentes', 'inventario', 'sucursales', 'EDITAR', 'RECURSO', 'ACTIVO', true, true),
('inventario.sucursales:eliminar', 'Eliminar Sucursales', 'Eliminar sucursales', 'inventario', 'sucursales', 'ELIMINAR', 'RECURSO', 'ACTIVO', true, true);

-- Proveedores
INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('inventario.proveedores:ver', 'Ver Proveedores', 'Ver listado y detalles de proveedores', 'inventario', 'proveedores', 'VER', 'RECURSO', 'ACTIVO', false, false),
('inventario.proveedores:crear', 'Crear Proveedores', 'Crear nuevos proveedores', 'inventario', 'proveedores', 'CREAR', 'RECURSO', 'ACTIVO', false, true),
('inventario.proveedores:editar', 'Editar Proveedores', 'Modificar proveedores existentes', 'inventario', 'proveedores', 'EDITAR', 'RECURSO', 'ACTIVO', false, true),
('inventario.proveedores:eliminar', 'Eliminar Proveedores', 'Eliminar proveedores', 'inventario', 'proveedores', 'ELIMINAR', 'RECURSO', 'ACTIVO', true, true);

-- Items de Inventario
INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('inventario.items:ver', 'Ver Inventario', 'Ver existencias y distribución de inventario', 'inventario', 'items', 'VER', 'RECURSO', 'ACTIVO', false, false),
('inventario.items:ver_alertas', 'Ver Alertas de Stock', 'Ver alertas de productos con stock bajo', 'inventario', 'items', 'VER', 'RECURSO', 'ACTIVO', false, false),
('inventario.items:exportar', 'Exportar Inventario', 'Exportar existencias a PDF y Excel', 'inventario', 'items', 'EXPORTAR', 'RECURSO', 'ACTIVO', false, false);

-- Series
INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('inventario.series:ver', 'Ver Series', 'Buscar y ver números de serie de productos', 'inventario', 'series', 'VER', 'RECURSO', 'ACTIVO', false, false),
('inventario.series:gestionar', 'Gestionar Series', 'Crear, editar y eliminar números de serie', 'inventario', 'series', 'CUSTOM', 'RECURSO', 'ACTIVO', false, true);

-- Movimientos de Inventario
INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('inventario.movimientos:ver', 'Ver Movimientos', 'Ver historial de movimientos de inventario', 'inventario', 'movimientos', 'VER', 'RECURSO', 'ACTIVO', false, false);

-- Auditorías de Inventario
INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('inventario.auditorias:ver', 'Ver Auditorías', 'Ver listado y detalles de auditorías de inventario', 'inventario', 'auditorias', 'VER', 'RECURSO', 'ACTIVO', false, false),
('inventario.auditorias:crear', 'Crear Auditorías', 'Crear nuevas auditorías de inventario', 'inventario', 'auditorias', 'CREAR', 'RECURSO', 'ACTIVO', false, true),
('inventario.auditorias:editar', 'Editar Auditorías', 'Modificar auditorías en curso', 'inventario', 'auditorias', 'EDITAR', 'RECURSO', 'ACTIVO', false, true),
('inventario.auditorias:eliminar', 'Eliminar Auditorías', 'Eliminar auditorías', 'inventario', 'auditorias', 'ELIMINAR', 'RECURSO', 'ACTIVO', true, true),
('inventario.auditorias:ejecutar', 'Ejecutar Auditorías', 'Iniciar conteos, registrar conteos, escanear series', 'inventario', 'auditorias', 'CUSTOM', 'RECURSO', 'ACTIVO', false, true),
('inventario.auditorias:finalizar', 'Finalizar Auditorías', 'Finalizar auditorías y ver discrepancias', 'inventario', 'auditorias', 'CUSTOM', 'RECURSO', 'ACTIVO', false, true),
('inventario.auditorias:generar_ajustes', 'Generar Ajustes', 'Generar ajustes desde discrepancias', 'inventario', 'auditorias', 'CUSTOM', 'RECURSO', 'ACTIVO', false, true),
('inventario.auditorias:exportar', 'Exportar Auditorías', 'Generar PDF de auditorías', 'inventario', 'auditorias', 'EXPORTAR', 'RECURSO', 'ACTIVO', false, false);

-- Ajustes de Inventario
INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('inventario.ajustes:ver', 'Ver Ajustes', 'Ver listado de ajustes de inventario', 'inventario', 'ajustes', 'VER', 'RECURSO', 'ACTIVO', false, false),
('inventario.ajustes:aprobar', 'Aprobar Ajustes', 'Aprobar ajustes de inventario', 'inventario', 'ajustes', 'APROBAR', 'RECURSO', 'ACTIVO', true, true),
('inventario.ajustes:aplicar', 'Aplicar Ajustes', 'Aplicar ajustes aprobados al inventario', 'inventario', 'ajustes', 'CUSTOM', 'RECURSO', 'ACTIVO', true, true);

-- Catálogos de Inventario
INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('inventario.catalogos:ver', 'Ver Catálogos', 'Ver catálogos auxiliares de inventario', 'inventario', 'catalogos', 'VER', 'RECURSO', 'ACTIVO', false, false);

-- =====================================================
-- MÓDULO: SMS Y NOTIFICACIONES
-- =====================================================

INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('sms.mensajes:ver', 'Ver SMS', 'Ver historial de mensajes SMS enviados', 'sms', 'mensajes', 'VER', 'RECURSO', 'ACTIVO', false, false),
('sms.mensajes:enviar', 'Enviar SMS', 'Enviar mensajes SMS individuales', 'sms', 'mensajes', 'CUSTOM', 'RECURSO', 'ACTIVO', false, true),
('sms.notificaciones:enviar', 'Enviar Notificaciones', 'Enviar notificaciones automáticas por SMS', 'sms', 'notificaciones', 'CUSTOM', 'RECURSO', 'ACTIVO', false, false);

-- =====================================================
-- MÓDULO: DASHBOARDS Y REPORTES
-- =====================================================

INSERT INTO permisos (codigo, nombre, descripcion, modulo, recurso, accion, tipo, estado, es_critico, requiere_auditoria) VALUES
('dashboard.ventas:ver', 'Ver Dashboard de Ventas', 'Acceder al dashboard principal de ventas', 'dashboard', 'ventas', 'VER', 'RECURSO', 'ACTIVO', false, false),
('dashboard.inventario:ver', 'Ver Dashboard de Inventario', 'Acceder al dashboard de inventario', 'dashboard', 'inventario', 'VER', 'RECURSO', 'ACTIVO', false, false),
('dashboard.atencion_cliente:ver', 'Ver Dashboard de Atención', 'Acceder al dashboard de atención al cliente', 'dashboard', 'atencion_cliente', 'VER', 'RECURSO', 'ACTIVO', false, false);

-- =====================================================
-- FIN DEL ARCHIVO
-- =====================================================
