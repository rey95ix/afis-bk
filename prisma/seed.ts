import { PrismaClient } from '@prisma/client';
import { runAllSeeds } from './seeds';

const prisma = new PrismaClient();

/**
 * Entry point principal de Prisma Seed
 *
 * Este archivo se ejecuta automaticamente con:
 * - npx prisma db seed
 * - npm run seed
 *
 * Tambien se ejecuta automaticamente despues de:
 * - npx prisma migrate dev
 * - npx prisma migrate reset
 */
async function main() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║           AFIS - Prisma Database Seed              ║');
  console.log('╚════════════════════════════════════════════════════╝');
  console.log('\n');

  try {
    await runAllSeeds();
  } catch (error) {
    console.error('❌ Error durante el seeding:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
