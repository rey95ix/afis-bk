import { seedPermisos, mostrarEstadisticasPermisos } from './permisos';

/**
 * Orquestador de seeds
 * Permite ejecutar seeds individuales o todos juntos
 *
 * Uso:
 * - npm run seed (ejecuta todos los seeds)
 * - npm run seed:permisos (solo permisos)
 */
export async function runAllSeeds(): Promise<void> {
  console.log('🌱 Iniciando proceso de seeding...\n');
  console.log('='.repeat(50));

  // Seed de permisos
  await seedPermisos();

  // Mostrar estadisticas
  await mostrarEstadisticasPermisos();

  console.log('='.repeat(50));
  console.log('\n✨ Todos los seeds completados\n');
}

// Re-exportar seeds individuales
export { seedPermisos, mostrarEstadisticasPermisos };
