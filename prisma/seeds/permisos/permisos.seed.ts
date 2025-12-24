import { PrismaClient } from '@prisma/client';
import { PERMISOS_MAESTROS, getPermisosPorPatron } from './permisos.data';
import { ROL_IDS, ROLES_PREDEFINIDOS } from './permisos.types';

const prisma = new PrismaClient();

/**
 * Configuracion de permisos por rol
 * Define que permisos recibe cada rol automaticamente usando patrones
 *
 * Patrones soportados:
 * - '*' = Todos los permisos
 * - 'modulo.*' = Todos los permisos del modulo
 * - 'modulo.recurso:*' = Todas las acciones del recurso
 * - 'modulo.recurso:accion' = Permiso especifico
 */
const PERMISOS_POR_ROL: Record<number, string[]> = {
  // Admin: Todos los permisos
  [ROL_IDS.ADMIN]: ['*'],

  // Facturacion: Dashboard, clientes (ver), reportes de ventas
  [ROL_IDS.FACTURACION]: [
    'dashboard.*',
    'atencion_cliente.clientes:ver',
    'atencion_cliente.clientes:gestionar_facturacion',
  ],

  // Inventario: Todo el modulo inventario + catalogos
  [ROL_IDS.INVENTARIO]: [
    'dashboard.inventario:*',
    'inventario.*',
    'administracion.catalogo:*',
    'administracion.categorias:*',
  ],

  // Atencion Cliente: Clientes, tickets, ordenes, agenda
  [ROL_IDS.ATENCION_CLIENTE]: [
    'dashboard.atencion_cliente:*',
    'atencion_cliente.*',
    'sms.*',
  ],

  // Tecnico: Solo ver/ejecutar ordenes de trabajo y ver clientes
  [ROL_IDS.TECNICO]: [
    'atencion_cliente.ordenes:ver',
    'atencion_cliente.ordenes:ejecutar',
    'atencion_cliente.ordenes:gestionar_evidencias',
    'atencion_cliente.clientes:ver',
    'atencion_cliente.agenda:ver',
    'inventario.series:ver',
  ],
};

/**
 * Resuelve patrones de permisos a codigos concretos
 */
function resolverPatrones(patrones: string[]): string[] {
  const codigosResueltos = new Set<string>();

  for (const patron of patrones) {
    if (patron === '*') {
      // Todos los permisos
      PERMISOS_MAESTROS.forEach((p) => codigosResueltos.add(p.codigo));
    } else if (patron.includes('*')) {
      // Patron con wildcard
      getPermisosPorPatron(patron).forEach((p) => codigosResueltos.add(p.codigo));
    } else {
      // Codigo exacto
      codigosResueltos.add(patron);
    }
  }

  return Array.from(codigosResueltos);
}

/**
 * Seed de roles del sistema
 * Crea los roles predefinidos si no existen
 */
export async function seedRoles(): Promise<void> {
  console.log('👥 Verificando roles del sistema...\n');

  let rolesCreados = 0;

  for (const rol of ROLES_PREDEFINIDOS) {
    const resultado = await prisma.roles.upsert({
      where: { id_rol: rol.id_rol },
      update: {}, // No actualizar si existe
      create: {
        id_rol: rol.id_rol,
        nombre: rol.nombre,
        descripcion: rol.descripcion,
        estado: 'ACTIVO',
      },
    });

    // Verificar si fue creado (comparando fecha_creacion con ahora)
    const ahora = new Date();
    const diferencia = ahora.getTime() - resultado.fecha_creacion.getTime();
    if (diferencia < 5000) {
      // Creado en los ultimos 5 segundos
      rolesCreados++;
    }
  }

  if (rolesCreados > 0) {
    console.log(`   ✅ ${rolesCreados} roles nuevos creados`);
  }
  console.log(`   📊 Total de roles en sistema: ${ROLES_PREDEFINIDOS.length}\n`);
}

/**
 * Seed principal de permisos
 * - Inserta permisos nuevos (skipDuplicates)
 * - Asigna permisos nuevos a roles segun configuracion
 */
