import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

//TODO: ELIMINAR AL FINALIZAR MIGRACIONES 
import { formatNumberDecimal } from 'src/common/helpers';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SeedService {
  private readonly logger = new Logger('UsersService');

  constructor(private readonly prisma: PrismaService) { }


  async executeSeed() {
    try {


      //SUCURSAL DEMO
      await this.prisma.sucursales.createMany({
        data: [
          {
            nombre: 'Casa Matriz',
            correo: 'demo@demo.com',
            telefono: '60457278',
            complemento: 'San salvador',
            id_municipio: 1,
            id_tipo_establecimiento: 2,
          },
        ],
      });

      //ROLS DEMO
      await this.prisma.roles.createMany({
        data: [
          { nombre: 'Admin', descripcion: 'Administrador total del sistema' },
          { nombre: 'Facturacion', descripcion: 'Personal de facturación' },
          { nombre: 'Inventario', descripcion: 'Gestión de inventario y compras' },
          { nombre: 'Atencion Cliente', descripcion: 'Soporte y atención al cliente' },
          { nombre: 'Tecnico', descripcion: 'Técnico de campo para órdenes de trabajo' },
        ],
      });

      // ============= SEED DE PERMISOS Y POLÍTICAS =============
      await this.seedPermisosYPoliticas();

      //USUARIO DEMO
      const salt = bcrypt.genSaltSync();
      let password = bcrypt.hashSync('***123$$$', salt);

      await this.prisma.usuarios.create({
        data: {
          nombres: 'Usuario',
          apellidos: 'Demo',
          usuario: 'sysadmin@ixc.com',
          dui: '1234567890',
          password: password,
          id_rol: 1,
          id_sucursal: 1,
        },
      });

      await this.prisma.facturasTipos.createMany({
        data: [
          { id_tipo_factura: 1, version: 1, nombre: 'Factura', codigo: '01' },
          {
            id_tipo_factura: 2,
            version: 3,
            nombre: 'Comprobante de crédito fiscal',
            codigo: '03',
          },
          {
            id_tipo_factura: 3,
            version: 3,
            nombre: 'Nota de remisión',
            codigo: '04',
            activo: 'INACTIVO',
          },
          {
            id_tipo_factura: 4,
            version: 3,
            nombre: 'Nota de crédito',
            codigo: '05',
            activo: 'INACTIVO',
          },
          {
            id_tipo_factura: 5,
            version: 3,
            nombre: 'Nota de debito',
            codigo: '06',
            activo: 'INACTIVO',
          },
          {
            id_tipo_factura: 6,
            version: 1,
            nombre: 'Comprobante de retención',
            codigo: '07',
            activo: 'INACTIVO',
          },
          {
            id_tipo_factura: 7,
            version: 1,
            nombre: 'Comprobante de liquidación',
            codigo: '08',
            activo: 'INACTIVO',
          },
          {
            id_tipo_factura: 8,
            version: 1,
            nombre: 'Documento contable de liquidación',
            codigo: '09',
            activo: 'INACTIVO',
          },
          {
            id_tipo_factura: 9,
            version: 1,
            nombre: 'Facturas de exportación',
            codigo: '11',
          },
          {
            id_tipo_factura: 10,
            version: 1,
            nombre: 'Factura de sujeto excluido',
            codigo: '14',
          },
          {
            id_tipo_factura: 11,
            version: 1,
            nombre: 'Comprobante de donación ',
            codigo: '15',
            activo: 'INACTIVO',
          },
        ],
      });
      await this.prisma.generalData.create({
        data: {
          nombre_sistema: 'Sistema Administrativo',
          impuesto: 0.13,
          direccion: 'San Salvador',
          razon: 'Razon',
          nit: '123456789',
          nrc: '1234',
          contactos: '234567890',
          domain_email: 'mail.helixsys.dev',
          sender_email: 'facturacion-electronica@mail.helixsys.dev',
          token_email: 'token123',
          version_email: '2',
        },
      });
      await this.prisma.facturasBloques.createMany({
        data: [
          {
            tira: 'N/A',
            autorizacion: 'AU001',
            resolucion: 'RE001',
            desde: 1,
            hasta: 2000000,
            actual: 1,
            serie: 'DTE-11-ABCDEFGH-00000',
            fecha_creacion: new Date('2024-06-08T16:21:42.663Z'),
            id_tipo_factura: 9,
            id_sucursal: 1,
            estado: 'ACTIVO',
          },
          {
            tira: 'N/A',
            autorizacion: 'AU001',
            resolucion: 'RE001',
            desde: 1,
            hasta: 2000000,
            actual: 1,
            serie: 'DTE-14-ABCDEFGH-00000',
            id_tipo_factura: 10,
            id_sucursal: 1,
            estado: 'ACTIVO',
          },
          {
            tira: 'N/A',
            autorizacion: 'AU001',
            resolucion: 'RE001',
            desde: 1,
            hasta: 2000000,
            actual: 1,
            serie: 'DTE-05-ABCDEFGH-00000',
            id_tipo_factura: 4,
            id_sucursal: 1,
            estado: 'ACTIVO',
          },
          {
            tira: 'N/A',
            autorizacion: 'AU001',
            resolucion: 'RE001',
            desde: 1,
            hasta: 2000000,
            actual: 2,
            serie: 'DTE-01-M001P001-00000',
            id_tipo_factura: 1,
            id_sucursal: 1,
            estado: 'ACTIVO',
          },
          {
            tira: 'N/A',
            autorizacion: 'AU001',
            resolucion: 'RE001',
            desde: 1,
            hasta: 2000000,
            actual: 2,
            serie: 'DTE-03-M001P001-00000',
            id_tipo_factura: 2,
            id_sucursal: 1,
            estado: 'ACTIVO',
          },
        ],
      });
    } catch (error) {
      console.log(error);
    }
  }

  /**
   * Seed completo de permisos y políticas del sistema
   * Crea permisos para todos los módulos existentes y políticas comunes
   */
  async seedPermisosYPoliticas() {
    this.logger.log('🔐 Iniciando seed de permisos y políticas...');

    // ============= POLÍTICAS =============
    this.logger.log('📋 Creando políticas...');

    const politicas = await this.prisma.politicas.createMany({
      data: [
        {
          codigo: 'same_sucursal',
          nombre: 'Misma Sucursal',
          descripcion: 'Valida que el usuario y el recurso pertenezcan a la misma sucursal',
          tipo: 'SUCURSAL',
          handler: 'SameSucursalPolicy',
          configuracion: {
            campo_usuario: 'id_sucursal',
            campo_recurso: 'id_sucursal'
          }
        },
        {
          codigo: 'is_owner',
          nombre: 'Es Propietario',
          descripcion: 'Valida que el usuario sea el propietario/creador del recurso',
          tipo: 'PROPIETARIO',
          handler: 'IsOwnerPolicy',
          configuracion: {
            campo_usuario: 'id_usuario',
            campo_recurso: 'id_usuario'
          }
        },
        {
          codigo: 'ticket_not_closed',
          nombre: 'Ticket No Cerrado',
          descripcion: 'Valida que el ticket no esté cerrado o cancelado',
          tipo: 'ESTADO_RECURSO',
          handler: 'TicketNotClosedPolicy',
          configuracion: {
            estados_permitidos: ['ABIERTO', 'EN_DIAGNOSTICO', 'ESCALADO']
          }
        },
        {
          codigo: 'orden_not_completed',
          nombre: 'Orden No Completada',
          descripcion: 'Valida que la orden de trabajo no esté completada o cancelada',
          tipo: 'ESTADO_RECURSO',
          handler: 'OrdenNotCompletedPolicy',
          configuracion: {
            estados_bloqueados: ['COMPLETADA', 'CANCELADA']
          }
        },
        {
          codigo: 'requisicion_pendiente',
          nombre: 'Requisición Pendiente',
          descripcion: 'Valida que la requisición esté en estado PENDIENTE para poder autorizar',
          tipo: 'ESTADO_RECURSO',
          handler: 'RequisicionPendientePolicy',
          configuracion: {
            estados_permitidos: ['PENDIENTE']
          }
        },
        {
          codigo: 'ajuste_pendiente_autorizacion',
          nombre: 'Ajuste Pendiente de Autorización',
          descripcion: 'Valida que el ajuste esté pendiente de autorización',
          tipo: 'ESTADO_RECURSO',
          handler: 'AjustePendientePolicy',
          configuracion: {
            estados_permitidos: ['PENDIENTE_AUTORIZACION']
          }
        }
      ]
    });

    this.logger.log(`✅ ${politicas.count} políticas creadas`);

    // ============= PERMISOS =============
    this.logger.log('🔑 Creando permisos...');

    const permisosData = [
      // ============= MÓDULO: DASHBOARD =============
      { modulo: 'dashboard', recurso: 'ventas', accion: 'VER', nombre: 'Ver Dashboard de Ventas', descripcion: 'Acceso al dashboard principal de ventas' },
      { modulo: 'dashboard', recurso: 'inventario', accion: 'VER', nombre: 'Ver Dashboard de Inventario', descripcion: 'Acceso al dashboard de inventario' },
      { modulo: 'dashboard', recurso: 'atencion_cliente', accion: 'VER', nombre: 'Ver Dashboard de Atención', descripcion: 'Acceso al dashboard de atención al cliente' },
      { modulo: 'dashboard', recurso: 'metricas', accion: 'VER', nombre: 'Ver Métricas Globales', descripcion: 'Ver estadísticas y métricas del sistema' },

      // ============= MÓDULO: ADMINISTRACIÓN - USUARIOS =============
      { modulo: 'administracion', recurso: 'usuarios', accion: 'VER', nombre: 'Ver Usuarios', descripcion: 'Listar y ver detalles de usuarios' },
      { modulo: 'administracion', recurso: 'usuarios', accion: 'CREAR', nombre: 'Crear Usuarios', descripcion: 'Crear nuevos usuarios en el sistema' },
      { modulo: 'administracion', recurso: 'usuarios', accion: 'EDITAR', nombre: 'Editar Usuarios', descripcion: 'Modificar información de usuarios existentes' },
      { modulo: 'administracion', recurso: 'usuarios', accion: 'ELIMINAR', nombre: 'Eliminar Usuarios', descripcion: 'Eliminar usuarios del sistema', es_critico: true },
      { modulo: 'administracion', recurso: 'usuarios', accion: 'CUSTOM', nombre: 'Resetear Contraseña Usuario', descripcion: 'Resetear contraseña de otros usuarios', es_critico: true },
      { modulo: 'administracion', recurso: 'usuarios', accion: 'CUSTOM', nombre: 'Asignar Permisos a Usuario', descripcion: 'Asignar permisos individuales a usuarios' },

      // ============= MÓDULO: ADMINISTRACIÓN - ROLES =============
      { modulo: 'administracion', recurso: 'roles', accion: 'VER', nombre: 'Ver Roles', descripcion: 'Listar y ver detalles de roles' },
      { modulo: 'administracion', recurso: 'roles', accion: 'CREAR', nombre: 'Crear Roles', descripcion: 'Crear nuevos roles en el sistema' },
      { modulo: 'administracion', recurso: 'roles', accion: 'EDITAR', nombre: 'Editar Roles', descripcion: 'Modificar roles existentes' },
      { modulo: 'administracion', recurso: 'roles', accion: 'ELIMINAR', nombre: 'Eliminar Roles', descripcion: 'Eliminar roles del sistema', es_critico: true },
      { modulo: 'administracion', recurso: 'roles', accion: 'CUSTOM', nombre: 'Asignar Permisos a Rol', descripcion: 'Gestionar permisos de un rol' },

      // ============= MÓDULO: ADMINISTRACIÓN - PERMISOS =============
      { modulo: 'administracion', recurso: 'permisos', accion: 'VER', nombre: 'Ver Permisos', descripcion: 'Listar y ver detalles de permisos' },
      { modulo: 'administracion', recurso: 'permisos', accion: 'CREAR', nombre: 'Crear Permisos', descripcion: 'Crear nuevos permisos en el sistema', es_critico: true },
      { modulo: 'administracion', recurso: 'permisos', accion: 'EDITAR', nombre: 'Editar Permisos', descripcion: 'Modificar permisos existentes', es_critico: true },
      { modulo: 'administracion', recurso: 'permisos', accion: 'ELIMINAR', nombre: 'Eliminar Permisos', descripcion: 'Eliminar permisos del sistema', es_critico: true },

      // ============= MÓDULO: ADMINISTRACIÓN - POLÍTICAS =============
      { modulo: 'administracion', recurso: 'politicas', accion: 'VER', nombre: 'Ver Políticas', descripcion: 'Listar y ver detalles de políticas' },
      { modulo: 'administracion', recurso: 'politicas', accion: 'CREAR', nombre: 'Crear Políticas', descripcion: 'Crear nuevas políticas de autorización', es_critico: true },
      { modulo: 'administracion', recurso: 'politicas', accion: 'EDITAR', nombre: 'Editar Políticas', descripcion: 'Modificar políticas existentes', es_critico: true },
      { modulo: 'administracion', recurso: 'politicas', accion: 'ELIMINAR', nombre: 'Eliminar Políticas', descripcion: 'Eliminar políticas del sistema', es_critico: true },

      // ============= MÓDULO: ADMINISTRACIÓN - CATÁLOGO =============
      { modulo: 'administracion', recurso: 'catalogo', accion: 'VER', nombre: 'Ver Catálogo', descripcion: 'Ver productos del catálogo' },
      { modulo: 'administracion', recurso: 'catalogo', accion: 'CREAR', nombre: 'Crear Productos', descripcion: 'Agregar productos al catálogo' },
      { modulo: 'administracion', recurso: 'catalogo', accion: 'EDITAR', nombre: 'Editar Productos', descripcion: 'Modificar productos del catálogo' },
      { modulo: 'administracion', recurso: 'catalogo', accion: 'ELIMINAR', nombre: 'Eliminar Productos', descripcion: 'Eliminar productos del catálogo' },
      { modulo: 'administracion', recurso: 'catalogo', accion: 'EXPORTAR', nombre: 'Exportar Catálogo', descripcion: 'Exportar catálogo a Excel/CSV' },

      // ============= MÓDULO: ADMINISTRACIÓN - CATEGORÍAS =============
      { modulo: 'administracion', recurso: 'categorias', accion: 'VER', nombre: 'Ver Categorías', descripcion: 'Ver categorías de productos' },
      { modulo: 'administracion', recurso: 'categorias', accion: 'CREAR', nombre: 'Crear Categorías', descripcion: 'Crear nuevas categorías' },
      { modulo: 'administracion', recurso: 'categorias', accion: 'EDITAR', nombre: 'Editar Categorías', descripcion: 'Modificar categorías existentes' },
      { modulo: 'administracion', recurso: 'categorias', accion: 'ELIMINAR', nombre: 'Eliminar Categorías', descripcion: 'Eliminar categorías' },

      // ============= MÓDULO: ADMINISTRACIÓN - SUCURSALES =============
      { modulo: 'administracion', recurso: 'sucursales', accion: 'VER', nombre: 'Ver Sucursales', descripcion: 'Ver todas las sucursales' },
      { modulo: 'administracion', recurso: 'sucursales', accion: 'CREAR', nombre: 'Crear Sucursales', descripcion: 'Crear nuevas sucursales' },
      { modulo: 'administracion', recurso: 'sucursales', accion: 'EDITAR', nombre: 'Editar Sucursales', descripcion: 'Modificar sucursales' },
      { modulo: 'administracion', recurso: 'sucursales', accion: 'ELIMINAR', nombre: 'Eliminar Sucursales', descripcion: 'Eliminar sucursales' },

      // ============= MÓDULO: ATENCIÓN AL CLIENTE - CLIENTES =============
      { modulo: 'atencion_cliente', recurso: 'clientes', accion: 'VER', nombre: 'Ver Clientes', descripcion: 'Listar y ver detalles de clientes' },
      { modulo: 'atencion_cliente', recurso: 'clientes', accion: 'CREAR', nombre: 'Crear Clientes', descripcion: 'Registrar nuevos clientes' },
      { modulo: 'atencion_cliente', recurso: 'clientes', accion: 'EDITAR', nombre: 'Editar Clientes', descripcion: 'Modificar información de clientes' },
      { modulo: 'atencion_cliente', recurso: 'clientes', accion: 'ELIMINAR', nombre: 'Eliminar Clientes', descripcion: 'Eliminar clientes del sistema' },
      { modulo: 'atencion_cliente', recurso: 'clientes', accion: 'EXPORTAR', nombre: 'Exportar Clientes', descripcion: 'Exportar lista de clientes' },

      // ============= MÓDULO: ATENCIÓN AL CLIENTE - TICKETS =============
      { modulo: 'atencion_cliente', recurso: 'tickets', accion: 'VER', nombre: 'Ver Tickets', descripcion: 'Ver tickets de soporte' },
      { modulo: 'atencion_cliente', recurso: 'tickets', accion: 'CREAR', nombre: 'Crear Tickets', descripcion: 'Abrir nuevos tickets de soporte' },
      { modulo: 'atencion_cliente', recurso: 'tickets', accion: 'EDITAR', nombre: 'Editar Tickets', descripcion: 'Actualizar tickets de soporte' },
      { modulo: 'atencion_cliente', recurso: 'tickets', accion: 'CUSTOM', nombre: 'Cerrar Tickets', descripcion: 'Cerrar tickets resueltos' },
      { modulo: 'atencion_cliente', recurso: 'tickets', accion: 'CUSTOM', nombre: 'Escalar Tickets', descripcion: 'Escalar tickets a nivel superior' },
      { modulo: 'atencion_cliente', recurso: 'tickets', accion: 'CUSTOM', nombre: 'Reasignar Tickets', descripcion: 'Reasignar tickets a otros agentes' },

      // ============= MÓDULO: ATENCIÓN AL CLIENTE - ÓRDENES DE TRABAJO =============
      { modulo: 'atencion_cliente', recurso: 'ordenes_trabajo', accion: 'VER', nombre: 'Ver Órdenes de Trabajo', descripcion: 'Ver órdenes de trabajo' },
      { modulo: 'atencion_cliente', recurso: 'ordenes_trabajo', accion: 'CREAR', nombre: 'Crear Órdenes de Trabajo', descripcion: 'Generar nuevas órdenes de trabajo' },
      { modulo: 'atencion_cliente', recurso: 'ordenes_trabajo', accion: 'EDITAR', nombre: 'Editar Órdenes de Trabajo', descripcion: 'Modificar órdenes de trabajo' },
      { modulo: 'atencion_cliente', recurso: 'ordenes_trabajo', accion: 'CUSTOM', nombre: 'Asignar Técnico', descripcion: 'Asignar técnicos a órdenes de trabajo' },
      { modulo: 'atencion_cliente', recurso: 'ordenes_trabajo', accion: 'CUSTOM', nombre: 'Completar Orden', descripcion: 'Marcar orden como completada' },
      { modulo: 'atencion_cliente', recurso: 'ordenes_trabajo', accion: 'CUSTOM', nombre: 'Cancelar Orden', descripcion: 'Cancelar órdenes de trabajo' },
      { modulo: 'atencion_cliente', recurso: 'ordenes_trabajo', accion: 'CUSTOM', nombre: 'Cargar Evidencias', descripcion: 'Subir fotos y evidencias de trabajos' },
      { modulo: 'atencion_cliente', recurso: 'ordenes_trabajo', accion: 'IMPRIMIR', nombre: 'Imprimir Orden de Trabajo', descripcion: 'Generar PDF de orden de trabajo' },

      // ============= MÓDULO: INVENTARIO - BODEGAS =============
      { modulo: 'inventario', recurso: 'bodegas', accion: 'VER', nombre: 'Ver Bodegas', descripcion: 'Ver bodegas y cuadrillas' },
      { modulo: 'inventario', recurso: 'bodegas', accion: 'CREAR', nombre: 'Crear Bodegas', descripcion: 'Crear nuevas bodegas' },
      { modulo: 'inventario', recurso: 'bodegas', accion: 'EDITAR', nombre: 'Editar Bodegas', descripcion: 'Modificar bodegas existentes' },
      { modulo: 'inventario', recurso: 'bodegas', accion: 'ELIMINAR', nombre: 'Eliminar Bodegas', descripcion: 'Eliminar bodegas' },

      // ============= MÓDULO: INVENTARIO - COMPRAS =============
      { modulo: 'inventario', recurso: 'compras', accion: 'VER', nombre: 'Ver Compras', descripcion: 'Ver órdenes de compra' },
      { modulo: 'inventario', recurso: 'compras', accion: 'CREAR', nombre: 'Crear Compras', descripcion: 'Crear órdenes de compra' },
      { modulo: 'inventario', recurso: 'compras', accion: 'EDITAR', nombre: 'Editar Compras', descripcion: 'Modificar órdenes de compra' },
      { modulo: 'inventario', recurso: 'compras', accion: 'ELIMINAR', nombre: 'Eliminar Compras', descripcion: 'Eliminar órdenes de compra' },
      { modulo: 'inventario', recurso: 'compras', accion: 'CUSTOM', nombre: 'Recepcionar Compra', descripcion: 'Marcar compra como recepcionada e ingresar a inventario' },
      { modulo: 'inventario', recurso: 'compras', accion: 'IMPRIMIR', nombre: 'Imprimir Compra', descripcion: 'Generar PDF de orden de compra' },
      { modulo: 'inventario', recurso: 'compras', accion: 'EXPORTAR', nombre: 'Exportar Compras', descripcion: 'Exportar reporte de compras' },

      // ============= MÓDULO: INVENTARIO - IMPORTACIONES =============
      { modulo: 'inventario', recurso: 'importaciones', accion: 'VER', nombre: 'Ver Importaciones', descripcion: 'Ver importaciones internacionales' },
      { modulo: 'inventario', recurso: 'importaciones', accion: 'CREAR', nombre: 'Crear Importaciones', descripcion: 'Crear órdenes de importación' },
      { modulo: 'inventario', recurso: 'importaciones', accion: 'EDITAR', nombre: 'Editar Importaciones', descripcion: 'Modificar importaciones' },
      { modulo: 'inventario', recurso: 'importaciones', accion: 'ELIMINAR', nombre: 'Eliminar Importaciones', descripcion: 'Eliminar importaciones' },
      { modulo: 'inventario', recurso: 'importaciones', accion: 'CUSTOM', nombre: 'Gestionar Gastos de Importación', descripcion: 'Registrar gastos adicionales de importación' },
      { modulo: 'inventario', recurso: 'importaciones', accion: 'CUSTOM', nombre: 'Calcular Retaceo', descripcion: 'Ejecutar cálculo de retaceo de costos' },
      { modulo: 'inventario', recurso: 'importaciones', accion: 'CUSTOM', nombre: 'Recepcionar Importación', descripcion: 'Marcar importación como recibida' },

      // ============= MÓDULO: INVENTARIO - REQUISICIONES =============
      { modulo: 'inventario', recurso: 'requisiciones', accion: 'VER', nombre: 'Ver Requisiciones', descripcion: 'Ver requisiciones de inventario' },
      { modulo: 'inventario', recurso: 'requisiciones', accion: 'CREAR', nombre: 'Crear Requisiciones', descripcion: 'Crear solicitudes de transferencia' },
      { modulo: 'inventario', recurso: 'requisiciones', accion: 'EDITAR', nombre: 'Editar Requisiciones', descripcion: 'Modificar requisiciones pendientes' },
      { modulo: 'inventario', recurso: 'requisiciones', accion: 'ELIMINAR', nombre: 'Eliminar Requisiciones', descripcion: 'Eliminar requisiciones' },
      { modulo: 'inventario', recurso: 'requisiciones', accion: 'APROBAR', nombre: 'Aprobar Requisiciones', descripcion: 'Autorizar requisiciones de inventario', es_critico: true },
      { modulo: 'inventario', recurso: 'requisiciones', accion: 'RECHAZAR', nombre: 'Rechazar Requisiciones', descripcion: 'Rechazar requisiciones de inventario' },
      { modulo: 'inventario', recurso: 'requisiciones', accion: 'CUSTOM', nombre: 'Procesar Requisiciones', descripcion: 'Ejecutar transferencia de inventario' },

      // ============= MÓDULO: INVENTARIO - ÓRDENES DE SALIDA =============
      { modulo: 'inventario', recurso: 'ordenes_salida', accion: 'VER', nombre: 'Ver Órdenes de Salida', descripcion: 'Ver salidas formales de inventario' },
      { modulo: 'inventario', recurso: 'ordenes_salida', accion: 'CREAR', nombre: 'Crear Órdenes de Salida', descripcion: 'Crear órdenes de salida' },
      { modulo: 'inventario', recurso: 'ordenes_salida', accion: 'EDITAR', nombre: 'Editar Órdenes de Salida', descripcion: 'Modificar órdenes de salida' },
      { modulo: 'inventario', recurso: 'ordenes_salida', accion: 'ELIMINAR', nombre: 'Eliminar Órdenes de Salida', descripcion: 'Eliminar órdenes de salida' },
      { modulo: 'inventario', recurso: 'ordenes_salida', accion: 'APROBAR', nombre: 'Aprobar Órdenes de Salida', descripcion: 'Autorizar salidas de inventario', es_critico: true },
      { modulo: 'inventario', recurso: 'ordenes_salida', accion: 'RECHAZAR', nombre: 'Rechazar Órdenes de Salida', descripcion: 'Rechazar salidas de inventario' },
      { modulo: 'inventario', recurso: 'ordenes_salida', accion: 'CUSTOM', nombre: 'Procesar Órdenes de Salida', descripcion: 'Ejecutar salida física de inventario' },

      // ============= MÓDULO: INVENTARIO - AUDITORÍAS =============
      { modulo: 'inventario', recurso: 'auditorias', accion: 'VER', nombre: 'Ver Auditorías', descripcion: 'Ver auditorías de inventario' },
      { modulo: 'inventario', recurso: 'auditorias', accion: 'CREAR', nombre: 'Crear Auditorías', descripcion: 'Planificar nuevas auditorías' },
      { modulo: 'inventario', recurso: 'auditorias', accion: 'EDITAR', nombre: 'Editar Auditorías', descripcion: 'Modificar auditorías planificadas' },
      { modulo: 'inventario', recurso: 'auditorias', accion: 'CUSTOM', nombre: 'Ejecutar Auditorías', descripcion: 'Realizar conteos físicos de inventario' },
      { modulo: 'inventario', recurso: 'auditorias', accion: 'CUSTOM', nombre: 'Finalizar Auditorías', descripcion: 'Completar y cerrar auditorías' },
      { modulo: 'inventario', recurso: 'auditorias', accion: 'EXPORTAR', nombre: 'Exportar Auditorías', descripcion: 'Exportar reportes de auditorías' },

      // ============= MÓDULO: INVENTARIO - AJUSTES =============
      { modulo: 'inventario', recurso: 'ajustes', accion: 'VER', nombre: 'Ver Ajustes', descripcion: 'Ver ajustes de inventario' },
      { modulo: 'inventario', recurso: 'ajustes', accion: 'CREAR', nombre: 'Crear Ajustes', descripcion: 'Solicitar ajustes de inventario' },
      { modulo: 'inventario', recurso: 'ajustes', accion: 'EDITAR', nombre: 'Editar Ajustes', descripcion: 'Modificar ajustes pendientes' },
      { modulo: 'inventario', recurso: 'ajustes', accion: 'ELIMINAR', nombre: 'Eliminar Ajustes', descripcion: 'Eliminar ajustes no autorizados' },
      { modulo: 'inventario', recurso: 'ajustes', accion: 'APROBAR', nombre: 'Aprobar Ajustes', descripcion: 'Autorizar ajustes de inventario', es_critico: true, requiere_auditoria: true },
      { modulo: 'inventario', recurso: 'ajustes', accion: 'RECHAZAR', nombre: 'Rechazar Ajustes', descripcion: 'Rechazar ajustes de inventario', requiere_auditoria: true },

      // ============= MÓDULO: INVENTARIO - MOVIMIENTOS =============
      { modulo: 'inventario', recurso: 'movimientos', accion: 'VER', nombre: 'Ver Movimientos', descripcion: 'Ver historial de movimientos de inventario' },
      { modulo: 'inventario', recurso: 'movimientos', accion: 'EXPORTAR', nombre: 'Exportar Movimientos', descripcion: 'Exportar reporte de movimientos' },

      // ============= MÓDULO: INVENTARIO - SERIES =============
      { modulo: 'inventario', recurso: 'series', accion: 'VER', nombre: 'Ver Series', descripcion: 'Ver equipos con número de serie' },
      { modulo: 'inventario', recurso: 'series', accion: 'CUSTOM', nombre: 'Rastrear Serie', descripcion: 'Ver historial completo de una serie' },

      // ============= MÓDULO: PROVEEDORES =============
      { modulo: 'administracion', recurso: 'proveedores', accion: 'VER', nombre: 'Ver Proveedores', descripcion: 'Ver proveedores' },
      { modulo: 'administracion', recurso: 'proveedores', accion: 'CREAR', nombre: 'Crear Proveedores', descripcion: 'Registrar nuevos proveedores' },
      { modulo: 'administracion', recurso: 'proveedores', accion: 'EDITAR', nombre: 'Editar Proveedores', descripcion: 'Modificar proveedores' },
      { modulo: 'administracion', recurso: 'proveedores', accion: 'ELIMINAR', nombre: 'Eliminar Proveedores', descripcion: 'Eliminar proveedores' },

      // ============= MÓDULO: REPORTES =============
      { modulo: 'reportes', recurso: 'inventario', accion: 'VER', nombre: 'Ver Reportes de Inventario', descripcion: 'Acceso a reportes de inventario' },
      { modulo: 'reportes', recurso: 'ventas', accion: 'VER', nombre: 'Ver Reportes de Ventas', descripcion: 'Acceso a reportes de ventas' },
      { modulo: 'reportes', recurso: 'clientes', accion: 'VER', nombre: 'Ver Reportes de Clientes', descripcion: 'Acceso a reportes de clientes' },
      { modulo: 'reportes', recurso: 'financieros', accion: 'VER', nombre: 'Ver Reportes Financieros', descripcion: 'Acceso a reportes financieros', es_critico: true },
    ];

    // Crear permisos con código generado
    for (const permiso of permisosData) {
      const codigo = `${permiso.modulo}.${permiso.recurso}:${permiso.accion.toLowerCase()}`;

      await this.prisma.permisos.create({
        data: {
          codigo,
          nombre: permiso.nombre,
          descripcion: permiso.descripcion,
          modulo: permiso.modulo,
          recurso: permiso.recurso,
          accion: permiso.accion as any, // Type cast para enum
          tipo: 'RECURSO',
          es_critico: permiso.es_critico || false,
          requiere_auditoria: permiso.requiere_auditoria || false,
        }
      });
    }

    this.logger.log(`✅ ${permisosData.length} permisos creados`);

    // ============= ASIGNAR PERMISOS AL ROL ADMIN =============
    this.logger.log('🔗 Asignando todos los permisos al rol Admin...');

    const adminRole = await this.prisma.roles.findFirst({ where: { nombre: 'Admin' } });
    const todosLosPermisos = await this.prisma.permisos.findMany({ where: { estado: 'ACTIVO' } });

    if (adminRole) {
      const asignaciones = todosLosPermisos.map(permiso => ({
        id_rol: adminRole.id_rol,
        id_permiso: permiso.id_permiso
      }));

      await this.prisma.rol_permisos.createMany({ data: asignaciones });
      this.logger.log(`✅ ${asignaciones.length} permisos asignados al rol Admin`);
    }

    // ============= ASIGNAR PERMISOS A OTROS ROLES =============
    // ROL: Facturación (solo ver dashboards y clientes)
    const facturacionRole = await this.prisma.roles.findFirst({ where: { nombre: 'Facturacion' } });
    if (facturacionRole) {
      const permisosFacturacion = await this.prisma.permisos.findMany({
        where: {
          OR: [
            { codigo: { startsWith: 'dashboard.' } },
            { codigo: { startsWith: 'atencion_cliente.clientes' } },
            { codigo: { startsWith: 'reportes.ventas' } },
          ]
        }
      });

      await this.prisma.rol_permisos.createMany({
        data: permisosFacturacion.map(p => ({ id_rol: facturacionRole.id_rol, id_permiso: p.id_permiso }))
      });
    }

    // ROL: Inventario (todos los permisos de inventario + ver catálogo)
    const inventarioRole = await this.prisma.roles.findFirst({ where: { nombre: 'Inventario' } });
    if (inventarioRole) {
      const permisosInventario = await this.prisma.permisos.findMany({
        where: {
          OR: [
            { modulo: 'inventario' },
            { codigo: { startsWith: 'dashboard.inventario' } },
            { codigo: { startsWith: 'administracion.catalogo' } },
            { codigo: { startsWith: 'administracion.categorias' } },
            { codigo: { startsWith: 'administracion.proveedores' } },
          ]
        }
      });

      await this.prisma.rol_permisos.createMany({
        data: permisosInventario.map(p => ({ id_rol: inventarioRole.id_rol, id_permiso: p.id_permiso }))
      });
    }

    // ROL: Atención al Cliente (clientes, tickets, órdenes)
    const atencionRole = await this.prisma.roles.findFirst({ where: { nombre: 'Atencion Cliente' } });
    if (atencionRole) {
      const permisosAtencion = await this.prisma.permisos.findMany({
        where: {
          OR: [
            { modulo: 'atencion_cliente' },
            { codigo: { startsWith: 'dashboard.atencion_cliente' } },
          ]
        }
      });

      await this.prisma.rol_permisos.createMany({
        data: permisosAtencion.map(p => ({ id_rol: atencionRole.id_rol, id_permiso: p.id_permiso }))
      });
    }

    // ROL: Técnico (solo ver y completar sus órdenes de trabajo)
    const tecnicoRole = await this.prisma.roles.findFirst({ where: { nombre: 'Tecnico' } });
    if (tecnicoRole) {
      const permisosTecnico = await this.prisma.permisos.findMany({
        where: {
          OR: [
            { codigo: 'atencion_cliente.ordenes_trabajo:ver' },
            { codigo: 'atencion_cliente.ordenes_trabajo:editar' },
            { codigo: 'atencion_cliente.ordenes_trabajo:custom' }, // Completar, cargar evidencias
            { codigo: 'atencion_cliente.clientes:ver' },
            { codigo: 'inventario.series:ver' },
          ]
        }
      });

      await this.prisma.rol_permisos.createMany({
        data: permisosTecnico.map(p => ({ id_rol: tecnicoRole.id_rol, id_permiso: p.id_permiso }))
      });
    }

    this.logger.log('✅ Permisos asignados a roles predefinidos');
    this.logger.log('🎉 Seed de permisos y políticas completado exitosamente');
  }


}