export async function seedPermisos(): Promise<void> {
  console.log('🔐 Iniciando seed de permisos...\n');

  // =============================================================
  // PASO 1: Insertar permisos nuevos (skipDuplicates)
  // =============================================================
  console.log('📝 Insertando permisos...');

  const permisosData = PERMISOS_MAESTROS.map((permiso) => ({
    codigo: permiso.codigo,
    nombre: permiso.nombre,
    descripcion: permiso.descripcion,
    modulo: permiso.modulo,
    recurso: permiso.recurso,
    accion: permiso.accion,
    tipo: permiso.tipo,
    estado: permiso.estado,
    es_critico: permiso.es_critico,
    requiere_auditoria: permiso.requiere_auditoria,
  }));

  const resultadoPermisos = await prisma.permisos.createMany({
    data: permisosData,
    skipDuplicates: true,
  });

  console.log(`   ✅ ${resultadoPermisos.count} permisos nuevos insertados`);

  // =============================================================
  // PASO 2: Obtener todos los permisos actuales de la BD
  // =============================================================
  const permisosEnBD = await prisma.permisos.findMany({
    where: { estado: 'ACTIVO' },
    select: { id_permiso: true, codigo: true },
  });

  const mapaPermisos = new Map(permisosEnBD.map((p) => [p.codigo, p.id_permiso]));
  console.log(`\n📊 Total de permisos activos en BD: ${permisosEnBD.length}`);

  // =============================================================
  // PASO 3: Obtener roles existentes en la BD
  // =============================================================
  const rolesExistentes = await prisma.roles.findMany({
    select: { id_rol: true, nombre: true },
  });
  const mapaRoles = new Map(rolesExistentes.map((r) => [r.id_rol, r.nombre]));
  const idsRolesExistentes = new Set(rolesExistentes.map((r) => r.id_rol));

  // =============================================================
  // PASO 4: Asignar permisos a roles
  // =============================================================
  console.log('\n🔗 Asignando permisos a roles...');

  for (const [idRol, patrones] of Object.entries(PERMISOS_POR_ROL)) {
    const rolId = parseInt(idRol);

    // Verificar que el rol existe en la BD
    if (!idsRolesExistentes.has(rolId)) {
      console.log(`   ⚠️  Rol ${rolId}: No existe en la BD, saltando...`);
      continue;
    }

    const codigosPermiso = resolverPatrones(patrones);

    // Obtener permisos ya asignados a este rol
    const permisosExistentes = await prisma.rol_permisos.findMany({
      where: { id_rol: rolId },
      select: { id_permiso: true },
    });
    const idsExistentes = new Set(permisosExistentes.map((p) => p.id_permiso));

    // Filtrar solo permisos nuevos que aun no estan asignados
    const nuevasAsignaciones: { id_rol: number; id_permiso: number }[] = [];
    const codigosInvalidos: string[] = [];

    for (const codigo of codigosPermiso) {
      const idPermiso = mapaPermisos.get(codigo);
      if (!idPermiso) {
        // El codigo no existe en la BD - puede ser typo o permiso no definido
        codigosInvalidos.push(codigo);
        continue;
      }
      if (!idsExistentes.has(idPermiso)) {
        nuevasAsignaciones.push({
          id_rol: rolId,
          id_permiso: idPermiso,
        });
      }
    }

    const nombreRol = mapaRoles.get(rolId) || `Rol ${rolId}`;

    // Advertir sobre codigos invalidos
    if (codigosInvalidos.length > 0) {
      console.log(`   ⚠️  ${nombreRol}: ${codigosInvalidos.length} codigos no encontrados en BD`);
    }

    if (nuevasAsignaciones.length > 0) {
      await prisma.rol_permisos.createMany({
        data: nuevasAsignaciones,
        skipDuplicates: true,
      });
      console.log(`   ✅ ${nombreRol}: ${nuevasAsignaciones.length} permisos nuevos asignados`);
    } else {
      console.log(`   ⏭️  ${nombreRol}: Sin permisos nuevos que asignar`);
    }
  }

  console.log('\n🎉 Seed de permisos completado exitosamente\n');
}

/**
 * Funcion para mostrar estadisticas de permisos
 */
export async function mostrarEstadisticasPermisos(): Promise<void> {
  const totalPermisos = await prisma.permisos.count();
  const permisosPorModulo = await prisma.permisos.groupBy({
    by: ['modulo'],
    _count: true,
    orderBy: { _count: { modulo: 'desc' } },
  });

  const asignacionesPorRol = await prisma.rol_permisos.groupBy({
    by: ['id_rol'],
    _count: true,
  });

  // Obtener nombres de roles
  const roles = await prisma.roles.findMany({
    select: { id_rol: true, nombre: true },
  });
  const mapaRoles = new Map(roles.map((r) => [r.id_rol, r.nombre]));

  console.log('📊 Estadisticas de Permisos:');
  console.log(`   Total de permisos: ${totalPermisos}`);
  console.log('\n   Por modulo:');
  permisosPorModulo.forEach((m) => {
    console.log(`   - ${m.modulo}: ${m._count}`);
  });

  console.log('\n   Asignaciones por rol:');
  asignacionesPorRol.forEach((r) => {
    const nombreRol = mapaRoles.get(r.id_rol) || `Rol ${r.id_rol}`;
    console.log(`   - ${nombreRol}: ${r._count} permisos`);
  });
}

/**
 * Ejecutar seed como script independiente
 */
async function main() {
  try {
    await seedRoles();
    await seedPermisos();
    await mostrarEstadisticasPermisos();
  } catch (error) {
    console.error('❌ Error durante el seed de permisos:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si es llamado directamente
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
